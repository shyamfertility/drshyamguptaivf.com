// Patient login for drshyamguptaivf.com.
//
// Sign-in is by a one-time code sent to the patient's email (or Google).
// Everything after that goes through four database functions that only ever
// touch the signed-in patient's own row: my_profile, save_profile,
// delete_profile and my_updates. There is no table the browser can read.
import { createClient } from "https://cdn.jsdelivr.net/npm/@neon/neon-js@0.10.2/+esm";

const AUTH = "https://ep-orange-frost-azh48mao.neonauth.c-3.ap-southeast-1.aws.neon.tech/neondb/auth";
const DATA = "https://ep-orange-frost-azh48mao.apirest.c-3.ap-southeast-1.aws.neon.tech/neondb/rest/v1";
const client = createClient({ auth: { url: AUTH }, dataApi: { url: DATA } });

const CONSENT_VERSION = "2026-11-03";
const CONCERNS = {
  trying: "Trying to conceive for over a year",
  considering_ivf: "Considering IVF",
  ivf_failed: "IVF has failed before",
  miscarriage: "Repeated miscarriages",
  low_amh: "Low AMH",
  male_factor: "Abnormal semen report",
  second_opinion: "Second opinion on my reports",
  travelling: "Travelling from Nepal, Bangladesh or abroad",
  not_sure: "Not sure yet",
};

const $ = (id) => document.getElementById(id);
const views = ["acc-loading", "acc-signin", "acc-code", "acc-profile", "acc-home"];
function show(id) { views.forEach((v) => { $(v).hidden = v !== id; }); window.scrollTo({ top: 0 }); }
function say(el, msg, kind) { el.textContent = msg || ""; el.dataset.kind = kind || ""; el.hidden = !msg; }
function busy(btn, on, label) {
  if (on) { btn.dataset.label = btn.textContent; btn.textContent = label || "Please wait"; btn.disabled = true; }
  else { btn.textContent = btn.dataset.label || btn.textContent; btn.disabled = false; }
}
function track(n, x) { if (window.dsgTrack) window.dsgTrack(n, x); }
function errText(error) {
  const m = (error && (error.message || error.code || "")) + "";
  if (/TOO_MANY|rate/i.test(m)) return "Too many attempts. Wait a few minutes and request a new code.";
  if (/invalid|expired|otp/i.test(m)) return "That code did not match or has expired. Request a new one.";
  if (/network|fetch/i.test(m)) return "Could not reach the server. Check your connection and try again.";
  return "Something went wrong. Please try again, or message the clinic on WhatsApp.";
}

let email = "";
let profile = null;

// ---------------------------------------------------------------- sign in
$("acc-email-form").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const btn = ev.submitter || $("acc-email-btn");
  email = $("acc-email").value.trim().toLowerCase();
  say($("acc-email-msg"));
  busy(btn, true, "Sending code");
  const { error } = await client.auth.emailOtp.sendVerificationOtp({ email, type: "sign-in" });
  busy(btn, false);
  if (error) return say($("acc-email-msg"), errText(error), "err");
  $("acc-code-to").textContent = email;
  show("acc-code");
  $("acc-otp").focus();
});

$("acc-code-form").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const btn = ev.submitter || $("acc-code-btn");
  say($("acc-code-msg"));
  busy(btn, true, "Checking");
  const { error } = await client.auth.signIn.emailOtp({ email, otp: $("acc-otp").value.replace(/\D/g, "") });
  busy(btn, false);
  if (error) return say($("acc-code-msg"), errText(error), "err");
  track("login", "email");
  await route();
});

$("acc-resend").addEventListener("click", async () => {
  const { error } = await client.auth.emailOtp.sendVerificationOtp({ email, type: "sign-in" });
  say($("acc-code-msg"), error ? errText(error) : "A new code is on its way.", error ? "err" : "ok");
});
$("acc-change-email").addEventListener("click", () => show("acc-signin"));

$("acc-google").addEventListener("click", async () => {
  track("login", "google");
  const { error } = await client.auth.signIn.social({ provider: "google", callbackURL: location.origin + "/account/" });
  if (error) say($("acc-email-msg"), errText(error), "err");
});

// ---------------------------------------------------------------- profile
function fillForm(p) {
  const f = $("acc-profile-form");
  f.full_name.value = p?.full_name || "";
  f.whatsapp.value = p?.whatsapp || "";
  f.concern.value = p?.concern || "";
  f.language.value = p?.language || "English";
  f.city.value = p?.city || "";
  f.note.value = p?.note || "";
  f.consent_updates.checked = !!p?.consent_updates;
  f.consent_whatsapp.checked = !!p?.consent_whatsapp;
  $("acc-profile-title").textContent = p ? "Your details" : "Tell us a little about you";
  $("acc-profile-cancel").hidden = !p;
}

$("acc-profile-form").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const f = ev.target, btn = ev.submitter || $("acc-save-btn");
  const wa = f.whatsapp.value.trim();
  if (f.consent_whatsapp.checked && !wa) {
    return say($("acc-profile-msg"), "Add a WhatsApp number, or untick WhatsApp messages.", "err");
  }
  if (wa && !/^\+?[0-9][0-9 ]{7,17}$/.test(wa)) {
    return say($("acc-profile-msg"), "Enter the WhatsApp number with country code, for example +91 98765 43210.", "err");
  }
  say($("acc-profile-msg"));
  busy(btn, true, "Saving");
  const isNew = !profile;
  const { data, error } = await client.rpc("save_profile", { f: {
    full_name: f.full_name.value.trim(), whatsapp: wa, concern: f.concern.value,
    language: f.language.value, city: f.city.value.trim(), note: f.note.value.trim(),
    consent_updates: f.consent_updates.checked, consent_whatsapp: f.consent_whatsapp.checked,
    consent_version: CONSENT_VERSION,
  } });
  busy(btn, false);
  if (error) return say($("acc-profile-msg"), errText(error), "err");
  profile = data;
  if (isNew) track("signup", profile.concern);
  renderHome("Saved.");
});
$("acc-profile-cancel").addEventListener("click", () => renderHome());

// ---------------------------------------------------------------- home
async function renderHome(flash) {
  const p = profile;
  $("acc-hello").textContent = "Hello, " + (p.full_name.split(" ")[0] || "there");
  $("acc-sum-concern").textContent = CONCERNS[p.concern] || p.concern;
  $("acc-sum-lang").textContent = p.language;
  $("acc-sum-wa").textContent = p.whatsapp || "Not added";
  $("acc-sum-updates").textContent = p.consent_updates ? "Yes" : "No";
  $("acc-sum-whatsapp").textContent = p.consent_whatsapp ? "Yes" : "No";
  say($("acc-home-msg"), flash || "", "ok");

  const msg = "Hello Dr Gupta's clinic, I am " + p.full_name + ". " + (CONCERNS[p.concern] || "") + ".";
  $("acc-wa-link").href = "https://wa.me/919899984791?text=" + encodeURIComponent(msg);
  show("acc-home");

  const list = $("acc-updates");
  list.textContent = "Loading updates...";
  const { data, error } = await client.rpc("my_updates");
  list.textContent = "";
  if (error) { list.textContent = "Updates could not be loaded just now."; return; }
  if (!data || !data.length) { list.textContent = "No updates yet. New articles and clinic news will appear here."; return; }
  data.forEach((u) => {
    const art = document.createElement("article");
    art.className = "acc-update";
    const h = document.createElement("h3"); h.textContent = u.title;
    const d = document.createElement("p"); d.className = "acc-date";
    d.textContent = new Date(u.published_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
    const b = document.createElement("div"); b.className = "acc-body";
    String(u.body).split(/\n{2,}/).forEach((para) => { const x = document.createElement("p"); x.textContent = para; b.appendChild(x); });
    art.append(h, d, b);
    list.appendChild(art);
  });
}

$("acc-edit").addEventListener("click", () => { fillForm(profile); show("acc-profile"); });
$("acc-signout").addEventListener("click", async () => { await client.auth.signOut(); profile = null; show("acc-signin"); });

$("acc-delete").addEventListener("click", async () => {
  const ok = confirm("Delete your details from this website? Your name, WhatsApp number, concern and choices will be removed. This cannot be undone.");
  if (!ok) return;
  const { error } = await client.rpc("delete_profile");
  if (error) return say($("acc-home-msg"), errText(error), "err");
  await client.auth.signOut();
  profile = null;
  show("acc-signin");
  say($("acc-email-msg"), "Your details have been deleted. To remove your login email as well, message the clinic and it will be erased.", "ok");
});

// ---------------------------------------------------------------- start
async function route() {
  const { data } = await client.auth.getSession();
  if (!data || !data.session) return show("acc-signin");
  $("acc-signed-as").textContent = data.user?.email || "";
  const r = await client.rpc("my_profile");
  profile = r.data || null;
  if (!profile) { fillForm(null); show("acc-profile"); }
  else renderHome();
}

route().catch(() => show("acc-signin"));

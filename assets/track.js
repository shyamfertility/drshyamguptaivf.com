/* Page statistics for drshyamguptaivf.com - no cookies, no IP stored.
 *
 * Sends three kinds of record to the site's own collector on Neon:
 *   view   - a page was opened (path, referring site, device class, language)
 *   event  - a known button was used (WhatsApp, call, assistant, booking, ...)
 *   vital  - Core Web Vitals from this visitor's real browser
 *
 * A visit is identified by a random id kept in sessionStorage, which dies with
 * the tab. Nothing recognises a returning visitor, and nothing is sent at all
 * when the browser asks not to be tracked (Global Privacy Control or DNT).
 */
(function () {
  "use strict";
  var URL_ = "https://br-wandering-surf-azaq9p4j-collect.compute.c-3.ap-southeast-1.aws.neon.tech/";
  if (!/(^|\.)drshyamguptaivf\.com$/.test(location.hostname)) return;   // never from previews or copies
  if (navigator.globalPrivacyControl || navigator.doNotTrack === "1" || window.doNotTrack === "1") return;

  var sid;
  try {
    sid = sessionStorage.getItem("dsg_sid");
    if (!sid) { sid = Math.random().toString(36).slice(2, 12); sessionStorage.setItem("dsg_sid", sid); }
  } catch (e) { sid = "nostore"; }

  var path = location.pathname;
  var device = matchMedia("(max-width: 760px)").matches ? "mobile"
             : matchMedia("(max-width: 1100px)").matches ? "tablet" : "desktop";

  var queue = [];
  function flush() {
    if (!queue.length) return;
    var body = JSON.stringify(queue.splice(0, 25));
    // text/plain keeps this a simple request, so no preflight round trip
    if (!(navigator.sendBeacon && navigator.sendBeacon(URL_, new Blob([body], { type: "text/plain" })))) {
      try { fetch(URL_, { method: "POST", body: body, keepalive: true, headers: { "Content-Type": "text/plain" } }); } catch (e) {}
    }
  }
  function send(rec) { rec.p = path; rec.s = sid; queue.push(rec); }

  // ---- the view ----
  var ref = "";
  try { var r = document.referrer && new URL(document.referrer); if (r && r.hostname !== location.hostname) ref = r.hostname; } catch (e) {}
  var utm = new URLSearchParams(location.search).get("utm_source") || "";
  send({ k: "view", r: ref, d: device, l: document.documentElement.lang || "", u: utm });
  setTimeout(flush, 0);

  // ---- the buttons that matter to the practice ----
  document.addEventListener("click", function (ev) {
    var a = ev.target.closest && ev.target.closest("a, button, summary");
    if (!a) return;
    var href = a.getAttribute("href") || "";
    var label = (a.getAttribute("aria-label") || a.textContent || "").replace(/\s+/g, " ").trim().slice(0, 80);
    var n = null;
    if (/^https:\/\/wa\.me\//.test(href)) n = "whatsapp";
    else if (/^tel:/.test(href)) n = "call";
    else if (a.hasAttribute("data-ask") || a.id === "bot-launch") n = "ask";
    else if (a.closest("#pathways") && href) n = "pathway";
    else if (a.closest(".langs, .langs-row") && href) n = "lang";
    else if (a.closest(".feed-card")) n = "feed";
    if (n) { send({ k: "event", n: n, x: label }); flush(); }
  }, true);
  document.addEventListener("submit", function (ev) {
    if (ev.target && ev.target.id === "book-form") { send({ k: "event", n: "book", x: (ev.target.elements.reason || {}).value || "" }); flush(); }
  }, true);
  // the patient page reports its own sign-ups and logins
  window.dsgTrack = function (n, x) { send({ k: "event", n: n, x: x || "" }); flush(); };

  // ---- Core Web Vitals, measured in this visitor's browser ----
  function rate(name, v) {
    var t = { LCP: [2500, 4000], INP: [200, 500], CLS: [0.1, 0.25], FCP: [1800, 3000], TTFB: [800, 1800] }[name];
    return v <= t[0] ? "good" : v <= t[1] ? "needs-improvement" : "poor";
  }
  var vit = {};
  function keep(name, v) { vit[name] = v; }
  function observe(type, fn, opts) {
    try { var po = new PerformanceObserver(function (l) { l.getEntries().forEach(fn); }); po.observe(Object.assign({ type: type, buffered: true }, opts || {})); } catch (e) {}
  }
  observe("largest-contentful-paint", function (e) { keep("LCP", e.startTime); });
  observe("paint", function (e) { if (e.name === "first-contentful-paint") keep("FCP", e.startTime); });
  var cls = 0, win = 0, winStart = 0, last = 0;
  observe("layout-shift", function (e) {
    if (e.hadRecentInput) return;
    if (e.startTime - last < 1000 && e.startTime - winStart < 5000) win += e.value;
    else { win = e.value; winStart = e.startTime; }
    last = e.startTime; if (win > cls) { cls = win; keep("CLS", cls); }
  });
  observe("event", function (e) {
    if (e.interactionId && e.duration > (vit.INP || 0)) keep("INP", e.duration);
  }, { durationThreshold: 40 });
  try { var nav = performance.getEntriesByType("navigation")[0]; if (nav) keep("TTFB", nav.responseStart); } catch (e) {}

  var sentVitals = false;
  function sendVitals() {
    if (sentVitals) return; sentVitals = true;
    Object.keys(vit).forEach(function (n) {
      var v = n === "CLS" ? Math.round(vit[n] * 1000) / 1000 : Math.round(vit[n]);
      send({ k: "vital", n: n, v: v, g: rate(n, vit[n]), d: device });
    });
    flush();
  }
  // vitals settle when the page is hidden; pagehide covers the bfcache case
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "hidden") sendVitals(); });
  addEventListener("pagehide", sendVitals);
})();

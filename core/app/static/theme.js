// Light or dark, set before the page paints (loaded in <head> without defer): the choice saved on this device
// with the top bar's button (app.js), else the system's setting.
"use strict";
(function () {
  let t = null;
  try { t = localStorage.getItem("theme"); } catch (e) { /* storage blocked: follow the system */ }
  if (t !== "light" && t !== "dark") t = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  document.documentElement.dataset.theme = t;
})();

// The compact view (20.11.2026): the hub shows a page in a small frame with ?compact=1, and html.compact (app.css) hides the top
// bar and the tab bar; data and actions stay the same. It is kept for this tab (sessionStorage) and used again only inside a
// frame, so a link or a form's reload in the frame stays compact, and this app opened on its own later is not. ?compact=0 ends it.
(function () {
  const q = new URLSearchParams(location.search).get("compact");
  let on = q === "1";
  try {
    if (q === "1") sessionStorage.setItem("compact", "1");
    else if (q === "0") sessionStorage.removeItem("compact");
    else on = window.self !== window.top && sessionStorage.getItem("compact") === "1";
  } catch (e) { /* storage blocked: only a page opened with ?compact=1 is compact */ }
  if (on) document.documentElement.classList.add("compact");
})();

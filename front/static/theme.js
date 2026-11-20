// Sets the theme before first paint, so the page never flashes the wrong one. Dark unless light was chosen.
// Loaded by a plain blocking <script src> in app.html: the page's CSP allows no inline scripts.
// Keep in step with src/lib/theme.svelte.ts.
(function () {
  var choice = null;
  try {
    choice = localStorage.getItem('logger-theme');
  } catch {
    // Storage is blocked: dark.
  }
  var theme = choice === 'light' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', theme);
  // The phone's bar above the page (deploy 112): the page's own background, whatever the device's setting.
  var metas = document.querySelectorAll('meta[name="theme-color"]');
  for (var i = 0; i < metas.length; i++) metas[i].setAttribute('content', theme === 'light' ? '#f1f1ee' : '#0c0d0f');
})();

// The compact view (20.11.2026): the hub shows a page in a small frame with ?compact=1, and html.compact (src/app.css) hides the
// places (the tab bar, the PC's rail) and Today's Sign out and theme button; data and actions stay the same. It is kept for this tab
// (sessionStorage) and used again only inside a frame, so a link or a reload in the frame stays compact, and this app opened on its
// own later is not. ?compact=0 ends it. In the page itself the class stays from page to page (SvelteKit keeps the document).
(function () {
  var q = new URLSearchParams(location.search).get('compact');
  var on = q === '1';
  try {
    if (q === '1') sessionStorage.setItem('logger-compact', '1');
    else if (q === '0') sessionStorage.removeItem('logger-compact');
    else on = window.self !== window.top && sessionStorage.getItem('logger-compact') === '1';
  } catch {
    // Storage is blocked: only a page opened with ?compact=1 is compact.
  }
  if (on) document.documentElement.classList.add('compact');
})();

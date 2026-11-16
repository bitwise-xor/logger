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
  document.documentElement.setAttribute('data-theme', choice === 'light' ? 'light' : 'dark');
})();

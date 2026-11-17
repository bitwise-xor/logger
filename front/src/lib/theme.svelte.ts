/**
 * Light or dark, dark by default (the plan). The choice is kept in localStorage and applied to <html data-theme>;
 * static/theme.js does the same before first paint, so keep the two in step.
 */
export type Theme = 'light' | 'dark';

const KEY = 'logger-theme';
/** The page's background of each theme (tokens.css --bg), for the phone's bar above the page. */
const BAR: Record<Theme, string> = { dark: '#0c0d0f', light: '#f1f1ee' };
const inBrowser = typeof window !== 'undefined';

function stored(): Theme {
  try {
    return localStorage.getItem(KEY) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

class ThemeState {
  current = $state<Theme>(inBrowser ? stored() : 'dark');

  toggle(): void {
    this.current = this.current === 'dark' ? 'light' : 'dark';
    try {
      if (this.current === 'dark') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, 'light');
    } catch {
      // The choice then lasts until the page is closed.
    }
    if (inBrowser) {
      document.documentElement.setAttribute('data-theme', this.current);
      // the phone's bar above the page follows (deploy 112; the two theme-color metas of app.html)
      for (const m of document.querySelectorAll('meta[name="theme-color"]')) m.setAttribute('content', BAR[this.current]);
    }
  }
}

export const theme = new ThemeState();

/**
 * Light or dark, dark by default (the plan). The choice is kept in localStorage and applied to <html data-theme>;
 * static/theme.js does the same before first paint, so keep the two in step.
 */
export type Theme = 'light' | 'dark';

const KEY = 'logger-theme';
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
    if (inBrowser) document.documentElement.setAttribute('data-theme', this.current);
  }
}

export const theme = new ThemeState();

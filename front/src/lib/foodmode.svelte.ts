/**
 * The Food day's "Macros / All values" switch (web 73, 23.11.2026): All values unless Macros was chosen on this device. The choice is
 * kept in localStorage and set on <html data-food-values> (only "macros"); static/theme.js does the same before first paint, so the
 * page never flashes the other mode, and the page's parts of each mode are shown by CSS (the `macros:` and `allvalues:` variants of
 * app.css). Keep in step with static/theme.js, as theme.svelte.ts is.
 */
import { modeOf, type ValuesMode } from './foodvalues.js';

export const FOOD_VALUES_KEY = 'logger-food-values';
const inBrowser = typeof window !== 'undefined';

function stored(): ValuesMode {
  try {
    return modeOf(localStorage.getItem(FOOD_VALUES_KEY));
  } catch {
    return 'all';
  }
}

class FoodModeState {
  current = $state<ValuesMode>(inBrowser ? stored() : 'all');

  /** The stored choice again (the page drawn on the server starts with All values; the CSS shows the chosen one already). */
  sync(): void {
    this.current = stored();
  }

  set(mode: ValuesMode): void {
    this.current = mode;
    try {
      if (mode === 'all') localStorage.removeItem(FOOD_VALUES_KEY);
      else localStorage.setItem(FOOD_VALUES_KEY, mode);
    } catch {
      // The choice then lasts until the page is closed.
    }
    if (!inBrowser) return;
    if (mode === 'macros') document.documentElement.setAttribute('data-food-values', 'macros');
    else document.documentElement.removeAttribute('data-food-values');
  }
}

export const foodMode = new FoodModeState();

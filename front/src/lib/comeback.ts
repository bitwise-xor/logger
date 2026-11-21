/**
 * Reading the page again when the app comes back to the screen (Web 67, 21.11.2026). The home-screen app on the phone stays open
 * for days: back after a while, Today would show the morning's numbers. So when the page becomes visible after being hidden for a
 * minute or more, the (app) layout calls SvelteKit's invalidateAll(), which runs the page's load again and hands it the fresh data.
 *
 * invalidateAll keeps the page's components (no new page), but each page puts its fresh read on screen its own way: Today's load()
 * closes an open food row (its editor, with an amount or a note being changed), the Food day the same, and a form drawn from the
 * read (a habit's or a chore's form, Settings' fields) may be drawn again. The logging box keeps its words (they live in Today's
 * state, not in the read: it is marked `data-survives-reload`). So the read waits while:
 * - a save is on its way (its answer brings the fresh read anyway, and a read in between could show the day before it);
 * - a text field has the focus, or the owner typed into one that is still on the page and not empty (an `input` or `change` event
 *   since it was drawn, and its form not sent since: a sent form's words went with it), outside `data-survives-reload`;
 * - something is open (`aria-expanded="true"`: a food row's editor, a chip's box, a habit's calendar), outside the places, or a
 *   read-back waits for Yes or No in the answer bar (`data-holds-reload`: Today's load() would put the session's Undo there).
 * It is then tried again at the next return. Home > Pick reads itself again on every return for its timer (its own handler).
 */
export const AWAY_MS = 60_000;

/** What would be lost by a read now. */
export interface Probe {
  /** Saves on their way (src/lib/saver.ts, savesInFlight). */
  inFlight(): number;
  /** A text field has the focus. */
  focused(): boolean;
  /** Something typed into a field still on the page. */
  typed(): boolean;
  /** Something open (an editor, a box). */
  open(): boolean;
}

export class Comeback {
  #hiddenAt: number | null = null;
  readonly #now: () => number;

  constructor(now: () => number = () => Date.now()) {
    this.#now = now;
  }

  /** The page was hidden (kept from the first time, until a read). */
  hidden() {
    this.#hiddenAt ??= this.#now();
  }

  /** The page is visible again: true when it should be read again now. Not read (held): it is tried again at the next return. */
  visible(probe: Probe): boolean {
    if (this.#hiddenAt === null) return false;
    if (this.#now() - this.#hiddenAt < AWAY_MS) {
      this.#hiddenAt = null;
      return false;
    }
    if (probe.inFlight() > 0 || probe.focused() || probe.typed() || probe.open()) return false;
    this.#hiddenAt = null;
    return true;
  }
}

/** The fields where typing counts: text-like inputs, text areas, selects and editable text (not buttons, hidden fields or boxes). */
export const TEXT_FIELD =
  'input:not([type=hidden]):not([type=button]):not([type=submit]):not([type=reset]):not([type=checkbox]):not([type=radio]):not([type=image]), textarea, select, [contenteditable=""], [contenteditable="true"]';
/** What a read does not touch (the logging box). */
export const SURVIVES = '[data-survives-reload]';
/** What a read would close or lose: something open, or a read-back waiting for an answer. */
export const OPEN = '[aria-expanded="true"], [data-holds-reload]';

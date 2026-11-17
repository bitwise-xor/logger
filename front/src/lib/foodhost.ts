/**
 * What a page gives the food row editor (components/food/FoodEditor.svelte, deploy 117): the Food day (foodday.svelte.ts) and Today
 * (today.svelte.ts) both open a food row in place with the same editor. Each page posts the editor's forms to its own form actions
 * (food_entry, food_note), so the answer brings that page's fresh day.
 */
import type { SaveAnswer } from './day.js';
import type { FoodEntry } from './food.js';
import type { FieldValues } from './saver.js';

export interface FoodHost {
  /** The taps on their way (`entry:<ref>`, `note:<ref>`). */
  busy: Record<string, boolean>;
  submit(action: string, id: string, done?: (a: SaveAnswer | null, form: HTMLFormElement) => void): (event: SubmitEvent) => void;
  tap(action: string, id: string, fields: FieldValues): Promise<SaveAnswer | null>;
  /** Opens the row (another closes), or closes it when it was open. */
  toggle(ref: string): void;
  /** The entry behind a row (its units, its note). */
  entry(ref: string): Promise<FoodEntry | null>;
}

/**
 * The entries behind the rows (GET /food/entry through /food/entry here): asked once per row until cleared (a save can move a row
 * to another food, with other units); null when one cannot be read.
 */
export class EntryCache {
  #entries = new Map<string, Promise<FoodEntry | null>>();

  get(ref: string): Promise<FoodEntry | null> {
    let p = this.#entries.get(ref);
    if (!p) {
      p = fetch(`/food/entry?ref=${encodeURIComponent(ref)}`, { headers: { accept: 'application/json' }, cache: 'no-store' })
        .then(async (r) => (r.ok ? ((await r.json()) as { entry: FoodEntry }).entry : null))
        .catch(() => null);
      this.#entries.set(ref, p);
    }
    return p;
  }

  clear() {
    this.#entries.clear();
  }
}

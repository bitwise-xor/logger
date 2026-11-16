/**
 * The scan sheet's plain rules (deploy 90): the barcode, label photo and Open Food Facts steps of the logging box, as app.'s
 * scanner (core/app/static/app.js setupScan, shrink). The sheet is components/today/ScanSheet.svelte; the browser asks this
 * app's own routes (src/routes/(app)/scan/…), which ask the door (docs/API.md: GET /foods/barcode, /foods/off, POST
 * /food/label); "Log" is the `again` save, "Add to my foods" the `labeladd` save (src/lib/server/saves.ts).
 *
 * Plain TypeScript with no SvelteKit import, so the tests can call it.
 */

/** A barcode as typed or read: 8 to 14 digits, spaces and dashes left out (the door's rule); anything else is null. */
export function cleanCode(typed: string): string | null {
  const c = typed.replace(/[\s-]/g, '');
  return /^\d{8,14}$/.test(c) ? c : null;
}

export const CODE_RULE = 'A barcode is 8 to 14 digits.';

/** GET /foods/barcode's food (docs/API.md). */
export interface ScannedFood {
  food_id: number;
  name: string;
  unit: 'g' | 'ml';
  amount: number;
}

export interface LabelValues {
  kcal: number | null;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
  sat_fat: number | null;
  sugar_total: number | null;
  fibre: number | null;
  salt_g: number | null;
}

/** GET /foods/off's and POST /food/label's answer: the values to check, or why there are none. */
export type ReadAnswer =
  | { ok: true; name: string | null; brand: string | null; basis: 'g' | 'ml'; note: string | null; values: LabelValues }
  | { ok: false; reason: string };

/** The form's fields in the order the sheet shows them; the first four are needed. */
export const VALUE_FIELDS: { key: keyof LabelValues; label: string; needed: boolean }[] = [
  { key: 'kcal', label: 'Calories (kcal)', needed: true },
  { key: 'protein', label: 'Protein g', needed: true },
  { key: 'fat', label: 'Fat g', needed: true },
  { key: 'sat_fat', label: 'of which saturated g', needed: false },
  { key: 'carbs', label: 'Carbs g', needed: true },
  { key: 'sugar_total', label: 'of which sugar g', needed: false },
  { key: 'fibre', label: 'Fibre g', needed: false },
  { key: 'salt_g', label: 'Salt g', needed: false },
];

/** The form to check, as text fields (what the inputs hold). */
export interface LabelForm {
  name: string;
  basis: 'g' | 'ml';
  values: Record<keyof LabelValues, string>;
  barcode: string;
  source: 'label' | 'off';
  /** One sentence from the reader (or Open Food Facts) to check, with the basis. */
  note: string;
}

/** The name as app. fills it: the brand in brackets when the name does not say it already. */
export function labelName(name: string | null, brand: string | null): string {
  if (!name) return '';
  return brand && !name.toLowerCase().includes(brand.toLowerCase()) ? `${name} (${brand})` : name;
}

/** The form filled from a read (the label photos or Open Food Facts); a value it does not know stays empty. */
export function formFrom(a: Extract<ReadAnswer, { ok: true }>, source: 'label' | 'off', barcode: string | null): LabelForm {
  const values = Object.fromEntries(
    VALUE_FIELDS.map(({ key }) => [key, a.values[key] === null || a.values[key] === undefined ? '' : String(a.values[key])]),
  ) as Record<keyof LabelValues, string>;
  return {
    name: labelName(a.name, a.brand),
    basis: a.basis === 'ml' ? 'ml' : 'g',
    values,
    barcode: barcode ?? '',
    source,
    note: `${a.note ? `${a.note} ` : ''}Values per 100 ${a.basis === 'ml' ? 'ml' : 'g'}. Correct anything that is off.`,
  };
}

/** A number as typed ("4,5" or "4.5"); null when empty; NaN when it is not a number. */
export function typedNumber(v: unknown): number | null {
  const t = typeof v === 'string' ? v.trim().replace(',', '.') : '';
  if (t === '') return null;
  return /^\d{1,6}(\.\d{1,4})?$/.test(t) ? Number(t) : NaN;
}

/** The form's fields (FormData or a test double). */
export interface FieldsLike {
  get(name: string): unknown;
}

const text = (f: FieldsLike, name: string, limit: number): string | undefined => {
  const v = f.get(name);
  if (typeof v !== 'string') return undefined;
  const t = v.trim().slice(0, limit);
  return t === '' ? undefined : t;
};

/**
 * The door's POST /food/labeladd body from the form's fields (docs/API.md): numbers per 100, the optional ones null when left
 * empty, the barcode and the time only when they are right, the amount only when given. A value that is not a number is sent as
 * typed: the door then says which ("kcal must be a number.").
 */
export function labeladdBody(f: FieldsLike): Record<string, unknown> {
  const body: Record<string, unknown> = {
    name: text(f, 'name', 200) ?? '',
    basis: text(f, 'basis', 2) === 'ml' ? 'ml' : 'g',
    source: text(f, 'source', 5) === 'off' ? 'off' : 'label',
  };
  for (const { key, needed } of VALUE_FIELDS) {
    const n = typedNumber(f.get(key));
    if (n === null) {
      if (!needed) body[key] = null;
    } else body[key] = Number.isNaN(n) ? text(f, key, 20) : n;
  }
  const code = cleanCode(text(f, 'barcode', 20) ?? '');
  if (code) body.barcode = code;
  const amount = typedNumber(f.get('amount'));
  if (amount !== null) {
    body.amount = Number.isNaN(amount) ? text(f, 'amount', 20) : amount;
    const time = text(f, 'time', 5);
    if (time && /^\d\d:\d\d$/.test(time)) body.time = time;
  }
  return body;
}

/** What the sheet shows below the camera and the digits. */
export type Step =
  | { kind: 'start' }
  /** Asking: the barcode, Open Food Facts, or the label (the words say which). */
  | { kind: 'busy'; words: string }
  | { kind: 'found'; code: string; food: ScannedFood }
  | { kind: 'unknown'; code: string }
  /** The label photos (one to three) before they are read; `problem` when a read failed (the photos stay). */
  | { kind: 'photos'; problem: string | null }
  | { kind: 'form'; form: LabelForm };

/** After GET /foods/barcode: the food to log, or "Not in your catalogue yet". */
export function afterBarcode(code: string, a: { food: ScannedFood | null }): Step {
  return a.food ? { kind: 'found', code, food: a.food } : { kind: 'unknown', code };
}

/** After GET /foods/off: the form to check, or why not (the label photo is the next step; it keeps the barcode). */
export function afterOff(code: string, a: ReadAnswer): { step: Step; message: string } {
  if (a.ok) return { step: { kind: 'form', form: formFrom(a, 'off', code) }, message: 'Check the values, give an amount to log it now, then Add.' };
  return { step: { kind: 'unknown', code }, message: `${a.reason || 'That did not work.'} Use Photo of the label.` };
}

/** After POST /food/label: the form to check, or the photos again with why the read failed. */
export function afterLabel(code: string | null, a: ReadAnswer): { step: Step; message: string } {
  if (a.ok) return { step: { kind: 'form', form: formFrom(a, 'label', code) }, message: 'Check the values, give an amount to log it now, then Add.' };
  return { step: { kind: 'photos', problem: a.reason || 'That did not work; try again.' }, message: '' };
}

/** At most three photos of one package (the door's rule), each at most 8 MB after shrinking. */
export const MAX_PHOTOS = 3;
export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
export const TOO_LARGE = 'This photo is too large (at most 8 MB). Take it again, or pick a smaller one.';

/** A photo's size after shrink: at most 1600 px on its longer side, never larger than it was (app.'s shrink). */
export function shrunkSize(width: number, height: number, most = 1600): { width: number; height: number } {
  const s = Math.min(1, most / Math.max(width, height, 1));
  return { width: Math.max(1, Math.round(width * s)), height: Math.max(1, Math.round(height * s)) };
}

/** A save's answer as the sheet needs it. */
export interface SheetAnswer {
  outcome: string;
  head: string;
}

/**
 * Whether a save from the sheet ("Log", "Add to my foods") closes it: yes once something was saved, so the answer bar (with
 * Undo) is seen; not when it was refused, so what was typed can be corrected. A refused amount still adds the food ("Added …"):
 * then it closes too, or a second Add would make a second food.
 */
export function closesSheet(a: SheetAnswer | null): boolean {
  if (!a) return false;
  return a.outcome !== 'rejected' || a.head.startsWith('Added');
}

/** hh:mm now, for the sheet's time fields (the owner's device clock, as app.'s now-time). */
export function nowHm(d = new Date()): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** The read's words for a refused or failed call of this app's scan routes (their JSON `message`), or a plain fallback. */
export function failedWords(status: number, body: unknown): string {
  const m = (body as { message?: unknown } | null)?.message;
  if (typeof m === 'string' && m) return m;
  if (status === 413) return 'The photos are too large together. Remove one, or take them again.';
  return 'That did not work; try again in a moment.';
}

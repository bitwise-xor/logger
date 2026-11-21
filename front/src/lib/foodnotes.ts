/**
 * The Food space's Notes tab (21.11.2026) as the door sends it (GET /api/v1/food/notes, docs/API.md): every meal note and food note
 * of the last 90 days, newest first, grouped here by day; each row leads to that day's Food day (a food's note opens its row there).
 * Plain TypeScript, so the unit tests need no browser.
 */
import { foodDayHref, amountText } from './food.js';
import { dayOf, hm } from './format.js';

export interface FoodNote {
  kind: 'meal' | 'food' | 'day';
  day: string;
  meal: number | null;
  label: string | null;
  at: string | null;
  note: string;
  ref?: string;
  food?: string;
  amount?: number;
  unit?: string;
  portion_text?: string | null;
}

export interface FoodNotes {
  days: number;
  start: string;
  today: string;
  notes: FoodNote[];
}

export interface NoteRow {
  key: string;
  kind: FoodNote['kind'];
  /** "Meal 2 · 13:05", "Rye bread · 80 g (2 slices)", "The day". */
  what: string;
  /** For a food's note: its meal and time ("Meal 2 · 13:05"). */
  sub: string;
  note: string;
  href: string;
}

export interface NoteDay {
  day: string;
  /** "Sat 21.11." */
  title: string;
  today: boolean;
  href: string;
  rows: NoteRow[];
}

const when = (label: string | null, at: string | null) => [label, hm(at)].filter(Boolean).join(' · ');

/** The notes by day, newest first as the door sends them; each row with what it is on and where it leads. */
export function noteDays(x: FoodNotes): NoteDay[] {
  const out: NoteDay[] = [];
  x.notes.forEach((nt, i) => {
    let d = out.at(-1);
    if (!d || d.day !== nt.day) {
      out.push((d = { day: nt.day, title: dayOf(nt.day), today: nt.day === x.today, href: foodDayHref(nt.day, x.today), rows: [] }));
    }
    const base = foodDayHref(nt.day, x.today);
    if (nt.kind === 'food') {
      const amount = nt.amount !== undefined ? `${amountText(nt.amount)} ${nt.unit ?? ''}`.trim() + (nt.portion_text ? ` (${nt.portion_text})` : '') : '';
      d.rows.push({
        key: `f-${nt.ref ?? i}`,
        kind: 'food',
        what: [nt.food, amount].filter(Boolean).join(' · '),
        sub: when(nt.label, nt.at),
        note: nt.note,
        href: nt.ref ? `${base}${base.includes('?') ? '&' : '?'}open=${encodeURIComponent(nt.ref)}` : base,
      });
    } else {
      d.rows.push({
        key: `${nt.kind}-${nt.meal ?? 'day'}-${i}`,
        kind: nt.kind,
        what: nt.kind === 'day' ? 'The day' : when(nt.label, nt.at),
        sub: '',
        note: nt.note,
        href: nt.kind === 'meal' && nt.meal !== null ? `${base}#meal-${nt.meal}` : base,
      });
    }
  });
  return out;
}

/** The empty state's words. */
export const NOTES_EMPTY =
  'No notes in the last 90 days. On the Day tab, “Add note” on a meal’s line notes the whole meal; tap a food and use its Note field for one food.';

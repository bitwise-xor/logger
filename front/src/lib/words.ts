/**
 * Library > Foods > Words (core item 24, 22.11.2026): the words review. The door's GET /food/words (docs/API.md, "Library: the words
 * review") lists every word of an active food with its food, when and from where it was added and how many foods have it; the
 * page groups them by month, says where each came from and removes one with the Catalogue's own save. The plain rules (the page's
 * address, the groups, the labels) are here, so the tests need no browser; the state is wordspage.svelte.ts.
 */
import type { FieldValues } from './saver.js';

export type WordBy = 'web' | 'chat' | 'other' | null;

export interface WordRow {
  word: string;
  food_id: number;
  food: string;
  /** ISO time in Berlin with its offset (the food's creation when the word came with it), or null when it is not known. */
  added_at: string | null;
  by: WordBy;
  /** How many active foods have this word (compared in lower case); 1 is this food only. */
  shared: number;
  /** "2026-11", from added_at; null when it is not known. */
  month: string | null;
}

export interface Words {
  count: number;
  total: number;
  rows: WordRow[];
  limit: number;
}

// ---- the page's address ----------------------------------------------------------------------------------------------------------

export const WORDS_Q_MAX = 60;

export interface View {
  q: string;
  shared: boolean;
}

/** The search as the door takes it (cut at 60). */
export const askedQ = (x: string | null): string => (x ?? '').trim().slice(0, WORDS_Q_MAX);
/** ?shared=1 is the chip on; anything else is off. */
export const askedShared = (x: string | null): boolean => x === '1';

export function viewOf(params: URLSearchParams): View {
  return { q: askedQ(params.get('q')), shared: askedShared(params.get('shared')) };
}

/** The page's address for a view: the defaults are left out (/library/words is every word). */
export function wordsHref(v: Partial<View>): string {
  const p = new URLSearchParams();
  const q = askedQ(v.q ?? '');
  if (q) p.set('q', q);
  if (v.shared) p.set('shared', '1');
  const t = p.toString();
  return t ? `/library/words?${t}` : '/library/words';
}

/** What every save of the page carries, so its answer brings the list as shown (view "words"). */
export function viewFields(v: View): FieldValues {
  const out: FieldValues = { view: 'words' };
  if (v.q) out.view_q = v.q;
  if (v.shared) out.view_shared = '1';
  return out;
}

/** The Catalogue's word save (the door's POST /food/catalogue/words) for taking one word off a food. */
export const removeFields = (r: Pick<WordRow, 'food_id' | 'word'>): FieldValues => ({ id: String(r.food_id), act: 'remove', word: r.word });

// ---- the list ------------------------------------------------------------------------------------------------------------------

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const UNKNOWN_MONTH = 'Earlier, date unknown';

/** "2026-11" as "November 2026"; null (or anything else) as "Earlier, date unknown". */
export function monthLabel(month: string | null): string {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month ?? '');
  return m ? `${MONTHS[Number(m[2]) - 1]} ${m[1]}` : UNKNOWN_MONTH;
}

export interface Group {
  /** "2026-11", or null for the words whose date is not known. */
  month: string | null;
  label: string;
  rows: WordRow[];
}

/** The rows (as the door sorts them: newest first, unknown dates last) in a group per month, in the same order. */
export function groupByMonth(rows: WordRow[]): Group[] {
  const groups: Group[] = [];
  for (const r of rows) {
    const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(r.month ?? '') ? r.month : null;
    const last = groups.at(-1);
    if (last && last.month === month) last.rows.push(r);
    else groups.push({ month, label: monthLabel(month), rows: [r] });
  }
  return groups;
}

/** "12.11." from the door's ISO time (it is in Berlin time already); none when the date is not known. */
export function dateLabel(addedAt: string | null): string | null {
  const m = /^\d{4}-(\d\d)-(\d\d)T/.exec(addedAt ?? '');
  return m ? `${m[2]}.${m[1]}.` : null;
}

/** Where a word came from: the chat, the web (this app and app.), another way (by hand, a migration), or with the food itself. */
export function byLabel(by: WordBy): string {
  return by === 'chat' ? 'added in chat' : by === 'web' ? 'added on the web' : by === 'other' ? 'added by hand' : 'came with the food';
}

/** "12.11. · added in chat"; a word with no date has only where it came from. */
export function whenLine(r: Pick<WordRow, 'added_at' | 'by'>): string {
  const d = dateLabel(r.added_at);
  return d ? `${d} · ${byLabel(r.by)}` : byLabel(r.by);
}

/** The amber mark of a word that other foods have too ("also on 2 other foods"); none for a word of one food. */
export function sharedLabel(shared: number): string | null {
  return shared > 1 ? `also on ${shared - 1} other ${shared === 2 ? 'food' : 'foods'}` : null;
}

/** "213 words", "1 word"; when the door cut the list at its limit "500 of 650 words". */
export function countLine(w: Pick<Words, 'count' | 'total'>): string {
  const noun = (n: number) => (n === 1 ? 'word' : 'words');
  return w.count < w.total ? `${w.count} of ${w.total} words` : `${w.total} ${noun(w.total)}`;
}

/** What a narrowed list is narrowed by, said after the count ("matching “bread”", "on more than one food"); none when it is not. */
export function narrowedLine(v: View): string | null {
  const parts = [v.q ? `matching “${v.q}”` : null, v.shared ? 'on more than one food' : null].filter((x): x is string => !!x);
  return parts.length ? parts.join(', ') : null;
}

/** The line when nothing is listed. */
export const emptyLine = (v: View): string => (v.q || v.shared ? 'No word matches.' : 'No food has a word yet.');

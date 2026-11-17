/**
 * Today's state in the browser (step C, deploy 80): the day on screen and the rows a save added (blue edge); the answer bar and
 * the taps on their way are the shared part (src/lib/answers.svelte.ts, also the Food day's since step E, deploy 84).
 * The cards reach it through getToday(); each tap is a form posted to a form action by the Saver (src/lib/saver.ts).
 * Step D (deploy 81): the logging box's words (`box`), the typed lines being read (`reading`, a blue row each), and "Correct it"
 * or an answer's words put back into the box (src/lib/logbox.ts has the plain rules).
 * Deploy 117: a food row opens in place to change or delete it, with the Food day's editor (`open`, `toggle`, `entry`: foodhost.ts);
 * its saves go to Today's form actions food_entry and food_note, whose answer brings the fresh Today.
 */
import { getContext, setContext } from 'svelte';
import { Answers } from './answers.svelte.js';
import { freshRefs, type Day, type SaveAnswer, type Undo } from './day.js';
import type { FoodEntry } from './food.js';
import { EntryCache, type FoodHost } from './foodhost.js';
import { hm } from './format.js';
import { CoachRun } from './coachrun.svelte.js';
import { LineKeys, readingText, wordsBack } from './logbox.js';
import { makeKey, type FieldValues } from './saver.js';

export type { Bar } from './answers.svelte.js';

/** A typed line on its way: the blue "being read" row. */
export interface Reading {
  id: number;
  at: string;
  text: string;
}

export class Today extends Answers implements FoodHost {
  day = $state.raw<Day | null>(null);
  fresh = $state.raw<Set<string>>(new Set());
  /** The food row open to change (its ref), or none (deploy 117). */
  open = $state<string | null>(null);
  /** The logging box's words, and the lines being read. */
  box = $state('');
  reading = $state<Reading[]>([]);
  /** Today's Coach card (deploy 109): its button's one-press guard, and "still being read after 5 minutes". */
  readonly coach = new CoachRun();

  #keys = new LineKeys();
  #lines = 0;
  #boxEl: HTMLTextAreaElement | null = null;
  #loaded: Day | null = null;
  #entries = new EntryCache();

  constructor(day: Day | null, undo: Undo | null) {
    super('/');
    this.load(day, undo);
  }

  /** The day the page loaded (first visit, a reload, or after a sign-in), with the session's Undo if it still lasts. */
  load(day: Day | null, undo: Undo | null) {
    if (day === this.#loaded) return; // the same load again (the page's effect on its first run)
    this.#loaded = day;
    this.day = day;
    this.fresh = new Set();
    this.open = null;
    this.#entries.clear();
    this.loadUndo(undo);
  }

  /** A food row tapped: it opens (another one closes), or closes when it was open. */
  toggle(ref: string) {
    this.open = this.open === ref ? null : ref;
  }

  /** The entry behind a food row (its units and its note, which Today's rows do not carry): asked once per row (foodhost.ts). */
  entry(ref: string): Promise<FoodEntry | null> {
    return this.#entries.get(ref);
  }

  /**
   * After the sign-in: a tap that met a gone session is sent again, with its key (src/lib/saver.ts). A typed line goes the
   * box's way (its blue row); one that cannot be sent any more (over 10 minutes) puts its words back into the box.
   */
  async resend() {
    const kept = this.saver.takeKept();
    if (!kept) return;
    const text = typeof kept.fields.text === 'string' ? kept.fields.text : '';
    const key = typeof kept.fields.key === 'string' ? kept.fields.key : undefined;
    if (kept.action === 'log' && text) {
      if (kept.fresh) return void (await this.log(text, key));
      this.#putBack(text);
      this.show({ tone: 'warning', head: 'Not sent.', lines: ['You were signed out for a while. Your words are back in the box.'], undo: null, confirm: null });
      return;
    }
    if (!kept.fresh) return;
    this.handle(await this.saver.send<SaveAnswer>(kept.action, kept.fields), kept.action, kept.fields);
  }

  /**
   * The Coach card's button (deploy 109): one press, one start (a day coaching costs about 6 cents; never sent again by itself:
   * saver.ts). The answer's fresh day brings the card (working); a refusal says why in the bar.
   */
  startCoach(fields: FieldValues) {
    return this.coach.press(() => this.tap('coach_day', 'coach_day', fields));
  }

  /** The box's textarea, so "Correct it" can put words in and the cursor after them. */
  bindBox(el: HTMLTextAreaElement | null) {
    this.#boxEl = el;
  }

  /** "Correct it" (a question) or "Log again": the words go into the box, to change and send again. */
  refill(text: string) {
    this.box = text;
    const el = this.#boxEl;
    if (!el) return;
    queueMicrotask(() => {
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    });
  }

  /**
   * A typed line: a blue "being read" row while the door reads it (the AI, up to about 40 s), then the answer as for a tap
   * (the fresh day, the bar with the receipt, Undo, a held line or a question under Needs you). Lines may overlap: each has its
   * own row. key: a re-send's own key; the same words that got no answer before go with their key again (LineKeys).
   */
  async log(text: string, key?: string) {
    const words = text.trim();
    if (!words) return;
    const k = key ?? this.#keys.keyFor(words) ?? makeKey();
    const id = ++this.#lines;
    this.reading = [...this.reading, { id, at: hm(new Date().toISOString()), text: readingText(words) }];
    try {
      const fields = { text: words, key: k };
      const sent = await this.saver.send<SaveAnswer>('log', fields);
      if (sent.kind === 'problem') this.#keys.remember(words, k);
      else if (sent.kind === 'answer') this.#keys.forget(words);
      this.handle(sent, 'log', fields);
      if (wordsBack(sent, words) && this.#putBack(words) && this.bar) {
        this.bar = { ...this.bar, lines: [...this.bar.lines, 'Your words are back in the box.'] };
      }
    } finally {
      this.reading = this.reading.filter((r) => r.id !== id);
    }
  }

  /** Words back into the box, only when it is empty (never over a line being typed). True when they went in. */
  #putBack(words: string): boolean {
    if (this.box.trim()) return false;
    this.refill(words);
    return true;
  }

  /**
   * The answer's fresh day: a row it added gets a blue edge. A food row's change that went through (deploy 117) closes the row and
   * gives it the blue edge (not a delete: the row is gone); an open row that is not in the fresh day any more closes.
   */
  protected take(a: SaveAnswer, action: string, fields: FieldValues) {
    if (!a.day) return;
    const food = action === 'food_entry' || action === 'food_note';
    const changed = food && a.outcome === 'changed';
    if (this.day) {
      const fresh = freshRefs(this.day, a.day);
      const ref = typeof fields.ref === 'string' ? fields.ref : null;
      if (changed && ref && fields.action !== 'delete' && a.day.rows.some((r) => r.ref === ref)) fresh.add(ref);
      this.fresh = fresh;
    }
    if (changed) this.open = null;
    if (this.open && !a.day.rows.some((r) => r.ref === this.open)) this.open = null;
    this.#entries.clear(); // a change can move a row to another food (other units), or change its note
    this.day = a.day;
  }

  /** The door's /log takes no "confirmed": a typed line's read-back is a question under Needs you (its card has the read-back). */
  protected confirmable(_a: SaveAnswer, action: string) {
    return action !== 'log';
  }

  protected lines(a: SaveAnswer, action: string, confirm: boolean): string[] {
    const typed = action === 'log' || action === 'held_retry';
    // An answer's words ("Log again" on a message that is not an entry) go back into the box; into an empty box only.
    const refilled = !!a.refill && this.#putBack(a.refill.text);
    return [
      // a typed line's receipt and notes, as app. shows them under its box
      typed && a.receipt.length ? a.receipt.join('\n') : null,
      ...(typed ? a.notes : []),
      a.result,
      !confirm && !a.questions.length ? a.read_back : null,
      a.reason,
      a.questions.length ? (a.questions.length === 1 ? 'The question is under Needs you.' : 'The questions are under Needs you.') : null,
      a.refill ? (refilled ? 'Its words are back in the box.' : `Its words: “${a.refill.text}”`) : null,
    ].filter((x): x is string => !!x);
  }
}

const KEY = Symbol('today');
export const setToday = (t: Today) => setContext(KEY, t);
export const getToday = () => getContext<Today>(KEY);

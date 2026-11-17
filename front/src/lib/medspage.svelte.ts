/**
 * Medical's Medication tab in the browser (deploy 106): the Medication on screen, the course whose pencil is open and what is typed in it,
 * why a form was refused (next to it; what was typed stays), the course a save touched (blue edge), and "Add a course". The answer bar and the
 * taps on their way are the shared part (answers.svelte.ts).
 * Every save goes to a form action of /medical/meds with view "labs_meds", and its answer brings the fresh list, which replaces the page with
 * no reload. The course's form and End have no key or Undo and are never sent again by the page (saver.ts, `labs_`).
 *
 * A change is shown first by the door (needs_confirmation, its read-back in the answer bar with "Yes, change" or, for End, "Yes, end it
 * today"): Yes sends the same again with confirmed, No drops it. A new course is Today's typed line (the same `log` save, the same saver and
 * answer bar, the same line keys): the door reads it (the AI, up to about 40 s), the read-back of its question comes in the bar with Yes and
 * No, sent through `answer` as Today's questions are, both with view "labs_meds". Nothing of a course is written to a log line.
 */
import { getContext, setContext, untrack } from 'svelte';
import { Answers, type Bar } from './answers.svelte.js';
import { LineKeys } from './logbox.js';
import {
  addedMeds,
  changedFields,
  courseQuestion,
  endFields,
  formOf,
  medDraft,
  medFields,
  type Med,
  type MedField,
  type Meds,
} from './medical.js';
import type { SaveAnswer, Undo } from './day.js';
import { makeKey, type FieldValues, type Sent } from './saver.js';

type MedsAnswer = SaveAnswer & { labs_meds?: Meds };

export class MedsPage extends Answers {
  meds = $state.raw<Meds | null>(null);
  /** The course whose pencil is open, what is typed in its form. */
  editing = $state<number | null>(null);
  draft = $state<Record<MedField, string>>({ dose: '', frequency: '', indication: '', start: '', stop: '' });
  /** "Add a course": the sentence typed. */
  text = $state('');
  /** Why a form was refused, by form ("med:1", "add"). */
  errs = $state<Record<string, string>>({});
  /** The course a save just changed or added (blue edge). */
  fresh = $state<number | null>(null);

  #keys = new LineKeys();
  #loaded: Meds | null = null;

  constructor(meds: Meds | null, undo: Undo | null) {
    super('/medical/meds');
    this.load(meds, undo);
  }

  /** The page's load (a visit, a reload, after a sign-in). */
  load(meds: Meds | null, undo: Undo | null) {
    // the page's effect runs this when its data changes: what the page's own state reads in here is no reason to run it again
    untrack(() => {
      if (this.#loaded === meds && meds !== null) return;
      this.#loaded = meds;
      this.meds = meds;
      this.editing = null;
      this.loadUndo(undo);
    });
  }

  // ---- a course's pencil and End ------------------------------------------------------------------------------------------------

  /** The pencil: the form opens with the dose, how often, why, start and stop; tapped again it closes. */
  pencil(m: Med) {
    if (this.editing === m.id) {
      this.editing = null;
      return;
    }
    this.editing = m.id;
    this.draft = medDraft(m);
    delete this.errs[`med:${m.id}`];
  }

  /** Save: only what changed; the door shows it first, Yes sends it again confirmed. */
  async saveMed(m: Med) {
    const changed = changedFields(medDraft(m), this.draft);
    delete this.errs[`med:${m.id}`];
    await this.tap('labs_med', `med:${m.id}`, medFields(m.id, changed));
  }

  /** End: the door asks first ("Yes, end it today" in the answer bar). */
  async end(m: Med) {
    delete this.errs[`med:${m.id}`];
    await this.tap('labs_med', `end:${m.id}`, endFields(m.id));
  }

  // ---- Add a course ------------------------------------------------------------------------------------------------------------------

  /**
   * Add: the sentence goes through Today's typed line (`log`, keyed: the same words that got no answer before go with their key again, so
   * the door saves them once). The button says it is working while the door reads it.
   */
  async add() {
    const words = this.text.trim();
    if (!words) return;
    delete this.errs.add;
    const key = this.#keys.keyFor(words) ?? makeKey();
    const a = await this.tap('log', 'add', { text: words, key });
    if (a) this.#keys.forget(words);
    else this.#keys.remember(words, key);
  }

  // ---- the saves ---------------------------------------------------------------------------------------------------------------------

  protected extra(_action: string): FieldValues {
    return { view: 'labs_meds' };
  }

  /** A refusal of a form (and "Nothing changed.") is said next to it; the typed line's too. */
  protected inlineRefusal(action: string) {
    return action.startsWith('labs_') || action === 'log' || action === 'answer';
  }

  /** The door's /log takes no "confirmed": a typed course's read-back is a question, answered yes or no through /answer. */
  protected confirmable(a: SaveAnswer, action: string) {
    return action !== 'log' && !!a.confirm;
  }

  /** Yes on the course's question is its answer "yes" through /answer; Yes on a form's read-back is the same form, confirmed. */
  protected yes(c: NonNullable<Bar['confirm']>): FieldValues {
    return c.action === 'answer' ? { reply: 'yes' } : { confirmed: '1' };
  }

  /** No on the question answers it "no" (nothing is added); No on a form's read-back drops the change. */
  async no() {
    const c = this.bar?.confirm;
    this.closeBar();
    if (c?.action === 'answer') await this.tap('answer', 'add', { ...c.fields, reply: 'no' });
  }

  /** A typed line's receipt and notes, as Today's bar shows them. */
  protected lines(a: SaveAnswer, action: string, confirm: boolean): string[] {
    const typed = action === 'log' || action === 'answer';
    return [typed && a.receipt.length ? a.receipt.join('\n') : null, ...(typed ? a.notes : []), ...super.lines(a, action, confirm)].filter((x): x is string => !!x);
  }

  protected handle(sent: Sent<SaveAnswer>, action: string, fields: FieldValues): SaveAnswer | null {
    const a = super.handle(sent, action, fields);
    if (!a) return a;
    // "Nothing changed." is said next to the form (or on the row) only.
    if (a.outcome === 'unchanged' && action.startsWith('labs_')) this.closeBar();
    // The typed course's read-back: Yes and No in the answer bar (the question is also under Needs you on Today until answered).
    const q = action === 'log' ? courseQuestion(a) : null;
    if (q) {
      this.show({
        tone: 'warning',
        head: a.head,
        lines: [],
        undo: null,
        confirm: { readBack: q.readBack || a.read_back || '', label: q.yes, noLabel: q.no, action: 'answer', fields: { question_id: q.id } },
      });
    }
    // A No answered quietly: the bar stays closed.
    if (action === 'answer' && fields.reply === 'no' && a.outcome !== 'rejected') this.closeBar();
    return a;
  }

  protected take(answer: SaveAnswer, action: string, fields: FieldValues) {
    const a = answer as MedsAnswer;
    const before = this.meds;
    if (a.labs_meds) {
      this.meds = a.labs_meds;
      this.#loaded = a.labs_meds;
    }
    const form = formOf(action, fields);
    if (a.outcome === 'rejected' || a.outcome === 'unchanged') {
      // End has no form: its refusal ("That course has a stop date already.") is said on the course's row
      if (form) this.errs[form] = a.reason ?? a.head;
      return;
    }
    if (form) delete this.errs[form];
    if (a.outcome === 'needs_confirmation') return; // the read-back: what was typed stays until Yes
    if (!['saved', 'changed', 'partly_saved'].includes(a.outcome)) return;
    this.fresh = null;
    if (action === 'labs_med') {
      this.editing = null;
      const id = Number(fields.id);
      if (Number.isInteger(id)) this.fresh = id;
    } else if (a.labs_meds && (action === 'answer' || action === 'log')) {
      // a new course added through the typed line's yes: its row gets a blue edge, the box is emptied
      this.fresh = addedMeds(before, a.labs_meds)[0] ?? null;
      this.text = '';
    }
  }
}

const KEY = Symbol('meds-page');
export const setMedsPage = (p: MedsPage) => setContext(KEY, p);
export const getMedsPage = () => getContext<MedsPage>(KEY);

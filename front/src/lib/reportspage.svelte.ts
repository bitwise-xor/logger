/**
 * Medical's Reports tab in the browser (deploy 106): the Reports on screen and the open report (the page's address carries ?open=R12), what
 * is typed in a value's form and in the report's form, why a form was refused (next to it; what was typed stays) and the value a save
 * just changed. The answer bar and the taps on their way are the shared part (answers.svelte.ts).
 * Every save goes to a form action of /medical (`labs_value`, `labs_report`) with view "labs" and the open report, and its answer brings the
 * fresh Reports with the report open, which replace the page with no reload. No save here has a key or Undo, and none is ever sent again
 * by the page (saver.ts, `labs_`).
 *
 * Every change is shown first by the door (needs_confirmation, its read-back in the answer bar with "Yes, change" and "No"): Yes sends the
 * same form again with confirmed; No drops it. Nothing of a value, a test or a report is written to a log line.
 */
import { goto } from '$app/navigation';
import { getContext, setContext, untrack } from 'svelte';
import { Answers } from './answers.svelte.js';
import {
  changedFields,
  formOf,
  reportDraft,
  reportFields,
  reportsHref,
  reportsView,
  valueDraft,
  valueFields,
  type LabValue,
  type Labs,
  type ReportField,
  type ValueField,
} from './medical.js';
import type { SaveAnswer, Undo } from './day.js';
import type { FieldValues, Sent } from './saver.js';

type LabsAnswer = SaveAnswer & { labs?: Labs };

export class ReportsPage extends Answers {
  labs = $state.raw<Labs | null>(null);
  /** The open report's number (?open=R12), or none. */
  open = $state<number | null>(null);
  /** The value whose pencil is open, what is typed in its form. */
  editing = $state<number | null>(null);
  draft = $state<Record<ValueField, string>>({ value: '', unit: '', ref: '' });
  /** "Change date, title or notes": its form open and what is typed. */
  reportForm = $state(false);
  report = $state<Record<ReportField, string>>({ collected: '', title: '', provider: '', notes: '' });
  /** Why a form was refused, by form ("value:10", "report"). */
  errs = $state<Record<string, string>>({});
  /** The value a save just changed (blue edge). */
  fresh = $state<number | null>(null);

  #loaded: Labs | null = null;

  constructor(labs: Labs | null, open: number | null, undo: Undo | null) {
    super('/medical');
    this.load(labs, open, undo);
  }

  /** The page's load (a visit, another report). */
  load(labs: Labs | null, open: number | null, undo: Undo | null) {
    // the page's effect runs this when its data changes: what the page's own state reads in here is no reason to run it again
    untrack(() => {
      if (this.#loaded === labs && labs !== null) return;
      this.#loaded = labs;
      this.labs = labs;
      this.open = open;
      this.#setReport(labs?.open?.id ?? null, true);
      this.loadUndo(undo);
    });
  }

  /** Another report (or the same one fresh): the forms start from it; the same report keeps what is typed unless `reset`. */
  #setReport(id: number | null, reset: boolean) {
    const r = this.labs?.open;
    const other = id !== (this.#shown ?? null);
    this.#shown = id;
    if (!r) {
      this.editing = null;
      this.reportForm = false;
      return;
    }
    if (other) {
      this.errs = {};
      this.editing = null;
      this.reportForm = false;
      this.fresh = null;
    }
    if (other || reset) this.report = reportDraft(r);
  }
  #shown: number | null = null;

  /** A row tapped: its report opens (the address carries it); tapped again it closes. */
  toggle(id: number) {
    const next = this.open === id ? null : id;
    this.open = next;
    if (next === null && this.labs) this.labs = { ...this.labs, open: null };
    void goto(reportsHref(next), { reset: false });
  }

  close() {
    if (this.open !== null) this.toggle(this.open);
  }

  // ---- a value's pencil -----------------------------------------------------------------------------------------------------------

  /** The pencil: the form opens with the value, unit and range as printed; tapped again it closes. */
  pencil(v: LabValue) {
    if (this.editing === v.id) {
      this.editing = null;
      return;
    }
    this.editing = v.id;
    this.draft = valueDraft(v);
    delete this.errs[`value:${v.id}`];
  }

  /** Save: only what changed; the door shows it first (the answer bar's read-back), Yes sends it again confirmed. */
  async saveValue(v: LabValue) {
    const changed = changedFields(valueDraft(v), this.draft);
    delete this.errs[`value:${v.id}`];
    await this.tap('labs_value', `value:${v.id}`, valueFields(v.id, changed));
  }

  /** "Change date, title or notes". */
  toggleReportForm() {
    this.reportForm = !this.reportForm;
    delete this.errs.report;
  }

  async saveReport() {
    const r = this.labs?.open;
    if (!r) return;
    const changed = changedFields(reportDraft(r), this.report);
    delete this.errs.report;
    await this.tap('labs_report', 'report', reportFields(r.id, changed));
  }

  // ---- the saves ---------------------------------------------------------------------------------------------------------------------

  protected extra(_action: string): FieldValues {
    return reportsView(this.open);
  }

  /** A refusal of a form (and "Nothing changed.") is said next to it. */
  protected inlineRefusal(action: string) {
    return action.startsWith('labs_');
  }

  protected handle(sent: Sent<SaveAnswer>, action: string, fields: FieldValues): SaveAnswer | null {
    const a = super.handle(sent, action, fields);
    // "Nothing changed." is said next to the form only.
    if (a && a.outcome === 'unchanged' && action.startsWith('labs_')) this.closeBar();
    return a;
  }

  protected take(answer: SaveAnswer, action: string, fields: FieldValues) {
    const a = answer as LabsAnswer;
    if (a.labs) {
      this.labs = a.labs;
      this.#loaded = a.labs;
    }
    const form = formOf(action, fields);
    if (a.outcome === 'rejected' || a.outcome === 'unchanged') {
      if (form) this.errs[form] = a.reason ?? a.head;
      if (a.labs) this.#setReport(a.labs.open?.id ?? null, false);
      return;
    }
    if (form) delete this.errs[form];
    if (a.outcome === 'needs_confirmation') return; // the read-back: what was typed stays until Yes
    if (!['saved', 'changed', 'partly_saved'].includes(a.outcome)) return;
    this.fresh = null;
    if (a.labs) this.#setReport(a.labs.open?.id ?? null, true);
    if (action === 'labs_value') {
      const id = Number(fields.id);
      this.editing = null;
      if (Number.isInteger(id)) this.fresh = id;
    }
    if (action === 'labs_report') this.reportForm = false;
  }
}

const KEY = Symbol('reports-page');
export const setReportsPage = (p: ReportsPage) => setContext(KEY, p);
export const getReportsPage = () => getContext<ReportsPage>(KEY);

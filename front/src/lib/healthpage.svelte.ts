/**
 * The Health page's state in the browser (deploy 92): the days and charts on screen (the door's Health), the body card (Body),
 * which day's row is open, the rows a save changed (blue edge), whether the body form is open, and which measure's chart shows.
 * The answer bar and the taps on their way are the shared part (answers.svelte.ts). A day's Save goes to the form action
 * health_day and its answer brings the fresh Health (view "health", the range and "Show all" shown); the body form's goes to
 * body and brings the fresh card (view "body"); Undo asks for the read of the save it undoes.
 */
import { getContext, setContext } from 'svelte';
import { Answers, type Bar } from './answers.svelte.js';
import type { SaveAnswer, Undo } from './day.js';
import type { Body, Health } from './health.js';
import type { FieldValues } from './saver.js';

export class HealthPage extends Answers {
  health = $state.raw<Health | null>(null);
  body = $state.raw<Body | null>(null);
  /** The day whose row is open to change (phones and tablets), or none. */
  open = $state<string | null>(null);
  /** The days a save changed (blue edge). */
  fresh = $state.raw<Set<string>>(new Set());
  /** The body form open (Measure), and the measure whose chart shows (its chip). */
  measuring = $state(false);
  measure = $state<string | null>(null);
  /** The body card after a save (blue edge on the table). */
  bodyFresh = $state(false);

  #loaded: Health | null = null;
  /** The read an Undo asks for: the one of the save that made it (after a reload: the days). */
  #undoView: 'health' | 'body' = 'health';

  constructor(health: Health | null, body: Body | null, undo: Undo | null, measuring: boolean) {
    super('/health');
    this.load(health, body, undo, measuring);
  }

  /** The page's load (a visit, another range, the body form on another session), with the session's Undo. */
  load(health: Health | null, body: Body | null, undo: Undo | null, measuring: boolean) {
    if (health === this.#loaded) return;
    this.#loaded = health;
    this.health = health;
    this.body = body;
    this.fresh = new Set();
    this.bodyFresh = false;
    if (this.open && !health?.days.some((d) => d.day === this.open)) this.open = null;
    this.measuring = measuring;
    if (!this.measure || !body?.charts.some((c) => c.key === this.measure)) this.measure = body?.charts[0]?.key ?? null;
    this.loadUndo(undo);
  }

  /** A day's row tapped: it opens (another one closes), or closes when it was open. */
  toggle(day: string) {
    this.open = this.open === day ? null : day;
  }

  /** Every save asks for the page's range; a day's row for the days with "Show all" as shown, a body session for the card. */
  protected extra(action: string): FieldValues {
    const h = this.health;
    const view = action === 'body' ? 'body' : action === 'undo' ? this.#undoView : 'health';
    const out: FieldValues = { view };
    if (h) out.range = String(h.range);
    if (h?.all && view === 'health') out.all = '1';
    return out;
  }

  /**
   * "Yes" on a read-back: a value cleared is asked first ("Delete on …?"): its yes is confirm_delete; then an odd value ("Check:
   * …"): its yes is confirmed, keeping confirm_delete (docs/API.md). A save that clears a value and was not yet confirmed is the
   * delete's question.
   */
  protected yes(c: NonNullable<Bar['confirm']>): FieldValues {
    const f = c.fields;
    return f.confirm_delete !== '1' && f.clears === '1' ? { confirm_delete: '1' } : { confirmed: '1' };
  }

  /** A question the save opened (a new weight far from the last: the logger's own) waits under Needs you on Today. */
  protected lines(a: SaveAnswer, action: string, confirm: boolean): string[] {
    return super.lines(a, action, confirm).map((l) => l.replace(/under Needs you\.$/, 'under Needs you on Today.'));
  }

  /** The fresh read onto the screen: the changed day gets a blue edge and its row closes; a body session closes the form. */
  protected take(a: SaveAnswer, action: string, fields: FieldValues) {
    const went = ['saved', 'changed', 'partly_saved'].includes(a.outcome);
    if (went && action !== 'undo' && a.undo) this.#undoView = action === 'body' ? 'body' : 'health';
    if (a.health) {
      const day = typeof fields.day === 'string' ? fields.day : null;
      this.fresh = went && day && action === 'health_day' ? new Set([day]) : new Set();
      if (went && action === 'health_day' && this.open === day) this.open = null;
      this.health = a.health;
      this.#loaded = a.health;
    }
    if (a.body) {
      this.body = a.body;
      this.bodyFresh = went;
      if (went && action === 'body') this.measuring = false;
      if (!this.measure || !a.body.charts.some((c) => c.key === this.measure)) this.measure = a.body.charts[0]?.key ?? null;
    }
  }
}

const KEY = Symbol('health-page');
export const setHealthPage = (p: HealthPage) => setContext(KEY, p);
export const getHealthPage = () => getContext<HealthPage>(KEY);

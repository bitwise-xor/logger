/**
 * Saving in place, the part every page shares (step C, deploy 80; shared with the Food day since step E, deploy 84): which taps
 * are on their way (`busy`), and the answer bar (the save's head and tone, its read-back to confirm, and Undo for 15 minutes).
 * Each tap is a form posted to the page's form action by the Saver (src/lib/saver.ts); the page's own class (Today in
 * today.svelte.ts, FoodPage in foodday.svelte.ts) puts the answer's fresh day on screen (`take`).
 */
import { goto } from '$app/navigation';
import { deserialize } from '$app/forms';
import type { SaveAnswer, Undo } from './day.js';
import { Saver, type FieldValues, type Sent } from './saver.js';
import { loginHref } from './next.js';

export interface Bar {
  id: number;
  tone: 'ok' | 'warning';
  head: string;
  /** Smaller lines under the head: the reason, a look-up's answer, the words of a message read again. */
  lines: string[];
  /** Shown while the session's Undo lasts, when this save made it (or after a reload, from the page's read). */
  undo: Undo | null;
  /** A read-back to confirm: Yes sends the same tap again with confirmed. */
  confirm: null | { readBack: string; label: string; noLabel: string; action: string; fields: FieldValues };
  /** A link under the lines: "Open the full app" when the door is off (step F). */
  link?: string | null;
}

/** How long a plain "saved" line stays (an Undo, a warning or a question stays until closed or over). */
const QUIET_MS = 6000;

export abstract class Answers {
  bar = $state<Bar | null>(null);
  busy = $state<Record<string, boolean>>({});

  protected saver: Saver;
  protected undoToken: string | null = null;
  #bars = 0;
  #timer: ReturnType<typeof setTimeout> | undefined;

  /** page: the path whose form actions the taps call ("/" Today, "/food" the Food day). */
  constructor(page: string) {
    let storage: Storage | null = null;
    try {
      storage = typeof sessionStorage === 'undefined' ? null : sessionStorage;
    } catch {
      storage = null;
    }
    this.saver = new Saver({ fetch: (u, i) => fetch(u, i), deserialize: (t) => deserialize(t) as never, storage, page });
  }

  /** The answer's fresh day onto the screen. */
  protected abstract take(a: SaveAnswer, action: string, fields: FieldValues): void;

  /** Fields every save of the page carries (the Food day: the day shown, so the answer brings that day; the Health page: its range). */
  protected extra(_action: string): FieldValues {
    return {};
  }

  /** What "Yes" adds to a read-back's tap (the Health page: confirm_delete for a value cleared, deploy 92). */
  protected yes(_confirm: NonNullable<Bar['confirm']>): FieldValues {
    return { confirmed: '1' };
  }

  /** The bar's smaller lines under the head. */
  protected lines(a: SaveAnswer, _action: string, confirm: boolean): string[] {
    return [
      a.result,
      !confirm && !a.questions.length ? a.read_back : null,
      a.reason,
      a.questions.length ? (a.questions.length === 1 ? 'The question is under Needs you.' : 'The questions are under Needs you.') : null,
    ].filter((x): x is string => !!x);
  }

  /** Whether the answer's read-back is confirmed in the bar (Yes = the same tap with confirmed). */
  protected confirmable(a: SaveAnswer, _action: string): boolean {
    return !!a.confirm;
  }

  /**
   * A refusal the page shows next to what was typed instead of in the bar (deploy 87: a usual meal's Save, "Save as usual meal"):
   * the page's take() keeps the edits and says why there.
   */
  protected inlineRefusal(_action: string): boolean {
    return false;
  }

  /**
   * After the sign-in: a tap of this page that met a gone session is sent again, with its key (src/lib/saver.ts). Today has its
   * own (a typed line goes the box's way).
   */
  async resend() {
    const kept = this.saver.takeKept();
    if (!kept?.fresh) return;
    this.handle(await this.saver.send<SaveAnswer>(kept.action, kept.fields), kept.action, kept.fields);
  }

  /** The session's Undo after a load (a reload, another day): the bar with Undo while it lasts. */
  protected loadUndo(undo: Undo | null) {
    this.undoToken = undo?.token ?? null;
    if (undo && Date.parse(undo.expires_at) > Date.now()) this.show({ tone: 'ok', head: undo.head, lines: [], undo, confirm: null });
  }

  /** A form's submit: the tap goes to the form action, the page stays. `id` marks the tapped thing as busy. */
  submit(action: string, id: string, done?: (a: SaveAnswer | null, form: HTMLFormElement) => void) {
    return (event: SubmitEvent) => {
      event.preventDefault();
      const form = event.currentTarget as HTMLFormElement;
      const fields: FieldValues = {};
      new FormData(form, event.submitter).forEach((v, k) => {
        if (typeof v !== 'string') return;
        const had = fields[k];
        fields[k] = had === undefined ? v : Array.isArray(had) ? [...had, v] : [had, v];
      });
      void this.tap(action, id, fields).then((a) => {
        // A typed answer's field is emptied once it went through.
        if (a && a.tone === 'ok' && form.dataset.reset !== undefined) form.reset();
        done?.(a, form);
      });
    };
  }

  /** One tap: the answer's fresh day replaces the one shown. Resolves to the answer, or null (dropped, signed out, a problem). */
  async tap(action: string, id: string, fields: FieldValues): Promise<SaveAnswer | null> {
    if (this.busy[id]) return null;
    this.busy[id] = true;
    try {
      const all = { ...this.extra(action), ...fields };
      const sent = await this.saver.send<SaveAnswer>(action, all);
      return this.handle(sent, action, all);
    } finally {
      delete this.busy[id];
    }
  }

  closeBar() {
    clearTimeout(this.#timer);
    this.bar = null;
  }

  /** "Yes, save it" on a read-back: the same tap again, confirmed, with a new key (the first one saved nothing). */
  async confirm() {
    const c = this.bar?.confirm;
    if (!c) return;
    const { key: _old, ...fields } = c.fields;
    await this.tap(c.action, `confirm:${c.action}`, { ...fields, ...this.yes(c) });
  }

  async undo() {
    const u = this.bar?.undo;
    if (u) await this.tap('undo', 'undo', { token: u.token });
  }

  protected handle(sent: Sent<SaveAnswer>, action: string, fields: FieldValues): SaveAnswer | null {
    if (sent.kind === 'stale') return null;
    if (sent.kind === 'signed_out') {
      void goto(loginHref(location.pathname + location.search));
      return null;
    }
    if (sent.kind === 'problem') {
      this.show({ tone: 'warning', head: 'Not saved.', lines: [sent.message], undo: null, confirm: null, link: sent.link ?? null });
      return null;
    }
    const a = sent.answer;
    this.take(a, action, fields);
    if (a.outcome === 'rejected' && this.inlineRefusal(action)) {
      this.closeBar();
      return a;
    }
    // The Undo button only for the save that made this Undo: an older one would undo something else than the line says.
    const madeUndo = a.undo && a.undo.token !== this.undoToken ? a.undo : null;
    this.undoToken = a.undo?.token ?? null;
    const confirm = a.confirm && this.confirmable(a, action) ? a.confirm : null;
    const lines = this.lines(a, action, !!confirm);
    // A private line: "Saved privately." and nothing else (the door sends nothing else either).
    const quiet = a.head === 'Saved privately.';
    this.show({
      tone: a.tone,
      head: a.head,
      lines: quiet ? [] : lines,
      undo: quiet ? null : madeUndo,
      confirm: confirm ? { readBack: a.read_back ?? '', label: confirm.label, noLabel: confirm.no_label, action, fields } : null,
    });
    return a;
  }

  protected show(b: Omit<Bar, 'id'>) {
    clearTimeout(this.#timer);
    const id = ++this.#bars;
    this.bar = { id, ...b };
    if (typeof window === 'undefined') return; // no timers on the server
    const until = b.undo ? Date.parse(b.undo.expires_at) - Date.now() : b.tone === 'ok' && !b.confirm && !b.lines.length ? QUIET_MS : 0;
    if (until > 0) {
      this.#timer = setTimeout(() => {
        if (this.bar?.id === id) this.bar = null;
      }, Math.min(until, 2 ** 31 - 1));
    }
  }
}

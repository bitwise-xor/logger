/**
 * Today's state in the browser (step C, deploy 80): the day on screen, which taps are on their way, the rows a save added (blue
 * edge), and the answer bar at the bottom (the save's head and tone, its read-back to confirm, and Undo for 15 minutes).
 * The cards reach it through getToday(); each tap is a form posted to a form action by the Saver (src/lib/saver.ts).
 */
import { goto } from '$app/navigation';
import { deserialize } from '$app/forms';
import { getContext, setContext } from 'svelte';
import { freshRefs, type Day, type SaveAnswer, type Undo } from './day.js';
import { Saver, type FieldValues, type Sent } from './saver.js';

export interface Bar {
  id: number;
  tone: 'ok' | 'warning';
  head: string;
  /** Smaller lines under the head: the reason, a look-up's answer, the words of a message read again. */
  lines: string[];
  /** Shown while the session's Undo lasts, when this save made it (or after a reload, from GET /day). */
  undo: Undo | null;
  /** A read-back to confirm: Yes sends the same tap again with confirmed. */
  confirm: null | { readBack: string; label: string; noLabel: string; action: string; fields: FieldValues };
}

/** How long a plain "saved" line stays (an Undo, a warning or a question stays until closed or over). */
const QUIET_MS = 6000;

export class Today {
  day = $state.raw<Day | null>(null);
  fresh = $state.raw<Set<string>>(new Set());
  bar = $state<Bar | null>(null);
  busy = $state<Record<string, boolean>>({});

  #saver: Saver;
  #undoToken: string | null = null;
  #bars = 0;
  #timer: ReturnType<typeof setTimeout> | undefined;
  #loaded: Day | null = null;

  constructor(day: Day | null, undo: Undo | null) {
    let storage: Storage | null = null;
    try {
      storage = typeof sessionStorage === 'undefined' ? null : sessionStorage;
    } catch {
      storage = null;
    }
    this.#saver = new Saver({ fetch: (u, i) => fetch(u, i), deserialize: (t) => deserialize(t) as never, storage });
    this.load(day, undo);
  }

  /** The day the page loaded (first visit, a reload, or after a sign-in), with the session's Undo if it still lasts. */
  load(day: Day | null, undo: Undo | null) {
    if (day === this.#loaded) return; // the same load again (the page's effect on its first run)
    this.#loaded = day;
    this.day = day;
    this.fresh = new Set();
    this.#undoToken = undo?.token ?? null;
    if (undo && Date.parse(undo.expires_at) > Date.now()) this.#show({ tone: 'ok', head: undo.head, lines: [], undo, confirm: null });
  }

  /** After the sign-in: a tap that met a gone session is sent again, with its key (src/lib/saver.ts). */
  async resend() {
    const sent = await this.#saver.resend<SaveAnswer>();
    if (sent) this.#handle(sent, '', {});
  }

  /** A form's submit: the tap goes to the form action, the page stays. `id` marks the tapped thing as busy. */
  submit(action: string, id: string) {
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
      });
    };
  }

  /** One tap: the answer's fresh day replaces the one shown. Resolves to the answer, or null (dropped, signed out, a problem). */
  async tap(action: string, id: string, fields: FieldValues): Promise<SaveAnswer | null> {
    if (this.busy[id]) return null;
    this.busy[id] = true;
    try {
      const sent = await this.#saver.send<SaveAnswer>(action, fields);
      return this.#handle(sent, action, fields);
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
    await this.tap(c.action, `confirm:${c.action}`, { ...fields, confirmed: '1' });
  }

  async undo() {
    const u = this.bar?.undo;
    if (u) await this.tap('undo', 'undo', { token: u.token });
  }

  #handle(sent: Sent<SaveAnswer>, action: string, fields: FieldValues): SaveAnswer | null {
    if (sent.kind === 'stale') return null;
    if (sent.kind === 'signed_out') {
      void goto('/login');
      return null;
    }
    if (sent.kind === 'problem') {
      this.#show({ tone: 'warning', head: 'Not saved.', lines: [sent.message], undo: null, confirm: null });
      return null;
    }
    const a = sent.answer;
    if (a.day && this.day) this.fresh = freshRefs(this.day, a.day);
    if (a.day) this.day = a.day;
    // The Undo button only for the save that made this Undo: an older one would undo something else than the line says.
    const madeUndo = a.undo && a.undo.token !== this.#undoToken ? a.undo : null;
    this.#undoToken = a.undo?.token ?? null;
    const lines = [a.reason, a.result, a.refill ? `Its words: “${a.refill.text}”` : null].filter((x): x is string => !!x);
    this.#show({
      tone: a.tone,
      head: a.head,
      lines,
      undo: madeUndo,
      confirm: a.confirm
        ? { readBack: a.read_back ?? '', label: a.confirm.label, noLabel: a.confirm.no_label, action, fields }
        : null,
    });
    return a;
  }

  #show(b: Omit<Bar, 'id'>) {
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

const KEY = Symbol('today');
export const setToday = (t: Today) => setContext(KEY, t);
export const getToday = () => getContext<Today>(KEY);

/**
 * A Settings tab's state in the browser (deploy 111): the door's read on screen, why a form was refused (next to it; what was typed
 * stays) and the answer bar. Every save goes to a form action of the tab's own page and its answer brings the tab's fresh read
 * (`settings_<tab>`), which replaces the one shown: the Today page tab's list is always the door's. None takes a key, none has Undo,
 * none is ever sent again by the page (saver.ts). "Show everything again" and "Sign out all others" are asked first in the answer bar
 * (the door does not ask): Yes sends the tap.
 */
import { Answers } from './answers.svelte.js';
import type { SaveAnswer } from './day.js';
import type { SettingsTab } from './places.js';
import type { FieldValues } from './saver.js';

/** The forms whose refusal stands next to them (their name in `errs`); the other taps say it in the answer bar. */
const FORM_OF: Record<string, string> = {
  settings_targets: 'targets',
  settings_height: 'height',
  settings_body: 'body',
  settings_coach: 'coach',
  settings_nudges: 'nudges',
};

export class SettingsPage<T> extends Answers {
  read = $state.raw<T | null>(null);
  /** Why a form was refused ("targets", "height", "body", "coach", "nudges"): next to it. */
  errs = $state<Record<string, string>>({});
  /** The door's read in the answer: settings_targets, …, settings_notify. */
  readonly key: string;
  #loaded: T | null = null;

  /** path: the tab's page, whose form actions the saves call (/settings/targets, …). */
  constructor(tab: SettingsTab, read: T | null, path: string) {
    super(path);
    this.key = `settings_${tab}`;
    this.load(read);
  }

  /** The page's load (a reload, a sign-in): the read; nothing of a form is kept. (No Undo is offered here.) */
  load(read: T | null) {
    if (read === this.#loaded) return;
    this.#loaded = read;
    this.read = read;
    this.loadUndo(null);
  }

  /** A form's own check before anything is sent (a wrong kind of field, in app.'s words): next to the form. */
  refuse(form: string, words: string | null) {
    if (words) this.errs[form] = words;
    else delete this.errs[form];
  }

  /** "Shown first, then Yes": the question in the answer bar; Yes sends the tap, No closes it. */
  ask(head: string, yes: string, action: string, fields: FieldValues = {}) {
    this.show({ tone: 'warning', head, lines: [], undo: null, confirm: { readBack: '', label: yes, noLabel: 'No', action, fields } });
  }

  /** What the browser itself said, in the answer bar (deploy 112: "This device", e.g. "Notifications were not allowed."). */
  tell(head: string) {
    this.show({ tone: 'warning', head, lines: [], undo: null, confirm: null });
  }

  protected inlineRefusal(action: string) {
    return action in FORM_OF;
  }

  protected take(a: SaveAnswer, action: string, _fields: FieldValues) {
    const fresh = (a as unknown as Record<string, unknown>)[this.key] as T | undefined;
    if (fresh) {
      this.read = fresh;
      this.#loaded = fresh;
    }
    const form = FORM_OF[action];
    if (!form) return;
    if (a.outcome === 'rejected') this.errs[form] = a.reason ?? a.head;
    else delete this.errs[form];
  }
}

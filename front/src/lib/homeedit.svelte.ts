/**
 * Home's Edit zones page's state in the browser (deploy 100): the read on screen, which forms are open (a chore's, a chore's Per zone
 * table, a zone's, "+ New chore", "+ New zone"), what is typed in each (kept while the page is open; a refusal keeps it), why a form
 * was refused (next to it) and the row a save just changed (blue edge). Every save goes to a form action of /home/edit and its answer
 * brings the fresh Edit read (view "home_edit"). None takes a key and none has Undo (the answer bar shows the door's words only); a
 * button is blocked while its save is on the way and no Home save is ever sent again by the page (saver.ts).
 */
import { getContext, setContext } from 'svelte';
import { Answers } from './answers.svelte.js';
import type { SaveAnswer, Undo } from './day.js';
import {
  activeFields,
  choreDraftOf,
  choreFields,
  choreOfHash,
  choreProblem,
  formOf,
  goalFields,
  goalProblem,
  keyOf,
  newChoreDraft,
  newZoneDraft,
  perZoneDraftOf,
  perZoneFields,
  perZoneProblem,
  zoneDraftOf,
  zoneFields,
  zoneProblem,
  type ChoreDraft,
  type Edit,
  type EditChore,
  type EditZone,
  type PerZoneDraft,
  type ZoneDraft,
} from './homeparts.js';
import type { FieldValues } from './saver.js';

const WENT = ['saved', 'changed', 'partly_saved'];

/** Every chore of the read: the whole flat's and each zone's. */
export const choresOf = (e: Edit): EditChore[] => [...e.flat, ...e.zones.flatMap((z) => z.chores)];

export class EditPage extends Answers {
  edit = $state.raw<Edit | null>(null);
  /** The forms open, by key (keyOf). */
  open = $state<Record<string, boolean>>({});
  chores = $state<Record<string, ChoreDraft>>({});
  zones = $state<Record<string, ZoneDraft>>({});
  perZone = $state<Record<string, PerZoneDraft[]>>({});
  goal = $state('');
  /** Why a form was refused, by key: next to it. */
  errs = $state<Record<string, string>>({});
  /** The row a save just changed ("c:7", "z:2", "goal": blue edge). */
  changed = $state<string | null>(null);

  #loaded: Edit | null = null;

  constructor(edit: Edit | null) {
    super('/home/edit');
    this.load(edit);
  }

  /** The page's load: the read, nothing open, the goal as it is. (No Undo is offered here.) */
  load(edit: Edit | null) {
    if (edit === this.#loaded) return;
    this.#loaded = edit;
    this.edit = edit;
    this.open = {};
    this.chores = {};
    this.zones = {};
    this.perZone = {};
    this.errs = {};
    this.changed = null;
    this.goal = edit ? String(edit.goal) : '';
    this.loadUndo(null);
  }

  // ---- opening and closing the forms -------------------------------------------------------------------------------------------

  #close(key: string) {
    delete this.open[key];
    delete this.chores[key];
    delete this.zones[key];
    delete this.perZone[key];
    delete this.errs[key];
  }

  toggleChore(c: EditChore) {
    const k = keyOf.chore(c.chore_id);
    if (this.open[k]) return this.#close(k);
    this.chores[k] = choreDraftOf(c);
    delete this.errs[k];
    this.open[k] = true;
  }

  togglePerZone(c: EditChore) {
    const k = keyOf.perZone(c.chore_id);
    if (this.open[k]) return this.#close(k);
    this.perZone[k] = perZoneDraftOf(c);
    delete this.errs[k];
    this.open[k] = true;
  }

  toggleZone(z: EditZone) {
    const k = keyOf.zone(z.zone_id);
    if (this.open[k]) return this.#close(k);
    this.zones[k] = zoneDraftOf(z);
    delete this.errs[k];
    this.open[k] = true;
  }

  toggleNewChore() {
    const k = keyOf.newChore;
    if (this.open[k]) return this.#close(k);
    if (this.edit) this.chores[k] = newChoreDraft(this.edit.limits);
    this.open[k] = true;
  }

  toggleNewZone() {
    const k = keyOf.newZone;
    if (this.open[k]) return this.#close(k);
    this.zones[k] = newZoneDraft();
    this.open[k] = true;
  }

  /** A chore's page leads here with `#chore-7`: that chore's form open. Returns the chore's id when it was found. */
  openFromHash(hash: string): number | null {
    const id = choreOfHash(hash);
    const c = id === null || !this.edit ? null : choresOf(this.edit).find((x) => x.chore_id === id);
    if (!c) return null;
    if (!this.open[keyOf.chore(c.chore_id)]) this.toggleChore(c);
    return c.chore_id;
  }

  // ---- the saves ---------------------------------------------------------------------------------------------------------------

  async saveGoal() {
    const stop = this.edit ? goalProblem(this.goal, this.edit.limits) : null;
    if (stop) {
      this.errs[keyOf.goal] = stop;
      return;
    }
    delete this.errs[keyOf.goal];
    await this.tap('home_goalset', 'goal', goalFields(this.goal));
  }

  async saveChore(c: EditChore) {
    const k = keyOf.chore(c.chore_id);
    const d = this.chores[k];
    if (!d || !this.edit) return;
    const stop = choreProblem(d, this.edit.limits);
    if (stop) {
      this.errs[k] = stop;
      return;
    }
    delete this.errs[k];
    await this.tap('home_choreedit', `save:${k}`, choreFields(d, c.chore_id));
  }

  async addChore() {
    const k = keyOf.newChore;
    const d = this.chores[k];
    if (!d || !this.edit) return;
    const stop = choreProblem(d, this.edit.limits);
    if (stop) {
      this.errs[k] = stop;
      return;
    }
    delete this.errs[k];
    await this.tap('home_chorenew', `save:${k}`, choreFields(d));
  }

  async savePerZone(c: EditChore) {
    const k = keyOf.perZone(c.chore_id);
    const rows = this.perZone[k];
    if (!rows) return;
    const stop = perZoneProblem(rows);
    if (stop) {
      this.errs[k] = stop;
      return;
    }
    delete this.errs[k];
    await this.tap('home_chorezones', `save:${k}`, perZoneFields(c, rows));
  }

  async saveZone(z: EditZone) {
    const k = keyOf.zone(z.zone_id);
    const d = this.zones[k];
    if (!d || !this.edit) return;
    const stop = zoneProblem(d, this.edit.limits);
    if (stop) {
      this.errs[k] = stop;
      return;
    }
    delete this.errs[k];
    await this.tap('home_zoneedit', `save:${k}`, zoneFields(d, z.zone_id));
  }

  async addZone() {
    const k = keyOf.newZone;
    const d = this.zones[k];
    if (!d || !this.edit) return;
    const stop = zoneProblem(d, this.edit.limits);
    if (stop) {
      this.errs[k] = stop;
      return;
    }
    delete this.errs[k];
    await this.tap('home_zonenew', `save:${k}`, zoneFields(d));
  }

  /** Retire or Bring back (the answer bar says it; "History stays." is on the page). */
  async toggleChoreActive(c: EditChore) {
    await this.tap('home_choreactive', `active:${keyOf.chore(c.chore_id)}`, activeFields('chore_id', c.chore_id, !c.active));
  }

  async toggleZoneActive(z: EditZone) {
    await this.tap('home_zoneactive', `active:${keyOf.zone(z.zone_id)}`, activeFields('zone_id', z.zone_id, !z.active));
  }

  protected extra(_action: string): FieldValues {
    return { view: 'home_edit' };
  }

  /** The six forms say a refusal next to themselves (and keep what was typed); Retire and Bring back say it in the answer bar. */
  protected inlineRefusal(action: string) {
    return formOf(action, { chore_id: '0', zone_id: '0' }) !== null;
  }

  protected take(a: SaveAnswer, action: string, fields: FieldValues) {
    const before = this.edit;
    const after = a.home_edit;
    if (after) {
      this.edit = after;
      this.#loaded = after;
    }
    const form = formOf(action, fields);
    if (!WENT.includes(a.outcome)) {
      if (form) this.errs[form] = a.reason ?? a.head;
      return;
    }
    this.changed = null;
    if (form) this.#close(form);
    const id = (k: string) => Number(fields[k]);
    switch (action) {
      case 'home_choreedit':
      case 'home_chorezones':
      case 'home_choreactive':
        this.changed = keyOf.chore(id('chore_id'));
        break;
      case 'home_zoneedit':
      case 'home_zoneactive':
        this.changed = keyOf.zone(id('zone_id'));
        break;
      case 'home_goalset':
        this.changed = keyOf.goal;
        if (after) this.goal = String(after.goal);
        break;
      case 'home_chorenew': {
        const had = new Set(before ? choresOf(before).map((c) => c.chore_id) : []);
        const name = String(fields.name ?? '').toLowerCase();
        const added = after ? choresOf(after).find((c) => !had.has(c.chore_id)) ?? choresOf(after).find((c) => c.name.toLowerCase() === name) : null;
        this.changed = added ? keyOf.chore(added.chore_id) : null;
        break;
      }
      case 'home_zonenew': {
        const had = new Set(before?.zones.map((z) => z.zone_id));
        const name = String(fields.name ?? '').toLowerCase();
        const added = after ? after.zones.find((z) => !had.has(z.zone_id)) ?? after.zones.find((z) => z.name.toLowerCase() === name) : null;
        this.changed = added ? keyOf.zone(added.zone_id) : null;
        break;
      }
    }
  }
}

const KEY = Symbol('home-edit');
export const setEditPage = (p: EditPage) => setContext(KEY, p);
export const getEditPage = () => getContext<EditPage>(KEY);

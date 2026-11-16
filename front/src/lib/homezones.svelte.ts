/**
 * Home's Zones page's state in the browser (deploy 100): the read on screen, the zone cards folded or open (as the door says on a
 * visit, then as you left them), a tick on its way (a tile and the same pair's row in a zone card are one tap: the circle and the tile
 * show it at once, the circle with the blue edge), All done on its way, and a starting point's row that leaves at once. Every save goes
 * to a form action of /home/zones (home_tick, home_alldone, home_startpoint, undo) and its answer brings the fresh Zones read (view
 * "home_zones"). tick, alldone and startpoint take a key (a new one per tap); a button is blocked while its save is on the way and no
 * Home save is ever sent again by the page (saver.ts).
 */
import { getContext, setContext } from 'svelte';
import { Answers } from './answers.svelte.js';
import type { SaveAnswer, Undo } from './day.js';
import { pairKey, tickFields, type HomeRow } from './home.js';
import { alldoneFields, startFields, startKey, type FlatChore, type StartJob, type Tile, type Zones } from './homeparts.js';
import type { FieldValues } from './saver.js';

const WENT = ['saved', 'changed', 'partly_saved'];

export class ZonesPage extends Answers {
  zones = $state.raw<Zones | null>(null);
  /** A tick on its way, by pair: the circle and the tile show it done (or not) at once. */
  pending = $state<Record<string, boolean>>({});
  /** All done on its way, by chore: the label and the tiles show it at once. */
  allPending = $state<Record<number, boolean>>({});
  /** The pair a tick or All done changed (blue edge on its circle). */
  changed = $state<string | null>(null);
  /** A starting point's job on its way: its row has left. */
  leaving = $state<Record<string, boolean>>({});
  /** A zone card open: the door's `open` on a visit, then as you left it. */
  fold = $state<Record<number, boolean>>({});

  #loaded: Zones | null = null;

  constructor(zones: Zones | null, undo: Undo | null) {
    super('/home/zones');
    this.load(zones, undo);
  }

  /** The page's load (a visit, a reload): the read, the cards as the door says, the session's Undo. */
  load(zones: Zones | null, undo: Undo | null) {
    if (zones === this.#loaded) return;
    this.#loaded = zones;
    this.zones = zones;
    this.fold = Object.fromEntries((zones?.zones ?? []).map((z) => [z.zone_id, z.open]));
    this.pending = {};
    this.allPending = {};
    this.leaving = {};
    this.changed = null;
    if ((undo?.token ?? null) !== this.undoToken) this.loadUndo(undo);
  }

  isOpen(zoneId: number): boolean {
    return this.fold[zoneId] ?? false;
  }

  toggle(zoneId: number) {
    this.fold[zoneId] = !this.isOpen(zoneId);
  }

  /** Done today, as a circle shows it: a tick on its way at once, else the read's. */
  done(r: HomeRow): boolean {
    return this.pending[pairKey(r)] ?? r.done_today;
  }

  /** A tile tinted: the door says (done today or less than half the interval ago), a tap or All done on its way at once. */
  tinted(t: Tile): boolean {
    return this.pending[pairKey(t)] ?? this.allPending[t.chore_id] ?? t.tinted;
  }

  /** The short age on a tile: "today" while a tick is on its way. */
  age(t: Tile): string {
    return (this.pending[pairKey(t)] ?? this.allPending[t.chore_id]) === true ? 'today' : t.age_short;
  }

  allDone(f: FlatChore): boolean {
    return this.allPending[f.chore_id] ?? f.all_done_today;
  }

  /** The circle of a row or the tap on a tile: done now, or the tick taken back (the door's tick toggles a pair done today). */
  async tick(r: HomeRow) {
    const k = pairKey(r);
    if (this.busy[`tick:${k}`]) return;
    this.pending[k] = !r.done_today;
    this.changed = k;
    try {
      await this.tap('home_tick', `tick:${k}`, tickFields(r));
    } finally {
      delete this.pending[k];
    }
  }

  /** "All done" on a whole-flat chore; once every zone is done today, a second tap takes it back. */
  async doAllDone(f: FlatChore) {
    const id = `alldone:${f.chore_id}`;
    if (this.busy[id]) return;
    this.allPending[f.chore_id] = !f.all_done_today;
    try {
      await this.tap('home_alldone', id, alldoneFields(f));
    } finally {
      delete this.allPending[f.chore_id];
    }
  }

  /** A chip of "When did you last do these?": the row leaves at once, and comes back if the save was refused. */
  async answer(job: StartJob, ago: string) {
    const k = startKey(job);
    if (this.leaving[k]) return;
    this.leaving[k] = true;
    try {
      await this.tap('home_startpoint', `start:${k}`, startFields(job, ago));
    } finally {
      delete this.leaving[k];
    }
  }

  protected extra(_action: string): FieldValues {
    return { view: 'home_zones' };
  }

  /** The fresh Zones on screen; a refusal leaves no blue edge. */
  protected take(a: SaveAnswer, action: string, fields: FieldValues) {
    const after = a.home_zones;
    if (after) {
      for (const z of after.zones) if (!(z.zone_id in this.fold)) this.fold[z.zone_id] = z.open;
      this.zones = after;
      this.#loaded = after;
    }
    if (!WENT.includes(a.outcome) || action === 'undo') this.changed = null;
    else if (action === 'home_alldone') this.changed = null;
    else if (action === 'home_startpoint') this.changed = null;
    else this.changed = this.changed ?? `${fields.chore_id}:${fields.zone_id}`;
  }
}

const KEY = Symbol('home-zones');
export const setZonesPage = (p: ZonesPage) => setContext(KEY, p);
export const getZonesPage = () => getContext<ZonesPage>(KEY);

/**
 * The Coach page in the browser (deploy 109): the door's Coach on screen (the list, the filter, the card of the day asked), the open
 * coaching, and the day coaching's button. The button posts to the page's form action `coach_day` (the Saver, src/lib/saver.ts: no
 * key, never sent again by itself) and the answer's fresh Coach replaces the one shown, in place; the door's words of the answer (its
 * head, a refusal's reason) are in the answer bar like any save of the other pages. While the card is read, the page asks
 * (coachpoll.svelte.ts) and reads again when it is ready.
 */
import { Answers } from './answers.svelte.js';
import { toggled, type CoachRead } from './coach.js';
import { CoachRun } from './coachrun.svelte.js';
import type { SaveAnswer } from './day.js';
import type { FieldValues } from './saver.js';

export class CoachPage extends Answers {
  coach = $state.raw<CoachRead | null>(null);
  /** The open coaching (a row opens in place on phones and tablets, in the side column on the PC). */
  open = $state<number | null>(null);
  readonly run = new CoachRun();

  #loaded: CoachRead | null = null;

  constructor(read: CoachRead | null) {
    super('/coach');
    this.load(read);
  }

  /** The page's load (a visit, another filter or day, the page read again after a coaching): a new filter closes the open row. */
  load(read: CoachRead | null) {
    if (read === this.#loaded) return;
    const filterChanged = !!this.coach && !!read && this.coach.f !== read.f;
    this.#loaded = read;
    this.coach = read;
    this.run.slow = false;
    if (filterChanged || !read || (this.open !== null && !read.list.some((c) => c.id === this.open))) this.open = null;
  }

  toggle(id: number) {
    this.open = toggled(this.open, id);
  }

  /** The button: one press, one start. The answer's fresh Coach replaces the page's (take); a refusal says why in the bar. */
  start(fields: FieldValues) {
    return this.run.press(() => this.tap('coach_day', 'coach_day', fields));
  }

  protected take(a: SaveAnswer) {
    if (a.coach) this.coach = a.coach;
    this.run.slow = false;
  }
}

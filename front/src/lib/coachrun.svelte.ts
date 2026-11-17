/**
 * The day coaching's button in the browser (deploy 109), the part Today's Coach card and the Coach page share: one press starts one
 * coaching (it costs about 6 cents), so while a start is on its way another press does nothing (`OneStart`, week.ts, as the Week
 * review has it), and the page never sends one again by itself (saver.ts: `coach_` actions are not kept for after a sign-in and not
 * retried after a network error). `slow` is "still being read after 5 minutes" (the card says it takes longer, with Look again).
 */
import { OneStart } from './week.js';

export class CoachRun {
  /** A start is on its way: the button is disabled from the first press until the answer is in. */
  starting = $state(false);
  slow = $state(false);
  #one = new OneStart();

  /** One press: `send` runs once, unless a start is already on its way (then nothing happens and the result is null). */
  async press<T>(send: () => Promise<T>): Promise<T | null> {
    if (this.starting || this.#one.busy) return null;
    this.starting = true;
    try {
      return await this.#one.press(send);
    } finally {
      this.starting = false;
    }
  }
}

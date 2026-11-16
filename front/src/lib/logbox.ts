/**
 * The logging box (step D, deploy 81), the parts that are plain TypeScript: what the "being read" row shows for a line, which
 * key a line goes with, and when its words go back into the box. The box itself is components/today/LogBox.svelte; the flow
 * (send, the row, the answer) is Today.log in today.svelte.ts.
 */
import type { SaveAnswer } from './day.js';
import type { Sent } from './saver.js';

/** A private or gratitude label in front (the core's privateline.LABEL): saved without the AI, answered "Saved privately.". */
export const PRIVATE_LABEL = /^\s*(gratitude|private|g)\s*:\s*/i;

export const isPrivateLine = (text: string): boolean => PRIVATE_LABEL.test(text);

/** What the blue "being read" row shows: the line, but never a private line's words. */
export function readingText(text: string): string {
  return isPrivateLine(text) ? 'Private line' : text.trim().replace(/\s*\n\s*/g, ' · ');
}

/**
 * The key of a line that got no answer (no connection, or the time ran out): the core may have saved it all the same, so the
 * same words sent again go with the same key, and the door saves them once (`replayed`). An answer, of any kind, ends that.
 */
export class LineKeys {
  #open = new Map<string, string>();

  keyFor(text: string): string | undefined {
    return this.#open.get(text.trim());
  }

  remember(text: string, key: string) {
    this.#open.set(text.trim(), key);
    if (this.#open.size > 20) this.#open.delete(this.#open.keys().next().value!);
  }

  forget(text: string) {
    this.#open.delete(text.trim());
  }
}

/**
 * Whether a sent line's words go back into the box, so nothing typed is lost: when no answer came, or when the door says
 * nothing was saved and the words are not kept under Needs you either (a refused line). A line kept to read later (held) is
 * under Needs you with Try again; a question, a look-up and a saved line need nothing back.
 */
export function wordsBack(sent: Sent<SaveAnswer>, text: string): boolean {
  if (sent.kind === 'problem') return true;
  if (sent.kind !== 'answer' || sent.answer.outcome !== 'rejected') return false;
  const kept = sent.answer.day?.needs.not_read ?? [];
  return !kept.some((m) => (m.text ?? '').trim() === text.trim());
}

/**
 * The More page's Recent (deploy 108) from GET /api/v1/recent (docs/API.md, "More (107)"): the last 50 messages by day, each with what
 * it saved. A private entry is its label only: no words, no id, no Use again. And "Use again": the words travel to Today's logging
 * box in the tab's sessionStorage (never in the address) and are taken out once. Plain TypeScript, so the tests need no browser.
 */

export interface SavedLine {
  kind: string;
  text: string;
}

export interface Message {
  id: number | null;
  private: boolean;
  at: string;
  time: string;
  channel: string | null;
  channel_label: string;
  text: string | null;
  again: string | null;
  open_day: string | null;
  saved: SavedLine[];
}

export interface Recent {
  limit: number;
  small: string;
  empty: string;
  none: string;
  days: { day: string; head: string; messages: Message[] }[];
  not_read: number;
}

/** "1 message not read yet" / "3 messages not read yet". */
export const notReadText = (n: number): string => `${n} ${n === 1 ? 'message' : 'messages'} not read yet`;

/** What a message shows as its words: none for a private entry or a message the door sent without them. */
export const wordsOf = (m: Pick<Message, 'private' | 'text'>): string | null => (m.private ? null : m.text?.trim() ? m.text : null);

/** A private entry's saved label ("private", "gratitude"), the only thing it shows besides its time. */
export const privateLabel = (m: Pick<Message, 'saved'>): string => m.saved[0]?.text ?? '';

/** Use again is offered only where the door gave words for it; never for a private entry. */
export const canUseAgain = (m: Pick<Message, 'private' | 'again'>): boolean => !m.private && !!m.again?.trim();

/** Open day leads to that day's Food page, only where the door named a day; never for a private entry. */
export const openDayHref = (m: Pick<Message, 'private' | 'open_day'>): string | null => (!m.private && m.open_day ? `/food?day=${encodeURIComponent(m.open_day)}` : null);

// ---- Use again --------------------------------------------------------------------------------------------------------------------------

export const USE_AGAIN_ITEM = 'logger-use-again';
/** The logging box takes at most 4000 characters. */
const MAX = 4000;

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** The tab's storage, or none where the browser blocks it (a private window). */
export function tabStorage(): Store | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
}

/** Keeps the words for Today's box; false when there is nothing to keep or the storage is blocked. */
export function keepWords(storage: Store | null, text: string | null | undefined): boolean {
  const words = (text ?? '').trim().slice(0, MAX);
  if (!words || !storage) return false;
  try {
    storage.setItem(USE_AGAIN_ITEM, words);
    return true;
  } catch {
    return false;
  }
}

/** The kept words, once: they are removed as they are read. */
export function takeWords(storage: Store | null): string | null {
  if (!storage) return null;
  try {
    const words = storage.getItem(USE_AGAIN_ITEM);
    storage.removeItem(USE_AGAIN_ITEM);
    return words?.trim() ? words : null;
  } catch {
    return null;
  }
}

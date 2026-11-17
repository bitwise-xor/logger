// More's Recent (deploy 108): the lines of a message, what Use again and Open day need, and the words kept for Today's box, against a
// real answer of the door for invented messages (tests/samples/recent.json).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { canUseAgain, keepWords, notReadText, openDayHref, privateLabel, takeWords, USE_AGAIN_ITEM, wordsOf, type Message, type Recent } from './recent.js';

const R = (JSON.parse(readFileSync(new URL('../../tests/samples/recent.json', import.meta.url), 'utf8')) as { recent: Recent }).recent;
const all = R.days.flatMap((d) => d.messages);
const typed = all.find((m) => !m.private && m.again && m.open_day)!;
const secret = all.find((m) => m.private)!;
const noDay = all.find((m) => !m.private && !m.open_day)!;

const memory = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m };
};

describe('a message', () => {
  it('counts the messages not read yet', () => {
    expect(notReadText(1)).toBe('1 message not read yet');
    expect(notReadText(3)).toBe('3 messages not read yet');
  });

  it('shows its words, but a private entry only its label', () => {
    expect(wordsOf(typed)).toBe(typed.text);
    expect(wordsOf(secret)).toBeNull();
    expect(wordsOf({ private: false, text: null })).toBeNull();
    expect(wordsOf({ private: false, text: '  ' })).toBeNull();
    expect(wordsOf({ private: true, text: 'would be a leak' })).toBeNull();
    expect(privateLabel(secret)).toBe(secret.saved[0]!.text);
    expect(secret.id).toBeNull();
  });

  it('offers Use again only with words to use, never for a private entry', () => {
    expect(canUseAgain(typed)).toBe(true);
    expect(canUseAgain(secret)).toBe(false);
    expect(canUseAgain({ private: false, again: null })).toBe(false);
    expect(canUseAgain({ private: false, again: ' ' })).toBe(false);
    expect(canUseAgain({ private: true, again: 'x' })).toBe(false);
  });

  it('offers Open day only with a day, on the Food page', () => {
    expect(openDayHref(typed)).toBe(`/food?day=${typed.open_day}`);
    expect(openDayHref(noDay)).toBeNull();
    expect(openDayHref(secret)).toBeNull();
    expect(openDayHref({ private: true, open_day: '2026-11-16' } as Message)).toBeNull();
  });
});

describe('Use again', () => {
  it('keeps the words once, and clears them as they are taken', () => {
    const s = memory();
    expect(keepWords(s, '  40 g skyr ')).toBe(true);
    expect(s.m.get(USE_AGAIN_ITEM)).toBe('40 g skyr');
    expect(takeWords(s)).toBe('40 g skyr');
    expect(s.m.has(USE_AGAIN_ITEM)).toBe(false);
    expect(takeWords(s)).toBeNull();
  });

  it('keeps nothing for no words, and cuts at what the box takes', () => {
    const s = memory();
    expect(keepWords(s, null)).toBe(false);
    expect(keepWords(s, '   ')).toBe(false);
    expect(s.m.size).toBe(0);
    keepWords(s, 'x'.repeat(5000));
    expect(s.m.get(USE_AGAIN_ITEM)).toHaveLength(4000);
  });

  it('does nothing where the storage is blocked', () => {
    const blocked = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    expect(keepWords(blocked, 'x')).toBe(false);
    expect(takeWords(blocked)).toBeNull();
    expect(keepWords(null, 'x')).toBe(false);
    expect(takeWords(null)).toBeNull();
  });
});

// The logging box's plain rules (step D): the "being read" row's words, the key of a line that got no answer, and when the
// words go back into the box.
import { describe, expect, it } from 'vitest';
import type { Day, SaveAnswer } from './day.js';
import { isPrivateLine, LineKeys, readingText, wordsBack } from './logbox.js';

const answer = (outcome: string, notRead: string[] = []): SaveAnswer =>
  ({
    outcome,
    tone: outcome === 'saved' ? 'ok' : 'warning',
    head: 'x',
    receipt: [],
    notes: [],
    reason: null,
    questions: [],
    read_back: null,
    confirm: null,
    result: null,
    refill: null,
    replayed: false,
    undo: null,
    day: { needs: { not_read: notRead.map((text, id) => ({ id, text })) } } as unknown as Day,
  }) as SaveAnswer;

describe('the logging box', () => {
  it('knows a private or gratitude line by its label, as the core does', () => {
    for (const t of ['g: a line', 'G:x', '  gratitude : a line', 'private:a line', 'Private:  a\nb']) expect(isPrivateLine(t)).toBe(true);
    for (const t of ['gym: legs', 'a g: line', 'privately: no', 'grat: x', '150 g skyr']) expect(isPrivateLine(t)).toBe(false);
  });

  it('shows the words in the "being read" row, but never a private line\'s', () => {
    expect(readingText('  150 g skyr\n weight 82.4 ')).toBe('150 g skyr · weight 82.4');
    expect(readingText('private: an invented note')).toBe('Private line');
    expect(readingText('g: an invented thanks')).toBe('Private line');
  });

  it('sends the same words that got no answer with the same key, until an answer comes', () => {
    const k = new LineKeys();
    expect(k.keyFor('40 g radishes')).toBeUndefined();
    k.remember(' 40 g radishes ', 'key-1');
    expect(k.keyFor('40 g radishes')).toBe('key-1');
    expect(k.keyFor('40 g radish')).toBeUndefined(); // other words: a new line, a new key
    k.forget('40 g radishes');
    expect(k.keyFor('40 g radishes')).toBeUndefined();
  });

  it('puts the words back when no answer came, or nothing was saved and nothing kept', () => {
    expect(wordsBack({ kind: 'problem', message: 'No connection.' }, 'skyr')).toBe(true);
    expect(wordsBack({ kind: 'answer', answer: answer('rejected') }, 'skyr')).toBe(true);
    // kept under Needs you (Try again there), saved, a question, a look-up, or the sign-in's re-send: not back
    expect(wordsBack({ kind: 'answer', answer: answer('rejected', [' skyr ']) }, 'skyr')).toBe(false);
    for (const o of ['held', 'saved', 'partly_saved', 'needs_confirmation', 'needs_choice', 'answered', 'not_logged']) {
      expect(wordsBack({ kind: 'answer', answer: answer(o) }, 'skyr')).toBe(false);
    }
    expect(wordsBack({ kind: 'signed_out' }, 'skyr')).toBe(false);
  });
});

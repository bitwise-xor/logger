// Library > Foods > Words (core item 24): the page's address, the groups by month, the labels and the save's fields, against a real
// answer of the door (tests/samples/food_words.json).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  askedQ,
  askedShared,
  byLabel,
  countLine,
  dateLabel,
  emptyLine,
  groupByMonth,
  monthLabel,
  narrowedLine,
  removeFields,
  sharedLabel,
  viewFields,
  viewOf,
  whenLine,
  wordsHref,
  type WordRow,
  type Words,
} from './words.js';

const SAMPLE = JSON.parse(readFileSync(new URL('../../tests/samples/food_words.json', import.meta.url), 'utf8'));
const ALL = SAMPLE.all.words as Words;
const row = (over: Partial<WordRow>): WordRow => ({ word: 'bread', food_id: 5, food: 'Rye bread', added_at: '2026-11-12T19:02:00+01:00', by: 'web', shared: 1, month: '2026-11', ...over });

describe("the page's address", () => {
  it('cuts the search at 60 and takes only ?shared=1 as the chip', () => {
    expect(askedQ('  rye  ')).toBe('rye');
    expect(askedQ('a'.repeat(80))).toBe('a'.repeat(60));
    expect(askedQ(null)).toBe('');
    expect(askedShared('1')).toBe(true);
    for (const x of ['0', 'yes', 'true', '', null]) expect(askedShared(x), String(x)).toBe(false);
    expect(viewOf(new URLSearchParams('q=bread&shared=1'))).toEqual({ q: 'bread', shared: true });
    expect(viewOf(new URLSearchParams('shared=2&x=1'))).toEqual({ q: '', shared: false });
  });

  it('leaves the defaults out of the address', () => {
    expect(wordsHref({})).toBe('/library/words');
    expect(wordsHref({ q: '', shared: false })).toBe('/library/words');
    expect(wordsHref({ q: 'my bread' })).toBe('/library/words?q=my+bread');
    expect(wordsHref({ shared: true })).toBe('/library/words?shared=1');
    expect(wordsHref({ q: 'rye', shared: true })).toBe('/library/words?q=rye&shared=1');
    expect(wordsHref({ q: 'a'.repeat(70) })).toBe(`/library/words?q=${'a'.repeat(60)}`);
  });

  it("asks every save for the list as shown, and removes a word with the Catalogue's fields", () => {
    expect(viewFields({ q: '', shared: false })).toEqual({ view: 'words' });
    expect(viewFields({ q: 'rye', shared: true })).toEqual({ view: 'words', view_q: 'rye', view_shared: '1' });
    expect(removeFields({ food_id: 9, word: 'my bread' })).toEqual({ id: '9', act: 'remove', word: 'my bread' });
  });
});

describe('the groups', () => {
  it('names a month, and the unknown ones', () => {
    expect(monthLabel('2026-11')).toBe('November 2026');
    expect(monthLabel('2026-01')).toBe('January 2026');
    expect(monthLabel('2025-12')).toBe('December 2025');
    for (const x of [null, '', '2026-13', '2026-00', 'soon', '2026-1']) expect(monthLabel(x), String(x)).toBe('Earlier, date unknown');
  });

  it('keeps the door\'s order and puts each month in one group, the unknown last', () => {
    const rows = [row({ word: 'a' }), row({ word: 'b' }), row({ word: 'c', month: '2026-10' }), row({ word: 'd', month: '2026-03' }), row({ word: 'e', added_at: null, month: null }), row({ word: 'f', added_at: null, month: null })];
    const g = groupByMonth(rows);
    expect(g.map((x) => [x.month, x.label, x.rows.map((r) => r.word)])).toEqual([
      ['2026-11', 'November 2026', ['a', 'b']],
      ['2026-10', 'October 2026', ['c']],
      ['2026-03', 'March 2026', ['d']],
      [null, 'Earlier, date unknown', ['e', 'f']],
    ]);
    expect(groupByMonth([])).toEqual([]);
  });

  it('groups the real answer by month, newest first', () => {
    const g = groupByMonth(ALL.rows);
    expect(g.map((x) => x.month)).toEqual(['2026-11', '2026-10', '2026-09', '2026-03']);
    expect(g.map((x) => x.label)).toEqual(['November 2026', 'October 2026', 'September 2026', 'March 2026']);
    expect(g.flatMap((x) => x.rows)).toEqual(ALL.rows);
  });
});

describe('the labels', () => {
  it('writes the date as dd.mm. from the door\'s time, without a time zone change', () => {
    expect(dateLabel('2026-11-12T19:02:00+01:00')).toBe('12.11.');
    expect(dateLabel('2026-11-01T00:30:00+01:00')).toBe('01.11.');
    expect(dateLabel('2026-10-31T23:59:59.123456+01:00')).toBe('31.10.');
    expect(dateLabel(null)).toBeNull();
    expect(dateLabel('soon')).toBeNull();
  });

  it('says where a word came from', () => {
    expect(byLabel('chat')).toBe('added in chat');
    expect(byLabel('web')).toBe('added on the web');
    expect(byLabel('other')).toBe('added by hand');
    expect(byLabel(null)).toBe('came with the food');
    expect(whenLine(row({ by: 'chat' }))).toBe('12.11. · added in chat');
    expect(whenLine(row({ by: null, added_at: '2026-03-04T09:00:00+01:00' }))).toBe('04.03. · came with the food');
    expect(whenLine(row({ by: 'web', added_at: null, month: null }))).toBe('added on the web');
  });

  it('marks a word other foods have too', () => {
    expect(sharedLabel(1)).toBeNull();
    expect(sharedLabel(0)).toBeNull();
    expect(sharedLabel(2)).toBe('also on 1 other food');
    expect(sharedLabel(3)).toBe('also on 2 other foods');
  });

  it('counts the words, and says when the door cut the list', () => {
    expect(countLine({ count: 213, total: 213 })).toBe('213 words');
    expect(countLine({ count: 1, total: 1 })).toBe('1 word');
    expect(countLine({ count: 0, total: 0 })).toBe('0 words');
    expect(countLine({ count: 500, total: 650 })).toBe('500 of 650 words');
    expect(countLine(ALL)).toBe('13 words');
  });

  it('says what a narrowed list is narrowed by, and what an empty one is', () => {
    expect(narrowedLine({ q: '', shared: false })).toBeNull();
    expect(narrowedLine({ q: 'bread', shared: false })).toBe('matching “bread”');
    expect(narrowedLine({ q: '', shared: true })).toBe('on more than one food');
    expect(narrowedLine({ q: 'bread', shared: true })).toBe('matching “bread”, on more than one food');
    expect(emptyLine({ q: '', shared: false })).toBe('No food has a word yet.');
    expect(emptyLine({ q: 'zz', shared: false })).toBe('No word matches.');
    expect(emptyLine({ q: '', shared: true })).toBe('No word matches.');
  });
});

describe("the door's real answers", () => {
  it('have every shape the page reads', () => {
    for (const k of ['all', 'shared', 'search', 'none']) {
      const w = SAMPLE[k].words as Words;
      expect(w.count).toBe(w.rows.length);
      expect(w.total).toBeGreaterThanOrEqual(w.count);
      for (const r of w.rows) {
        expect(Object.keys(r).sort()).toEqual(['added_at', 'by', 'food', 'food_id', 'month', 'shared', 'word']);
        expect(r.shared).toBeGreaterThanOrEqual(1);
        expect(r.month).toBe(r.added_at?.slice(0, 7) ?? null);
      }
    }
    expect(SAMPLE.shared.words.rows.every((r: WordRow) => r.shared > 1)).toBe(true);
    expect(SAMPLE.none.words.rows).toEqual([]);
    expect(emptyLine({ q: 'zzqq', shared: false })).toBe('No word matches.');
  });

  it('say where each word came from', () => {
    const by = Object.fromEntries(ALL.rows.map((r) => [`${r.food}/${r.word}`, whenLine(r)]));
    expect(by['Rye bread/toast']).toBe('19.11. · added in chat');
    expect(by['Rye bread/wholemeal']).toBe('19.11. · added on the web');
    expect(by['Green tea/brew']).toBe('28.09. · added by hand');
    expect(by['Oat flakes/porridge']).toBe('04.03. · came with the food');
    expect(sharedLabel(ALL.rows.find((r) => r.word === 'mix')!.shared)).toBe('also on 1 other food');
  });
});

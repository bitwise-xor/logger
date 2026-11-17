// More's Usage (deploy 108): the range asked, the tiles and the lines of the page, against real answers of the door for invented calls
// (tests/samples/usage.json).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { chartLayout } from './chart.js';
import { askedRange, ESCALATED, kindCells, kindName, tilesOf, topLine, topWords, usageHref, type Usage } from './usage.js';

const U = JSON.parse(readFileSync(new URL('../../tests/samples/usage.json', import.meta.url), 'utf8')) as Record<string, { usage: Usage }>;

describe('the range', () => {
  it('is 7, 30 or all; anything else is dropped', () => {
    expect(askedRange('7')).toBe('7');
    expect(askedRange('30')).toBe('30');
    expect(askedRange('all')).toBe('all');
    expect(askedRange('5')).toBeUndefined();
    expect(askedRange('ALL')).toBeUndefined();
    expect(askedRange('')).toBeUndefined();
    expect(askedRange(null)).toBeUndefined();
  });

  it('is a chip address: 7 days is the page itself', () => {
    expect(usageHref('7')).toBe('/usage');
    expect(usageHref('30')).toBe('/usage?r=30');
    expect(usageHref('all')).toBe('/usage?r=all');
    expect(U['7']!.usage.ranges.map((r) => usageHref(r.r))).toEqual(['/usage', '/usage?r=30', '/usage?r=all']);
  });
});

describe('the tiles', () => {
  it('are the door’s four, in its order, with its words', () => {
    const u = U['7']!.usage;
    const t = tilesOf(u);
    expect(t.map((x) => x.label)).toEqual(['AI calls', 'Cost', 'Per message', 'Tokens in / out']);
    expect(t.map((x) => x.value)).toEqual([String(u.tiles.calls), u.tiles.usd_text, u.tiles.per_message_text, u.tiles.tokens_text]);
    expect(t[2]!.sub).toBe(`${u.tiles.messages} messages`);
    expect(t[3]!.sub).toBe(u.tiles.tokens_note);
  });

  it('say so when there is no typed message, and when every call has its tokens', () => {
    const t = tilesOf({ tiles: { ...U['7']!.usage.tiles, messages: 0, per_message: null, per_message_text: '–', tokens_known: true, tokens_note: null } });
    expect(t[2]).toMatchObject({ value: '–', sub: 'no typed messages' });
    expect(t[3]!.sub).toBe('read / written');
    expect(tilesOf({ tiles: { ...U['7']!.usage.tiles, messages: 1 } })[2]!.sub).toBe('1 message');
  });
});

describe('the table and the list', () => {
  it('name a kind and write its row as the door does', () => {
    expect(kindName('food look-up')).toBe('Food look-up');
    expect(kindName('')).toBe('');
    const u = U['7']!.usage;
    const k = u.kinds[0]!;
    expect(kindCells(k)).toEqual([kindName(k.kind), String(k.calls), k.tokens_in_text, k.tokens_out_text, k.usd_text]);
    expect(kindCells(u.all)[0]).toBe('All');
    expect(u.kinds.reduce((n, x) => n + x.calls, 0)).toBe(u.all.calls);
  });

  it('write a costly message’s line, and its words only when it has them', () => {
    const top = U['7']!.usage.top;
    expect(topLine(top[0]!)).toBe(`${top[0]!.at_text} · ${top[0]!.kind} · ${top[0]!.models_text}`);
    expect(topWords(top[0]!)).toEqual({ words: top[0]!.text, private: false });
    const secret = top.find((t) => t.private)!;
    expect(topWords({ ...secret, text: 'would be a leak' })).toEqual({ words: null, private: true });
    expect(topWords(top.find((t) => !t.private && !t.text)!)).toEqual({ words: null, private: false });
    expect(top.some((t) => t.escalated)).toBe(true);
    expect(ESCALATED).toBe('read again by the larger model');
  });
});

describe('the cost chart', () => {
  it('is the door’s stacked bars, drawn by the chart part: a bar per point, lifted by what is under it', () => {
    for (const r of ['7', '30', 'all']) {
      const c = U[r]!.usage.chart!;
      const lay = chartLayout(c, 340)!;
      expect(lay.shapes.filter((s) => s.kind === 'bar')).toHaveLength(c.series.reduce((n, s) => n + s.pts.length, 0));
      expect(c.series.map((s) => s.cls)).toEqual(['a', 'b', 'c']);
    }
    const seven = U['7']!.usage;
    expect(seven.legend.map((l) => l.key)).toEqual(['sq a', 'sq b', 'sq c']);
  });
});

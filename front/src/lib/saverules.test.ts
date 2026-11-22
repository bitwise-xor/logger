// The one table of how each save behaves (web item 72): its pages agree with the page files, and its flags with each other. What each
// action does today is held line by line in src/lib/server/savebehaviour.test.ts.
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as saves from './server/saves.js';
import { ruleOf, SAVE_NAMES, SAVE_PAGES, SAVE_RULES, savesOn, type SavePage, type SaveRule } from './saverules.js';

// The type check refuses a save with no page, and one without a key that is to be sent again.
// @ts-expect-error an action needs at least one page
const noPage: SaveRule = { path: '/x', key: 'none', resend: false, pages: [] };
// @ts-expect-error only a keyed save is ever sent again
const keylessResend: SaveRule = { path: '/x', key: 'none', resend: true, pages: ['today'] };
void [noPage, keylessResend];

/** The page files whose form actions are save lists: address -> the list's name in saves.ts. */
function pageFiles(): Map<string, string> {
  const root = new URL('../routes/(app)/', import.meta.url);
  const found = new Map<string, string>();
  for (const file of readdirSync(root, { recursive: true, encoding: 'utf8' })) {
    if (!file.endsWith('+page.server.ts')) continue;
    const list = /formActions\((\w+),/.exec(readFileSync(new URL(file, root), 'utf8'))?.[1];
    if (list) found.set('/' + file.replace(/\/?\+page\.server\.ts$/, ''), list);
  }
  return found;
}

describe('the table of saves (saverules.ts)', () => {
  it('gives every page at least one save', () => {
    for (const page of Object.keys(SAVE_PAGES) as SavePage[]) expect(savesOn(page).length, page).toBeGreaterThan(0);
  });

  it("matches every page file's form actions to its page, address by address", () => {
    const lists = saves as unknown as Record<string, readonly string[] | undefined>;
    const files = pageFiles();
    const addresses = Object.entries(SAVE_PAGES).flatMap(([page, routes]) => routes.map((r) => [r, page as SavePage] as const));
    expect([...files.keys()].sort()).toEqual(addresses.map(([r]) => r).sort());
    for (const [route, page] of addresses) {
      const list = lists[files.get(route) ?? ''];
      expect(list, route).toBeDefined();
      expect([...(list ?? [])].sort(), route).toEqual([...savesOn(page)].sort());
    }
  });

  it('keeps its flags consistent', () => {
    for (const n of SAVE_NAMES) {
      const r: SaveRule = SAVE_RULES[n];
      if (r.resend) expect(r.key, n).not.toBe('none');
      // the AI's saves and the coaching wait long; a coaching start is never sent again and its answer may be dropped
      if (r.slow || r.coaching) expect(r.long, n).toBe(true);
      if (r.coaching) expect([r.key, r.resend, r.slow], n).toEqual(['none', false, undefined]);
      expect(r.path, n).toMatch(/^\/[a-z_/]+$/);
      expect(new Set(r.pages).size, n).toBe(r.pages.length);
    }
  });

  it('knows only its own names', () => {
    expect(ruleOf('water')?.path).toBe('/water');
    expect(ruleOf('gym_anything_new')).toBeUndefined();
    expect(ruleOf('toString')).toBeUndefined();
    expect(ruleOf('constructor')).toBeUndefined();
  });
});

// The compact view (20.11.2026): static/theme.js itself, run with a stand-in window, page and storage. ?compact=1 turns it on and
// is kept for the tab; without the parameter it is used again only inside a frame (the hub's); ?compact=0 ends it.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const SCRIPT = readFileSync(new URL('../../static/theme.js', import.meta.url), 'utf8');

type Store = Map<string, string>;

/** Runs theme.js once for an address; true when it made the page compact. */
function run(search: string, { framed = false, store = new Map() as Store, blocked = false } = {}): boolean {
  const classes = new Set<string>();
  const storage = {
    getItem: (k: string) => {
      if (blocked) throw new Error('blocked');
      return store.get(k) ?? null;
    },
    setItem: (k: string, v: string) => {
      if (blocked) throw new Error('blocked');
      store.set(k, v);
    },
    removeItem: (k: string) => {
      if (blocked) throw new Error('blocked');
      store.delete(k);
    },
  };
  const self = {};
  const window = { self, top: framed ? {} : self };
  const document = {
    documentElement: { setAttribute: () => {}, classList: { add: (c: string) => classes.add(c) } },
    querySelectorAll: () => [],
  };
  new Function('window', 'document', 'location', 'localStorage', 'sessionStorage', SCRIPT)(
    window, document, { search }, storage, storage,
  );
  return classes.has('compact');
}

describe('the compact view', () => {
  it('?compact=1 makes the page compact, in a frame or not', () => {
    expect(run('?compact=1', { framed: true })).toBe(true);
    expect(run('?compact=1')).toBe(true);
    expect(run('?day=2026-11-19&compact=1')).toBe(true);
  });
  it('stays on in the frame from page to page, without the parameter', () => {
    const store: Store = new Map();
    run('?compact=1', { framed: true, store });
    expect(run('', { framed: true, store })).toBe(true);
    expect(run('?day=2026-11-19', { framed: true, store })).toBe(true);
  });
  it('is not used again outside a frame, nor without having been asked for', () => {
    const store: Store = new Map();
    run('?compact=1', { framed: true, store });
    expect(run('', { store })).toBe(false);
    expect(run('', { framed: true })).toBe(false);
    expect(run('?compact=yes', { framed: true })).toBe(false);
  });
  it('?compact=0 ends it', () => {
    const store: Store = new Map();
    run('?compact=1', { framed: true, store });
    expect(run('?compact=0', { framed: true, store })).toBe(false);
    expect(run('', { framed: true, store })).toBe(false);
  });
  it('with storage blocked only ?compact=1 is compact', () => {
    expect(run('?compact=1', { framed: true, blocked: true })).toBe(true);
    expect(run('', { framed: true, blocked: true })).toBe(false);
  });
});

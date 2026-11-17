// Deploy 112: static/sw.js, run with a fake `self` (the worker's global): a push shows the core's {title, body, url, tag} (and safe
// defaults for an empty or broken one); a tap opens the message's page: a page of logger. in an open window (focused and moved there)
// or a new one, a page of another address (the gratitude list at app.) in a new window, as it came. No fetch handler.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const CODE = readFileSync(new URL('../../static/sw.js', import.meta.url), 'utf8');
const ORIGIN = 'https://logger.example';

type Handler = (e: Record<string, unknown>) => void;
interface Win {
  url: string;
  focused?: boolean;
  visibilityState?: string;
  focus?: () => Promise<Win>;
  navigate?: (url: string) => Promise<Win | null>;
}

function load(wins: Win[] = [], log: string[] = []) {
  const handlers: Record<string, Handler> = {};
  const shown: { title: string; options: Record<string, unknown> }[] = [];
  const self = {
    location: new URL(`${ORIGIN}/sw.js`),
    addEventListener: (type: string, fn: Handler) => (handlers[type] = fn),
    skipWaiting: () => log.push('skipWaiting'),
    registration: {
      showNotification: async (title: string, options: Record<string, unknown>) => {
        shown.push({ title, options });
      },
    },
    clients: {
      claim: async () => log.push('claim'),
      matchAll: async (o: unknown) => {
        log.push(`matchAll ${JSON.stringify(o)}`);
        return wins;
      },
      openWindow: async (url: string) => {
        log.push(`openWindow ${url}`);
        return null;
      },
    },
  };
  new Function('self', CODE)(self);
  /** An event with waitUntil; resolves once what it waits for is done. */
  async function fire(type: string, fields: Record<string, unknown>) {
    const waits: Promise<unknown>[] = [];
    handlers[type]!({ ...fields, waitUntil: (p: Promise<unknown>) => waits.push(p) });
    await Promise.all(waits);
  }
  return { handlers, log, shown, fire };
}

const pushData = (raw: string | null) =>
  raw === null
    ? null
    : {
        json: () => JSON.parse(raw),
        text: () => raw,
      };

function win(url: string, log: string[], o: Partial<Win> = {}): Win {
  const w: Win = {
    url,
    focus: async () => {
      log.push(`focus ${url}`);
      return w;
    },
    navigate: async (to: string) => {
      log.push(`navigate ${url} -> ${to}`);
      return w;
    },
    ...o,
  };
  return w;
}

async function tap(wins: (log: string[]) => Win[], url: unknown) {
  const log: string[] = [];
  const sw = load(wins(log), log);
  let closed = 0;
  await sw.fire('notificationclick', { notification: { data: url === undefined ? undefined : { url }, close: () => closed++ } });
  expect(closed).toBe(1);
  return log;
}

describe('the service worker', () => {
  it('listens to install, activate, push and notificationclick only: no fetch handler, nothing kept', async () => {
    const sw = load();
    expect(Object.keys(sw.handlers).sort()).toEqual(['activate', 'install', 'notificationclick', 'push']);
    sw.handlers.install!({});
    await sw.fire('activate', {});
    expect(sw.log).toEqual(['skipWaiting', 'claim']);
    expect(CODE).not.toMatch(/caches\.|addEventListener\('fetch'/);
  });

  it('a push shows the core\'s title, body and tag, with the page to open and the icon', async () => {
    const sw = load();
    await sw.fire('push', { data: pushData(JSON.stringify({ title: 'Weight', body: 'No weight logged yet today.', url: '/', tag: 'weight' })) });
    expect(sw.shown).toEqual([{ title: 'Weight', options: { body: 'No weight logged yet today.', tag: 'weight', data: { url: '/' }, icon: '/icon-192.png' } }]);
  });

  it('an empty push, one without data and a broken one: "Logger", the words as they came, Today', async () => {
    const sw = load();
    await sw.fire('push', { data: pushData('{}') });
    await sw.fire('push', { data: null });
    await sw.fire('push', { data: pushData('not json {') });
    await sw.fire('push', { data: pushData('null') });
    await sw.fire('push', { data: pushData(JSON.stringify({ title: 7, body: ['x'], url: { a: 1 }, tag: null })) });
    const base = { tag: 'logger', data: { url: '/' }, icon: '/icon-192.png' };
    expect(sw.shown).toEqual([
      { title: 'Logger', options: { body: '', ...base } },
      { title: 'Logger', options: { body: '', ...base } },
      { title: 'Logger', options: { body: 'not json {', ...base } },
      { title: 'Logger', options: { body: '', ...base } },
      { title: 'Logger', options: { body: '', ...base } },
    ]);
  });

  it('a tap with a page of logger. and a window open: that window comes forward and goes there', async () => {
    const log = await tap((l) => [win(`${ORIGIN}/food`, l)], '/settings/notifications');
    expect(log).toEqual([
      'matchAll {"type":"window","includeUncontrolled":true}',
      `focus ${ORIGIN}/food`,
      `navigate ${ORIGIN}/food -> ${ORIGIN}/settings/notifications`,
    ]);
  });

  it('the focused (or visible) window is the one taken', async () => {
    const log = await tap((l) => [win(`${ORIGIN}/a`, l), win(`${ORIGIN}/b`, l, { visibilityState: 'visible' }), win(`${ORIGIN}/c`, l, { focused: true })], '/');
    expect(log.filter((x) => !x.startsWith('matchAll'))).toEqual([`focus ${ORIGIN}/c`, `navigate ${ORIGIN}/c -> ${ORIGIN}/`]);
  });

  it('no window open: a new one at the page; no url: Today', async () => {
    expect(await tap(() => [], '/settings/notifications')).toEqual(['matchAll {"type":"window","includeUncontrolled":true}', `openWindow ${ORIGIN}/settings/notifications`]);
    expect((await tap(() => [], undefined)).at(-1)).toBe(`openWindow ${ORIGIN}/`);
  });

  it('a window that cannot be moved (no navigate, or one this worker does not control): a new window', async () => {
    const none = await tap((l) => [win(`${ORIGIN}/`, l, { navigate: undefined })], '/settings/notifications');
    expect(none.slice(1)).toEqual([`focus ${ORIGIN}/`, `openWindow ${ORIGIN}/settings/notifications`]);
    const refused = await tap((l) => [win(`${ORIGIN}/`, l, { navigate: async () => Promise.reject(new TypeError('not controlled')) })], '/');
    expect(refused.slice(1)).toEqual([`focus ${ORIGIN}/`, `openWindow ${ORIGIN}/`]);
  });

  it('a page of another address (the gratitude list at app.): a new window with it as it came, no logger. window touched', async () => {
    const app = 'https://app.example/web/gratitude?x=1#top';
    expect(await tap((l) => [win(`${ORIGIN}/`, l)], app)).toEqual([`openWindow ${app}`]);
  });

  it('anything that is not a web address opens Today', async () => {
    expect(await tap(() => [], 'javascript:alert(1)')).toEqual(['matchAll {"type":"window","includeUncontrolled":true}', `openWindow ${ORIGIN}/`]);
    expect((await tap(() => [], 42)).at(-1)).toBe(`openWindow ${ORIGIN}/`);
  });
});

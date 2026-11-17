// Deploy 112: "This device" in Settings > Notifications with fake browser parts: which state the card shows, the door's key as bytes,
// the turn-on order (permission, worker, subscription, the door) and the subscription taken back when the door does not keep it.
import { describe, expect, it } from 'vitest';
import { deviceState, isIos, keyBytes, subscriptionProblem, turnOff, turnOn, WORDS, type PushEnv, type SubscriptionLike } from './pushdevice.js';
import type { Subscription } from './settings.js';

// an invented key of the right shape: 65 bytes, the first 0x04
const KEY = 'B' + 'A'.repeat(85) + 'E';
const SUB_JSON = { endpoint: 'https://fcm.googleapis.com/fcm/send/invented-endpoint-1', keys: { p256dh: 'B' + 'A'.repeat(86), auth: 'C'.repeat(22) } };
const ROW: Subscription = { id: 54, name: 'Linux, Chrome', address: 'logger', on_since: '2026-11-17T12:58:36+01:00', last_delivered: null, this: true };
const read = (over: { public_key?: string | null; subscriptions?: Subscription[] } = {}) => ({ public_key: KEY, subscriptions: [], ...over });

function fakeEnv(o: { permission?: NotificationPermission; answer?: NotificationPermission; had?: boolean; subscribeFails?: boolean; registerFails?: boolean; ua?: string; standalone?: boolean; sub?: object } = {}) {
  const log: string[] = [];
  let unsubscribed = 0;
  const sub: SubscriptionLike = {
    toJSON: () => (o.sub ?? SUB_JSON) as ReturnType<SubscriptionLike['toJSON']>,
    unsubscribe: async () => {
      log.push('unsubscribe');
      unsubscribed++;
      return true;
    },
  };
  let has = o.had ? sub : null;
  const pushManager = {
    getSubscription: async () => {
      log.push('getSubscription');
      return has;
    },
    subscribe: async (opts: { userVisibleOnly: boolean; applicationServerKey: Uint8Array }) => {
      log.push(`subscribe ${opts.userVisibleOnly} ${opts.applicationServerKey.length}`);
      if (o.subscribeFails) throw new Error('AbortError');
      has = sub;
      return sub;
    },
  };
  const env: PushEnv = {
    notification: {
      permission: o.permission ?? 'default',
      requestPermission: async () => {
        log.push('requestPermission');
        return o.answer ?? 'granted';
      },
    },
    serviceWorker: {
      register: async (url: string, opts: { scope: string }) => {
        log.push(`register ${url} ${opts.scope}`);
        if (o.registerFails) throw new Error('SecurityError');
        return {};
      },
      get ready() {
        log.push('ready');
        return Promise.resolve({ pushManager });
      },
      getRegistration: async (scope?: string) => {
        log.push(`getRegistration ${scope}`);
        return { pushManager };
      },
    },
    pushManager: true,
    userAgent: o.ua ?? 'Mozilla/5.0 (X11; Linux x86_64) Chrome/140.0 Safari/537.36',
    maxTouchPoints: 0,
    standalone: o.standalone ?? false,
  };
  return { env, log, unsubscribed: () => unsubscribed };
}

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

describe('the card\'s state', () => {
  it('the door without a key: not set up, whatever the browser', () => {
    expect(deviceState(read({ public_key: null }), fakeEnv().env)).toEqual({ kind: 'cannot', words: WORDS.noServer });
    expect(deviceState(read({ public_key: null, subscriptions: [ROW] }), null)).toEqual({ kind: 'cannot', words: WORDS.noServer });
  });

  it('an iPhone or iPad outside the Home Screen app: the hint; from the Home Screen: as any browser', () => {
    expect(deviceState(read(), fakeEnv({ ua: IPHONE }).env)).toEqual({ kind: 'cannot', words: WORDS.iphone });
    expect(deviceState(read(), fakeEnv({ ua: IPHONE, standalone: true }).env)).toEqual({ kind: 'off' });
    expect(isIos({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15', maxTouchPoints: 5 })).toBe(true);
    expect(isIos({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15', maxTouchPoints: 0 })).toBe(false);
  });

  it('a browser without notifications, the worker or PushManager: it cannot', () => {
    for (const k of ['notification', 'serviceWorker'] as const) {
      const { env } = fakeEnv();
      delete env[k];
      expect(deviceState(read(), env)).toEqual({ kind: 'cannot', words: WORDS.noBrowser });
    }
    const { env } = fakeEnv();
    env.pushManager = false;
    expect(deviceState(read(), env)).toEqual({ kind: 'cannot', words: WORDS.noBrowser });
  });

  it('blocked in the browser\'s settings, off, on from the door\'s row with "this"', () => {
    expect(deviceState(read({ subscriptions: [ROW] }), fakeEnv({ permission: 'denied' }).env)).toEqual({ kind: 'blocked', words: WORDS.blocked });
    expect(deviceState(read({ subscriptions: [{ ...ROW, this: false }] }), fakeEnv().env)).toEqual({ kind: 'off' });
    expect(deviceState(read({ subscriptions: [{ ...ROW, id: 53, address: 'app', this: false }, ROW] }), fakeEnv({ permission: 'granted' }).env)).toEqual({ kind: 'on', row: ROW });
    // before the page knows the browser (on the server): the door's word only
    expect(deviceState(read({ subscriptions: [ROW] }), null)).toEqual({ kind: 'on', row: ROW });
    expect(deviceState(read(), null)).toEqual({ kind: 'off' });
  });
});

describe('the door\'s key', () => {
  it('base64url (with or without padding) as bytes', () => {
    expect([...(keyBytes('AQID-_8') ?? [])]).toEqual([1, 2, 3, 251, 255]);
    expect([...(keyBytes('AQID-_8=') ?? [])]).toEqual([1, 2, 3, 251, 255]);
    const k = keyBytes(KEY);
    expect(k?.length).toBe(65);
    expect(k?.[0]).toBe(4);
    expect(k?.buffer).toBeInstanceOf(ArrayBuffer);
  });
  it('anything else: null', () => {
    for (const bad of ['', 'a b', 'AQ+/', 'A', 'AQID==='] ) expect(keyBytes(bad), bad).toBeNull();
  });
});

describe('the subscription\'s check', () => {
  it('an https address up to 1000 characters, two base64url keys up to 200 and 100', () => {
    const ok = { endpoint: SUB_JSON.endpoint, ...SUB_JSON.keys };
    expect(subscriptionProblem(ok)).toBeNull();
    expect(subscriptionProblem({ ...ok, endpoint: 'https://push.example/' + 'a'.repeat(978) })).toBeNull();
    expect(subscriptionProblem({ ...ok, endpoint: 'https://push.example/' + 'a'.repeat(980) })).not.toBeNull();
    expect(subscriptionProblem({ ...ok, endpoint: 'http://fcm.googleapis.com/x' })).not.toBeNull();
    expect(subscriptionProblem({ ...ok, endpoint: 'javascript:alert(1)' })).not.toBeNull();
    expect(subscriptionProblem({ ...ok, endpoint: 7 })).not.toBeNull();
    expect(subscriptionProblem({ ...ok, p256dh: 'B'.repeat(200) })).toBeNull();
    expect(subscriptionProblem({ ...ok, p256dh: 'B'.repeat(201) })).not.toBeNull();
    expect(subscriptionProblem({ ...ok, auth: 'C'.repeat(101) })).not.toBeNull();
    expect(subscriptionProblem({ ...ok, auth: 'a/b' })).not.toBeNull();
    expect(subscriptionProblem({ endpoint: ok.endpoint })).not.toBeNull();
  });
});

describe('Turn on', () => {
  it('asks first, then registers /sw.js for "/", waits for it, subscribes with the door\'s key, then the door', async () => {
    const f = fakeEnv();
    const sent: unknown[] = [];
    const r = await turnOn(f.env, KEY, async (x) => {
      f.log.push('save');
      sent.push(x);
      return true;
    });
    expect(r).toEqual({ on: true });
    expect(f.log).toEqual(['requestPermission', 'register /sw.js /', 'ready', 'getSubscription', 'subscribe true 65', 'save']);
    expect(sent).toEqual([{ endpoint: SUB_JSON.endpoint, p256dh: SUB_JSON.keys.p256dh, auth: SUB_JSON.keys.auth }]);
    expect(f.unsubscribed()).toBe(0);
  });

  it('a subscription the browser already has is sent again (the door keeps it by its address)', async () => {
    const f = fakeEnv({ had: true });
    expect(await turnOn(f.env, KEY, async () => true)).toEqual({ on: true });
    expect(f.log.some((x) => x.startsWith('subscribe'))).toBe(false);
  });

  it('permission refused or left unanswered: nothing registered, nothing subscribed', async () => {
    for (const [answer, words] of [['denied', WORDS.blocked], ['default', WORDS.notAllowed]] as const) {
      const f = fakeEnv({ answer });
      let saved = false;
      expect(await turnOn(f.env, KEY, async () => (saved = true))).toEqual({ on: false, words });
      expect(f.log).toEqual(['requestPermission']);
      expect(saved).toBe(false);
    }
  });

  it('the worker not registered, or the subscription refused by the browser: plain words, the door not asked', async () => {
    let saved = false;
    const a = fakeEnv({ registerFails: true });
    expect(await turnOn(a.env, KEY, async () => (saved = true))).toEqual({ on: false, words: WORDS.noWorker });
    const b = fakeEnv({ subscribeFails: true });
    expect(await turnOn(b.env, KEY, async () => (saved = true))).toEqual({ on: false, words: WORDS.noSubscription });
    expect(saved).toBe(false);
  });

  it('a worker that never gets ready: given up after the wait', async () => {
    const f = fakeEnv();
    Object.defineProperty(f.env.serviceWorker, 'ready', { get: () => new Promise(() => {}) });
    expect(await turnOn(f.env, KEY, async () => true, 20)).toEqual({ on: false, words: WORDS.noWorker });
  });

  it('the door refuses, fails or throws: the browser\'s subscription is ended again (never half on)', async () => {
    for (const save of [async () => false, async () => Promise.reject(new Error('offline'))]) {
      const f = fakeEnv();
      expect(await turnOn(f.env, KEY, save)).toEqual({ on: false, words: null });
      expect(f.unsubscribed()).toBe(1);
      expect(f.log.at(-1)).toBe('unsubscribe');
    }
  });

  it('a subscription without its keys is not sent, and ended', async () => {
    const f = fakeEnv({ sub: { endpoint: SUB_JSON.endpoint } });
    let saved = false;
    expect(await turnOn(f.env, KEY, async () => (saved = true))).toEqual({ on: false, words: WORDS.noSubscription });
    expect(saved).toBe(false);
    expect(f.unsubscribed()).toBe(1);
  });

  it('no key from the door, or a browser without the parts: nothing is asked', async () => {
    const f = fakeEnv();
    expect(await turnOn(f.env, '', async () => true)).toEqual({ on: false, words: WORDS.noServer });
    delete f.env.serviceWorker;
    expect(await turnOn(f.env, KEY, async () => true)).toEqual({ on: false, words: WORDS.noBrowser });
    expect(f.log).toEqual([]);
  });
});

describe('Turn off on this device', () => {
  it('the door first, then the browser\'s subscription ends', async () => {
    const f = fakeEnv({ had: true });
    await turnOff(f.env, async () => f.log.push('push_off'));
    expect(f.log).toEqual(['push_off', 'getRegistration /', 'getSubscription', 'unsubscribe']);
    expect(f.unsubscribed()).toBe(1);
  });

  it('ends the browser\'s subscription even when the door did not answer; nothing to end is fine', async () => {
    const f = fakeEnv({ had: true });
    await expect(turnOff(f.env, async () => Promise.reject(new Error('offline')))).rejects.toThrow('offline');
    expect(f.unsubscribed()).toBe(1);
    const g = fakeEnv();
    await turnOff(g.env, async () => null);
    expect(g.unsubscribed()).toBe(0);
    delete g.env.serviceWorker;
    await turnOff(g.env, async () => null);
  });
});

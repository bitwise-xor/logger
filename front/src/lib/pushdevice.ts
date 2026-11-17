/**
 * Notifications on this device (deploy 112): Settings > Notifications' "This device" card. What the card says comes from the door's
 * read (`settings_notify`: public_key, the row with `this`) and what this browser offers; "Turn on" asks for the permission,
 * registers static/sw.js (scope "/", only then: never on a page load), subscribes with the door's public key and sends the
 * subscription to the page's form action `push_subscribe` (which adds the browser's User-Agent and posts it to the door's
 * /push/subscribe); a refusal or failure takes the browser's subscription back. "Turn off on this device" sends the row's id to
 * `push_off` and ends the browser's subscription.
 *
 * Plain TypeScript: every browser object comes in as an argument (`PushEnv`), so src/lib/pushdevice.test.ts drives it with fakes.
 */
import type { SettingsNotify, Subscription } from './settings.js';

/** The parts of the browser the card uses (browserEnv() takes them from window). */
export interface PushEnv {
  notification?: { permission: NotificationPermission; requestPermission(): Promise<NotificationPermission> };
  serviceWorker?: {
    register(url: string, options: { scope: string }): Promise<unknown>;
    ready: Promise<{ pushManager: PushManagerLike }>;
    getRegistration(scope?: string): Promise<{ pushManager: PushManagerLike } | undefined>;
  };
  /** window has PushManager */
  pushManager: boolean;
  userAgent: string;
  maxTouchPoints: number;
  /** opened from the Home Screen (display-mode standalone, or Safari's navigator.standalone) */
  standalone: boolean;
}
export interface PushManagerLike {
  getSubscription(): Promise<SubscriptionLike | null>;
  subscribe(options: { userVisibleOnly: boolean; applicationServerKey: Uint8Array<ArrayBuffer> }): Promise<SubscriptionLike>;
}
export interface SubscriptionLike {
  toJSON(): { endpoint?: string; keys?: Record<string, string> };
  unsubscribe(): Promise<boolean>;
}

/** What the card shows. */
export type DeviceState =
  | { kind: 'cannot'; words: string }
  | { kind: 'blocked'; words: string }
  | { kind: 'off' }
  | { kind: 'on'; row: Subscription };

export const WORDS = {
  noServer: 'Notifications are not set up on the server.',
  iphone: 'On an iPhone: open logger. from the Home Screen first (Share, then Add to Home Screen).',
  noBrowser: 'This browser cannot show notifications.',
  blocked: 'Notifications are blocked for logger. in this browser\'s settings.',
  notAllowed: 'Notifications were not allowed.',
  noWorker: 'This browser did not start notifications for logger. Try again in a moment.',
  noSubscription: 'This browser did not give an address for notifications. Try again in a moment.',
} as const;

/** iPhone, iPod or iPad (an iPad says "Macintosh" but has a touch screen), as app.js tells them apart. */
export const isIos = (env: Pick<PushEnv, 'userAgent' | 'maxTouchPoints'>) =>
  /iPhone|iPad|iPod/.test(env.userAgent) || (/Macintosh/.test(env.userAgent) && env.maxTouchPoints > 1);

/** What the card shows for the door's read in this browser (env null: not known yet, on the server: the door's word only). */
export function deviceState(read: Pick<SettingsNotify, 'public_key' | 'subscriptions'>, env: PushEnv | null): DeviceState {
  if (!read.public_key) return { kind: 'cannot', words: WORDS.noServer };
  const row = read.subscriptions.find((s) => s.this);
  if (env) {
    if (isIos(env) && !env.standalone) return { kind: 'cannot', words: WORDS.iphone };
    if (!env.notification || !env.serviceWorker || !env.pushManager) return { kind: 'cannot', words: WORDS.noBrowser };
    if (env.notification.permission === 'denied') return { kind: 'blocked', words: WORDS.blocked };
  }
  return row ? { kind: 'on', row } : { kind: 'off' };
}

/** The door's public key (base64url, as the core gives it) as the bytes `applicationServerKey` takes; null when it is not one. */
export function keyBytes(key: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[A-Za-z0-9_-]+={0,2}$/.test(key)) return null;
  const b64 = key.replace(/=+$/, '').replace(/-/g, '+').replace(/_/g, '/');
  if (b64.length % 4 === 1) return null;
  const raw = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** The subscription as the form action takes it. */
export interface SubscriptionFields {
  endpoint: string;
  p256dh: string;
  auth: string;
  [k: string]: string;
}

const B64URL = /^[A-Za-z0-9_-]+={0,2}$/;
/** Why a subscription's fields are not one (the form action's check before the door is asked); null when they are. */
export function subscriptionProblem(f: { endpoint?: unknown; p256dh?: unknown; auth?: unknown }): string | null {
  const { endpoint, p256dh, auth } = f;
  if (typeof endpoint !== 'string' || endpoint.length > 1000 || !/^https:\/\/[^\s/?#]+/.test(endpoint)) return 'The browser\'s notification address is not one.';
  try {
    if (new URL(endpoint).protocol !== 'https:') return 'The browser\'s notification address is not one.';
  } catch {
    return 'The browser\'s notification address is not one.';
  }
  if (typeof p256dh !== 'string' || p256dh.length > 200 || !B64URL.test(p256dh)) return 'The browser\'s notification keys are not right.';
  if (typeof auth !== 'string' || auth.length > 100 || !B64URL.test(auth)) return 'The browser\'s notification keys are not right.';
  return null;
}

/** What a press did: on, or not (words: why, for the answer bar; null when the door's own answer is already there). */
export type TurnOn = { on: true } | { on: false; words: string | null };

function within<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<T>((_, no) => (timer = setTimeout(() => no(new Error('timeout')), ms)));
  return Promise.race([p, late]).finally(() => clearTimeout(timer));
}

/**
 * "Turn on", in this order inside the press: the permission, the worker registered and ready, the subscription (the browser's own
 * if it has one: the door then keeps it again, by its address), the door. `save` sends it to the form action and says whether the
 * door kept it; when it did not (a refusal, the door off, signed out), the browser's subscription is ended again, so the device is
 * never half on.
 */
export async function turnOn(env: PushEnv, publicKey: string, save: (f: SubscriptionFields) => Promise<boolean>, waitMs = 20_000): Promise<TurnOn> {
  const { notification, serviceWorker } = env;
  if (!notification || !serviceWorker || !env.pushManager) return { on: false, words: WORDS.noBrowser };
  const key = keyBytes(publicKey);
  if (!key) return { on: false, words: WORDS.noServer };
  const permission = await notification.requestPermission();
  if (permission !== 'granted') return { on: false, words: permission === 'denied' ? WORDS.blocked : WORDS.notAllowed };
  let manager: PushManagerLike;
  try {
    await serviceWorker.register('/sw.js', { scope: '/' });
    manager = (await within(serviceWorker.ready, waitMs)).pushManager;
  } catch {
    return { on: false, words: WORDS.noWorker };
  }
  let sub: SubscriptionLike;
  try {
    sub = (await manager.getSubscription()) ?? (await manager.subscribe({ userVisibleOnly: true, applicationServerKey: key }));
  } catch {
    return { on: false, words: WORDS.noSubscription };
  }
  const j = sub.toJSON();
  const fields = { endpoint: j.endpoint ?? '', p256dh: j.keys?.p256dh ?? '', auth: j.keys?.auth ?? '' };
  let kept = false;
  if (!subscriptionProblem(fields)) {
    try {
      kept = await save(fields);
    } catch {
      kept = false;
    }
  }
  if (kept) return { on: true };
  await sub.unsubscribe().catch(() => false);
  return { on: false, words: subscriptionProblem(fields) ? WORDS.noSubscription : null };
}

/**
 * "Turn off on this device": the door forgets the row (`send`: push_off with its id), and the browser's subscription ends (when the
 * worker is there), whatever the door answered: the press means off.
 */
export async function turnOff(env: PushEnv, send: () => Promise<unknown>): Promise<void> {
  try {
    await send();
  } finally {
    try {
      const reg = await env.serviceWorker?.getRegistration('/');
      const sub = await reg?.pushManager.getSubscription();
      await sub?.unsubscribe();
    } catch {
      // nothing to end in this browser
    }
  }
}

/** The browser's parts from window (only in the browser). */
export function browserEnv(w: Window & typeof globalThis): PushEnv {
  const nav = w.navigator;
  let standalone = (nav as Navigator & { standalone?: boolean }).standalone === true;
  try {
    standalone ||= w.matchMedia('(display-mode: standalone)').matches;
  } catch {
    // no matchMedia: as reported by navigator.standalone
  }
  return {
    notification: 'Notification' in w ? w.Notification : undefined,
    serviceWorker: 'serviceWorker' in nav ? (nav.serviceWorker as unknown as PushEnv['serviceWorker']) : undefined,
    pushManager: 'PushManager' in w,
    userAgent: nav.userAgent ?? '',
    maxTouchPoints: nav.maxTouchPoints ?? 0,
    standalone,
  };
}

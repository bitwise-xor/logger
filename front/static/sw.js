// logger.'s service worker (deploy 112): only for the nudges. It shows a pushed message as a notification, and a tap on it opens
// (or brings forward) logger. at the message's page. No fetch handler and no caching: every page still comes from the server, and
// nothing works without a connection. It is registered only when "Turn on" is pressed in Settings > Notifications (scope "/"),
// never by itself (src/lib/pushdevice.ts). Plain JavaScript, served as it is from static/; src/lib/sw.test.ts runs it with a fake self.
'use strict';

// A changed sw.js takes over at once instead of waiting until every logger. tab is closed: it keeps nothing, so there is nothing
// to keep in step between two versions.
self.addEventListener('install', () => self.skipWaiting());
// The open pages come under this worker at once (also the one where "Turn on" was pressed), so a tap can move one of them to the
// message's page (WindowClient.navigate works only on a page this worker controls).
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

const words = (v) => (typeof v === 'string' ? v : '');

// The core's payload: {title, body, url, tag} (docs/API.md, "The notifications at two addresses").
self.addEventListener('push', (e) => {
  let d = {};
  if (e.data) {
    try {
      d = e.data.json();
    } catch {
      d = { body: e.data.text() };
    }
  }
  if (!d || typeof d !== 'object') d = {};
  e.waitUntil(
    self.registration.showNotification(words(d.title) || 'Logger', {
      body: words(d.body),
      tag: words(d.tag) || 'logger',
      data: { url: words(d.url) || '/' },
      icon: '/icon-192.png',
    }),
  );
});

// The address a tap opens: a page of logger. ("/", "/settings/notifications") or a page of another address as it came (the
// gratitude list at app.); anything that is not http(s) opens Today.
function target(raw) {
  const here = self.location.origin;
  try {
    const u = new URL(raw || '/', here);
    if (u.protocol === 'https:' || u.protocol === 'http:') return u;
  } catch {
    // not an address: Today
  }
  return new URL('/', here);
}

async function open(url) {
  if (url.origin !== self.location.origin) return self.clients.openWindow(url.href);
  const wins = (await self.clients.matchAll({ type: 'window', includeUncontrolled: true })).filter((w) => {
    try {
      return new URL(w.url).origin === self.location.origin;
    } catch {
      return false;
    }
  });
  const win = wins.find((w) => w.focused) ?? wins.find((w) => w.visibilityState === 'visible') ?? wins[0];
  if (!win) return self.clients.openWindow(url.href);
  const shown = (typeof win.focus === 'function' ? await win.focus().catch(() => null) : null) ?? win;
  if (typeof shown.navigate === 'function') {
    try {
      return await shown.navigate(url.href);
    } catch {
      // a page this worker does not control: a new window instead
    }
  }
  return self.clients.openWindow(url.href);
}

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = target(words(e.notification.data && e.notification.data.url));
  e.waitUntil(open(url));
});

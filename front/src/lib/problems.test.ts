import { describe, expect, it } from 'vitest';
import { linksToApp, problemOf, problemText } from './problems.js';
import { loginHref, safeNext } from './next.js';

describe('problemOf', () => {
  it('tells the door off, the core down, a sign-out and the rest apart', () => {
    expect(problemOf({ code: 'signed_out', status: 401 })).toBe('signed_out');
    expect(problemOf({ code: 'not_found', status: 404 })).toBe('door_off');
    expect(problemOf({ code: 'door_off', status: 0 })).toBe('door_off');
    expect(problemOf({ code: 'unreadable', status: 404 })).toBe('door_off');
    expect(problemOf({ code: 'unreachable', status: 0 })).toBe('core_down');
    expect(problemOf({ code: 'server_error', status: 500 })).toBe('trouble');
    expect(problemOf({ code: 'unreadable', status: 502 })).toBe('trouble');
    expect(problemOf({ code: 'no_entry', status: 404 })).toBe('trouble');
    expect(problemOf(new Error('x'))).toBe('trouble');
    expect(problemOf(null)).toBe('trouble');
  });

  it('says plainly what happened, and links to app. only when app. can help', () => {
    expect(problemText('door_off', 'page')).toContain('switched off');
    expect(problemText('core_down', 'save')).toContain('Nothing was saved');
    expect(problemText('core_down', 'signin')).toContain('not answering');
    expect(linksToApp('door_off')).toBe(true);
    expect(linksToApp('trouble')).toBe(true);
    expect(linksToApp('core_down')).toBe(false);
  });
});

describe('safeNext', () => {
  it('keeps a path of this app with its query', () => {
    expect(safeNext('/food?day=2026-01-30')).toBe('/food?day=2026-01-30');
    expect(safeNext('/food?open=f12')).toBe('/food?open=f12');
    expect(safeNext('/')).toBe('/');
  });

  it('never leads to another site', () => {
    for (const bad of ['//evil.example', '/\\evil.example', 'https://evil.example/', 'evil', '', ' /food', '/fo od', '/x\ny',
      'javascript:alert(1)', null, undefined, '/' + 'a'.repeat(400)]) {
      expect(safeNext(bad as string)).toBe('/');
    }
  });

  it('drops the sign-in and sign-out pages and the hash', () => {
    expect(safeNext('/login?next=/food')).toBe('/');
    expect(safeNext('/signout')).toBe('/');
    expect(safeNext('/food#x')).toBe('/food');
  });

  it('builds the sign-in address', () => {
    expect(loginHref('/')).toBe('/login');
    expect(loginHref('/food?day=2026-01-30')).toBe('/login?next=%2Ffood%3Fday%3D2026-01-30');
    expect(loginHref('//evil.example')).toBe('/login');
  });
});

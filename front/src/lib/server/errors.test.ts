// The server log's line for an error (Web 66): the kind and the route id, never words, values or addresses.
import { describe, expect, it } from 'vitest';
import { DoorError } from './door.js';
import { errorKind, errorLine } from './errors.js';

describe('errorLine', () => {
  it('says the kind of error and the route id only', () => {
    expect(errorLine({ kind: 'framework', error: { status: 404, message: 'Not found: /food?q=secret' } }, null)).toBe('logger. error: framework 404 on (no route)');
    expect(errorLine({ kind: 'app', error: { status: 404, message: 'Not found' } }, '/(app)/[...rest]')).toBe('logger. error: app 404 on /(app)/[...rest]');
    expect(errorLine({ kind: 'unknown', error: new TypeError("Cannot read properties of undefined (reading 'kcal 2100')") }, '/(app)/food')).toBe(
      'logger. error: unknown TypeError on /(app)/food',
    );
    expect(errorLine({ kind: 'unknown', error: new DoorError(500, 'server_error', 'Weight 82 kg could not be saved') }, '/(app)')).toBe(
      'logger. error: door server_error 500 on /(app)',
    );
  });

  it('never passes on words: odd names and codes become plain ones', () => {
    const odd = new Error('x');
    odd.name = 'Weight 82 kg';
    expect(errorKind({ kind: 'unknown', error: odd })).toBe('unknown Error');
    expect(errorKind({ kind: 'unknown', error: new DoorError(0, 'Bad words here', 'x') })).toBe('door error');
    expect(errorKind({ kind: 'unknown', error: 'a string with words' })).toBe('unknown string');
    expect(errorKind({ kind: 'unknown', error: null })).toBe('unknown object');
  });
});

// Settings (deploy 111) against the door's real answers (tests/samples/settings.json, written by tests/test_front_samples.py): a
// Today page group moved and switched and posted whole, the forms' own checks in app.'s words, the Nudges form, the lines of a device,
// and the export's download headers.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  addressTag,
  canMove,
  dateText,
  deviceLine,
  downloadHeaders,
  groupFields,
  heightProblem,
  hoursOf,
  intervalProblem,
  moved,
  nudgesDraft,
  nudgesFields,
  pushLine,
  switched,
  targetsProblem,
  whenText,
  type SettingsBody,
  type SettingsDevices,
  type SettingsNotify,
  type SettingsTargets,
  type SettingsToday,
} from './settings.js';

const SAMPLE = JSON.parse(readFileSync(new URL('../../tests/samples/settings.json', import.meta.url), 'utf8'));
const TODAY: SettingsToday = SAMPLE.today.settings_today;
const TARGETS: SettingsTargets = SAMPLE.targets.settings_targets;
const BODY: SettingsBody = SAMPLE.body.settings_body;
const DEVICES: SettingsDevices = SAMPLE.devices.settings_devices;
const NOTIFY: SettingsNotify = SAMPLE.notify.settings_notify;

describe('the Today page tab', () => {
  const health = TODAY.groups.find((g) => g.kind === 'health')!;

  it('moves a row one place up or down; the first row cannot go up, the last cannot go down', () => {
    const ids = (xs: { id: string }[]) => xs.map((x) => x.id);
    expect(ids(moved(health.items, 2, -1))).toEqual(['bed', 'weight', 'wake', 'sugar', 'bp_morning', 'bp_evening']);
    expect(ids(moved(health.items, 0, 1))).toEqual(['wake', 'bed', 'weight', 'sugar', 'bp_morning', 'bp_evening']);
    expect(ids(moved(health.items, 0, -1))).toEqual(ids(health.items));
    expect(ids(moved(health.items, 5, 1))).toEqual(ids(health.items));
    expect([canMove(health.items, 0, -1), canMove(health.items, 0, 1), canMove(health.items, 5, 1), canMove(health.items, 5, -1)]).toEqual([false, true, false, true]);
    const box = TODAY.groups.find((g) => g.kind === 'review')!;
    expect([canMove(box.items, 0, -1), canMove(box.items, 0, 1)]).toEqual([false, false]);
    // the read itself is left as it is (the page shows the door's fresh read, never this)
    expect(ids(health.items)[0]).toBe('bed');
  });

  it('switches one row and keeps the others', () => {
    const s = switched(health.items, 3);
    expect(s.map((x) => x.shown)).toEqual([true, true, true, true, true, true]);
    expect(switched(s, 0)[0]!.shown).toBe(false);
    expect(health.items[3]!.shown).toBe(false);
  });

  it('posts the whole group: its kind, the ids in the new order, each shown or not', () => {
    const cards = TODAY.groups.find((g) => g.kind === 'card')!;
    expect(groupFields('card', moved(cards.items, 2, -1))).toEqual({ group: 'card', id: ['coach', 'gratitude', 'home'], shown: ['1', '0', '1'] });
    expect(groupFields('health', switched(health.items, 0)).shown).toEqual(['0', '1', '1', '0', '1', '1']);
  });
});

describe('the forms\' own checks (app.\'s words)', () => {
  it('food targets: a field that is no number is refused before it goes; empty is no target, a comma and a minus go to the door', () => {
    const typed = Object.fromEntries(TARGETS.fields.map((f) => [f.key, String(f.value ?? '')]));
    expect(targetsProblem(TARGETS.fields, typed, TARGETS.limits)).toBeNull();
    expect(targetsProblem(TARGETS.fields, { ...typed, fat: '', protein: '150,5', kcal: '-5' }, TARGETS.limits)).toBeNull();
    expect(targetsProblem(TARGETS.fields, { ...typed, sodium_mg: 'lots' }, TARGETS.limits)).toBe('Sodium: give a number from 0 to 100000, or leave it empty.');
  });

  it('height and the interval', () => {
    expect(heightProblem('177.5', BODY.height_range)).toBeNull();
    expect(heightProblem('', BODY.height_range)).toBe('Height: give a number from 120 to 230 cm.');
    expect(intervalProblem('28', BODY.interval)).toBeNull();
    expect(intervalProblem('2.5', BODY.interval)).toBe('Due every: give a whole number of days from 7 to 90.');
  });
});

describe('the Nudges form', () => {
  it('starts as the read: the master switch, each row\'s switch and its hours', () => {
    const d = nudgesDraft(NOTIFY);
    expect(d.on).toBe(true);
    expect(d.rows.map((r) => [r.key, r.on, r.hoursKey, r.hours])).toEqual([
      ['weight', true, 'weight_after', '2.5'],
      ['habits', false, 'habits_after', '14'],
      ['idle', true, 'idle_hours', '5'],
      ['checkin', true, 'checkin_after', '12'],
      ['bp_evening', false, 'bp_evening_after', '13'],
      ['gratitude', true, 'gratitude_after', '14'],
    ]);
  });

  it('sends every switch as "1" or "0" and every hours field as typed', () => {
    const d = nudgesDraft(NOTIFY);
    d.on = false;
    d.rows[1]!.on = true;
    d.rows[2]!.hours = ' 6.5 ';
    expect(nudgesFields(d)).toEqual({
      on: '0', weight: '1', weight_after: '2.5', habits: '1', habits_after: '14', idle: '1', idle_hours: '6.5',
      checkin: '1', checkin_after: '12', bp_evening: '0', bp_evening_after: '13', gratitude: '1', gratitude_after: '14',
    });
  });

  it('takes an hours field as a number (a comma too); anything else is left out, so it stays as it is', () => {
    expect([hoursOf('2'), hoursOf('2,5'), hoursOf('15.5'), hoursOf(''), hoursOf('soon'), hoursOf('-1'), hoursOf(undefined)]).toEqual([2, 2.5, 15.5, undefined, undefined, undefined, undefined]);
  });
});

describe('devices and the devices that get nudges', () => {
  it('say where and when, in Berlin time, dates dd.mm.yyyy', () => {
    const [here, app, pc] = DEVICES.devices;
    expect([addressTag(here!.address), addressTag(app!.address)]).toEqual(['logger.', 'app.']);
    expect(deviceLine(here!)).toBe('signed in 17.11.2026 · last used 17.11.2026 12:58 · stays signed in until 17.12.2026');
    expect(deviceLine(pc!)).toBe('signed in 17.11.2026 · last used 30.10.2026 12:58 · stays signed in until 29.11.2026');
    expect(pushLine(NOTIFY.subscriptions[0]!)).toBe('on since 17.11.2026, last delivered 17.11.2026 09:58');
    expect(pushLine({ ...NOTIFY.subscriptions[0]!, last_delivered: null })).toBe('on since 17.11.2026, nothing delivered yet');
    expect([dateText('2026-02-01'), dateText(null), whenText('nonsense')]).toEqual(['01.02.2026', '', '']);
  });
});

describe('the export\'s download', () => {
  it('hands on the door\'s ZIP with its file name and no-store', () => {
    expect(downloadHeaders('application/zip', 'attachment; filename="logger-export-17.11.2026.zip"')).toEqual({
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="logger-export-17.11.2026.zip"',
      'Cache-Control': 'no-store',
    });
  });

  it('names the file plainly when the door\'s name is odd, and hands on nothing that is not a ZIP', () => {
    expect(downloadHeaders('application/zip', 'inline')!['Content-Disposition']).toBe('attachment; filename="logger-export.zip"');
    expect(downloadHeaders('application/zip', 'attachment; filename="../x\r\nSet-Cookie: a=b"')!['Content-Disposition']).toBe('attachment; filename="logger-export.zip"');
    expect(downloadHeaders('application/json', 'attachment; filename="x.zip"')).toBeNull();
    expect(downloadHeaders('text/html', null)).toBeNull();
    expect(downloadHeaders(null, null)).toBeNull();
  });
});

// The Health page's plain rules (deploy 92): what a day's row shows, what a Save sends (only the changed rows), the door's body
// from the form's fields, the body card's lines and Today's due line; against real answers of the door (tests/samples/health.json).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  askedRange,
  bodyDraft,
  bodyDueLine,
  bodyFields,
  bodySub,
  bodyValues,
  changedRows,
  clears,
  dayLine,
  draftOf,
  healthHref,
  healthValues,
  saveFields,
  sleptText,
  waistHeight,
  weightRate,
  type Body,
  type Health,
} from './health.js';

const SAMPLE = JSON.parse(readFileSync(new URL('../../tests/samples/health.json', import.meta.url), 'utf8'));
const health: Health = SAMPLE.health.health;
const body: Body = SAMPLE.body.body;
const [today, before] = [health.days[0]!, health.days[1]!];
const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.append(k, v);
  return f;
};

describe('the address', () => {
  it('the range: 7, 30 or 90, else 30', () => {
    expect([askedRange('7'), askedRange('90'), askedRange('45'), askedRange(null)]).toEqual([7, 90, 30, 30]);
  });
  it('"Show all" and the body form on a session', () => {
    expect(healthHref(7)).toBe('/health?range=7');
    expect(healthHref(30, { all: true })).toBe('/health?range=30&all=1');
    expect(healthHref(30, { measure: true, mday: '2026-11-12' })).toBe('/health?range=30&measure=1&mday=2026-11-12#body');
  });
});

describe("a day's row", () => {
  it('the date, the values there are in the door’s order, the sleep', () => {
    const l = dayLine(today, health.columns);
    expect(l.label).toBe('Mon 16.11.');
    expect(l.parts.map((p) => p.text)).toEqual(['Weight 81.6 kg', 'BP morning 118/77', 'Sugar 88', 'Bed 22:00', 'Up 06:00']);
    expect(l.slept).toBe('8 h 00');
    expect(l.cells.map((c) => c.text)).toEqual(['81.6', '118/77', '–', '88', '22:00', '06:00', '–', '–']);
    expect(l.empty).toBe(false);
  });

  it('a day with nothing', () => {
    const l = dayLine({ day: '2026-11-01', values: { ...today.values, weight: null, bp_morning: null, sugar: null, bed: null, wake: null }, slept_minutes: null }, health.columns);
    expect(l.empty).toBe(true);
    expect(l.slept).toBe('–');
  });

  it('the sleep as app.’s table writes it', () => {
    expect([sleptText(484), sleptText(null), sleptText(0), sleptText(1440)]).toEqual(['8 h 04', '–', '–', '–']);
  });
});

describe('a Save', () => {
  it('the fields start from the day’s values', () => {
    expect(draftOf(before)).toEqual({
      weight: '81.8', bp_morning_1: '', bp_morning_2: '', bp_evening_1: '125', bp_evening_2: '81', sugar: '', bed: '23:07', wake: '07:11',
      mood: '3', energy: '3',
    });
  });

  it('sends only the changed rows, both numbers of a blood pressure; the same number written otherwise is no change', () => {
    const was = draftOf(before);
    const now = { ...was, weight: '81.80', bp_evening_2: '80', sugar: ' 91 ', mood: '3' };
    expect(changedRows(was, now)).toEqual(['bp_evening', 'sugar']);
    expect(saveFields(was, now)).toEqual({ bp_evening_1: '125', bp_evening_2: '80', sugar: '91' });
    expect(clears(was, now)).toBe(false);
    expect(changedRows(was, { ...was })).toEqual([]);
  });

  it('knows a cleared value (asked once) from an added one', () => {
    const was = draftOf(before);
    expect(clears(was, { ...was, weight: '' })).toBe(true);
    expect(clears(was, { ...was, bp_evening_1: '', bp_evening_2: '' })).toBe(true);
    expect(clears(was, { ...was, bp_morning_1: '120', bp_morning_2: '80' })).toBe(false);
    expect(saveFields(was, { ...was, weight: '' })).toEqual({ weight: '' });
  });
});

describe("the door's bodies", () => {
  it('values from the fields sent: numbers, [upper, lower], hh:mm; empty is null', () => {
    expect(healthValues(form({ weight: '81,2', bp_morning_1: '121', bp_morning_2: '79', bed: '22:40', wake: '', mood: '4' }))).toEqual({
      weight: 81.2, bp_morning: [121, 79], bed: '22:40', wake: null, mood: 4,
    });
    expect(healthValues(form({ bp_evening_1: '', bp_evening_2: '' }))).toEqual({ bp_evening: null });
    expect(healthValues(form({ day: '2026-11-15' }))).toEqual({});
  });

  it('a body session in cm', () => {
    expect(bodyValues(form({ waist: '91.8', hips: '', day: '2026-11-16', other: '3' }))).toEqual({ waist: 91.8, hips: null });
  });
});

describe('the body card', () => {
  it('the line under the title', () => {
    expect(bodySub(body)).toBe('Last measured 12.11.2026 · next due in about 3 weeks');
    expect(bodySub({ ...body, last_measured: null, due_text: null })).toBe('No measurements yet. About 3 minutes with a tape measure, every 4 weeks.');
  });

  it('the form: the session’s values; a Save sends only the measures changed', () => {
    const was = bodyDraft(body);
    expect(was).toEqual({ waist: '', hips: '', chest: '', upper_arm: '', thigh: '' });
    expect(bodyFields(was, { ...was, waist: '91.8', thigh: ' 57 ' })).toEqual({ waist: '91.8', thigh: '57' });
    const session = bodyDraft({ ...body, form: body.form.map((m) => (m.key === 'waist' ? { ...m, cm: 92, ref: 'm98' } : m)) });
    expect(session.waist).toBe('92.0');
    expect(bodyFields(session, { ...session, waist: '92' })).toEqual({});
    expect(bodyFields(session, { ...session, waist: '' })).toEqual({ waist: '' });
  });

  it('waist ÷ height and the weekly weight rate as app. writes them', () => {
    expect(waistHeight(body)).toEqual({ ratio: '0.52', height: '178' });
    expect(waistHeight({ ...body, waist_height: { waist_cm: 92, day: '2026-11-12', height_cm: null, ratio: null } })).toEqual({ noHeight: true });
    expect(waistHeight({ ...body, waist_height: null })).toBeNull();
    expect(weightRate(body)).toEqual({ kg: '+0.26 kg', pct: '+0.32 %' });
    expect(weightRate({ ...body, weight_rate: { kg_week: -0.4, pct_week: -0.5, sign: '−' } })).toEqual({ kg: '−0.40 kg', pct: '−0.50 %' });
  });
});

describe("Today's line", () => {
  it('due, with the last session; or not measured yet', () => {
    expect(bodyDueLine(SAMPLE.day_body_due)).toEqual({ head: 'Body measurements due', sub: 'Last 15.10. · 32 days ago · takes about 3 minutes' });
    expect(bodyDueLine({ last: null, days: null })).toEqual({ head: 'Body measurements', sub: 'not measured yet · takes about 3 minutes' });
  });
});

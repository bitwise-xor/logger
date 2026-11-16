// The Habits page's plain rules (deploy 94): "n of N done", the weeks of a calendar from the read's days, what a cell shows, the
// filter's counts, a row's actions, and the body of each form; against real answers of the door (tests/samples/habits.json).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  askedShow,
  canChange,
  cellLabel,
  cellMark,
  cellNumber,
  changedNames,
  chips,
  dayFields,
  dayName,
  deleteFields,
  doneLine,
  editDraft,
  editFields,
  fullText,
  groupTitle,
  helpText,
  habitsHref,
  isFull,
  newDraft,
  newFields,
  problem,
  readOnlyWhy,
  restoreFields,
  retireFields,
  rowActions,
  rowLine,
  tickFields,
  trackFields,
  weekdayOf,
  weeks,
  whereOf,
  type CalDay,
  type CalHabit,
  type Habits,
} from './habits.js';

const SAMPLE = JSON.parse(readFileSync(new URL('../../tests/samples/habits.json', import.meta.url), 'utf8'));
const habits: Habits = SAMPLE.habits.habits;
const all: Habits = SAMPLE.habits_all.habits;
const cal = (name: string) => habits.calendar.find((c) => c.name === name)!;
const row = (h: Habits, name: string) => h.list.flatMap((g) => g.habits).find((x) => x.name === name)!;
const day = (n: number, target = 1): CalDay => ({ day: '2026-11-16', n, state: n >= target ? 'done' : n ? 'partly' : 'none', text: '' });

describe('the filter', () => {
  it('takes the four filters, tracked without or when odd', () => {
    expect(askedShow('retired')).toBe('retired');
    expect(askedShow('all')).toBe('all');
    expect(askedShow(null)).toBe('tracked');
    expect(askedShow('everything')).toBe('tracked');
    expect(habitsHref('tracked')).toBe('/habits');
    expect(habitsHref('untracked')).toBe('/habits?show=untracked');
  });

  it("shows each filter with the read's count and marks the one shown", () => {
    expect(chips(habits).map((c) => c.text)).toEqual(['Tracked · 5', 'Not tracked · 27', 'Retired · 2', 'All · 34']);
    expect(chips(habits).map((c) => c.current)).toEqual([true, false, false, false]);
    expect(chips(all).find((c) => c.current)?.key).toBe('all');
    expect(chips(habits).map((c) => c.href)).toEqual(['/habits', '/habits?show=untracked', '/habits?show=retired', '/habits?show=all']);
  });

  it('titles a group with how many habits it has', () => {
    expect(habits.list.map(groupTitle)).toEqual(['Intake · 1', 'Practice · 2', 'Learning · 1', 'Behaviour · 1']);
  });
});

describe("today's ticks", () => {
  it('says n of N done from the read', () => {
    expect(doneLine(habits)).toBe('2 of 4 done');
  });

  it("ticks what is not complete and takes the last tick off a complete one, as Today's card", () => {
    const [meds, , stretching] = habits.checklist.habits;
    expect(tickFields(meds!)).toEqual({ name: 'meds', action: 'tick' });
    expect(tickFields(stretching!)).toEqual({ name: 'sample_stretching', action: 'untick', ref: 'e1' });
    expect(tickFields({ ...stretching!, last_tick: null })).toEqual({ name: 'sample_stretching', action: 'untick' });
  });
});

describe('the last 30 days', () => {
  it('counts the days done, or without for a habit to avoid', () => {
    expect(fullText(cal('sample_stretching'))).toBe('23/30');
    expect(fullText(cal('sample_soft_drink'))).toBe('26/30 without');
    expect(fullText(cal('meds'))).toBe('0/30');
  });

  it('knows the weekday, Monday first', () => {
    expect(weekdayOf('2026-11-16')).toBe(0); // a Monday
    expect(weekdayOf('2026-11-22')).toBe(6);
    expect(weekdayOf('2026-10-18')).toBe(6);
    expect(dayName('2026-11-16')).toBe('Mon 16.11.');
  });

  it('lays the 30 days out in weeks of seven, Monday first, empty cells before the first day and after the last', () => {
    const w = weeks(cal('sample_reading').days);
    // 18.10. is a Sunday: six empty cells, then the 30 days, then padding to a whole week (6 + 30 = 36 -> 42)
    expect(w).toHaveLength(6);
    expect(w.every((x) => x.length === 7)).toBe(true);
    expect(w[0]!.slice(0, 6)).toEqual([null, null, null, null, null, null]);
    expect(w[0]![6]!.day).toBe('2026-10-18');
    expect(w[5]![0]!.day).toBe('2026-11-16'); // today, a Monday, the first of the last week
    expect(w[5]!.slice(1)).toEqual([null, null, null, null, null, null]);
    expect(w.flat().filter(Boolean).map((d) => d!.day)).toEqual(cal('sample_reading').days.map((d) => d.day));
    // every row starts on a Monday
    for (const week of w.slice(1)) expect(weekdayOf(week[0]!.day)).toBe(0);
  });

  it('adds nothing for no days, and no padding for whole weeks', () => {
    expect(weeks([])).toEqual([]);
    const monday = Array.from({ length: 14 }, (_, i) => ({ ...day(0), day: `2026-11-${String(2 + i).padStart(2, '0')}` }));
    const w = weeks(monday);
    expect(w).toHaveLength(2);
    expect(w.flat().includes(null)).toBe(false);
  });

  it('writes the day of the month, with the month on the first cell and on the 1st', () => {
    expect(cellNumber('2026-10-18', true)).toBe('18 Oct');
    expect(cellNumber('2026-10-19', false)).toBe('19');
    expect(cellNumber('2026-11-01', false)).toBe('1 Nov');
    expect(cellNumber('2026-11-09', false)).toBe('9');
  });

  it('shows in a cell: a tick, "1/2" for a habit of two a day, a cross for a habit to avoid, nothing for nothing', () => {
    const once = { target: 1, avoid: false };
    const twice = { target: 2, avoid: false };
    const avoid = { target: 1, avoid: true };
    expect(cellMark(day(1), once)).toBe('✓');
    expect(cellMark(day(0), once)).toBe('');
    expect(cellMark(day(1, 2), twice)).toBe('1/2');
    expect(cellMark(day(2, 2), twice)).toBe('2/2');
    expect(cellMark(day(0, 2), twice)).toBe('');
    expect(cellMark(day(1), avoid)).toBe('✕');
    expect(cellMark(day(3), avoid)).toBe('✕3');
    expect(cellMark(day(0), avoid)).toBe('');
    // against the sample's own days
    const reading = cal('sample_reading');
    expect(reading.days.filter((d) => d.state === 'partly').every((d) => cellMark(d, reading) === '1/2')).toBe(true);
  });

  it('tells a tap what it does: a done day is taken off, any other day gets a tick', () => {
    const reading = cal('sample_reading');
    expect(isFull(day(1, 2), reading)).toBe(false);
    expect(isFull(day(2, 2), reading)).toBe(true);
    expect(cellLabel(reading, { ...day(1, 2), text: '1 of 2' })).toBe('Reading Mon 16.11.: 1 of 2, tap to tick');
    expect(cellLabel(reading, { ...day(2, 2), text: 'done' })).toBe('Reading Mon 16.11.: done, tap to take the ticks off');
    expect(cellLabel({ ...reading, editable: false }, { ...day(2, 2), text: 'done' })).toBe('Reading Mon 16.11.: done');
  });

  it('changes only the days the door takes, from edit_from to today', () => {
    expect(canChange(habits, '2026-11-16')).toBe(true);
    expect(canChange(habits, '2026-10-18')).toBe(true);
    expect(canChange(habits, '2026-10-12')).toBe(true);
    expect(canChange(habits, '2026-10-11')).toBe(false);
    expect(canChange(habits, '2026-11-17')).toBe(false);
  });

  it('opens a habit the read marks as not editable read-only, with one line why', () => {
    expect(readOnlyWhy(cal('sample_reading'))).toBeNull();
    const locked: CalHabit = { ...cal('sample_reading'), editable: false };
    expect(readOnlyWhy(locked)).toBe('Its days cannot be changed here: this is a time, not a habit to tick.');
  });

  it("sends a day tap's habit and day", () => {
    expect(dayFields(cal('sample_reading'), '2026-11-13')).toEqual({ name: 'sample_reading', day: '2026-11-13' });
  });
});

describe('your habits', () => {
  it('words a row: group, times a day', () => {
    expect(rowLine(row(habits, 'sample_reading'), habits.groups)).toBe('Learning · 2 times a day');
    expect(rowLine(row(habits, 'meds'), habits.groups)).toBe('Intake · 1 time a day');
    expect(rowLine({ ...row(habits, 'meds'), group: 'odd' }, habits.groups)).toBe('odd · 1 time a day');
  });

  it('offers the actions the read allows', () => {
    expect(rowActions(row(habits, 'meds'))).toEqual({ track: 'untrack', edit: true, retire: true, restore: false, delete: true });
    expect(rowActions(row(habits, 'sample_stretching')).delete).toBe(false); // it has history
    const untracked = row(all, 'surya_kriya');
    expect(rowActions(untracked).track).toBe('track');
    const retired = row(all, 'sample_piano');
    expect(rowActions(retired)).toMatchObject({ track: null, retire: false, restore: true });
  });

  it('finds the rows a fresh read changed or added', () => {
    const after: Habits = structuredClone(habits);
    row(after, 'meds').label = 'Medicine';
    after.list[3]!.habits.push({ ...row(habits, 'sample_soft_drink'), name: 'sample_new', label: 'New' });
    expect([...changedNames(habits, after)].sort()).toEqual(['meds', 'sample_new']);
    expect(changedNames(habits, habits).size).toBe(0);
    expect(changedNames(null, habits).size).toBe(5);
  });
});

describe('the forms', () => {
  const limits = habits.limits;

  it("an Edit form starts from the habit's own values and sends all of them", () => {
    const d = editDraft(row(habits, 'sample_reading'));
    expect(d).toMatchObject({ label: 'Reading', target: '2', order: '802', aim: 'do' });
    expect(editDraft(row(habits, 'sample_soft_drink')).aim).toBe('avoid');
    expect(editFields('sample_reading', { ...d, label: '  Reading   more ', target: ' 3 ', aim: 'avoid' })).toEqual({
      action: 'edit',
      name: 'sample_reading',
      label: 'Reading more',
      target: '3',
      order: '802',
      aim: 'avoid',
    });
    // an order left empty is not sent, so the door keeps it
    expect(editFields('x', { ...d, order: ' ' })).not.toHaveProperty('order');
  });

  it('a new habit: the default group, one a day, tracked; its body', () => {
    const d = newDraft(habits);
    expect(d).toMatchObject({ label: '', target: '1', group: 'practice', track: true });
    expect(newFields({ ...d, label: ' Evening  walk', group: 'daily', target: '2', track: false })).toEqual({
      action: 'new',
      label: 'Evening walk',
      group: 'daily',
      target: '2',
      track: '0',
    });
    expect(newFields({ ...d, label: 'A' }).track).toBe('1');
  });

  it("checks a form with the read's limits and says why, in the door's words where it has them", () => {
    const d = { ...newDraft(habits), label: 'Walk' };
    expect(problem(d, limits, true)).toBeNull();
    expect(problem({ ...d, label: '   ' }, limits, true)).toBe('A habit needs a name to show.');
    expect(problem({ ...d, label: 'x'.repeat(41) }, limits, true)).toBe('The name can have up to 40 characters.');
    expect(problem({ ...d, label: 'x'.repeat(40) }, limits, true)).toBeNull();
    expect(problem({ ...d, target: '0' }, limits, true)).toBe('Times a day: a whole number from 1 to 10.');
    expect(problem({ ...d, target: '11' }, limits, true)).toBe('Times a day: a whole number from 1 to 10.');
    expect(problem({ ...d, target: '1.5' }, limits, true)).toBe('Times a day: a whole number from 1 to 10.');
    expect(problem({ ...d, target: '10' }, limits, true)).toBeNull();
    expect(problem({ ...d, order: '1000' }, limits, false)).toBe('Order: a whole number from 0 to 999.');
    expect(problem({ ...d, order: '' }, limits, false)).toBeNull();
    expect(problem({ ...d, order: '999' }, limits, false)).toBeNull();
    // the order is not asked of a new habit
    expect(problem({ ...d, order: 'abc' }, limits, true)).toBeNull();
  });

  it('track, retire, bring back and delete', () => {
    expect(trackFields('meds', true)).toEqual({ action: 'track', name: 'meds', on: '1' });
    expect(trackFields('meds', false)).toEqual({ action: 'track', name: 'meds', on: '0' });
    expect(retireFields('meds')).toEqual({ action: 'retire', name: 'meds' });
    expect(restoreFields('meds')).toEqual({ action: 'restore', name: 'meds' });
    expect(deleteFields('meds')).toEqual({ action: 'delete', name: 'meds', confirmed: '1' });
  });

  it('says where a refusal belongs: the Edit form, the New form, or the row', () => {
    expect(whereOf(editFields('meds', editDraft(row(habits, 'meds'))))).toBe('edit:meds');
    expect(whereOf(newFields({ ...newDraft(habits), label: 'A' }))).toBe('new');
    expect(whereOf(deleteFields('meds'))).toBe('row:meds');
    expect(whereOf(trackFields('meds', true))).toBe('row:meds');
  });
});

describe('the line under the filter (deploy 96)', () => {
  it('says where the calendar is on this page instead of app.’s "below"', () => {
    const h = SAMPLE.habits.habits as Habits;
    expect(h.help).toContain('in the calendar below');
    expect(helpText(h)).toBe('Tracked habits show on Today (unless hidden under Settings > Today page) and in Last 30 days.');
    expect(helpText({ help: 'Retired: hidden everywhere; the history stays. Bring one back any time.', days: 30 })).toBe(
      'Retired: hidden everywhere; the history stays. Bring one back any time.',
    );
  });
});

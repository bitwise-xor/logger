// The Gym's read-only parts' plain rules (deploy 97): the questions of Progress and Activity, the lines of the Progress card, the bars
// of "Workouts per week", what a History card shows and its anchor, the Activity day's links, times and guide; against real answers of
// the door (tests/samples/gym.json).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  activityHref,
  activityTitle,
  askedDay,
  askedExercise,
  bars,
  barsLabel,
  cardDate,
  cardHref,
  cardSub,
  clock,
  exerciseLine,
  goodWeeks,
  matchLine,
  progressHref,
  progressTitle,
  sessionDay,
  subParts,
  watchTimes,
  type Activity,
  type HistoryWorkout,
  type Progress,
} from './gymread.js';

const read = (name: string) => JSON.parse(readFileSync(new URL(`../../tests/samples/${name}`, import.meta.url), 'utf8'));
const G = read('gym.json');
const P: Progress = G.progress.gym_progress;
const H: HistoryWorkout[] = G.history.gym_history.workouts;
const A: Activity = G.activity.gym_activity;
const NONE: Activity = G.activity_none.gym_activity;

describe('the questions', () => {
  it('Progress takes an exercise id of digits, nothing else', () => {
    expect(askedExercise('8')).toBe('8');
    expect(askedExercise('0012')).toBe('0012');
    for (const bad of [null, '', 'x', '8; drop', '-1', '1.5', '1'.repeat(13)]) expect(askedExercise(bad), String(bad)).toBeUndefined();
    expect(progressHref(8)).toBe('/gym/progress?x=8');
  });

  it('Activity takes a real date, nothing else', () => {
    expect(askedDay('2026-11-15')).toBe('2026-11-15');
    expect(askedDay('2024-02-29')).toBe('2024-02-29');
    for (const bad of [null, '', '2026-13-01', '2026-02-30', '15.11.2026', '2026-11-15x', 'yesterday']) expect(askedDay(bad), String(bad)).toBeUndefined();
  });
});

describe('the Progress card', () => {
  it('has the exercise’s name and what the number is', () => {
    expect(progressTitle(P)).toBe('Bench press: top weight');
    expect(progressTitle({ ...P, exercise: null })).toBe('');
    expect(P.top_text).toBe('70 kg');
    expect(P.change).toBe('+20 kg since 22.09.');
  });

  it('cuts the line under the number where it joins its parts, and marks the estimated 1-rep max', () => {
    expect(P.one_rep_max).toBe(84);
    expect(subParts(P.sub)).toEqual([
      { text: 'Top set 70 kg × 6', orm: false },
      { text: 'Estimated 1-rep max ≈ 84 kg', orm: true },
    ]);
    expect(subParts('Last session Tue 04.11.')).toEqual([{ text: 'Last session Tue 04.11.', orm: false }]);
    expect(subParts(undefined)).toEqual([]);
  });

  it('lists the last sessions with the weekday and date', () => {
    expect(P.recent).toHaveLength(6);
    expect(sessionDay(P.recent![0]!.day)).toBe('Mon 16.11.');
    expect(P.recent![0]!.text).toBe('3 × 8 at 67.5 kg, 1 × 6 at 70 kg');
  });

  it('draws the chart the door sent: one point per session', () => {
    expect(P.chart!.series[0]!.pts).toHaveLength(8);
    expect(P.chart!.days).toBe(56);
  });
});

describe('Workouts per week', () => {
  it('makes a bar for each of the 8 weeks as app. draws it (320 × 84, 24 wide every 40, up to 56 high)', () => {
    const b = bars(P.per_week);
    expect(b).toHaveLength(8);
    expect(b.map((x) => x.n)).toEqual([3, 2, 2, 3, 2, 2, 3, 1]);
    expect(b[0]).toEqual({ x: 8, y: 8, h: 56, n: 3, cx: 20, ny: 4, label: '28.09.', now: false });
    expect(b[1]).toMatchObject({ x: 48, h: 37.3, y: 26.7, ny: 22.7 });
    expect(b[7]).toMatchObject({ x: 288, h: 18.7, now: true, label: '16.11.' });
    expect(b.filter((x) => x.now)).toHaveLength(1);
  });

  it('keeps the bars inside their box: a week of 5 with top 5, and a week of 0', () => {
    const b = bars({ weeks: [{ start: '2026-11-02', n: 5 }, { start: '2026-11-09', n: 0 }], top: 5, good: 1 });
    expect(b[0]).toMatchObject({ h: 56, y: 8 });
    expect(b[1]).toMatchObject({ h: 0, y: 64, ny: 60 });
  });

  it('says how many weeks had 2 or more, and each week in words for a screen reader', () => {
    expect(goodWeeks(P.per_week)).toBe('7 of 8 weeks with 2+');
    expect(barsLabel(P.per_week)).toBe(
      'Workouts per week: week of 28.09.: 3, week of 05.10.: 2, week of 12.10.: 2, week of 19.10.: 3, week of 26.10.: 2, week of 02.11.: 2, week of 09.11.: 3, week of 16.11.: 1',
    );
  });
});

describe('a History card', () => {
  it('has its date, its day and times, and its anchor', () => {
    expect(H).toHaveLength(21);
    const [first, last] = [H[0]!, H.at(-1)!];
    expect(cardDate(first)).toBe('Mon 16.11.2026');
    expect(cardSub(first)).toBe('Push · 18:21–19:21');
    expect(first.anchor).toBe('w21');
    expect(cardHref(first)).toBe('/gym/history#w21');
    expect(cardSub(last)).toBe('Arms · 20:01');
  });

  it('every card’s anchor is w<id> and every one is different', () => {
    for (const w of H) expect(w.anchor).toBe(`w${w.workout_id}`);
    expect(new Set(H.map((w) => w.anchor)).size).toBe(H.length);
  });

  it('shows each exercise with its sets as one line', () => {
    expect(H[0]!.exercises.map(exerciseLine)).toEqual([
      { name: 'Bench press', text: '3 × 8 at 67.5 kg, 1 × 6 at 70 kg' },
      { name: 'Exercise bike', text: '20 min' },
    ]);
    // a line without the door's text is made from the rows
    expect(exerciseLine({ ...H[0]!.exercises[0]!, text: '' }).text).toBe('3 × 8 at 67.5 kg, 1 × 6 at 70 kg');
  });

  it('says "Free workout" for a workout with no day', () => {
    expect(cardSub({ split: 'Free workout', when: '17:05' })).toBe('Free workout · 17:05');
  });
});

describe('the Activity day', () => {
  it('links to the day before and after; today’s own link has no day', () => {
    expect(A.day).toBe('2026-11-15');
    expect(activityHref(A.prev_day!, A.today)).toBe('/gym/activity?day=2026-11-14');
    expect(activityHref(A.next_day!, A.today)).toBe('/gym/activity');
    expect(activityHref('2026-11-12', A.today)).toBe('/gym/activity?day=2026-11-12');
    expect(activityHref('2026-11-12', null)).toBe('/gym/activity?day=2026-11-12');
  });

  it('titles the day with its label and date', () => {
    expect(activityTitle(A)).toEqual({ label: 'Yesterday', date: '15.11.2026' });
  });

  it('writes the watch’s times as the clock the door sent', () => {
    expect(clock('2026-11-16T17:05:00+01:00')).toBe('17:05');
    expect(watchTimes({ start_at: '2026-11-16T17:05:00+01:00', end_at: '2026-11-16T18:10:00+01:00' })).toBe('17:05–18:10');
  });

  it('says what a watch workout matches in the Logger, or nothing', () => {
    expect(matchLine({ matches: 'Day 2 · Pull' })).toBe('Matches Day 2 · Pull in the Logger');
    expect(matchLine({ matches: 'Free workout' })).toBe('Matches Free workout in the Logger');
    expect(matchLine({ matches: null })).toBeNull();
  });

  it('has the tiles and three 7-day charts, or the set-up guide while the watch has sent nothing', () => {
    expect(A.has_data).toBe(true);
    expect(A.tiles).toHaveLength(8);
    expect(A.charts.map((c) => c.id)).toEqual(['steps', 'sleep', 'rhr']);
    for (const c of A.charts) expect(c.chart.days).toBe(7);
    expect(NONE.has_data).toBe(false);
    expect(NONE.setup!.title).toBe('No watch data yet');
    expect(NONE.setup!.steps.flat().some((p) => p.code)).toBe(true);
    expect(NONE.charts).toEqual([]);
  });
});

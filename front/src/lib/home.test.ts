// Home's first pages' plain rules (deploy 99): the time chips and the tabs, a row's lines and its tick, the rows kept in place after a
// save, the timer's clock and what shows in each of its states, the Pick page's lines and fields, and Today's Home card; against real
// answers of the door (tests/samples/home.json, day.json).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  alsoTitle,
  anotherHref,
  askedNumber,
  cardLines,
  chipsOf,
  choreHref,
  clockText,
  earlierProblem,
  earlierRange,
  hiddenLine,
  jobOf,
  keepOrder,
  leftText,
  nWord,
  overNote,
  pairKey,
  pairsValue,
  pickFields,
  pickHref,
  rowMeta,
  secondsLeft,
  showAll,
  TABS,
  tickFields,
  tickLabel,
  timerView,
  weekLines,
  type HomeCard,
  type HomePick,
  type Now,
} from './home.js';

const read = (name: string) => JSON.parse(readFileSync(new URL(`../../tests/samples/${name}`, import.meta.url), 'utf8'));
const H = read('home.json');
const NOW: Now = H.home.home;
const NOW_T: Now = H.home_timer.home;
const PICK: HomePick = H.pick.home_pick;
const HOUR: HomePick = H.pick_hour.home_pick;
const PICK_T: HomePick = H.pick_timer.home_pick;
const CARD: HomeCard = read('day.json').day.home;

describe('Now', () => {
  it('has the door’s time chips, each a link to Now with that time, the chosen one on', () => {
    expect(chipsOf(NOW)).toEqual([
      { minutes: 5, label: '5 min', href: '/home?min=5', on: false },
      { minutes: 15, label: '15 min', href: '/home?min=15', on: true },
      { minutes: 30, label: '30 min', href: '/home?min=30', on: false },
      { minutes: 60, label: '1 hour', href: '/home?min=60', on: false },
    ]);
    expect(pickHref(NOW.minutes)).toBe('/home/pick?min=15');
    expect(pickHref(30, 2)).toBe('/home/pick?min=30&n=2');
  });

  it('has the tabs Now · Zones · History, all pages of this app since deploy 100', () => {
    expect(TABS.map((t) => [t.label, t.href])).toEqual([
      ['Now', '/home'],
      ['Zones', '/home/zones'],
      ['History', '/home/history'],
    ]);
    expect(choreHref(3)).toBe('/home/chore?id=3');
  });

  it('writes a row as app. does, in the door’s words', () => {
    const r = NOW.rows.find((x) => x.chore_id === 4)!;
    expect(r.label).toBe('Clean the fridge · Kitchen');
    expect(rowMeta(r)).toBe('5 weeks ago · monthly');
    expect(rowMeta(NOW.rows[0]!)).toBe('not logged yet · every 5 days');
    expect(tickLabel(r)).toBe('Done: Clean the fridge · Kitchen');
    expect(tickLabel(NOW.rows.find((x) => x.done_today)!)).toBe('Take the tick off: Scrub the sink · Bathroom');
    expect(tickLabel(r, true)).toBe('Take the tick off: Clean the fridge · Kitchen');
    expect(tickFields(r)).toEqual({ chore_id: '4', zone_id: '1' });
    expect(pairKey(r)).toBe('4:1');
  });

  it('counts the chores, offers "Show all N chores" past the six shown, and says how many are hidden', () => {
    expect(nWord(NOW.count, 'chore')).toBe('7 chores');
    expect(nWord(1, 'chore')).toBe('1 chore');
    expect(showAll(NOW)).toBe('Show all 7 chores');
    expect(showAll(NOW_T)).toBeNull();
    expect(hiddenLine(NOW.hidden)).toBeNull();
    expect(hiddenLine(NOW_T.hidden)).toBe('1 hidden for today');
  });

  it('draws This week: the count, a segment per session of the goal, the last 4 weeks', () => {
    expect(weekLines(NOW.week)).toEqual({ count: '1 of 3 sessions', segments: [true, false, false], weeks: 'Last 4 weeks: 1 · 1 · 2 · 0' });
    expect(weekLines({ goal: 2, this: 3, weeks: [3, 2, 3, 1] }).segments).toEqual([true, true]);
  });

  it('keeps the six rows in their places after a save (a ticked one stays to be ticked off again), the read’s order on a load', () => {
    const shown = NOW.rows.slice(0, 6);
    // the fridge ticked: the read moves it to the end (done today), the page keeps it in its place with the fresh row
    const fridge = { ...NOW.rows.find((x) => x.chore_id === 4)!, age: 0, age_text: 'today', done_today: true };
    const after = [...NOW.rows.filter((x) => x.chore_id !== 4), fridge];
    const kept = keepOrder(shown, after, 6);
    expect(kept.map((r) => r.chore_id)).toEqual(shown.map((r) => r.chore_id));
    expect(kept[3]).toBe(fridge);
    // a chore gone from the read leaves its place to the next of the read
    const gone = keepOrder(shown, after.filter((x) => x.chore_id !== 2), 6);
    expect(gone.map((r) => r.chore_id)).toEqual([7, 1, 4, 3, 6, 5]);
  });
});

describe('the timer', () => {
  it('counts seconds left as app.js does: rounded, never below 0', () => {
    expect(secondsLeft(10_000, 0)).toBe(10);
    expect(secondsLeft(10_000, 400)).toBe(10);
    expect(secondsLeft(10_000, 600)).toBe(9);
    expect(secondsLeft(10_000, 12_000)).toBe(0);
  });

  it('writes the Pick page’s clock MM:SS and the Now card’s "N:SS left"', () => {
    expect(clockText(900)).toBe('15:00');
    expect(clockText(899)).toBe('14:59');
    expect(clockText(61)).toBe('01:01');
    expect(clockText(3600)).toBe('60:00');
    expect(clockText(0)).toBe('00:00');
    expect(leftText('running', 761)).toBe('12:41 left');
    expect(leftText('running', 59)).toBe('0:59 left');
    expect(leftText('paused', 761)).toBe('12:41 left (paused)');
    expect(leftText('running', 0)).toBe('time is up');
    expect(leftText('over', 0)).toBe('time is up');
  });

  it('without a timer: the clock at the time’s minutes, Start timer', () => {
    expect(timerView(null, 0, 15, 180)).toMatchObject({ state: 'none', clock: '15:00', live: false, line: null, pause: false, resume: false, next: false, wake: false });
    expect(timerView(null, 0, 5, 180).clock).toBe('05:00');
    expect(timerView(null, 0, 60, 180).clock).toBe('60:00');
  });

  it('running: counting, Pause, "Done, next job" with 3 minutes or more left, Stop timer, the screen kept on', () => {
    const t = PICK_T.timer!;
    expect(timerView(t, 900, 15, PICK_T.next_from_s)).toEqual({
      state: 'running', clock: '15:00', live: true, line: null, pause: true, resume: false, next: true, stop: 'Stop timer', wake: true,
    });
    expect(timerView(t, 180, 15, 180).next).toBe(true);
    expect(timerView(t, 179, 15, 180)).toMatchObject({ next: false, pause: true, clock: '02:59' });
  });

  it('at zero, without a reload: over, "Time is up · well done", no Pause, no next, "Finished", the screen let go', () => {
    expect(timerView({ state: 'running' }, 0, 15, 180)).toEqual({
      state: 'over', clock: '00:00', live: false, line: 'Time is up · well done', pause: false, resume: false, next: false, stop: 'Finished', wake: false,
    });
    expect(timerView({ state: 'over' }, 0, 15, 180).stop).toBe('Finished');
  });

  it('paused: the seconds kept, "Paused.", Resume, no next', () => {
    expect(timerView({ state: 'paused' }, 425, 15, 180)).toEqual({
      state: 'paused', clock: '07:05', live: false, line: 'Paused.', pause: false, resume: true, next: false, stop: 'Stop timer', wake: false,
    });
  });
});

describe('Pick', () => {
  it('uses the door’s title and says "Job i of N" only with several jobs', () => {
    expect(PICK.title).toBe('Your 15 minutes');
    expect(HOUR.title).toBe('Your hour');
    expect(jobOf(PICK)).toBe('Job 1 of 5');
    expect(jobOf(PICK_T)).toBeNull();
    expect(jobOf({ n: 0, count: 1 })).toBeNull();
  });

  it('links "Another job" to the next n (only with more than one), and "Also fits" with the time’s minutes', () => {
    expect(anotherHref(PICK)).toBe('/home/pick?min=15&n=1');
    expect(anotherHref(PICK_T)).toBeNull();
    expect(alsoTitle(PICK.minutes)).toBe('Also fits in 15 minutes');
    expect(PICK.also.map((a) => pickHref(PICK.minutes, a.n))).toEqual(['/home/pick?min=15&n=1', '/home/pick?min=15&n=2']);
  });

  it('notes a job over the time in app.’s words', () => {
    expect(overNote(PICK.job!)).toBeNull();
    expect(overNote({ over: true, minutes: 20 })).toBe('This job takes about 20 minutes: do what fits, stopping counts.');
  });

  it('sends each button’s fields: the job’s pairs, the minutes, the timer’s id', () => {
    expect(pairsValue(HOUR.job!.pairs)).toBe('1-2,7-2,2-2');
    expect(pickFields.start(PICK, PICK.job!)).toEqual({ pairs: '7-2', minutes: '15' });
    expect(pickFields.timer(PICK_T.timer!)).toEqual({ timer_id: '1' });
    expect(pickFields.done(PICK.job!, null)).toEqual({ pairs: '7-2' });
    expect(pickFields.done(PICK_T.job!, PICK_T.timer)).toEqual({ pairs: '3-1', timer_id: '1' });
    expect(pickFields.next(PICK_T.job!, PICK_T.timer!)).toEqual({ pairs: '3-1', timer_id: '1' });
    expect(pickFields.skip(PICK.job!)).toEqual({ pairs: '7-2' });
    expect(pickFields.earlier(PICK.job!, 1)).toEqual({ pairs: '7-2', when: '1' });
    expect(pickFields.earlier(PICK.job!, '2026-11-02')).toEqual({ pairs: '7-2', when: '2026-11-02' });
  });

  it('allows a date before today in the last year for "Done it earlier?", in the door’s words', () => {
    const r = earlierRange(PICK);
    expect(r).toEqual({ min: '2025-11-16', max: '2026-11-15' });
    expect(earlierProblem('2026-11-15', r)).toBeNull();
    expect(earlierProblem('2025-11-16', r)).toBeNull();
    expect(earlierProblem('2026-11-16', r)).toBe('Pick a day before today, in the last year.');
    expect(earlierProblem('2025-11-15', r)).toBe('Pick a day before today, in the last year.');
    expect(earlierProblem('', r)).toBe('Pick a day before today, in the last year.');
  });

  it('takes ?min= and ?n= as digits only', () => {
    expect(askedNumber('30', 3)).toBe('30');
    expect(askedNumber('3x', 3)).toBe('');
    expect(askedNumber('12345', 4)).toBe('');
    expect(askedNumber(null, 3)).toBe('');
  });
});

describe('Today’s Home card', () => {
  it('has the week’s text, the chore waiting longest with its age and interval, the hidden line', () => {
    expect(cardLines(CARD)).toEqual({
      week: 'this week 1 of 3',
      waiting: { label: 'Fresh towels · Bathroom', meta: 'not logged yet · every 5 days' },
      none: null,
      hidden: null,
    });
  });

  it('says nothing else is waiting when no chore waits, and how many are hidden', () => {
    expect(cardLines({ ...CARD, waiting: null, hidden: 2 })).toMatchObject({ waiting: null, none: 'Nothing else is waiting today.', hidden: '2 hidden for today' });
  });
});

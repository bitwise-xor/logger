// The Gym's Workout page's plain rules (deploy 96): what a row's circle does and says, the numbers of an opened row (steps, limits,
// typing, the check in the door's words), the body of each save, Today's Gym card, and the places of the Spaces menu; against real
// answers of the door (tests/samples/gym.json, day.json).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  circleLabel,
  circleOf,
  draftFields,
  draftOf,
  draftText,
  goodLine,
  hintText,
  lastLine,
  logLabel,
  newFields,
  newProblem,
  otherLabel,
  parseNum,
  PARTS,
  pickFields,
  problem,
  removeAllFields,
  removeSetFields,
  rowText,
  splitNote,
  squares,
  stepped,
  tickFields,
  upText,
  weekLine,
  wordsOf,
  type GymCard,
  type GymRow,
  type Workout,
} from './gym.js';
import { LIBRARY_TABS, placeOf, SPACES } from './places.js';

const read = (name: string) => JSON.parse(readFileSync(new URL(`../../tests/samples/${name}`, import.meta.url), 'utf8'));
const W: Workout = read('gym.json').gym.gym;
const CARD: GymCard = read('day.json').day.gym;
const row = (name: string): GymRow => [...W.exercises, ...W.other].find((r) => r.name === name)!;
const field = (kind: keyof Workout['fields'], name: string) => W.fields[kind].find((f) => f.name === name)!;

describe('a row', () => {
  it('writes the numbers as app. does (gym.fmt)', () => {
    for (const r of [...W.exercises, ...W.other]) for (const s of r.logged) expect(rowText(r.kind, s)).toBe(s.text);
    expect(rowText('weights', { sets: 3, reps: 8, kg: 62.5 })).toBe('3 × 8 at 62.5 kg');
    expect(rowText('bodyweight', { sets: 3, reps: 12, kg: 10 })).toBe('3 × 12');
    expect(rowText('cardio', { minutes: 25, km: 3.2 })).toBe('25 min · 3.2 km');
    expect(rowText('cardio', { minutes: 20, km: null })).toBe('20 min');
    expect(rowText('weights', { sets: null, reps: 8, kg: 60 })).toBe(' at 60 kg');
  });

  it('a done circle takes the exercise off, a ready one logs the read numbers, one without complete numbers opens the row', () => {
    const bench = row('Bench press');
    expect(circleOf(bench)).toBe('done');
    expect(circleLabel(bench)).toBe('Take Bench press off today’s workout');
    expect(removeAllFields(bench)).toEqual({ exercise_id: '1' });

    const press = row('Shoulder press');
    expect(circleOf(press)).toBe('ready');
    expect(circleLabel(press)).toBe('Log Shoulder press: 3 × 10 at 45 kg');
    expect(tickFields(press)).toEqual({ exercise_id: '2', sets: '3', reps: '10', kg: '45' });
    expect(tickFields(row('Exercise bike'))).toEqual({ exercise_id: '8', minutes: '20' });

    const fresh = { ...press, logged: [], done: false, ready: false, name: 'Cable fly' };
    expect(circleOf(fresh)).toBe('off');
    expect(circleLabel(fresh)).toBe('Cable fly: set the numbers first');
  });

  it('marks a heavier day: "+5 kg", none without', () => {
    expect(upText(row('Bench press').up_kg)).toBe('+5 kg');
    expect(upText(2.5)).toBe('+2.5 kg');
    expect(upText(row('Shoulder press').up_kg)).toBeNull();
  });

  it('says "Add another row" when it is logged already, else "Log"', () => {
    expect(logLabel(row('Bench press'))).toBe('Add another row');
    expect(logLabel(row('Shoulder press'))).toBe('Log');
  });

  it('removes one logged row by its id, picks a day or Free workout', () => {
    expect(removeSetFields(row('Bench press').logged[1]!)).toEqual({ set_id: '62' });
    expect(pickFields(W.chips[1]!)).toEqual({ day_id: '2' });
    expect(pickFields(W.chips.at(-1)!)).toEqual({ day_id: '' });
  });
});

describe('an opened row', () => {
  it('opens with the read values, only its kind’s fields', () => {
    expect(draftOf(row('Bench press'), W.fields.weights)).toEqual({ sets: '1', reps: '6', kg: '70' });
    expect(draftOf(row('Push-up'), W.fields.bodyweight)).toEqual({ sets: '3', reps: '15' });
    expect(draftOf(row('Exercise bike'), W.fields.cardio)).toEqual({ minutes: '20', km: '' });
  });

  it('steps by the read step, rounded to 0.01, kept in the field limits (app.js)', () => {
    const kg = field('weights', 'kg');
    expect(stepped('70', kg, 1)).toBe('72.5');
    expect(stepped('70', kg, -1)).toBe('67.5');
    expect(stepped('1', kg, -1)).toBe('0');
    expect(stepped('999', kg, 1)).toBe('1000');
    expect(stepped('', kg, 1)).toBe('2.5');
    expect(stepped('abc', kg, 1)).toBe('2.5');
    expect(stepped('62,5', kg, 1)).toBe('65');
    const km = field('cardio', 'km');
    expect(stepped('0.2', km, 1)).toBe('0.3');
    expect(stepped('', km, 1)).toBe('0.1');
    const sets = field('weights', 'sets');
    expect(stepped('1', sets, -1)).toBe('1');
    expect(stepped('50', sets, 1)).toBe('50');
    const minutes = field('cardio', 'minutes');
    expect(stepped('', minutes, -1)).toBe('1');
  });

  it('reads typed numbers: a comma is a point, empty is none, words are not numbers', () => {
    expect(parseNum('62,5')).toBe(62.5);
    expect(parseNum(' 8 ')).toBe(8);
    expect(parseNum('')).toBeNull();
    expect(parseNum(undefined)).toBeNull();
    expect(parseNum('eight')).toBeNaN();
    expect(parseNum('-1')).toBeNaN();
  });

  it('checks before a tick in the door’s words (gym.values)', () => {
    const n = W.numbers;
    expect(problem('weights', { sets: '3', reps: '8', kg: '62.5' }, n)).toBeNull();
    expect(problem('weights', { sets: '3', reps: '8', kg: '' }, n)).toBe('Give the weight in kg.');
    expect(problem('weights', { sets: '', reps: '8', kg: '60' }, n)).toBe('Give sets and reps.');
    expect(problem('weights', { sets: '3.5', reps: '8', kg: '60' }, n)).toBe(n);
    expect(problem('weights', { sets: '51', reps: '8', kg: '60' }, n)).toBe(n);
    expect(problem('weights', { sets: '3', reps: '8', kg: '1001' }, n)).toBe(n);
    expect(problem('weights', { sets: '3', reps: 'x', kg: '60' }, n)).toBe(n);
    expect(problem('bodyweight', { sets: '3', reps: '12' }, n)).toBeNull();
    expect(problem('bodyweight', { sets: '3', reps: '501' }, n)).toBe(n);
    expect(problem('cardio', { minutes: '', km: '3' }, n)).toBe('Give the minutes.');
    expect(problem('cardio', { minutes: '0.5', km: '' }, n)).toBeNull();
    expect(problem('cardio', { minutes: '601', km: '' }, n)).toBe(n);
    expect(problem('cardio', { minutes: '20', km: '201' }, n)).toBe(n);
    expect(n).toBe('Numbers only: sets 1 to 50, reps 1 to 500, kg 0 to 1000, minutes up to 600, km up to 200.');
  });

  it('sends the typed numbers of its kind (an empty one left out) and shows what it would log', () => {
    expect(draftFields(row('Bench press'), W.fields.weights, { sets: '3', reps: '8', kg: '62,5' })).toEqual({ exercise_id: '1', sets: '3', reps: '8', kg: '62.5' });
    expect(draftFields(row('Exercise bike'), W.fields.cardio, { minutes: '25', km: '' })).toEqual({ exercise_id: '8', minutes: '25' });
    expect(draftText('weights', W.fields.weights, { sets: '3', reps: '8', kg: '62.5' })).toBe('3 × 8 at 62.5 kg');
    expect(draftText('cardio', W.fields.cardio, { minutes: '25', km: '3.2' })).toBe('25 min · 3.2 km');
  });
});

describe('+ Add exercise', () => {
  it('checks the name and sends it for today, with the other words as the door takes them', () => {
    expect(newProblem({ name: '  ', kind: 'weights', words: '' })).toBe("Type the exercise's name.");
    expect(newProblem({ name: 'x'.repeat(61), kind: 'weights', words: '' })).toBe('The name can have up to 60 characters.');
    expect(newProblem({ name: 'Cable fly', kind: 'weights', words: '' })).toBeNull();
    expect(newFields({ name: ' Cable   fly ', kind: 'cardio', words: 'fly, chest' })).toEqual({ name: 'Cable fly', kind: 'cardio', words: 'fly, chest', today: '1' });
    expect(wordsOf(' fly , chest  press,, ')).toEqual(['fly', 'chest press']);
    expect(wordsOf('a,b,c,d,e,f,g,h,i,j,k,l')).toHaveLength(10);
    expect(wordsOf('y'.repeat(50))).toEqual(['y'.repeat(40)]);
  });
});

describe('the cards', () => {
  it('This week’s split, the 4 weeks, Other exercises, the hint', () => {
    expect(W.week_split.map(splitNote)).toEqual(['Today', null, null]);
    expect(splitNote({ ...W.week_split[1]!, done: '2026-11-17' })).toBe('Done Tue');
    expect(goodLine(W.weeks)).toBe('3 of 4 weeks with 2+ workouts');
    expect(otherLabel(W)).toBe('Other exercises (4)');
    expect(hintText(W)).toBe('Tap the circle to log the numbers shown, tap the name to change them. Undo is in the answer bar after a tap.');
    expect(hintText({ hint: null })).toBeNull();
  });

  it('Today’s card: the 14 squares oldest first, the lines', () => {
    const sq = squares(CARD);
    expect(sq.days).toHaveLength(14);
    expect(sq.days.map((d) => d.on)).toEqual(CARD.days.map((d) => d.on));
    expect(sq.days.at(-1)!.today).toBe(true);
    expect(sq.days[0]!.title).toBe('Tue 03.11.: workout');
    expect(sq.days[1]!.title).toBe('Wed 04.11.: no workout');
    expect(sq.from).toBe('03.11.');
    expect(sq.label).toBe('Last 14 days: 7 workouts');
    expect(squares({ ...CARD, n14: 1 }).label).toBe('Last 14 days: 1 workout');
    expect(lastLine(CARD)).toBe('Last workout Mon 16.11.');
    expect(lastLine({ ...CARD, last_workout: null })).toBe('No workouts yet');
    expect(weekLine(CARD)).toBe('Last week 3 · this week 1');
  });

  it('the parts: six pages of this app, in the mockup’s order', () => {
    expect(PARTS.map((p) => p.label)).toEqual(['Workout', 'Plan', 'Progress', 'History', 'Exercises', 'Activity']);
    expect(PARTS.map((p) => p.href)).toEqual(['/gym', '/gym/plan', '/gym/progress', '/gym/history', '/gym/exercises', '/gym/activity']);
  });
});

describe('the Spaces menu', () => {
  it('lists Gym, Health, Habits and Home (deploy 99), then Medical for later', () => {
    expect(SPACES.map((s) => [s.name, s.href])).toEqual([
      ['Gym', '/gym'],
      ['Health', '/health'],
      ['Habits', '/habits'],
      ['Home', '/home'],
      ['Medical', null],
    ]);
    expect(SPACES.find((s) => s.key === 'home')!.sub).not.toBe('soon');
  });

  it('knows the place of a page: Today for Today and the Food day, More for /more and every Space', () => {
    expect(placeOf('/')).toEqual({ tab: 'today', space: null, atMore: false });
    expect(placeOf('/food')).toEqual({ tab: 'today', space: null, atMore: false });
    // deploy 105: the usual meals are Library's tab; /food/usual only redirects there
    expect(placeOf('/library/usual')).toEqual({ tab: 'library', space: null, atMore: false });
    expect(placeOf('/more')).toEqual({ tab: 'more', space: null, atMore: true });
    expect(placeOf('/gym')).toEqual({ tab: 'more', space: 'gym', atMore: false });
    expect(placeOf('/health')).toEqual({ tab: 'more', space: 'health', atMore: false });
    expect(placeOf('/habits')).toEqual({ tab: 'more', space: 'habits', atMore: false });
    expect(placeOf('/home')).toEqual({ tab: 'more', space: 'home', atMore: false });
    expect(placeOf('/home/pick')).toEqual({ tab: 'more', space: 'home', atMore: false });
    expect(placeOf('/homework')).toEqual({ tab: null, space: null, atMore: false });
    expect(placeOf('/gymnastics')).toEqual({ tab: null, space: null, atMore: false });
    expect(placeOf('/scan/barcode')).toEqual({ tab: null, space: null, atMore: false });
    // deploy 102: Trends is a tab of this app, lit on every /trends page
    expect(placeOf('/trends')).toEqual({ tab: 'trends', space: null, atMore: false });
    expect(placeOf('/trends/charts')).toEqual({ tab: 'trends', space: null, atMore: false });
    expect(placeOf('/trendsetter')).toEqual({ tab: null, space: null, atMore: false });
    // deploy 105: Library is a tab of this app, lit on every /library page
    expect(placeOf('/library')).toEqual({ tab: 'library', space: null, atMore: false });
    expect(placeOf('/library/habits')).toEqual({ tab: 'library', space: null, atMore: false });
    expect(placeOf('/library/exercises')).toEqual({ tab: 'library', space: null, atMore: false });
    expect(placeOf('/libraryx')).toEqual({ tab: null, space: null, atMore: false });
    // the Habits Space and the Gym keep their own pages
    expect(placeOf('/habits')).toEqual({ tab: 'more', space: 'habits', atMore: false });
    expect(placeOf('/gym/exercises')).toEqual({ tab: 'more', space: 'gym', atMore: false });
  });

  it("lists Library's four tabs, each its own page", () => {
    expect(LIBRARY_TABS.map((t) => [t.key, t.label, t.href])).toEqual([
      ['foods', 'Foods', '/library'],
      ['usual', 'Usual meals', '/library/usual'],
      ['habits', 'Habits', '/library/habits'],
      ['exercises', 'Exercises', '/library/exercises'],
    ]);
  });
});

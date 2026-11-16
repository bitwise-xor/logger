// The Gym's Plan and Exercises parts' plain rules (deploy 97): a plan exercise's line and form, up and down, "+ Add exercise" on a day,
// the day forms, an exercise's Rename, Retire and "+ New exercise", and which form a refusal belongs to; against real answers of the
// door (tests/samples/gym.json).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  activeFields,
  activeLabel,
  activeLine,
  addDraft,
  addProblem,
  canMove,
  CARDIO_NOTE,
  dayactiveFields,
  dayeditFields,
  dayName,
  dayProblem,
  dayTag,
  daynewFields,
  doneChip,
  exerciseFormOf,
  exerciseNameProblem,
  hasNumbers,
  itemaddFields,
  itemmoveFields,
  itemremoveFields,
  itemsetFields,
  newExerciseFields,
  numbersOf,
  numbersProblem,
  numbersWords,
  planFormOf,
  renameFields,
  type Exercises,
  type Plan,
} from './gymplan.js';

const read = (name: string) => JSON.parse(readFileSync(new URL(`../../tests/samples/${name}`, import.meta.url), 'utf8'));
const PLAN: Plan = read('gym.json').plan.gym_plan;
const EX: Exercises = read('gym.json').exercises.gym_exercises;
const push = PLAN.days[0]!;
const L = PLAN.limits;

describe('a day of the plan', () => {
  it('tags today’s day "Today" and the others with their count', () => {
    expect(dayTag(push)).toBe('Today');
    expect(dayTag(PLAN.days[1]!)).toBe('3 exercises');
    expect(dayTag({ today: false, items: [push.items[0]!] })).toBe('1 exercise');
    expect(dayTag({ today: false, items: [] })).toBe('0 exercises');
  });

  it('offers the sets and reps form to every kind but cardio, which has its note', () => {
    expect(push.items.map((i) => [i.name, hasNumbers(i)])).toEqual([['Bench press', true], ['Shoulder press', true], ['Push-up', true], ['Exercise bike', false]]);
    expect(CARDIO_NOTE).toBe('Cardio: you set the minutes when you log it.');
  });

  it('first cannot go up, last cannot go down', () => {
    expect(push.items.map((_, k) => [canMove(push, k, 'up'), canMove(push, k, 'down')])).toEqual([[false, true], [true, true], [true, true], [true, false]]);
    expect(canMove({ items: [push.items[0]!] }, 0, 'up')).toBe(false);
    expect(canMove({ items: [push.items[0]!] }, 0, 'down')).toBe(false);
  });

  it('names a day done this week with its date', () => {
    expect(doneChip({ day_id: 1, label: 'Day 1 · Push', day: '2026-11-16' })).toBe('Day 1 · Push · done Mon 16.11.');
  });
});

describe('the sets and reps form', () => {
  it('opens with the plan’s numbers, empty where there are none', () => {
    expect(numbersOf(push.items[0]!)).toEqual({ sets: '3', reps: '8' });
    expect(numbersOf(push.items[2]!)).toEqual({ sets: '', reps: '' });
  });

  it('is checked in the door’s words, from its limits', () => {
    expect(numbersWords(L)).toBe('Numbers only: sets 1 to 50, reps 1 to 500.');
    expect(numbersProblem({ sets: '3', reps: '8' }, L)).toBeNull();
    expect(numbersProblem({ sets: ' 3 ', reps: '8' }, L)).toBeNull();
    expect(numbersProblem({ sets: '', reps: '' }, L)).toBeNull();
    expect(numbersProblem({ sets: '3', reps: '' }, L)).toBe('Give both sets and reps, or neither.');
    expect(numbersProblem({ sets: '', reps: '8' }, L)).toBe('Give both sets and reps, or neither.');
    for (const bad of [['0', '8'], ['51', '8'], ['3', '501'], ['3', '0'], ['2.5', '8'], ['x', '8'], ['3', '-1'], ['3', '8 reps']]) {
      expect(numbersProblem({ sets: bad[0]!, reps: bad[1]! }, L), bad.join(' × ')).toBe('Numbers only: sets 1 to 50, reps 1 to 500.');
    }
    expect(numbersProblem({ sets: '50', reps: '500' }, L)).toBeNull();
    expect(numbersProblem({ sets: '1', reps: '1' }, L)).toBeNull();
  });

  it('sends the item and its numbers; both empty sends neither', () => {
    expect(itemsetFields(push.items[0]!, { sets: '4', reps: '6' })).toEqual({ item_id: '1', sets: '4', reps: '6' });
    expect(itemsetFields(push.items[0]!, { sets: ' 4 ', reps: ' 6' })).toEqual({ item_id: '1', sets: '4', reps: '6' });
    expect(itemsetFields(push.items[0]!, { sets: '', reps: '' })).toEqual({ item_id: '1' });
  });
});

describe('up, down and take off', () => {
  it('send the item (and the way)', () => {
    expect(itemmoveFields(push.items[1]!, 'up')).toEqual({ item_id: '2', dir: 'up' });
    expect(itemmoveFields(push.items[1]!, 'down')).toEqual({ item_id: '2', dir: 'down' });
    expect(itemremoveFields(push.items[3]!)).toEqual({ item_id: '4' });
  });
});

describe('+ Add exercise on a day', () => {
  it('starts on the first exercise the read allows, with no numbers', () => {
    expect(push.can_add.map((x) => x.name)).toEqual(['Seated row', 'Leg press', 'Pull-up', 'Walking lunge']);
    expect(addDraft(push)).toEqual({ exercise_id: '3', sets: '', reps: '' });
    expect(addDraft({ can_add: [] })).toEqual({ exercise_id: '', sets: '', reps: '' });
  });

  it('is checked: an exercise, and the numbers both or neither', () => {
    expect(addProblem({ exercise_id: '', sets: '', reps: '' }, L)).toBe('Pick a day and one of your exercises.');
    expect(addProblem({ exercise_id: '3', sets: '', reps: '' }, L)).toBeNull();
    expect(addProblem({ exercise_id: '3', sets: '3', reps: '10' }, L)).toBeNull();
    expect(addProblem({ exercise_id: '3', sets: '3', reps: '' }, L)).toBe('Give both sets and reps, or neither.');
    expect(addProblem({ exercise_id: '3', sets: '99', reps: '10' }, L)).toBe('Numbers only: sets 1 to 50, reps 1 to 500.');
  });

  it('sends the day, the exercise and the numbers typed', () => {
    expect(itemaddFields(push, { exercise_id: '3', sets: '3', reps: '10' })).toEqual({ day_id: '1', exercise_id: '3', sets: '3', reps: '10' });
    expect(itemaddFields(push, { exercise_id: '4', sets: '', reps: '' })).toEqual({ day_id: '1', exercise_id: '4' });
  });
});

describe('the days', () => {
  it('tidy a name to 40 characters and refuse an empty one in the core’s words', () => {
    expect(dayName('  Push   day ')).toBe('Push day');
    expect(dayName('x'.repeat(50))).toHaveLength(40);
    expect(dayProblem('Push')).toBeNull();
    expect(dayProblem('   ')).toBe("Type the day's name.");
    expect(dayProblem('   ', true)).toBe("Type the day's name, e.g. Push.");
    expect(dayProblem('Push', true)).toBeNull();
  });

  it('send the new name, the rename, and Remove or Bring back as 0 or 1', () => {
    expect(daynewFields(' Arms  and ')).toEqual({ name: 'Arms and' });
    expect(dayeditFields(push, ' Chest ')).toEqual({ day_id: '1', name: 'Chest' });
    expect(dayactiveFields(push, false)).toEqual({ day_id: '1', on: '0' });
    expect(dayactiveFields(PLAN.removed[0]!, true)).toEqual({ day_id: '4', on: '1' });
  });

  it('say which form a refusal belongs to (the others go in the answer bar)', () => {
    expect(planFormOf('gym_itemset', { item_id: '7', sets: '3' })).toBe('item:7');
    expect(planFormOf('gym_itemadd', { day_id: '2', exercise_id: '3' })).toBe('add:2');
    expect(planFormOf('gym_dayedit', { day_id: '2', name: 'x' })).toBe('edit:2');
    expect(planFormOf('gym_daynew', { name: 'x' })).toBe('new');
    expect(planFormOf('gym_itemmove', { item_id: '7' })).toBeNull();
    expect(planFormOf('gym_itemremove', { item_id: '7' })).toBeNull();
    expect(planFormOf('gym_dayactive', { day_id: '7' })).toBeNull();
    expect(planFormOf('undo', {})).toBeNull();
  });
});

describe('the exercises', () => {
  it('say how many are active, and Retire or Bring back by the state', () => {
    expect(EX.exercises).toHaveLength(9);
    expect(activeLine(EX)).toBe('8 active');
    const [bench, curl] = [EX.exercises[0]!, EX.exercises[8]!];
    expect([activeLabel(bench), activeLabel(curl)]).toEqual(['Retire', 'Bring back']);
    expect(activeFields(bench)).toEqual({ exercise_id: '1', on: '0' });
    expect(activeFields(curl)).toEqual({ exercise_id: '9', on: '1' });
  });

  it('show the door’s line: kind, also words, use', () => {
    expect(EX.exercises[0]!.meta).toBe('Weights · also: flat bench · 8 workouts, last 16.11.');
    expect(EX.exercises[6]!.meta).toBe('Bodyweight · not done yet');
    for (const x of EX.exercises) expect(x.meta).toBe([x.kind_label, x.words.length ? `also: ${x.words.join(', ')}` : '', x.use].filter(Boolean).join(' · '));
  });

  it('check a name in the core’s words, up to the read’s limit', () => {
    expect(exerciseNameProblem('Cable fly')).toBeNull();
    expect(exerciseNameProblem('   ')).toBe("Type the exercise's name.");
    expect(exerciseNameProblem('x'.repeat(61))).toBe('The name can have up to 60 characters.');
    expect(exerciseNameProblem('x'.repeat(61), EX.limits.name_max)).toBe('The name can have up to 60 characters.');
    expect(exerciseNameProblem('x'.repeat(60))).toBeNull();
  });

  it('send a rename, and a new exercise without "today" (it is not put on a day)', () => {
    expect(renameFields(EX.exercises[0]!, '  Flat   press ')).toEqual({ exercise_id: '1', name: 'Flat press' });
    expect(newExerciseFields({ name: ' Cable fly ', kind: 'weights', words: 'fly, chest press' })).toEqual({ name: 'Cable fly', kind: 'weights', words: 'fly, chest press' });
    expect(newExerciseFields({ name: 'Rowing', kind: 'cardio', words: '' })).not.toHaveProperty('today');
  });

  it('say which form a refusal belongs to', () => {
    expect(exerciseFormOf('gym_rename', { exercise_id: '4' })).toBe('rename:4');
    expect(exerciseFormOf('gym_new', { name: 'x' })).toBe('new');
    expect(exerciseFormOf('gym_active', { exercise_id: '4' })).toBeNull();
  });
});

/**
 * The door's types checked against the samples (Web 71).
 *
 * `tests/samples/*.json` are real answers of the door (written by `tests/test_front_samples.py`). Every interface that types a read
 * or a save answer is held against the sample of that answer here, at COMPILE time: `tools/front-pnpm check` (svelte-check) fails
 * on a field a type names and the door no longer sends (renamed, dropped), or sends as another type. Vitest does not type-check, so
 * at run time the `it` bodies only check what a type cannot: the top-level keys of each answer (an extra or missing one).
 *
 * JSON imports widen every literal ('tracked' becomes string, true becomes boolean), so `shape<T>()(sample)` compares the sample with
 * `Relax<T>`: T with its string, number and boolean literals widened, everything else (names, nesting, null, optional) kept. A
 * renamed or missing field still fails; only a value outside a literal union (a new state word) is not seen by the types.
 */
import { describe, expect, it } from 'vitest';

import catalogue from '../../tests/samples/catalogue.json';
import coach from '../../tests/samples/coach.json';
import dayS from '../../tests/samples/day.json';
import food from '../../tests/samples/food.json';
import foodSpace from '../../tests/samples/food_space.json';
import foodTrends from '../../tests/samples/food_trends.json';
import foodWords from '../../tests/samples/food_words.json';
import gym from '../../tests/samples/gym.json';
import habits from '../../tests/samples/habits.json';
import health from '../../tests/samples/health.json';
import home from '../../tests/samples/home.json';
import insights from '../../tests/samples/insights.json';
import labs from '../../tests/samples/labs.json';
import log from '../../tests/samples/log.json';
import recent from '../../tests/samples/recent.json';
import save from '../../tests/samples/save.json';
import scan from '../../tests/samples/scan.json';
import search from '../../tests/samples/search.json';
import settings from '../../tests/samples/settings.json';
import usage from '../../tests/samples/usage.json';
import usual from '../../tests/samples/usual.json';
import week from '../../tests/samples/week.json';

import type { Catalogue, Item } from './catalogue.js';
import type { CatalogueAnswer } from './cataloguepage.svelte.js';
import type { CoachRead } from './coach.js';
import type { Day, SaveAnswer, Undo } from './day.js';
import type { FoodDay, FoodEntry } from './food.js';
import type { FoodNotes } from './foodnotes.js';
import type { Activity, HistoryWorkout, Progress } from './gymread.js';
import type { Exercises, Plan } from './gymplan.js';
import type { Workout } from './gym.js';
import type { Habits } from './habits.js';
import type { Body, BodyDue, Health } from './health.js';
import type { Now, HomePick } from './home.js';
import type { Chore, Edit, History, Zones } from './homeparts.js';
import type { Labs, Meds, Tests } from './medical.js';
import type { MedsAnswer } from './medspage.svelte.js';
import type { LabsAnswer } from './reportspage.svelte.js';
import type { Nutrients as FoodNutrients } from './nutrients.js';
import type { Recent } from './recent.js';
import type { LabelValues, ReadAnswer, ScannedFood } from './scan.js';
import type { Search } from './search.js';
import type {
  SettingsBody,
  SettingsCoach,
  SettingsDevices,
  SettingsExport,
  SettingsNotify,
  SettingsTargets,
  SettingsToday,
} from './settings.js';
import type { FoodTrends, Insights } from './trendscharts.js';
import type { Usage } from './usage.js';
import type { FoodHit, Usual } from './usual.js';
import type { Week } from './week.js';
import type { Words } from './words.js';
import type { WordsAnswer } from './wordspage.svelte.js';

/** T with its literal unions widened (a JSON import has no literal types); keys, nesting, null and optional stay as they are. */
type Relax<T> = T extends string
  ? string
  : T extends number
    ? number
    : T extends boolean
      ? boolean
      : T extends null | undefined
        ? T
        : T extends readonly unknown[]
          ? Relax<T[number]>[]
          : T extends object
            ? { [K in keyof T]: Relax<T[K]> }
            : T;

/** What a sample has that T has not: the names of the keys, as a union (never when there is none). */
type Extras<S, T> = S extends readonly (infer E)[]
  ? [E] extends [never]
    ? never
    : Extras<E, ElementOf<T>>
  : S extends object
    ? [Objects<T>] extends [never]
      ? never
      : { [K in keyof S & string]: K extends KeysOf<Objects<T>> ? Extras<S[K], ValueOf<T, K>> : K }[keyof S & string]
    : never;
type Objects<T> = T extends readonly unknown[] ? never : T extends object ? T : never;
type KeysOf<T> = T extends unknown ? keyof T : never;
type ElementOf<T> = T extends readonly (infer E)[] ? E : never;
type ValueOf<T, K extends string> = Objects<T> extends infer O ? (O extends unknown ? (K extends keyof O ? O[K] : never) : never) : never;

/**
 * The compile-time check: `shape<Day>()(sample, ...)` fails when a sample lacks a key of Relax<T> or has a key T does not name.
 * It does nothing at run time.
 */
function shape<T>() {
  return <S extends Relax<T>[]>(
    ..._samples: { [K in keyof S]: S[K] & ([Extras<S[K], T>] extends [never] ? unknown : { not_in_the_type: Extras<S[K], T> }) }
  ): void => {};
}

/** The door puts its version, `v`, on every answer; no page reads it, so the types of the answers leave it out. */
type Answer<T> = T & { v: number };

/** The keys of an answer, sorted: the run-time check of what the types cannot see (an extra key, a key a sample lost). */
const keys = (o: object): string[] => Object.keys(o).sort();

/** The door's own wrapper of a save answer: the save's fields and one read the save asks for (`view`), see SaveAnswer. */
const SAVE_KEYS = [
  'confirm', 'head', 'notes', 'outcome', 'questions', 'read_back', 'receipt', 'reason', 'refill', 'replayed', 'result', 'tone', 'undo', 'v',
];

describe('the samples fit the types of the door', () => {
  it('Today and the save answers (day.json, save.json, log.json)', () => {
    shape<Day>()(dayS.day);
    shape<Undo | null>()(dayS.undo);
    shape<Answer<SaveAnswer>>()(save.saved, save.needs_confirmation, log.saved, log.question, log.confirm, log.answered, log.private, log.held);
    expect(keys(dayS)).toEqual(['day', 'undo', 'v']);
    expect(keys(save.saved)).toEqual([...SAVE_KEYS].sort());
    expect(keys(log.held)).toEqual([...SAVE_KEYS].sort());
  });

  it('the Food day and the Food space (food.json, food_space.json, food_trends.json)', () => {
    shape<FoodDay>()(food.food_day.food_day, food.before.food_day);
    shape<FoodEntry>()(food.entry.entry);
    shape<Answer<SaveAnswer>>()(food.saves.changed, food.saves.note);
    shape<FoodNutrients>()(foodSpace.day.food_nutrients, foodSpace.week.food_nutrients, foodSpace.month.food_nutrients);
    shape<FoodNotes>()(foodSpace.notes.food_notes);
    shape<Answer<SaveAnswer>>()(foodSpace.saves.saved, foodSpace.saves.removed, foodSpace.saves.gone);
    shape<FoodTrends>()(foodTrends['7'].trends, foodTrends['30'].trends, foodTrends['90'].trends);
    expect(keys(food.food_day)).toEqual(['food_day', 'undo', 'v']);
    expect(keys(food.entry)).toEqual(['entry', 'v']);
    expect(keys(foodSpace.day)).toEqual(['food_nutrients', 'v']);
    expect(keys(foodSpace.notes)).toEqual(['food_notes', 'v']);
    expect(keys(foodTrends['7'])).toEqual(['trends', 'undo', 'v']);
  });

  it('Library and Settings (usual.json, catalogue.json, food_words.json, habits.json, settings.json)', () => {
    shape<Usual[]>()(usual.usual.usual);
    shape<FoodHit[]>()(usual.foods.foods);
    shape<Answer<SaveAnswer>>()(usual.saves.changed, usual.saves.rejected);
    shape<Catalogue>()(catalogue.all.catalogue, catalogue.drinks.catalogue, catalogue.review.catalogue, catalogue.new.catalogue, catalogue.none.catalogue);
    shape<Item>()(catalogue.items.oats.food_item, catalogue.items.rye.food_item, catalogue.items.oatdrink.food_item, catalogue.items.bowl.food_item);
    shape<Words>()(foodWords.all.words, foodWords.shared.words, foodWords.search.words, foodWords.none.words);
    shape<Habits>()(habits.habits.habits, habits.habits_all.habits);
    shape<SettingsTargets>()(settings.targets.settings_targets);
    shape<SettingsToday>()(settings.today.settings_today);
    shape<SettingsBody>()(settings.body.settings_body);
    shape<SettingsCoach>()(settings.coach.settings_coach);
    shape<SettingsDevices>()(settings.devices.settings_devices);
    shape<SettingsNotify>()(settings.notify.settings_notify);
    shape<SettingsExport>()(settings.export.settings_export);
    expect(keys(usual.usual)).toEqual(['undo', 'usual', 'v']);
    expect(keys(usual.foods)).toEqual(['foods', 'v']);
    expect(keys(catalogue.all)).toEqual(['catalogue', 'undo', 'v']);
    expect(keys(catalogue.items.oats)).toEqual(['food_item', 'undo', 'v']);
    expect(keys(foodWords.all)).toEqual(['undo', 'v', 'words']);
    expect(keys(habits.habits)).toEqual(['habits', 'undo', 'v']);
    expect(keys(settings.notify)).toEqual(['settings_notify', 'undo', 'v']);
  });

  it('Health and the Body measures (health.json)', () => {
    shape<Health>()(health.health.health);
    shape<Body>()(health.body.body);
    shape<BodyDue>()(health.day_body_due);
    expect(keys(health.health)).toEqual(['health', 'undo', 'v']);
    expect(keys(health.body)).toEqual(['body', 'undo', 'v']);
  });

  it('Gym (gym.json)', () => {
    shape<Workout>()(gym.gym.gym);
    shape<Plan>()(gym.plan.gym_plan);
    shape<Exercises>()(gym.exercises.gym_exercises);
    shape<Progress>()(gym.progress.gym_progress);
    shape<{ workouts: HistoryWorkout[] }>()(gym.history.gym_history);
    shape<Activity>()(gym.activity.gym_activity, gym.activity_none.gym_activity);
    expect(keys(gym.gym)).toEqual(['gym', 'undo', 'v']);
    expect(keys(gym.history)).toEqual(['gym_history', 'undo', 'v']);
  });

  it('Home (home.json)', () => {
    shape<Now>()(home.home.home, home.home_timer.home);
    shape<HomePick>()(home.pick.home_pick, home.pick_hour.home_pick, home.pick_timer.home_pick);
    shape<Zones>()(home.zones.home_zones);
    shape<History>()(home.history.home_history);
    shape<Chore>()(home.chore.home_chore, home.chore_flat.home_chore);
    shape<Edit>()(home.edit.home_edit);
    expect(keys(home.home)).toEqual(['home', 'undo', 'v']);
    expect(keys(home.edit)).toEqual(['home_edit', 'undo', 'v']);
  });

  it('Trends, Coach, Search, Recent and Usage (week.json, insights.json, coach.json, ...)', () => {
    shape<Week>()(
      week['7'].week, week['30'].week, week.last_none.week, week.last_failed.week, week.last_done.week, week.this_working.week,
      week.this_cut_off.week, week['7_latest'].week, week.this_monday.week,
    );
    shape<{ id: number; state: string }>()(week.status.working.coaching, week.status.done.coaching, week.status.failed.coaching, week.status.gone.coaching);
    shape<Insights>()(insights.insights.insights);
    shape<CoachRead>()(
      coach.empty.coach, coach.all.coach, coach.days.coach, coach.weeks.coach, coach.day_done.coach, coach.day_failed.coach, coach.day_none.coach,
    );
    shape<Answer<SaveAnswer>>()(coach.saves.start, coach.saves.on_it, coach.saves.refused, coach.saves.limit);
    shape<Search>()(
      search.muesli.search, search.rowing.search, search.pull.search, search.stove.search, search.vitamin.search, search.zzqq.search, search.m.search,
    );
    shape<Recent>()(recent.recent);
    shape<Usage>()(usage['7'].usage, usage['30'].usage, usage.all.usage);
    expect(keys(week['7'])).toEqual(['undo', 'v', 'week']);
    expect(keys(week.status.working)).toEqual(['coaching', 'undo', 'v']);
    expect(keys(insights.insights)).toEqual(['insights', 'undo', 'v']);
    expect(keys(coach.all)).toEqual(['coach', 'undo', 'v']);
    expect(keys(recent)).toEqual(['recent', 'undo', 'v']);
    expect(keys(usage['7'])).toEqual(['undo', 'usage', 'v']);
  });

  it('Medical (labs.json)', () => {
    shape<Labs>()(labs.reports.labs, labs.open.labs, labs.open_imaging.labs);
    shape<Tests>()(labs.tests.labs_tests, labs.search.labs_tests, labs.test.labs_tests, labs.one_value.labs_tests, labs.no_test.labs_tests);
    shape<Meds>()(labs.meds.labs_meds);
    expect(keys(labs.reports)).toEqual(['labs', 'undo', 'v']);
    expect(keys(labs.meds)).toEqual(['labs_meds', 'undo', 'v']);
  });

  it('every other save answer (the `saves` of each sample file) is the page\'s SaveAnswer with the read it asks for', () => {
    shape<Answer<CatalogueAnswer>>()(...Object.values(catalogue.saves));
    shape<Answer<WordsAnswer>>()(...Object.values(foodWords.saves));
    shape<Answer<LabsAnswer | MedsAnswer>>()(...Object.values(labs.saves));
    shape<Answer<SaveAnswer & { week?: Week }>>()(...Object.values(week.saves));
    shape<Answer<SaveAnswer>>()(
      ...Object.values(gym.saves), ...Object.values(habits.saves), ...Object.values(health.saves), ...Object.values(home.saves),
      ...Object.values(scan.saves), ...Object.values(settings.saves),
    );
    for (const answers of [catalogue.saves, foodWords.saves, gym.saves, habits.saves, health.saves, home.saves, labs.saves, settings.saves, week.saves]) {
      for (const a of Object.values(answers)) expect(Object.keys(a)).toEqual(expect.arrayContaining(['outcome', 'head', 'undo', 'v']));
    }
  });

  it('the scan sheet (scan.json)', () => {
    shape<Answer<{ code: string; food: ScannedFood | null }>>()(scan.barcode, scan.barcode_none);
    shape<Answer<ReadAnswer>>()(scan.off, scan.off_none, scan.label, scan.label_unreadable);
    shape<LabelValues>()(scan.off.values, scan.label.values);
    expect(keys(scan.barcode)).toEqual(['code', 'food', 'v']);
  });
});

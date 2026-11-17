// A stand-in for the core's JSON door (docs/API.md), for the page tests and the screenshots: the sign-in, the session, GET /day
// and Today's saves (step C). Password "test", code "123456". GET /day starts as tests/samples/day.json, a real answer of the door
// that tests/test_front_samples.py writes (and checks against the door's shape on every Python test run). The saves answer in the
// shape of tests/samples/save.json (written by the same test) and change the day a little, as the core would (a glass of water,
// a tick, a new row), so the page tests can see the page change without a reload; Undo puts the day back. It also checks what the
// real door checks: the token, the call without proxy headers and the bearer.
// Step D: POST /log answers as the core does (from tests/samples/log.json, real answers of the door): a line is read for a
// moment ("being read"), then a food line ("40 g radishes") is saved with a new row and Undo, the same words again ask "Log it
// again?" (with Correct it), "the … was/were …" is a change read back first (a question), "what …" or "…?" is a look-up, a
// "g:"/"gratitude:"/"private:" line is "Saved privately." and nothing else, and while the AI is "down" every line is held.
// Step E: GET /food/day (today from the day above, with notes; an earlier day from tests/samples/food.json's day before; a later
// day is today), GET /food/entry (the units of tests/samples/food.json's entry for that food), and the Food day's saves:
// POST /food/entry (save: amount, unit, time, another food named like one of the day's; delete) and /food/note, each answering
// with the food day when the body asks for view "food". An amount over 2000 g (or ml) is read back first: a stand-in rule only,
// to try the confirm (the real door reads back only an odd value).
// Deploy 87: GET /usual (tests/samples/usual.json's list, and three more meals made here from the catalogue), GET /foods?q= (a
// catalogue made of the samples' foods, each with per_100 worked out from its values), and POST /usual/meal (save: name and the
// whole list; delete), /usual/new and /usual/from_meal, checked as webfood checks them (a name of 2 to 60 characters no other
// usual meal has, in any case; foods of the catalogue; amounts above 0 and at most 5000; 1 to 8 foods for a new one; not the
// drinks), answering with the list for view "usual" (from_meal: the food day). Undo puts the list back too.
// Deploy 90: the scan sheet's routes, from tests/samples/scan.json (real answers of the door): GET /foods/barcode (the sample's
// code is the sample's food, Oats; a code added through /food/labeladd is that food; any other is food null), GET /foods/off (the
// sample's unknown code 4000000000000 is not in Open Food Facts; any other code is the sample's oat drink), POST /food/label
// (multipart, 1 to 3 photos checked as the door checks them; one photo reads the table only, name null; two or three the whole
// label; after POST /standin/label-unreadable the next read fails with the sample's reason), POST /food/labeladd (checked as
// webfood.label_add: a new catalogue food, logged with an amount, with Undo of the entry; keyed) and POST /lookup (the sample's
// read-back as a "lookup_confirm" question under Needs you, Yes/No through /answer). A typed line with "mystery" in it asks the
// door's food question ("Which food is …?", tool "log", kind "food"), where the page offers "Look it up".
// Deploy 92: the Health page's routes, from tests/samples/health.json (real answers of the door for an invented day): GET /health
// (the sample's days, charts and sleep times; range 7 and 90 cut or widen them, all=1 a row for every day of the range), POST
// /health/day (a value added, changed or cleared as webactions.health_day does: a clear read back first, Yes = confirm_delete;
// a weight outside 30 to 300 kg or a sugar outside 20 to 600 read back, Yes = confirmed; a day outside the last 12 months
// refused; keyed, with Undo), GET /body (the sample's card, its sessions made from the sample's charts; ?day= a session to change),
// POST /body (a value out of the measure's range or 4 cm or more from the last read back, a clear asked first; keyed, with
// Undo) and POST /body/skip (Today's "Body measurements due", which GET /day has from the sample's day_body_due, goes; no Undo).
// The charts stay the sample's (the stand-in draws nothing new).
// Usage: node tests/standin/door.mjs [port]  (FRONT_TOKEN from the environment). POST /standin/reset starts the day again,
// POST /standin/drop-sessions signs every session out (for the re-send after a sign-in), POST /standin/ai-down and
// /standin/ai-up make /log hold its lines or read them again.
// Step F: POST /standin/core-down makes every door call fail with no answer (the connection is dropped, as when the core is
// stopped), POST /standin/door-off answers 404 not_found to every door call (FRONT_TOKEN unset at the core), and POST
// /standin/up (or /standin/reset) brings it back. Sessions survive both, as at the core.
// Deploy 94: the Habits page's routes, from tests/samples/habits.json (real answers of the door for invented habits): GET /habits?show=
// (today's ticks, 30 days per tracked habit, Your habits with the filter and its counts), POST /habit/day (a day under its times a
// day gets a tick, a done day has its ticks taken off; a re-sent key is refused while the day still needs a tick, as the core), POST
// /habits/manage (track, retire, restore, edit, delete with confirmed, new: the core's checks and words, no Undo), and Today's POST
// /habit with view "habits". The habits are the sample's list (names from the sample), kept as ticks per day; POST /standin/slow
// makes the day taps take a moment (to try a button blocked while its save is on the way), POST /standin/locked marks Medication as not editable.
// Deploy 96: the Gym's Workout page, from tests/samples/gym.json (real answers of the door for an invented split): GET /gym worked out
// from the exercises and today's rows as they stand (the read's order: the day's plan, then any other done today; the rest under
// "Other exercises"; Free workout: all), POST /gym/tick (gym.values' checks and words; the first tick starts the workout, a second
// tick of an exercise is another row; keyed), /gym/remove (one row by set_id, or all of an exercise's by exercise_id; the last one
// ends the workout), /gym/pick (another day or Free workout swaps the list; no Undo) and /gym/new (with today: on today's day;
// the core's words; no Undo); Undo of a tick or a remove puts the rows back. GET /day's gym card is the day sample's.
// Deploy 97: the Gym's other five parts: GET /gym/plan (the days in order as "Day n · Name", their exercises with the plan numbers, what
// can still be added, the removed days), /gym/exercises (the list with kind, words, use), /gym/progress?x= (the sample's Bench press
// as it is; another exercise's is made here from its kind, six weekly sessions), /gym/history (the sample), /gym/activity?day= (the
// sample's day for every day, the watch's workout on today; POST /standin/watch-none: the watch has sent nothing, the set-up guide);
// and POST /gym/itemset, itemmove, itemremove (Undo puts it back, same id and place), itemadd, daynew (a day name already there is
// refused), dayedit, dayactive, rename, active, and /gym/new without today (the Exercises part): the core's checks and words, the
// data changed as the core would; the Workout read follows the plan (the chips and the split come from the days). POST
// /standin/gym-empty: no exercises, no days (the empty Exercises list, the empty Progress, History and Plan). POST
// /standin/week-done: Day 1 counts as done this week.
// Deploy 99: Home's Now and Pick pages, from tests/samples/home.json (real answers of the door for an invented flat): GET /home?min= and
// /home/pick?min=&n= worked out from the Zones sample's pairs as they stand (home.load's order, one row per chore, the jobs that fit as
// home.candidates picks them, the open timer with its seconds left), Day.home made the same way; POST /home/tick (toggles a pair done
// today), start, pause, resume, stop, pickdone, picknext, skip and earlier with the core's checks and words, keys replayed, Undo of a
// tick, pickdone, picknext, skip and earlier. POST /standin/home-running (a timer of 15 minutes on the first job), /standin/home-ending
// (one with 6 seconds left), /standin/home-paused (7:05 left, paused), /standin/home-closed (the open timer closed elsewhere),
// /standin/home-empty (no zones or chores); /standin/slow slows Home's saves too.
// Deploy 100: GET /home/zones, /home/history?n=, /home/chore?id= and /home/edit worked out from the same pairs and the sample's zones, chores
// and history as they stand, and the saves of those pages as the core makes them (home.py): alldone, startpoint (week, month, longer,
// unknown), remove, goalset, zonenew, zoneedit, zoneactive, chorenew, choreedit, choreactive, chorezones, with the core's checks and
// refusals (a zone name in use, a number out of range, a whole-flat chore needing a zone); keys replay (alldone, startpoint, earlier), Undo
// of alldone, startpoint, remove and earlier; the Edit forms have none.
// Deploy 105: Library's Foods tab, from tests/samples/catalogue.json (real answers of the door for an invented catalogue): GET
// /food/catalogue?q=&f=&s= worked out from the foods as they stand (q in name, words, N number and barcode; f all, drinks, new (added in
// the 14 days to 17.11.2026), review; s the eight orders, ties by name, as the samples show; bad f or s 400), GET /food/item?id= (the
// samples' boxes, the other foods' made the same way; not there 404 no_entry), POST /food/catalogue/values (only the values sent; read
// back first, then saved with confirmed; a recipe food refused), words (add, remove; another food's name or word refused in the core's
// words), barcode (8 to 14 digits), basics (a name another food has refused; hide takes it out of the list), unit (the same name again
// changes its grams), reviewed; none has a key or Undo, the same values again are "Nothing changed.". POST /lookup and /answer with view
// "catalogue": a read-back of the words typed as a question (after a moment), its yes adds the food (Undo takes it out again), its no
// closes it; every catalogue save answers with the Catalogue of view_q, view_f, view_s and the box of view_food.
// Deploy 108: More's Search, Recent and Usage, from tests/samples/search.json, recent.json and usage.json (real answers of the door for invented
// data): GET /search?q= (the sample of that word: muesli, rowing, pull, stove, vitamin, zzqq; "many" is made here from the muesli sample, a food
// group cut at 15 with `more`; under two letters the sample's hint; any other word has no match, as the sample's zzqq; the word is squeezed and
// cut at 80 as the door does), GET /recent (the sample; POST /standin/recent-none: no message and none waiting), GET /usage?r=7|30|all (the
// sample of that range, another r 400; POST /standin/usage-empty: no call in any range) and GET /gym/history?w=<id> (the sample, and a
// workout that is not in it comes in its place by date as an older one: Pull day, 02.04.2026; w not digits 400).
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';

const port = Number(process.argv[2] ?? 8099);
const token = process.env.FRONT_TOKEN ?? '';
const sessions = new Set();
const PROXY = ['cf-ray', 'cf-connecting-ip', 'cf-visitor', 'x-forwarded-for', 'x-forwarded-host', 'x-forwarded-proto', 'forwarded', 'x-real-ip'];
const ends = () => new Date(Date.now() + 30 * 86400_000).toISOString();
const read = (name) => JSON.parse(readFileSync(new URL(`../samples/${name}`, import.meta.url), 'utf8'));
const SAVE = read('save.json');
const LOG = read('log.json');
const FOOD = read('food.json');
const USUAL = read('usual.json');
const SCAN = read('scan.json');
const HEALTH = read('health.json');
const HABITS = read('habits.json');
const GYM = read('gym.json');
const FOODTRENDS = read('food_trends.json');
const INSIGHTS = read('insights.json');
const CAT = read('catalogue.json');
const LABS = read('labs.json');
const SEARCH = read('search.json');
const RECENT = read('recent.json');
const USAGE = read('usage.json');
const READ_MS = 1200; // the AI's moment: long enough to see the "being read" row

let state; // { day, usual, undo: {token, head, expires_at} | null, before: {day, usual} before the last save (for Undo), keys: Map, lines: Map, aiDown }
let ids = 9000;
let mode = 'up'; // 'up' | 'core-down' | 'door-off' (step F)
function reset() {
  state = { day: read('day.json').day, usual: usualStart(), undo: null, before: null, keys: new Map(), lines: new Map(), aiDown: false,
    scanned: new Map([[SCAN.barcode.code, SCAN.barcode.food]]), labelFail: false,
    hv: healthStart(), sessions: sessionsStart(), hab: habitsStart(), dayKeys: new Set(), slow: 0, locked: new Set(), gym: gymStart(), watchNone: false, gymEmpty: false, home: homeStart(), week: weekStart(), fail: new Set(), cat: catStart(), labs: labsStart(), recentNone: false, usageEmpty: false };
  state.day.needs.body_due = structuredClone(HEALTH.day_body_due);
  // the notes of the food sample's rows (the same invented day), kept on the rows so an Undo puts them back too
  const notes = new Map(FOOD.food_day.food_day.rows.map((r) => [r.ref, r.note]));
  for (const r of state.day.rows) if (r.kind === 'food') r.note = notes.get(r.ref) ?? null;
}

/** GET /day's day: the rows without the notes the stand-in keeps on them (the door's /day has none). */
const dayOut = (d) => ({ ...d, rows: d.rows.map(({ note: _n, ...r }) => r) });

/** The Food day as the door sends it: today from the day above; an earlier day is the sample's day before. */
function foodDay(asked) {
  const d = state.day;
  if (asked && /^\d{4}-\d\d-\d\d$/.test(asked) && asked < d.day) {
    return { ...structuredClone(FOOD.before.food_day), day: asked, today: d.day, past: true };
  }
  const rows = d.rows
    .filter((r) => r.kind === 'food')
    .map((r) => ({ ref: r.ref, kind: 'food', meal: r.meal, at: r.at, time_known: r.time_known, food: r.food, amount: r.amount,
      unit: r.unit, portion_text: r.portion_text, nutrients: r.nutrients, food_id: r.food_id, note: r.note ?? null }));
  return { day: d.day, today: d.day, past: false, rows, meals: d.energy.meals, totals: d.energy.totals, targets: d.energy.targets };
}

/** GET /food/entry: the row with its food's units (the sample entry's units for its food, else only the food's own). */
function foodEntry(ref) {
  const r = state.day.rows.find((x) => x.ref === ref && x.kind === 'food');
  if (!r) return null;
  const e = FOOD.entry.entry;
  return { ref, day: state.day.day, food_id: r.food_id, food: r.food, amount: r.amount, unit: r.unit, at: r.at, time_known: r.time_known,
    note: r.note ?? null, units: r.food === e.food ? e.units : [{ unit: r.unit, in_basis: 1 }] };
}

/** The day's totals and meals worked out again from its food rows (after a change or a delete). */
function recount(d) {
  const food = d.rows.filter((r) => r.kind === 'food');
  d.energy.totals = food.reduce((a, r) => add(a, r.nutrients), ZERO);
  d.energy.meals = d.energy.meals
    .map((m) => ({ ...m, nutrients: food.filter((r) => r.meal === m.meal).reduce((a, r) => add(a, r.nutrients), ZERO) }))
    .filter((m) => food.some((r) => r.meal === m.meal));
}

/** POST /food/entry and /food/note, as webfood.entry and .note answer. */
function foodSave(path, b, d) {
  const row = d.rows.find((r) => r.ref === b.ref && r.kind === 'food');
  if (!row) return { outcome: 'rejected', head: 'Nothing saved.', reason: /^f\d{1,9}$/.test(b.ref ?? '') ? 'That entry is not there any more.' : 'Unknown entry.' };
  if (path === '/food/note') {
    const note = String(b.note ?? '').split(/\s+/).filter(Boolean).join(' ').slice(0, 300);
    row.note = note || null;
    return { outcome: 'changed', head: note ? 'Note saved.' : 'Note removed.' };
  }
  if (b.action === 'delete') {
    d.rows = d.rows.filter((r) => r !== row);
    recount(d);
    return { outcome: 'changed', head: `Deleted ${row.food}.` };
  }
  const typed = String(b.food_name ?? '').trim();
  let name = row.food;
  if (typed && typed.toLowerCase() !== row.food.toLowerCase()) {
    const other = d.rows.find((r) => r.kind === 'food' && r.food.toLowerCase() === typed.toLowerCase());
    if (!other) return { outcome: 'rejected', head: 'Nothing saved.', reason: `No food called "${typed}" in your catalogue: type part of its name and pick it from the list.` };
    name = other.food;
  }
  const units = foodEntry(row.ref).units;
  const unit = b.unit || row.unit;
  const u = units.find((x) => x.unit === unit);
  if (!u) return { outcome: 'rejected', head: 'Nothing saved.', reason: `"${unit}" is not a unit of that food: give the amount in ${row.unit}.` };
  const a = Number(b.amount);
  const top = u.in_basis === 1 ? 5000 : 100;
  if (!(a > 0 && a <= top)) return { outcome: 'rejected', head: 'Nothing saved.', reason: `Give the amount as a number above 0 and at most ${top} ${unit}.` };
  if (b.time && !/^\d\d:\d\d$/.test(b.time)) return { outcome: 'rejected', head: 'Nothing saved.', reason: 'Give the time as hh:mm.' };
  const grams = a * u.in_basis;
  const at = b.time ? `${d.day}T${b.time}:00+01:00` : row.at;
  if (grams === row.amount && name === row.food && (!b.time || (row.time_known && hm(new Date(row.at)) === b.time))) {
    return { outcome: 'unchanged', head: 'Nothing changed.', reason: 'Nothing changed.' };
  }
  if (grams > 2000 && b.confirmed !== true) {
    return { ...SAVE.needs_confirmation, read_back: `${name} ${grams} ${row.unit}: more than usual. Change it?`, confirm: { label: 'Yes, change', no_label: 'No' } };
  }
  const k = grams / row.amount;
  row.nutrients = Object.fromEntries(Object.entries(row.nutrients).map(([x, v]) => [x, +(v * k).toFixed(1)]));
  // as the core: a new amount replaces the portion's words ("4 slice" in another unit, none in the food's own)
  if (grams !== row.amount) row.portion_text = u.in_basis === 1 ? null : `${a} ${unit}`;
  [row.amount, row.food, row.at, row.time_known] = [grams, name, at, row.time_known || !!b.time];
  recount(d);
  return { outcome: 'changed', head: `Changed ${row.food}.` };
}
// ---- the usual meals (deploy 87) -----------------------------------------------------------------------------------------------

const r1 = (x) => Math.round(x * 10) / 10;
const per100 = (nu, amount) => Object.fromEntries(Object.entries(nu).map(([k, v]) => [k, r1((v * 100) / amount)]));
/** The catalogue: the foods of the samples (usual.json's search and meals, the day's rows), per 100 g or ml. */
const CATALOGUE = (() => {
  const m = new Map();
  const put = (food_id, name, unit, per_100) => m.has(food_id) || m.set(food_id, { food_id, name, unit, drink: unit === 'ml', per_100 });
  for (const f of USUAL.foods.foods) put(f.food_id, f.name, f.unit, f.per_100);
  for (const u of USUAL.usual.usual) for (const i of u.items) put(i.food_id, i.food, i.unit, per100(i.nutrients, i.amount));
  for (const r of read('day.json').day.rows) if (r.kind === 'food' && r.amount > 0) put(r.food_id, r.food, r.unit, per100(r.nutrients, r.amount));
  return m;
})();
const ofFood = (food_id, amount) => {
  const f = CATALOGUE.get(food_id);
  return Object.fromEntries(Object.entries(f.per_100).map(([k, v]) => [k, r1((v * amount) / 100)]));
};
let itemIds = 100;
/** A usual meal as GET /usual sends it, from [food_id, amount] pairs. */
function usualMeal(meal_id, name, drink, pairs, ids = []) {
  const items = pairs.map(([food_id, amount], k) => {
    const f = CATALOGUE.get(food_id);
    return { item_id: ids[k] ?? ++itemIds, food_id, food: f.name, amount, unit: f.unit, nutrients: ofFood(food_id, amount) };
  });
  return { meal_id, name, drink, items, nutrients: items.reduce((a, i) => add(a, i.nutrients), ZERO) };
}
const byName = (list) => list.sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
/** The sample's list, and three more made here from the catalogue (the day's foods), so the page has something to show. */
function usualStart() {
  const more = [
    usualMeal(86, 'Lunch box', false, [[6, 350], [7, 80]]),
    usualMeal(87, 'Evening snack', false, [[3, 150], [5, 40]]),
    usualMeal(88, 'Coffee with milk', true, [[1, 250]]),
  ];
  return byName([...structuredClone(USUAL.usual.usual), ...more]);
}
const rejected = (reason) => ({ outcome: 'rejected', head: 'Nothing saved.', reason });
const taken = (list, name, other) => list.find((u) => u.meal_id !== other && u.name.toLowerCase() === name.toLowerCase());
const cleanName = (x) => String(x ?? '').split(/\s+/).filter(Boolean).join(' ').slice(0, 60);
/** items: [{food_id, amount}], each a food of the catalogue with an amount above 0 and at most 5000; or the reason it is not. */
function pairsOf(items, most) {
  if (!Array.isArray(items) || items.length > most) return `At most ${most} foods.`;
  for (const i of items) {
    if (!CATALOGUE.has(i?.food_id)) return `Pick each food from the catalogue (N${i?.food_id} is not in it, or it is hidden).`;
    if (typeof i.amount !== 'number' || !(i.amount > 0 && i.amount <= 5000)) return 'Give every food an amount above 0 and at most 5000.';
  }
  return items.map((i) => [i.food_id, i.amount]);
}

/** POST /usual/meal, /usual/new and /usual/from_meal: changes state.usual (and answers), or refuses. */
function usualSave(path, b) {
  const list = structuredClone(state.usual);
  let head;
  if (path === '/usual/meal') {
    const u = list.find((x) => x.meal_id === b.meal_id);
    if (!u) return rejected('That usual meal is not there any more.');
    if (b.action === 'delete') {
      if (b.confirmed !== true) return { ...SAVE.needs_confirmation, read_back: `Delete the usual meal "${u.name}"?`, confirm: { label: 'Yes, delete', no_label: 'No' } };
      list.splice(list.indexOf(u), 1);
      head = `Deleted the usual meal "${u.name}". Past meals keep their values.`;
    } else {
      const pairs = pairsOf(b.items, 40);
      if (typeof pairs === 'string') return rejected(pairs);
      if (!pairs.length) return rejected('A usual meal needs at least one food. To remove it, use Delete.');
      const name = cleanName(b.name);
      if (name.length < 2) return rejected('Give the usual meal a name.');
      const other = taken(list, name, u.meal_id);
      if (other) return rejected(`There is already a usual meal called "${other.name}". Pick another name.`);
      const same = name === u.name && JSON.stringify(pairs) === JSON.stringify(u.items.map((i) => [i.food_id, i.amount]));
      if (same) return { outcome: 'unchanged', head: 'Nothing changed.', reason: 'Nothing changed.' };
      if (b.confirmed !== true) return { ...SAVE.needs_confirmation, read_back: `Change the usual meal "${u.name}"?` };
      // as the core: the items that stay keep their ids
      const ids = pairs.map(([fid]) => u.items.find((i) => i.food_id === fid)?.item_id);
      list.splice(list.indexOf(u), 1, usualMeal(u.meal_id, name, u.drink, pairs, ids));
      head = `Changed the usual meal "${name}".`;
    }
  } else if (path === '/usual/new') {
    const pairs = pairsOf(b.items, 8);
    if (typeof pairs === 'string') return rejected(pairs);
    const name = cleanName(b.name);
    if (name.length < 2) return rejected('Give the usual meal a name.');
    const other = taken(list, name);
    if (other) return rejected(`There is already a usual meal called "${other.name}". Pick another name.`);
    if (!pairs.length) return rejected('Add at least one food with its amount.');
    list.push(usualMeal(++ids, name, b.drink === true, pairs));
    head = `Saved "${name}" as a usual ${b.drink ? 'drink' : 'meal'} (${pairs.length} item${pairs.length === 1 ? '' : 's'}). It shows on Today and in the list below.`;
  } else {
    if (!Number.isInteger(b.meal) || b.meal === 0) return rejected("Pick a meal: the day's drinks cannot be saved as a usual meal.");
    const name = cleanName(b.name);
    if (name.length < 2) return rejected('Give the usual meal a name.');
    if (b.day !== state.day.day) return rejected('Unknown day.');
    const other = taken(list, name);
    if (other) return rejected(`There is already a usual meal called "${other.name}". Pick another name.`);
    const rows = state.day.rows.filter((r) => r.kind === 'food' && r.meal === b.meal && CATALOGUE.has(r.food_id));
    if (!rows.length) return rejected('That meal has no foods.');
    list.push(usualMeal(++ids, name, false, rows.map((r) => [r.food_id, r.amount])));
    head = `Saved "${name}" as a usual meal (${rows.length} items). It shows on Today and under Food › Usual meals.`;
  }
  state.before = { day: state.day, usual: state.usual };
  state.usual = byName(list);
  state.undo = { token: randomBytes(12).toString('base64url'), head, expires_at: new Date(Date.now() + 15 * 60_000).toISOString() };
  return { outcome: 'changed', head, undo: state.undo, tone: 'ok' };
}

/** GET /foods?q=: up to 20 foods whose name has the words (any case); none = all, as "the most eaten". */
function foods(q) {
  const words = String(q ?? '').toLowerCase().split(/\s+/).filter(Boolean);
  return [...CATALOGUE.values()].filter((f) => words.every((w) => f.name.toLowerCase().includes(w))).slice(0, 20);
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers });
  res.end(JSON.stringify({ v: 1, ...body }));
}

const nowIso = () => new Date().toISOString();
const add = (a, b) => ({
  kcal: a.kcal + b.kcal,
  protein: +(a.protein + b.protein).toFixed(1),
  fat: +(a.fat + b.fat).toFixed(1),
  carbs: +(a.carbs + b.carbs).toFixed(1),
});

/** A food row as the door sends it, eaten now, in the day's latest meal (0 = the drinks). */
function eat(d, food, food_id, amount, unit, nutrients, drink = false) {
  const meal = drink ? 0 : Math.max(1, ...d.rows.filter((r) => r.kind === 'food').map((r) => r.meal));
  d.rows.push({ ref: `f${++ids}`, kind: 'food', meal, at: nowIso(), time_known: true, food, food_id, amount, unit, portion_text: null, nutrients, usual_meal: null });
  d.energy.totals = add(d.energy.totals, nutrients);
  const m = d.energy.meals.find((x) => x.meal === meal);
  if (m) m.nutrients = add(m.nutrients, nutrients);
  else d.energy.meals.push({ meal, label: drink ? 'Drinks' : `Meal ${meal}`, nutrients });
}

const ZERO = { kcal: 0, protein: 0, fat: 0, carbs: 0 };
const hm = (d = new Date()) => d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' });
const ddmm = (iso) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.`;

/** A question as the door sends it (a sample's), asked now about these words. */
function ask(sample, words, readBack) {
  const now = new Date();
  return { ...structuredClone(sample), id: `p${randomBytes(4).toString('hex')}`, asked_at: now.toISOString(),
    open_until: new Date(now.getTime() + 3 * 86400_000).toISOString(), message: words,
    read_back: readBack ?? sample.read_back, refill: sample.refill ? { ...sample.refill, text: words } : null };
}

/** A typed line (POST /log), read as the core reads it, in the shape of tests/samples/log.json. */
function logLine(b) {
  const words = String(b.text ?? '').trim();
  if (!words) return { answer: { ...LOG.held, outcome: 'rejected', head: 'Nothing saved.', reason: 'Nothing saved: the message is empty.' } };
  const d = structuredClone(state.day);
  const label = /^\s*(gratitude|private|g)\s*:\s*(.*)$/is.exec(words);
  if (label) {
    if (!label[2].trim()) return { answer: { ...LOG.held, outcome: 'rejected', head: 'Nothing saved.', reason: 'Nothing saved: the line has a label but no words.' } };
    if (label[1].toLowerCase() !== 'private') d.gratitude.count += 1;
    return { answer: { ...LOG.private }, day: d, undo: false };
  }
  if (state.aiDown) {
    d.needs.not_read.push({ id: ++ids, received_at: new Date().toISOString(), text: words, tries: 1, needs_you: false, reading: false });
    return { answer: { ...LOG.held }, day: d, undo: false };
  }
  if (/^what\b/i.test(words) || words.endsWith('?')) {
    const food = d.rows.filter((r) => r.kind === 'food').map((r) => `  ${r.ref} ${hm(new Date(r.at))} ${r.food} ${r.amount} ${r.unit}`);
    return { answer: { ...LOG.answered, result: [`Food ${ddmm(d.day)}:`, ...food].join('\n') } };
  }
  if (/^the .+ (was|were) .+/i.test(words)) {
    const q = ask(LOG.confirm.questions[0], words, `OK changed: ${words.replace(/^the /i, '')}`);
    d.needs.questions.unshift(q);
    return { answer: { ...LOG.confirm, read_back: `Preview, nothing changed yet:\n${q.read_back}`, questions: [q] }, day: d, undo: false };
  }
  if (/mystery/i.test(words)) {
    // the door's food question of a typed line (reads.question, tool "log", kind "food"): not in the catalogue, no candidates
    const word = words.replace(/^\d+(?:[.,]\d+)?\s*(g|ml)\s+/i, '');
    const q = ask({ ...LOG.question.questions[0], tool: 'log', kind: 'food', text: `Which food is "${word}"?`, read_back: null, refill: null,
      answers: [{ reply: 'skip', label: 'Skip', style: 'quiet' }], free: { placeholder: 'Another food: name or N number', type: 'text', unit: null } }, words, null);
    d.needs.questions.unshift(q);
    return { answer: { ...LOG.question, head: 'Nothing saved yet: please answer.', read_back: null, reason: `Which food is "${word}"?`, questions: [q] }, day: d, undo: false };
  }
  const said = state.lines.get(words.toLowerCase());
  if (said) {
    const q = ask(LOG.question.questions[0], words, `same message already logged at ${said}`);
    d.needs.questions.unshift(q);
    return { answer: { ...LOG.question, reason: `This exact message was already logged at ${said}.`, questions: [q] }, day: d, undo: false };
  }
  state.lines.set(words.toLowerCase(), hm());
  const m = /^(\d+(?:[.,]\d+)?)\s*(g|ml)\s+(.+)$/i.exec(words);
  const amount = m ? Number(m[1].replace(',', '.')) : 100;
  const unit = m ? m[2].toLowerCase() : 'g';
  const name = (m ? m[3] : words).replace(/^./, (c) => c.toUpperCase());
  const k = amount / 100;
  const nutrients = { kcal: Math.round(80 * k), protein: +(4 * k).toFixed(1), fat: +(2 * k).toFixed(1), carbs: +(10 * k).toFixed(1) };
  eat(d, name, ++ids, amount, unit, nutrients, unit === 'ml');
  const row = d.rows.at(-1);
  const receipt = [`+ ${row.ref} ${name} ${amount} ${unit} | ${nutrients.kcal} kcal, P ${nutrients.protein} | ${ddmm(d.day)} meal ${row.meal} ${hm()}`,
    `= 1 item: ${nutrients.kcal} kcal, protein ${Math.round(nutrients.protein)} g`];
  return { answer: { ...LOG.saved, receipt, notes: [] }, day: d, undo: `Saved: ${receipt.join('; ')}`.slice(0, 160) };
}

/** One save: changes the day and answers with its head, or null for a request the core would refuse. */
function save(path, b) {
  const d = structuredClone(state.day);
  let head = 'Saved.';
  let outcome = 'saved';
  if (path === '/water') {
    const ml = b.ml ?? 250;
    d.water.ml += ml;
    eat(d, 'Water', 4, ml, 'ml', ZERO, true);
  } else if (path === '/again') {
    // an Again chip's food, or a scanned one (deploy 90: the sample's, or one added from a label)
    const scannedFood = [...state.scanned.values()].find((f) => String(f.food_id) === String(b.food_id));
    const chip = d.chips.again.find((c) => String(c.food_id) === String(b.food_id)) ??
      (scannedFood && { food_id: scannedFood.food_id, name: scannedFood.name, unit: scannedFood.unit });
    if (!chip) return { outcome: 'rejected', head: 'Nothing saved.', reason: 'Unknown food.' };
    if (b.time !== undefined && !/^\d\d:\d\d$/.test(b.time)) return { outcome: 'rejected', head: 'Nothing saved.', reason: 'Give the time as hh:mm.' };
    const k = Number(b.amount) / 100;
    eat(d, chip.name, chip.food_id, Number(b.amount), chip.unit, { kcal: Math.round(120 * k), protein: +(5 * k).toFixed(1), fat: +(3 * k).toFixed(1), carbs: +(15 * k).toFixed(1) }, chip.unit === 'ml');
  } else if (path === '/usual') {
    const meal = d.chips.usual.find((u) => String(u.meal_id) === String(b.meal_id));
    if (!meal) return { outcome: 'rejected', head: 'Nothing saved.', reason: 'Unknown meal.' };
    for (const i of meal.items) eat(d, i.food, 1, i.amount, i.unit, i.nutrients);
  } else if (path === '/habit') {
    const h = d.habits.find((x) => x.name === b.name);
    if (!h) return { outcome: 'rejected', head: 'Nothing saved.', reason: 'Unknown habit.' };
    if (b.action === 'untick') {
      if (!h.done) return { outcome: 'unchanged', head: 'Nothing to change.' };
      h.done -= 1;
      h.last_tick = h.done ? h.last_tick : null;
      outcome = 'changed';
      head = `${h.label} unticked.`;
    } else {
      h.done += 1;
      h.last_tick = `e${++ids}`;
      head = `${h.label} ticked.`;
    }
    h.complete = h.done >= h.target;
  } else if (path === '/checkin') {
    const c = d.needs.checkin;
    if (!c || !['mood', 'energy'].includes(b.type)) return { outcome: 'rejected', head: 'Nothing saved.', reason: 'Unknown check-in.' };
    c[b.type] = Number(b.value);
    if (c.mood && c.energy) d.needs.checkin = null;
  } else if (path === '/review') {
    const refs = b.action === 'all' ? b.refs : [b.ref];
    d.needs.review = d.needs.review.filter((r) => !refs.includes(r.ref));
    outcome = 'changed';
    head = refs.length > 1 ? `${refs.length} marked as right.` : 'Marked as right.';
  } else if (path === '/answer') {
    if (!d.needs.questions.some((q) => q.id === b.question_id)) return { outcome: 'rejected', head: 'Nothing saved.', reason: 'That question is closed.' };
    d.needs.questions = d.needs.questions.filter((q) => q.id !== b.question_id);
    if (['no', 'skip'].includes(String(b.reply).toLowerCase())) [outcome, head] = ['cancelled', 'Skipped.'];
  } else if (path === '/held/delete' || path === '/held/retry') {
    d.needs.not_read = d.needs.not_read.filter((m) => m.id !== b.id);
    if (path === '/held/delete') [outcome, head] = ['removed', 'Deleted.'];
  } else if (path === '/food/entry' || path === '/food/note') {
    const out = foodSave(path, b, d);
    if (out.outcome !== 'changed') return out;
    [outcome, head] = [out.outcome, out.head];
  } else if (path === '/health') {
    const h = d.health.find((x) => x.row === b.row);
    if (!h) return { outcome: 'rejected', head: 'Nothing saved.', reason: 'Unknown row.' };
    if (h.type === 'weight' && Number(b.v1) > 300 && b.confirmed !== true) return { ...SAVE.needs_confirmation };
    if (b.time) h.at = `${d.day}T${b.time}:00+01:00`;
    else [h.v1, h.v2, h.at] = [Number(b.v1), b.v2 === undefined ? null : Number(b.v2), nowIso()];
    if (h.ref) [outcome, head] = ['changed', `${h.label} changed.`];
    else h.ref = `m${++ids}`;
  } else {
    return null;
  }
  state.before = { day: state.day, usual: state.usual };
  state.day = d;
  state.undo = { token: randomBytes(12).toString('base64url'), head: `Saved: ${head}`, expires_at: new Date(Date.now() + 15 * 60_000).toISOString() };
  return { outcome, head, undo: state.undo, tone: 'ok' };
}


// ---- the Health page (deploy 92) ---------------------------------------------------------------------------------------------

const H = HEALTH.health.health;
const B = HEALTH.body.body;
const ROW_KIND = Object.fromEntries(H.columns.map((c) => [c.row, c.kind]));
const ROW_NAME = { weight: 'Weight', bp_morning: 'BP morning', bp_evening: 'BP evening', sugar: 'Sugar', bed: 'Bed', wake: 'Woke up', mood: 'Mood', energy: 'Energy' };
const shiftIso = (iso, n) => new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10) + n)).toISOString().slice(0, 10);
const dm = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' }) + ` ${iso.slice(8, 10)}.${iso.slice(5, 7)}.`;
const g = (v) => String(+v);

/** Every day's values the stand-in knows: the sample's 14 days ({day: {values, slept_minutes}}). */
function healthStart() {
  return Object.fromEntries(H.days.map((d) => [d.day, structuredClone(d)]));
}

/** A chart cut to the last `days` of the sample's range, or widened (its points moved along). */
function rangeChart(c, days) {
  const from = H.days_in_range - days; // > 0: cut; < 0: widened
  const series = c.series.map((s) => ({ ...s, pts: s.pts.filter((p) => p[0] >= from).map((p) => [p[0] - from, ...p.slice(1)]) }));
  return { ...c, start: shiftIso(H.today, 1 - days), days, series };
}

/** GET /health as the door answers: the sample, for the range asked (7, 30 or 90) and all. */
function healthOut(range = 30, all = false) {
  const days = [];
  const shown = all ? range : Math.min(range, H.shown_days);
  for (let i = 0; i < shown; i++) {
    const day = shiftIso(H.today, -i);
    const known = state.hv[day];
    days.push(known ? structuredClone(known) : { day, values: Object.fromEntries(H.columns.map((c) => [c.row, null])), slept_minutes: null });
  }
  const n = Math.min(range, 30);
  return {
    ...structuredClone(H), range, all, days_in_range: range, start: shiftIso(H.today, 1 - range), days,
    charts: H.charts.map((c) => ({ ...c, chart: rangeChart(c.chart, range) })),
    times: { ...H.times, days: n, rows: H.times.rows.slice(-n).map((r, i, a) => ({ ...r, label: i === a.length - 1 || n <= 7 ? `${r.date.slice(8, 10)}.${r.date.slice(5, 7)}.` : r.label })) },
  };
}

const hvText = (row, v) => (!v ? '' : ROW_KIND[row] === 'time' ? v.time : ROW_KIND[row] === 'pair' ? `${g(v.v1)}/${g(v.v2)}` : g(v.v1));

/** POST /health/day, as webactions.health_day answers (the stand-in's version of its checks). */
function healthDay(b) {
  if (typeof b.day !== 'string' || !/^\d{4}-\d\d-\d\d$/.test(b.day)) return [400, { error: 'bad_request', message: 'day is missing.' }];
  if (!b.values || typeof b.values !== 'object' || !Object.keys(b.values).length) return [400, { error: 'bad_request', message: 'values must be an object of rows and values.' }];
  for (const [row, v] of Object.entries(b.values)) {
    const kind = ROW_KIND[row];
    if (!kind) return [400, { error: 'bad_request', message: `Unknown row: ${row}.` }];
    if (kind === 'pair' && v !== null && v !== '' && !(Array.isArray(v) && v.length === 2 && v.every((x) => x === null || typeof x === 'number'))) return [400, { error: 'bad_request', message: `${row} must be [upper, lower] or null.` }];
    if (kind === 'time' && v !== null && !(typeof v === 'string')) return [400, { error: 'bad_request', message: `${row} must be a time hh:mm or null.` }];
    if (kind === 'number' && v !== null && v !== '' && typeof v !== 'number') return [400, { error: 'bad_request', message: `${row} must be a number or null.` }];
  }
  const no = (reason) => [200, { outcome: 'rejected', head: 'Nothing saved.', reason }];
  if (b.day > H.today || b.day < H.oldest_day) return no('Pick a day of the last 12 months.');
  const was = state.hv[b.day] ?? { day: b.day, values: Object.fromEntries(H.columns.map((c) => [c.row, null])), slept_minutes: null };
  const adds = [];
  const changes = [];
  const deletes = [];
  for (const [row, raw] of Object.entries(b.values)) {
    const kind = ROW_KIND[row];
    const cur = was.values[row];
    const empty = raw === null || raw === '' || (Array.isArray(raw) && raw.every((x) => x === null));
    if (empty) {
      if (cur) deletes.push(row);
      continue;
    }
    if (kind === 'pair' && raw.some((x) => x === null)) return no(`${ROW_NAME[row]}: give both numbers.`);
    if (kind === 'time' && !/^\d\d:\d\d$/.test(raw)) return no(`${ROW_NAME[row]}: give the time as hh:mm.`);
    const v = kind === 'time' ? { v1: null, v2: null, time: raw } : kind === 'pair' ? { v1: raw[0], v2: raw[1], time: null } : { v1: raw, v2: null, time: null };
    if (cur && hvText(row, cur) === hvText(row, { ...cur, ...v })) continue;
    (cur ? changes : adds).push([row, v]);
  }
  if (!adds.length && !changes.length && !deletes.length) return [200, { outcome: 'unchanged', head: 'Nothing changed.', reason: 'Nothing changed.' }];
  if (deletes.length && b.confirm_delete !== true) {
    return [200, { ...HEALTH.saves.health_day_delete, read_back: `Delete on ${dm(b.day)}: ${deletes.map((r) => `${ROW_NAME[r]} ${hvText(r, was.values[r])}`).join(', ')}?` }];
  }
  for (const [row, v] of [...adds, ...changes]) {
    const odd = (row === 'weight' && (v.v1 < 30 || v.v1 > 300)) || (row === 'sugar' && (v.v1 < 20 || v.v1 > 600));
    if (odd && b.confirmed !== true) {
      return [200, { ...HEALTH.saves.health_day_read_back, read_back: row === 'weight' ? `${g(v.v1)} is outside the plausible range 30-300 kg` : `${g(v.v1)} is outside the plausible range 20-600 mg/dL` }];
    }
  }
  const hv = structuredClone(state.hv);
  const d = hv[b.day] ?? structuredClone(was);
  hv[b.day] = d;
  const parts = [];
  for (const row of deletes) {
    parts.push(`${ROW_NAME[row]} ${hvText(row, d.values[row])} deleted`);
    d.values[row] = null;
  }
  for (const [row, v] of [...changes, ...adds]) {
    const cur = d.values[row];
    const kind = ROW_KIND[row];
    const at = kind === 'time' ? `${row === 'bed' ? shiftIso(b.day, -1) : b.day}T${v.time}:00+01:00` : null;
    parts.push(cur ? `${ROW_NAME[row]} ${hvText(row, cur)} → ${hvText(row, v)}` : `${ROW_NAME[row]} ${hvText(row, v)} added`);
    d.values[row] = { ref: cur?.ref ?? `${kind === 'time' ? 'e' : 'm'}${++ids}`, ...v, at };
  }
  const bed = d.values.bed?.at;
  const wake = d.values.wake?.at;
  const mins = bed && wake ? Math.round((Date.parse(wake) - Date.parse(bed)) / 60000) : null;
  d.slept_minutes = mins !== null && mins > 0 && mins < 1440 ? mins : null;
  const head = `Saved for ${dm(b.day)}: ${parts.join(', ')}.`;
  state.before = { day: state.day, usual: state.usual, hv: state.hv, sessions: state.sessions };
  state.hv = hv;
  state.undo = { token: randomBytes(12).toString('base64url'), head, expires_at: new Date(Date.now() + 15 * 60_000).toISOString() };
  return [200, { outcome: adds.length ? 'saved' : 'changed', head, undo: state.undo }];
}

/** The body sessions: {day: {measure: {cm, ref}}}, made from the sample's charts (each dot a session's value) and its table's refs. */
function sessionsStart() {
  const out = {};
  for (const c of B.charts) {
    const dots = c.chart.series.find((s) => s.mark === 'dot');
    for (const p of dots.pts) {
      const day = shiftIso(c.chart.start, p[0]);
      out[day] ??= {};
      out[day][c.key] = { cm: p[1], ref: null };
    }
  }
  for (const t of B.table) out[t.day][t.key].ref = t.ref;
  for (const d of Object.values(out)) for (const v of Object.values(d)) v.ref ??= `m${++ids}`;
  return out;
}

const cm1 = (v) => v.toFixed(1);
const signed = (d) => (Math.abs(d) < 0.05 ? '±0' : `${d > 0 ? '+' : '−'}${Math.abs(d).toFixed(1)}`);

/** GET /body as the door answers: the card of the session of `asked` (today without), from the sessions now. */
function bodyOut(asked) {
  const day = asked && /^\d{4}-\d\d-\d\d$/.test(asked) && asked < B.today ? asked : B.today;
  const days = Object.keys(state.sessions).filter((d) => Object.keys(state.sessions[d]).length).sort();
  const of = (k) => days.filter((d) => state.sessions[d][k]).map((d) => ({ day: d, ...state.sessions[d][k] }));
  const last = days.at(-1) ?? null;
  const left = last ? B.interval_days - Math.round((Date.parse(B.today) - Date.parse(last)) / 86400000) : null;
  const due = left === null ? null : left <= 0 ? 'due now' : left < 7 ? `next due in ${left} day${left === 1 ? '' : 's'}` : `next due in about ${Math.round(left / 7)} week${Math.round(left / 7) === 1 ? '' : 's'}`;
  const form = B.form.map((m) => {
    const s = state.sessions[day]?.[m.key];
    const before = of(m.key).filter((x) => x.day < day).at(-1);
    return { ...m, cm: s ? s.cm : null, ref: s ? s.ref : null, last_cm: before ? before.cm : null };
  });
  const table = B.form.flatMap((m) => {
    const vals = of(m.key);
    if (!vals.length) return [];
    const now = vals.at(-1);
    const lastD = vals.length > 1 ? now.cm - vals.at(-2).cm : null;
    const startD = vals.length > 1 ? now.cm - vals[0].cm : null;
    return [{ key: m.key, label: m.label, ref: now.ref, cm: now.cm, day: now.day, last: lastD, start: startD,
      last_text: lastD === null ? null : signed(lastD), start_text: startD === null ? null : signed(startD) }];
  });
  const charts = B.form.flatMap((m) => {
    const vals = of(m.key);
    if (!vals.length) return [];
    const first = vals[0].day;
    const idx = (d) => Math.round((Date.parse(d) - Date.parse(first)) / 86400000);
    return [{ key: m.key, label: m.label, chart: { start: first, days: Math.max(1, idx(vals.at(-1).day) + 1), label: `${m.label} in cm`,
      series: [{ mark: 'line', cls: 'a', pts: vals.map((v) => [idx(v.day), v.cm]) },
        { mark: 'dot', cls: 'a', pts: vals.map((v) => [idx(v.day), v.cm, `${v.day.slice(8, 10)}.${v.day.slice(5, 7)}.${v.day.slice(0, 4)}: ${cm1(v.cm)} cm`]) }],
      pointLabels: 1, xAtPoints: 1 } }];
  });
  const waist = of('waist').at(-1);
  return { ...structuredClone(B), day, last_measured: last, due_text: due, form, table, charts, first_day: days[0] ?? null,
    waist_height: waist ? { waist_cm: waist.cm, day: waist.day, height_cm: B.waist_height.height_cm, ratio: +(waist.cm / B.waist_height.height_cm).toFixed(2) } : null };
}

/** POST /body, as webactions.body_save answers (the stand-in's version of its checks). */
function bodySave(b) {
  if (typeof b.day !== 'string' || !/^\d{4}-\d\d-\d\d$/.test(b.day)) return [400, { error: 'bad_request', message: 'day is missing.' }];
  if (!b.values || typeof b.values !== 'object' || !Object.keys(b.values).length) return [400, { error: 'bad_request', message: 'values must be an object of measures and cm.' }];
  const no = (reason) => [200, { outcome: 'rejected', head: 'Nothing saved.', reason }];
  if (b.day > B.today || b.day < shiftIso(B.today, -365)) return no('Pick a day of the last 12 months.');
  const label = Object.fromEntries(B.form.map((m) => [m.key, m]));
  const cur = state.sessions[b.day] ?? {};
  const adds = [];
  const deletes = [];
  for (const [k, v] of Object.entries(b.values)) {
    if (!label[k]) return [400, { error: 'bad_request', message: `Unknown measure: ${k}.` }];
    if (v === null || v === '') {
      if (cur[k]) deletes.push(k);
      continue;
    }
    if (typeof v !== 'number') return [400, { error: 'bad_request', message: `${k} must be a number or null.` }];
    if (v <= 0) return no(`${label[k].label}: give a number in cm.`);
    if (cur[k] && cur[k].cm === v) continue;
    adds.push([k, v]);
  }
  if (!adds.length && !deletes.length) return [200, { outcome: 'unchanged', head: 'Nothing changed.', reason: 'Nothing changed.' }];
  if (deletes.length && b.confirm_delete !== true) {
    return [200, { ...HEALTH.saves.health_day_delete, read_back: `Delete on ${dm(b.day)}: ${deletes.map((k) => `${label[k].label} ${cm1(cur[k].cm)}`).join(', ')}?`, confirm: { label: 'Yes, delete', no_label: 'Keep it' } }];
  }
  for (const [k, v] of adds) {
    const before = Object.keys(state.sessions).filter((d) => d < b.day && state.sessions[d][k]).sort().at(-1);
    const lastCm = before ? state.sessions[before][k].cm : null;
    const m = label[k];
    if (b.confirmed !== true && (v < m.min || v > m.max)) {
      return [200, { ...HEALTH.saves.body_read_back, read_back: `Check: ${m.label} ${cm1(v)} cm is outside the usual ${m.min} to ${m.max} cm. Right?` }];
    }
    if (b.confirmed !== true && lastCm !== null && Math.abs(v - lastCm) >= B.jump_cm) {
      return [200, { ...HEALTH.saves.body_read_back, read_back: `Check: ${m.label} ${cm1(v)} cm is ${cm1(Math.abs(v - lastCm))} cm away from last time (${cm1(lastCm)}). Right?` }];
    }
  }
  const sessions = structuredClone(state.sessions);
  const s = (sessions[b.day] ??= {});
  const parts = [];
  for (const k of deletes) {
    parts.push(`${label[k].label} ${cm1(s[k].cm)} deleted`);
    delete s[k];
  }
  for (const [k, v] of adds) {
    parts.push(s[k] ? `${label[k].label} ${cm1(s[k].cm)} → ${cm1(v)}` : `${label[k].label} ${cm1(v)} added`);
    s[k] = { cm: v, ref: s[k]?.ref ?? `m${++ids}` };
  }
  const head = `Saved for ${dm(b.day)}: ${parts.join(', ')}.`;
  state.before = { day: state.day, usual: state.usual, hv: state.hv, sessions: state.sessions };
  state.sessions = sessions;
  state.undo = { token: randomBytes(12).toString('base64url'), head, expires_at: new Date(Date.now() + 15 * 60_000).toISOString() };
  return [200, { outcome: 'saved', head, undo: state.undo }];
}

// ---- the scan sheet (deploy 90) ------------------------------------------------------------------------------------------------

const codeOf = (url) => {
  const c = String(url.searchParams.get('code') ?? '').replace(/[\s-]/g, '');
  return /^\d{8,14}$/.test(c) ? c : null;
};
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

/** POST /food/label: the photos checked as the door checks them, then read: [status, body]. */
async function labelRead(buf, type) {
  let form;
  try {
    form = await new Response(buf, { headers: { 'content-type': type } }).formData();
  } catch {
    return [400, { error: 'bad_request', message: 'Send the photos as multipart/form-data, in the field photo.' }];
  }
  const photos = form.getAll('photo').filter((p) => typeof p !== 'string');
  if (!photos.length) return [400, { error: 'bad_request', message: 'No photo came with the request.' }];
  if (photos.length > 3) return [400, { error: 'bad_request', message: 'At most 3 photos.' }];
  if (photos.some((p) => !PHOTO_TYPES.includes(p.type))) return [400, { error: SCAN.label_refused.error, message: SCAN.label_refused.message }];
  if (photos.some((p) => p.size === 0)) return [400, { error: 'bad_request', message: 'A photo is empty.' }];
  if (photos.some((p) => p.size > 8 * 1024 * 1024)) return [413, { error: 'too_large', message: 'A photo is too large: at most 8 MB each, 3 photos.' }];
  await new Promise((r) => setTimeout(r, READ_MS));
  if (state.labelFail) {
    state.labelFail = false;
    return [200, { ...SCAN.label_unreadable }];
  }
  // one photo: the table only (the name is on the front); two or three: the whole label
  if (photos.length === 1) return [200, { ...SCAN.label, name: null, brand: null, note: 'The name is not on this photo: add a photo of the front, or type it.' }];
  return [200, { ...SCAN.label }];
}

/** POST /food/labeladd, checked as webfood.label_add: a new food of the catalogue, logged at once with an amount. */
function labelAdd(b) {
  const name = String(b.name ?? '').trim().replace(/\s+/g, ' ');
  if (name.length < 2 || name.length > 120) return rejected('Give the food a name (2 to 120 characters).');
  for (const k of ['kcal', 'protein', 'fat', 'carbs']) {
    if (typeof b[k] !== 'number') return rejected(`Give ${k} per 100 ${b.basis === 'ml' ? 'ml' : 'g'}.`);
  }
  if (b.protein + b.fat + b.carbs > 100) return rejected('Protein, fat and carbs come to more than 100 g per 100: check the values.');
  const unit = b.basis === 'ml' ? 'ml' : 'g';
  const food = { food_id: ++ids, name, unit, amount: 100 };
  CATALOGUE.set(food.food_id, { food_id: food.food_id, name, unit, drink: unit === 'ml', per_100: { kcal: b.kcal, protein: b.protein, fat: b.fat, carbs: b.carbs } });
  state.scanned.set(b.barcode && /^\d{8,14}$/.test(b.barcode) ? b.barcode : `no-code-${food.food_id}`, food);
  if (b.amount === undefined) {
    return { outcome: 'changed', head: `Added ${name} to your catalogue. Scan it again or find it in the Again chips to log it.` };
  }
  if (typeof b.amount !== 'number' || !(b.amount > 0 && b.amount <= 5000)) {
    return { outcome: 'rejected', head: `Added ${name} to your catalogue, not logged.`, reason: 'Give the amount as a number above 0 and at most 5000.' };
  }
  const d = structuredClone(state.day);
  eat(d, name, food.food_id, b.amount, unit, ofFood(food.food_id, b.amount), unit === 'ml');
  if (b.time) d.rows.at(-1).at = `${d.day}T${b.time}:00+01:00`;
  const row = d.rows.at(-1);
  const head = `Added ${name} to your catalogue. Logged it.`;
  state.before = { day: state.day, usual: state.usual };
  state.day = d;
  state.undo = { token: randomBytes(12).toString('base64url'), head, expires_at: new Date(Date.now() + 15 * 60_000).toISOString() };
  const k = row.nutrients;
  return { ...SCAN.saves.labeladd, head, undo: state.undo,
    receipt: [`+ ${row.ref} ${name} ${b.amount} ${unit} | ${k.kcal} kcal, P ${k.protein} | ${ddmm(d.day)} meal ${row.meal} ${b.time ?? hm()}`] };
}

/** POST /lookup: the sample's read-back as a question under Needs you (Yes or No through /answer). */
function lookUp(b) {
  const q0 = b.question_id ? state.day.needs.questions.find((q) => q.id === b.question_id) : null;
  if (b.question_id && !q0) return rejected('That question is closed.');
  const word = String(b.text ?? '').trim() || (q0 ? (/"(.+)"/.exec(q0.text)?.[1] ?? '') : '');
  if (!word) return rejected('Give a name or a barcode to look up.');
  const d = structuredClone(state.day);
  const sample = SCAN.saves.lookup;
  const q = ask(sample.questions[0], null, sample.questions[0].read_back);
  d.needs.questions.unshift(q);
  state.day = d;
  return { ...sample, questions: [q] };
}

// ---- the Habits page (deploy 94) ------------------------------------------------------------------------------------------------

const HB = HABITS.habits.habits;
const HB_ALL = HABITS.habits_all.habits;
const HB_HELP = {
  tracked: HB.help,
  untracked: 'Not tracked: in the database and still loggable in the chat, but not shown on Today. Switch Track on to start.',
  retired: 'Retired: hidden everywhere; the history stays. Bring one back any time.',
  all: HB_ALL.help,
};
const hbWhole = (x) => Number.isInteger(x);
const dmy2 = (iso) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;

/** Every habit of the sample's list (the "all" read) as {…row, on, active, days: {day: n}, older, base30, lastOld}. */
function habitsStart() {
  const cal = new Map(HB.calendar.map((c) => [c.name, c]));
  return HB_ALL.list.flatMap((g) => g.habits).map((h) => {
    const c = cal.get(h.name);
    const days = c ? Object.fromEntries(c.days.filter((d) => d.n).map((d) => [d.day, d.n])) : {};
    const inWindow = Object.values(days).reduce((a, n) => a + n, 0);
    return {
      name: h.name, label: h.label, group: h.group, target: h.target, order: h.order, avoid: h.avoid,
      on: h.state === 'tracked', active: h.state !== 'retired', days,
      older: Math.max(0, h.ticks - inWindow), base30: c ? 0 : h.days30, lastOld: h.last_day,
    };
  });
}

const hbState = (h) => (!h.active ? 'retired' : h.on ? 'tracked' : 'untracked');
const hbTicks = (h) => h.older + Object.values(h.days).reduce((a, n) => a + n, 0);
const hbLast = (h) => Object.keys(h.days).sort().at(-1) ?? h.lastOld;

/** app.'s stats line (habitspage.stats). */
function hbStats(h, today) {
  const ticks = hbTicks(h);
  if (!ticks) return 'Never ticked';
  const last = hbLast(h);
  const when = last.slice(0, 4) === today.slice(0, 4) ? ddmm(last) : dmy2(last);
  const days30 = h.base30 + Object.keys(h.days).length;
  return days30 ? `${days30} of the last 30 days · last ${when}` : `Last ticked ${when}`;
}

/** GET /habits as the door answers: the sample's shape, worked out from the habits as they stand now. */
function habitsOut(show = 'tracked') {
  const today = HB.today;
  const tracked = state.hab.filter((h) => hbState(h) === 'tracked').sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  const now = (h) => h.days[today] ?? 0;
  const days = Array.from({ length: HB.days }, (_, i) => shiftIso(HB.start, i));
  const rows = (h) => ({
    name: h.name, label: h.label, group: h.group, target: h.target, order: h.order, avoid: h.avoid, state: hbState(h),
    ticks: hbTicks(h), days30: h.base30 + Object.keys(h.days).length, last_day: hbLast(h) ?? null, stats: hbStats(h, today),
    can_track: h.active, can_delete: hbTicks(h) === 0,
  });
  const todo = tracked.filter((h) => !h.avoid);
  return {
    today, start: HB.start, days: HB.days, edit_from: HB.edit_from,
    checklist: {
      done: todo.filter((h) => now(h) >= h.target).length, total: todo.length,
      habits: tracked.map((h) => ({ name: h.name, label: h.label, done: now(h), target: h.target, complete: now(h) >= h.target, avoid: h.avoid, last_tick: now(h) ? `t_${h.name}` : null })),
    },
    calendar: tracked.map((h) => ({
      name: h.name, label: h.label, target: h.target, avoid: h.avoid, editable: !state.locked.has(h.name),
      full: days.filter((d) => (h.avoid ? !(h.days[d] ?? 0) : (h.days[d] ?? 0) >= h.target)).length,
      days: days.map((d) => {
        const n = h.days[d] ?? 0;
        const [st, text] = h.avoid ? (n ? ['logged', `${n} logged`] : ['none', 'none']) : n >= h.target ? ['done', 'done'] : n ? ['partly', `${n} of ${h.target}`] : ['none', 'not logged'];
        return { day: d, n, state: st, text };
      }),
    })),
    show, help: HB_HELP[show],
    shows: HB.shows.map((x) => ({ ...x, count: state.hab.filter((h) => x.key === 'all' || hbState(h) === x.key).length })),
    list: HB.groups.map((g) => ({ group: g.key, label: g.label, habits: state.hab.filter((h) => h.group === g.key && (show === 'all' || hbState(h) === show)).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name)).map(rows) })).filter((g) => g.habits.length),
    groups: HB.groups, default_group: HB.default_group, limits: HB.limits,
  };
}

const hbHabit = (name) => state.hab.find((h) => h.name === name);
const hbSave = (before, answer) => {
  // an Undo puts the habits back as they were
  state.before = { day: state.day, usual: state.usual, hab: before };
  if (answer.undo !== null) state.undo = { token: randomBytes(12).toString('base64url'), head: `Saved: ${answer.head}`, expires_at: new Date(Date.now() + 15 * 60_000).toISOString() };
  return { ...answer, ...(answer.undo === null ? {} : { undo: state.undo }) };
};

/** POST /habit with view "habits": Today's button, on the Habits page. */
function habitTick(b) {
  const h = hbHabit(b.name);
  if (!h || hbState(h) !== 'tracked') return rejected('Unknown habit.');
  const before = structuredClone(state.hab);
  const today = HB.today;
  const n = h.days[today] ?? 0;
  if (b.action === 'untick') {
    if (!n) return { outcome: 'unchanged', head: 'Nothing to change.' };
    if (n === 1) delete h.days[today];
    else h.days[today] = n - 1;
    return hbSave(before, { outcome: 'changed', head: `${h.label} unticked.` });
  }
  h.days[today] = n + 1;
  return hbSave(before, { outcome: 'saved', head: `${h.label} ticked.` });
}

/** POST /habit/day, as webactions.habit_day answers. */
async function habitDay(b) {
  if (state.slow) await new Promise((r) => setTimeout(r, state.slow));
  const h = hbHabit(b.name);
  if (!h || hbState(h) !== 'tracked' || state.locked.has(h.name)) return rejected('That habit cannot be changed for a past day here.');
  const day = String(b.day);
  const d = /^\d{4}-\d\d-\d\d$/.test(day) ? new Date(`${day}T12:00:00Z`) : null;
  if (!d || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== day) return rejected('Unknown day.');
  if (day > HB.today || day < HB.edit_from) return rejected('Only the last 30 days can be changed here.');
  const n = h.days[day] ?? 0;
  // the core's key rule for a square: the message carries the time of the click, so a re-sent key never replays; while the day
  // still needs a tick it is refused, once done it is the next click
  if (b.key && state.dayKeys.has(b.key) && n < h.target) return { ...rejected('This idempotency key was already used for a different message.') };
  if (b.key) state.dayKeys.add(b.key);
  const before = structuredClone(state.hab);
  if (n < h.target) {
    h.days[day] = n + 1;
    return hbSave(before, { outcome: 'saved', head: 'Saved.', receipt: [`+ e${++ids} ${h.name} | day ${ddmm(day)} | ${dmy2(day)} (date only)`] });
  }
  delete h.days[day];
  return hbSave(before, { outcome: 'changed', head: `Removed ${n} tick${n === 1 ? '' : 's'} of ${h.label} on ${dmy2(day)}.` });
}

const hbSlug = (label) => label.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
const hbBad = (message) => ({ error: 'bad_request', message });

/** POST /habits/manage: [status, answer]; the core's checks and words (webhabits), no Undo. */
function habitsManage(b) {
  const L = HB.limits;
  const label = String(b.label ?? '').split(/\s+/).filter(Boolean).join(' ');
  if (!['track', 'retire', 'restore', 'edit', 'delete', 'new'].includes(b.action)) return [400, hbBad('action must be track, retire, restore, edit, delete or new.')];
  if (b.action !== 'new' && typeof b.name !== 'string') return [400, hbBad('name is missing.')];
  if (label.length > L.label_max) return [400, hbBad(`label must be at most ${L.label_max} characters.`)];
  if (b.target !== undefined && !(hbWhole(b.target) && b.target >= L.target_min && b.target <= L.target_max)) return [400, hbBad('target must be a whole number from 1 to 10.')];
  if (b.order !== undefined && !(hbWhole(b.order) && b.order >= 0 && b.order <= L.order_max)) return [400, hbBad('order must be a whole number from 0 to 999.')];
  if (b.aim !== undefined && !['do', 'avoid'].includes(b.aim)) return [400, hbBad('aim must be do or avoid.')];
  if (b.action === 'edit' && b.target === undefined) return [400, hbBad('target is missing.')];
  if (b.action === 'track' && typeof b.on !== 'boolean') return [400, hbBad('on must be true or false.')];
  if (b.action === 'new' && b.track !== undefined && typeof b.track !== 'boolean') return [400, hbBad('track must be true or false.')];
  const h = b.action === 'new' ? null : hbHabit(b.name);
  if (b.action !== 'new' && !h) return [200, rejected('Unknown habit.')];
  const before = structuredClone(state.hab);
  let head;
  if (b.action === 'track') {
    if (!h.active) return [200, rejected(`${h.label} is retired: bring it back first.`)];
    if (b.on) {
      h.order = Math.min(Math.max(0, ...state.hab.filter((x) => x.on).map((x) => x.order)) + 10, L.order_max);
      h.on = true;
      head = `Now tracking ${h.label}. It shows on Today and in the calendar.`;
    } else {
      h.on = false;
      head = `Stopped tracking ${h.label}. Its history stays and you can still log it in the chat.`;
    }
  } else if (b.action === 'retire') {
    h.active = false;
    head = `Retired ${h.label}. Its history stays; it is hidden everywhere. Find it under Retired to bring it back.`;
  } else if (b.action === 'restore') {
    h.active = true;
    head = `Brought back ${h.label}` + (h.on ? ' (tracked again).' : ' (not tracked: switch Track on to start).');
  } else if (b.action === 'edit') {
    if (!label) return [200, rejected('A habit needs a name to show.')];
    if (state.hab.some((x) => x.name !== h.name && x.label.toLowerCase() === label.toLowerCase())) return [200, rejected(`There is already a log type called ${label}.`)];
    [h.label, h.target] = [label, b.target];
    if (b.order !== undefined) h.order = b.order;
    if (b.aim) h.avoid = b.aim === 'avoid';
    head = `Saved the habit ${label}.`;
  } else if (b.action === 'delete') {
    if (b.confirmed !== true) return [200, rejected('Press Yes, delete to delete a habit.')];
    if (hbTicks(h)) return [200, rejected(`${h.label} has history, so it cannot be deleted. Retire it instead.`)];
    state.hab.splice(state.hab.indexOf(h), 1);
    head = `Deleted the habit ${h.label}.`;
  } else {
    const name = hbSlug(label);
    if (!label || !name) return [200, rejected('Give the habit a name with letters or digits.')];
    const group = b.group ?? 'daily';
    if (!HB.groups.some((g) => g.key === group)) return [200, rejected('Choose a group for the habit.')];
    const old = state.hab.find((x) => x.name === name || x.label.toLowerCase() === label.toLowerCase());
    if (old) return [200, rejected(`There is already a log type called ${label}` + (old.active ? '' : ' (retired: bring it back from the Retired list)') + '.')];
    state.hab.push({ name, label, group, target: b.target ?? 1, order: Math.min(Math.max(0, ...state.hab.map((x) => x.order)) + 10, L.order_max), avoid: false, on: b.track === true, active: true, days: {}, older: 0, base30: 0, lastOld: null });
    head = `Added the habit ${label}. ` + (b.track === true ? 'It is tracked: tick it above or log it by its name.' : 'It is in the list, not tracked yet: switch Track on to start.');
  }
  state.before = null;
  state.undo = null; // the list's forms have no Undo, and the session's earlier one goes (as app.)
  void before;
  return [200, { outcome: 'changed', head, undo: null }];
}


// ---- the Gym's Workout page (deploy 96) --------------------------------------------------------------------------------------

const GW = GYM.gym.gym;
const GPL = GYM.plan.gym_plan;
const GEX = GYM.exercises.gym_exercises;
const KINDS = { weights: 'Weights', bodyweight: 'Bodyweight', cardio: 'Machine cardio' };
const GDEFAULT = { weights: { sets: 3, reps: 8, kg: null, minutes: null, km: null }, bodyweight: { sets: 3, reps: 10, kg: null, minutes: null, km: null }, cardio: { sets: null, reps: null, kg: null, minutes: 20, km: null } };
const GVALS = ['sets', 'reps', 'kg', 'minutes', 'km'];
const gnum = (x) => String(+x);
function gfmt(kind, v) {
  if (kind === 'cardio') return [v.minutes != null ? `${gnum(v.minutes)} min` : '', v.km != null ? `${gnum(v.km)} km` : ''].filter(Boolean).join(' · ');
  return (v.sets && v.reps ? `${v.sets} × ${v.reps}` : '') + (kind === 'weights' && v.kg != null ? ` at ${gnum(v.kg)} kg` : '');
}
const gpick = (v) => Object.fromEntries(GVALS.map((k) => [k, v[k] ?? null]));

/** The exercises (the Exercises sample's list, with each one's last session from the Workout sample), today's rows, the plan's days. */
function gymStart() {
  const rows = new Map([...GW.exercises, ...GW.other].map((r) => [r.exercise_id, r]));
  const days = [...GPL.days.map((d) => ({ id: d.day_id, name: d.name, active: true })), ...GPL.removed.map((d) => ({ id: d.day_id, name: d.name, active: false }))];
  return {
    ex: GEX.exercises.map((e) => ({ id: e.exercise_id, name: e.name, kind: e.kind, active: e.active, words: [...e.words], n: e.workouts, lastDay: e.last_day, last: rows.get(e.exercise_id)?.last ?? null, lastText: rows.get(e.exercise_id)?.last_text ?? null })),
    logs: [...rows.values()].flatMap((r) => r.logged.map((s) => ({ ...s, exercise_id: r.exercise_id }))),
    days,
    plan: new Map([...GPL.days.map((d) => [d.day_id, d.items.map((i) => ({ item_id: i.item_id, exercise_id: i.exercise_id, sets: i.sets, reps: i.reps }))]), ...GPL.removed.map((d) => [d.day_id, []])]),
    day: GW.day.day_id, auto: GW.day.day_id, startedAt: GW.started_at, setIds: 100, itemIds: 100, dayIds: 100, done: new Map(),
  };
}

/** The active days in order, labelled as the core does: "Day 1 · Push". */
const gActive = () => state.gym.days.filter((d) => d.active);
const gDay = (id) => state.gym.days.find((d) => d.id === id);
const gDayLabel = (d) => `Day ${gActive().indexOf(d) + 1} · ${d.name}`;
const gLabel = (id) => (id === null || !gDay(id) ? 'Free workout' : gDayLabel(gDay(id)));
const gDayName = (id) => gDay(id)?.name;

/** gym.values: the numbers of one row checked for the exercise's kind; a string is the refusal. */
function gValues(kind, b) {
  const num = (k, lo, hi, whole = false) => {
    const v = b[k];
    if (v === null || v === undefined || v === '') return null;
    if (typeof v !== 'number' || v < lo || v > hi || (whole && !Number.isInteger(v))) throw GW.numbers;
    return v;
  };
  try {
    if (kind === 'cardio') {
      const [minutes, km] = [num('minutes', 0.1, 600), num('km', 0, 200)];
      return minutes === null ? 'Give the minutes.' : { sets: null, reps: null, kg: null, minutes, km };
    }
    const [sets, reps, kg] = [num('sets', 1, 50, true), num('reps', 1, 500, true), kind === 'weights' ? num('kg', 0, 1000) : null];
    if (sets === null || reps === null) return 'Give sets and reps.';
    if (kind === 'weights' && kg === null) return 'Give the weight in kg.';
    return { sets, reps, kg, minutes: null, km: null };
  } catch (reason) {
    return reason;
  }
}

/** One row as gympage.row_data makes it. */
function gRow(x, plan, first) {
  const g = state.gym;
  const mine = g.logs.filter((s) => s.exercise_id === x.id);
  const prev = x.last?.rows ?? [];
  const top = prev.length ? prev.reduce((a, r) => ((r.kg ?? 0) > (a.kg ?? 0) || ((r.kg ?? 0) === (a.kg ?? 0) && (r.minutes ?? 0) > (a.minutes ?? 0)) ? r : a)) : null;
  let pre = mine.at(-1) ?? top;
  const values = pre ? gpick(pre) : { ...GDEFAULT[x.kind] };
  if (!pre && plan?.sets && x.kind !== 'cardio') Object.assign(values, { sets: plan.sets, reps: plan.reps });
  if (!pre && typeof gValues(x.kind, values) !== 'string') pre = values;
  let up = null;
  if (mine.length && prev.length && x.kind === 'weights') {
    const [now, then] = [Math.max(...mine.map((r) => r.kg ?? 0)), Math.max(...prev.map((r) => r.kg ?? 0))];
    if (now > then) up = now - then;
  }
  return {
    exercise_id: x.id, name: x.name, kind: x.kind, active: x.active, done: mine.length > 0,
    logged: mine.map(({ exercise_id: _e, ...s }) => s), values, ready: !!pre,
    text: mine.length ? mine.map((s) => s.text).join(', ') : pre ? gfmt(x.kind, values) : 'first time: set the numbers',
    up_kg: up, last: x.last, last_text: x.last ? x.lastText : 'Not done before' + (plan?.sets ? ` · plan ${plan.sets} × ${plan.reps}` : ''),
    plan: plan ? { item_id: plan.item_id, sets: plan.sets, reps: plan.reps } : null, open: !(pre || mine.length || !first),
  };
}

/** GET /gym as the door answers: the sample's shape, worked out from the exercises and today's rows as they stand now. */
function gymOut() {
  const g = state.gym;
  const started = g.logs.length > 0;
  const doneIds = new Set(g.logs.map((s) => s.exercise_id));
  const free = g.day === null;
  let shown;
  let rest = [];
  if (!free) {
    const plan = g.plan.get(g.day) ?? [];
    const pids = new Set(plan.map((i) => i.exercise_id));
    const byId = new Map(g.ex.map((x) => [x.id, x]));
    const list = plan.map((i) => byId.get(i.exercise_id)).filter((x) => x && (x.active || doneIds.has(x.id)));
    list.push(...g.ex.filter((x) => doneIds.has(x.id) && !pids.has(x.id)));
    const newId = list.find((x) => !doneIds.has(x.id) && !x.last)?.id;
    shown = list.map((x) => gRow(x, plan.find((i) => i.exercise_id === x.id) ?? null, x.id === newId));
    rest = g.ex.filter((x) => x.active && !list.includes(x)).map((x) => gRow(x, null, false));
  } else {
    shown = g.ex.filter((x) => x.active || doneIds.has(x.id)).map((x) => gRow(x, null, true));
  }
  const hand = free || g.day !== g.auto;
  const weeks = structuredClone(GW.weeks);
  const now = weeks.weeks.at(-1);
  now.days.find((d) => d.today).on = started;
  now.n = now.days.filter((d) => d.on).length;
  weeks.good = weeks.weeks.filter((w) => w.n >= 2).length;
  return {
    ...GW,
    title: free ? 'Free workout' : gLabel(g.day),
    started_at: started ? g.startedAt : null,
    done: doneIds.size,
    status: started ? `started ${hm(new Date(g.startedAt))} · ${doneIds.size} done` : 'not started: the first tick starts it',
    day: free ? null : { day_id: g.day, name: gDayName(g.day), label: gLabel(g.day) },
    free, picked_by_hand: hand,
    has_split: gActive().length > 0,
    chips: gActive().length ? [...gActive().map((d) => ({ day_id: d.id, label: gDayLabel(d), on: d.id === g.day })), { day_id: null, label: 'Free workout', on: g.day === null }] : [],
    why: free ? 'Free workout: all your exercises.' : hand ? `Picked by you instead of ${gLabel(g.auto)}.` : started ? 'Today’s day. Tap another day to switch.' : 'Your 1st workout this week: the first day not done yet. Tap another day to switch.',
    exercises: shown, other: rest,
    empty: shown.length ? null : free ? 'No exercises yet: add your first one below.' : 'No exercises on this day yet: add them on the Plan tab.',
    hint: shown.length || rest.length ? GW.hint : null,
    week_split: gActive().map((d) => ({
      day_id: d.id, label: gDayLabel(d), today: d.id === g.day, done: g.done.get(d.id) ?? null,
      exercises: g.plan.get(d.id).map((i) => g.ex.find((x) => x.id === i.exercise_id)).filter((x) => x?.active).map((x) => x.name).join(', '),
    })),
    weeks,
    retired: g.ex.filter((x) => !x.active).map((x) => x.name),
  };
}

/** A gym save with Undo (a tick, a remove): the gym and the day as they were, and the head of its undo. */
const gymSave = (before, answer, undoHead) => {
  state.before = { day: state.day, usual: state.usual, gym: before, gymUndo: undoHead };
  state.undo = { token: randomBytes(12).toString('base64url'), head: answer.head, expires_at: new Date(Date.now() + 15 * 60_000).toISOString() };
  return { ...answer, undo: state.undo };
};
/** A gym save without Undo (pick, new): the session's earlier Undo goes, as on app. */
const gymPlain = (answer) => {
  state.before = null;
  state.undo = null;
  return { ...answer, undo: null };
};

/** POST /gym/<action>: [status, answer]; the core's checks and words (gym.py). */
function gymAction(action, b) {
  const g = state.gym;
  const isId = (v) => Number.isInteger(v) && v >= 1;
  if (action === 'tick') {
    if (!isId(b.exercise_id)) return [400, { error: 'bad_request', message: 'exercise_id must be a number.' }];
    for (const k of GVALS) if (b[k] !== undefined && b[k] !== null && typeof b[k] !== 'number') return [400, { error: 'bad_request', message: `${k} must be a number.` }];
    const x = g.ex.find((e) => e.id === b.exercise_id);
    if (!x) return [200, rejected('Unknown exercise.')];
    const v = gValues(x.kind, b);
    if (typeof v === 'string') return [200, rejected(v)];
    const before = structuredClone(g);
    if (!g.logs.length) g.startedAt = new Date().toISOString();
    const text = gfmt(x.kind, v);
    g.logs.push({ set_id: ++g.setIds, ...v, text, exercise_id: x.id });
    return [200, gymSave(before, { outcome: 'saved', head: `Saved: ${x.name} ${text}` }, "Undone: the exercise is off today's workout.")];
  }
  if (action === 'remove') {
    const hasSet = b.set_id !== undefined && b.set_id !== null;
    if (hasSet === (b.exercise_id !== undefined && b.exercise_id !== null)) return [400, { error: 'bad_request', message: "Send set_id (one row) or exercise_id (all of today's rows of it)." }];
    const gone = g.logs.filter((s) => (hasSet ? s.set_id === b.set_id : s.exercise_id === b.exercise_id));
    if (!gone.length) return [200, rejected("That is not in today's workout.")];
    const before = structuredClone(g);
    g.logs = g.logs.filter((s) => !gone.includes(s));
    const said = gone.map((s) => `${g.ex.find((x) => x.id === s.exercise_id).name} ${s.text}`).join(', ');
    return [200, gymSave(before, { outcome: 'changed', head: `Removed: ${said}`.slice(0, 160) }, "Undone: it is back in today's workout.")];
  }
  if (action === 'pick') {
    if (!('day_id' in b)) return [400, { error: 'bad_request', message: 'day_id is missing (null = Free workout).' }];
    if (b.day_id !== null && !gDay(b.day_id)?.active) return [200, rejected('Unknown day.')];
    g.day = b.day_id;
    return [200, gymPlain({ outcome: 'changed', head: `Today: ${b.day_id === null ? 'Free workout' : gLabel(b.day_id)}.` })];
  }
  if (action === 'new') {
    const name = String(b.name ?? '').split(/\s+/).filter(Boolean).join(' ');
    if (name.length > 60) return [400, { error: 'bad_request', message: 'name must be 60 characters or fewer.' }];
    if (!name) return [200, rejected("Type the exercise's name.")];
    const onToday = (id) => {
      if (b.today !== true || g.day === null) return '';
      const items = g.plan.get(g.day);
      if (items.some((i) => i.exercise_id === id)) return '';
      items.push({ item_id: ++g.itemIds, exercise_id: id, sets: null, reps: null });
      return ` It is on today’s ${gDayName(g.day)} now.`;
    };
    const old = g.ex.find((x) => x.name.toLowerCase() === name.toLowerCase());
    if (old?.active) return [200, rejected(`${old.name} is already in your list.`)];
    if (old) {
      old.active = true;
      return [200, gymPlain({ outcome: 'changed', head: `${old.name} is back in your list (${KINDS[old.kind].toLowerCase()}).${onToday(old.id)}` })];
    }
    if (!KINDS[b.kind]) return [200, rejected('Pick weights, bodyweight or machine cardio.')];
    const words = (Array.isArray(b.words) ? b.words : []).map((w) => String(w).split(/\s+/).filter(Boolean).join(' ').slice(0, 40)).filter(Boolean).slice(0, 10);
    const x = { id: Math.max(0, ...g.ex.map((e) => e.id)) + 1, name, kind: b.kind, active: true, words, n: 0, lastDay: null, last: null, lastText: null };
    g.ex.push(x);
    return [200, gymPlain({ outcome: 'changed', head: `Added ${name} (${KINDS[b.kind].toLowerCase()}).${onToday(x.id)}` })];
  }
  // ---- the Plan and Exercises parts (deploy 97) ----
  const planNumbers = () => {
    const ok = (v, hi) => v === null || v === undefined || (typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= hi);
    if (!ok(b.sets, 50) || !ok(b.reps, 500)) return "Numbers only: sets 1 to 50, reps 1 to 500.";
    if ((b.sets == null) !== (b.reps == null)) return 'Give both sets and reps, or neither.';
    return null;
  };
  const itemOf = (id) => {
    for (const [day, items] of g.plan) {
      const i = items.find((x) => x.item_id === id);
      if (i) return { day, items, i };
    }
    return null;
  };
  const xName = (id) => g.ex.find((x) => x.id === id)?.name;
  if (action === 'itemset') {
    if (!isId(b.item_id)) return [400, { error: 'bad_request', message: 'item_id must be a number.' }];
    const why = planNumbers();
    if (why) return [200, rejected(why)];
    const at = itemOf(b.item_id);
    if (!at) return [200, rejected('That is not on a day any more.')];
    at.i.sets = b.sets ?? null;
    at.i.reps = b.reps ?? null;
    return [200, gymPlain({ outcome: 'changed', head: `${xName(at.i.exercise_id)}: plan ${gfmt('bodyweight', at.i) || 'without numbers'}.` })];
  }
  if (action === 'itemmove') {
    if (!isId(b.item_id)) return [400, { error: 'bad_request', message: 'item_id must be a number.' }];
    if (!['up', 'down'].includes(b.dir)) return [400, { error: 'bad_request', message: 'dir must be up or down.' }];
    const at = itemOf(b.item_id);
    if (!at) return [200, rejected('That is not on a day any more.')];
    const k = at.items.indexOf(at.i);
    const to = b.dir === 'up' ? k - 1 : k + 1;
    if (to >= 0 && to < at.items.length) [at.items[k], at.items[to]] = [at.items[to], at.items[k]];
    return [200, gymPlain({ outcome: 'changed', head: `Moved ${xName(at.i.exercise_id)} ${b.dir}.` })];
  }
  if (action === 'itemremove') {
    if (!isId(b.item_id)) return [400, { error: 'bad_request', message: 'item_id must be a number.' }];
    const at = itemOf(b.item_id);
    if (!at) return [200, rejected('That is not on a day any more.')];
    const before = structuredClone(g);
    at.items.splice(at.items.indexOf(at.i), 1);
    const [name, day] = [xName(at.i.exercise_id), gDayName(at.day)];
    return [200, gymSave(before, { outcome: 'changed', head: `Took ${name} off ${day}.` }, `Undone: ${name} is back on ${day}.`)];
  }
  if (action === 'itemadd') {
    if (!isId(b.day_id) || !isId(b.exercise_id)) return [400, { error: 'bad_request', message: 'day_id and exercise_id must be numbers.' }];
    const why = planNumbers();
    if (why) return [200, rejected(why)];
    const d = gDay(b.day_id);
    const x = g.ex.find((e) => e.id === b.exercise_id && e.active);
    if (!d?.active || !x) return [200, rejected('Pick a day and one of your exercises.')];
    const items = g.plan.get(d.id);
    if (items.some((i) => i.exercise_id === x.id)) return [200, rejected(`${x.name} is already on ${d.name}.`)];
    items.push({ item_id: ++g.itemIds, exercise_id: x.id, sets: b.sets ?? null, reps: b.reps ?? null });
    return [200, gymPlain({ outcome: 'changed', head: `Added ${x.name} to ${d.name}.` })];
  }
  const tidyName = (v, max) => String(v ?? '').split(/\s+/).filter(Boolean).join(' ').slice(0, max);
  if (action === 'daynew') {
    if (typeof b.name === 'string' && b.name.length > 40) return [400, { error: 'bad_request', message: 'name must be 40 characters or fewer.' }];
    const name = tidyName(b.name, 40);
    if (!name) return [200, rejected("Type the day's name, e.g. Push.")];
    if (gActive().some((d) => d.name.toLowerCase() === name.toLowerCase())) return [200, rejected(`${name} is already a day of your split.`)];
    const d = { id: ++g.dayIds, name, active: true };
    g.days.push(d);
    g.plan.set(d.id, []);
    return [200, gymPlain({ outcome: 'changed', head: `Added ${gDayLabel(d)}. Add its exercises below.` })];
  }
  if (action === 'dayedit') {
    if (!isId(b.day_id)) return [400, { error: 'bad_request', message: 'day_id must be a number.' }];
    const name = tidyName(b.name, 40);
    if (!name) return [200, rejected("Type the day's name.")];
    const d = gDay(b.day_id);
    if (!d) return [200, rejected('Unknown day.')];
    d.name = name;
    return [200, gymPlain({ outcome: 'changed', head: `Renamed to ${name}.` })];
  }
  if (action === 'dayactive') {
    if (!isId(b.day_id) || typeof b.on !== 'boolean') return [400, { error: 'bad_request', message: 'day_id must be a number and on true or false.' }];
    const d = gDay(b.day_id);
    if (!d) return [200, rejected('Unknown day.')];
    d.active = b.on;
    if (b.on) g.days.push(...g.days.splice(g.days.indexOf(d), 1));
    else for (const k of ['day', 'auto']) if (g[k] === d.id) g[k] = gActive()[0]?.id ?? null;
    return [200, gymPlain({ outcome: 'changed', head: b.on ? `${d.name} is back in your split.` : `Removed ${d.name} from your split. Past workouts keep its name; "Removed days" below brings it back.` })];
  }
  if (action === 'rename') {
    if (!isId(b.exercise_id)) return [400, { error: 'bad_request', message: 'exercise_id must be a number.' }];
    const name = tidyName(b.name, 60);
    if (!name) return [200, rejected("Type the exercise's name.")];
    const x = g.ex.find((e) => e.id === b.exercise_id);
    if (!x) return [200, rejected('Unknown exercise.')];
    if (name === x.name) return [200, rejected(`It is called ${name} already.`)];
    const o = g.ex.find((e) => e.id !== x.id && e.name.toLowerCase() === name.toLowerCase());
    if (o) return [200, rejected(o.active ? `${o.name} is already in your list.` : `A retired exercise is called ${o.name}.`)];
    const old = x.name;
    x.words = x.words.filter((w) => w.toLowerCase() !== name.toLowerCase());
    if (old.toLowerCase() !== name.toLowerCase() && !x.words.some((w) => w.toLowerCase() === old.toLowerCase())) x.words = [...x.words.slice(0, 9), old];
    x.name = name;
    return [200, gymPlain({ outcome: 'changed', head: `Renamed ${old} to ${name}. Its history moved with it.` })];
  }
  if (action === 'active') {
    if (!isId(b.exercise_id) || typeof b.on !== 'boolean') return [400, { error: 'bad_request', message: 'exercise_id must be a number and on true or false.' }];
    const x = g.ex.find((e) => e.id === b.exercise_id);
    if (!x) return [200, rejected('Unknown exercise.')];
    x.active = b.on;
    return [200, gymPlain({ outcome: 'changed', head: b.on ? `${x.name} is back in your list.` : `Retired ${x.name}. Its history stays.` })];
  }
  return [404, { error: 'not_found', message: 'Not found.' }];
}

/** GET /gym/plan as the door answers: the sample's words and limits, the days and items as they stand now. */
function planOut() {
  const g = state.gym;
  const byId = new Map(g.ex.map((x) => [x.id, x]));
  const days = gActive().map((d) => {
    const items = g.plan.get(d.id).map((i) => {
      const x = byId.get(i.exercise_id);
      return { item_id: i.item_id, exercise_id: x.id, name: x.name, kind: x.kind, active: x.active, sets: i.sets, reps: i.reps,
        text: KINDS[x.kind] + (i.sets ? ` · plan ${i.sets} × ${i.reps}` : '') + (x.active ? '' : ' · retired') };
    });
    const on = new Set(items.map((i) => i.exercise_id));
    return { day_id: d.id, name: d.name, label: gDayLabel(d), today: d.id === g.day, items,
      can_add: g.ex.filter((x) => x.active && !on.has(x.id)).map((x) => ({ exercise_id: x.id, name: x.name })) };
  });
  const done = [...g.done].map(([id, day]) => ({ day_id: id, label: gLabel(id), day })).filter((x) => gDay(x.day_id)?.active);
  const today = g.day === null ? null : { day_id: g.day, name: gDayName(g.day), label: gLabel(g.day) };
  const week = (done.length ? `This week: ${done.map((x) => `${x.label} on ${new Date(`${x.day}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' })}`).join(', ')} done. ` : '')
    + (today ? `Today: ${today.label}.` : days.length ? 'Today: Free workout.' : '');
  return { ...GPL, week: days.length ? week : null, done, day: today, free: days.length > 0 && g.day === null, days,
    removed: g.days.filter((d) => !d.active).map((d) => ({ day_id: d.id, name: d.name })) };
}

/** GET /gym/exercises as the door answers. */
function exercisesOut() {
  const g = state.gym;
  const use = (x) => (x.n ? `${x.n} workout${x.n === 1 ? '' : 's'}, last ${x.lastDay.slice(8, 10)}.${x.lastDay.slice(5, 7)}.` : 'not done yet');
  return { ...GEX, active: g.ex.filter((x) => x.active).length,
    exercises: g.ex.map((x) => ({ exercise_id: x.id, name: x.name, kind: x.kind, kind_label: KINDS[x.kind], words: x.words, active: x.active,
      workouts: x.n, last_day: x.lastDay, use: use(x), meta: [KINDS[x.kind], x.words.length ? `also: ${x.words.join(', ')}` : '', use(x)].filter(Boolean).join(' · ') })) };
}

const WD = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' });
const DM = (iso) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.`;
const addDays = (iso, n) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86400_000).toISOString().slice(0, 10);

/** GET /gym/progress?x=: the sample's own exercise as it is; another one's six weekly sessions are made here from its kind. */
function progressOut(x) {
  const P = GYM.progress.gym_progress;
  const g = state.gym;
  if (state.gymEmpty) return { ...P, exercises: [], exercise: null, per_week: { weeks: P.per_week.weeks.map((w) => ({ ...w, n: 0 })), top: 3, good: 0 } };
  const shown = P.exercises.filter((c) => g.ex.some((e) => e.id === c.exercise_id));
  const pick = shown.find((c) => c.exercise_id === Number(x)) ?? shown[0];
  const chips = shown.map((c) => ({ ...c, on: c.exercise_id === pick.exercise_id }));
  if (pick.exercise_id === P.exercise.exercise_id) return { ...P, exercises: chips };
  const e = g.ex.find((q) => q.id === pick.exercise_id);
  const [unit, title, base, step] = { weights: ['kg', 'top weight', 30, 2.5], bodyweight: ['reps', 'most reps in a set', 8, 1], cardio: ['min', 'longest session', 15, 2] }[e.kind];
  const dates = [0, 1, 2, 3, 4, 5].map((i) => addDays(P.today, -7 * (5 - i) - (i % 2)));
  const rowOf = (v) => (e.kind === 'weights' ? { sets: 3, reps: 8, kg: v, minutes: null, km: null, text: `3 × 8 at ${v} kg` }
    : e.kind === 'bodyweight' ? { sets: 3, reps: v, kg: null, minutes: null, km: null, text: `3 × ${v}` } : { sets: null, reps: null, kg: null, minutes: v, km: null, text: `${v} min` });
  const vals = dates.map((_, i) => base + i * step);
  const sessions = dates.map((d, i) => ({ day: d, v: vals[i], row: { set_id: 700 + i, ...rowOf(vals[i]) } }));
  const [first, last] = [sessions[0], sessions.at(-1)];
  const pts = sessions.map((q) => [Math.round((Date.parse(`${q.day}T12:00:00Z`) - Date.parse(`${P.start}T12:00:00Z`)) / 86400_000), q.v, `${WD(q.day)} ${DM(q.day)}: ${q.row.text}`]);
  const orm = e.kind === 'weights' ? Math.round(last.v * (1 + 8 / 30)) : null;
  return { ...P, exercises: chips, exercise: { exercise_id: e.id, name: e.name, kind: e.kind }, unit, title, top: last.v,
    top_reps: e.kind === 'weights' ? 8 : null, top_text: `${last.v} ${unit}`, change: `+${last.v - first.v} ${unit} since ${DM(first.day)}`, one_rep_max: orm,
    sub: orm ? `Top set ${last.v} kg × 8 · estimated 1-rep max ≈ ${orm} kg` : `Last session ${WD(last.day)} ${DM(last.day)}`,
    chart: { start: P.start, days: P.weeks * 7, label: `${e.name}: ${title} in ${unit}`, decimals: 1, series: [{ mark: 'line', cls: 'a', pts }, { mark: 'dot', cls: 'a', pts }] },
    recent: [...sessions].reverse().map((q) => ({ day: q.day, text: q.row.text, rows: [q.row] })) };
}

/** GET /gym/activity?day=: the sample's day for any day; today has a watch workout that matches today's workout. */
function activityOut(day) {
  const A = GYM.activity.gym_activity;
  if (state.watchNone) return structuredClone(GYM.activity_none.gym_activity);
  const today = A.today;
  const d = day && day < today ? day : today;
  const out = structuredClone(A);
  out.day = d;
  out.label = d === today ? 'Today' : d === addDays(today, -1) ? 'Yesterday' : `${WD(d)} ${DM(d)}`;
  out.prev_day = addDays(d, -1);
  out.next_day = d === today ? null : addDays(d, 1);
  const first = addDays(d, -6);
  const k = Date.parse(`${d}T12:00:00Z`) / 86400_000 % 7;
  for (const c of out.charts) {
    c.chart.start = first;
    const v = (i) => (c.id === 'steps' ? 1800 + ((i + k) % 5) * 700 : c.id === 'sleep' ? 6.5 + ((i + k) % 4) * 0.5 : 56 + ((i + k) % 4));
    const text = (i, val) => `${WD(addDays(first, i))} ${DM(addDays(first, i))}: ${c.id === 'steps' ? `${val} steps` : c.id === 'sleep' ? `${val} h` : `${val} bpm`}`;
    const pts = [0, 1, 2, 3, 4, 5, 6].map((i) => [i, v(i), text(i, v(i))]);
    for (const sr of c.chart.series) sr.pts = pts;
  }
  const h = new Date(Date.now());
  out.workouts = d === today ? [{ name: 'Traditional Strength Training', start_at: `${d}T18:15:00+01:00`, end_at: `${d}T19:20:00+01:00`, minutes: 65, kcal: 310, hr_avg: 118, km: null,
    meta: '65 min · 310 kcal · avg 118 bpm', matches: GW.day ? gLabel(state.gym.day) : 'Free workout' }] : [];
  void h;
  return out;
}

/**
 * GET /gym/history?w=: the sample (none while the stand-in is empty); with w (deploy 107) a workout the last 60 do not hold comes in its place
 * by date, as an older one (Pull day, 02.04.2026, one exercise).
 */
const historyOut = (w) => {
  const list = state.gymEmpty ? [] : GYM.history.gym_history.workouts;
  if (state.gymEmpty || w === null || list.some((x) => String(x.workout_id) === w)) return { workouts: list };
  const old = { workout_id: Number(w), anchor: `w${w}`, day: '2026-04-02', split_day_id: null, split: 'Pull day', started_at: '2026-04-02T18:00:00+02:00', ended_at: '2026-04-02T18:40:00+02:00',
    when: '18:00–18:40', exercises: [{ exercise_id: 99, name: 'Rowing', kind: 'weights', text: '3 × 8 at 24 kg', rows: [{ set_id: 9000 + Number(w), sets: 3, reps: 8, kg: 24, minutes: null, km: null, text: '3 × 8 at 24 kg' }] }] };
  const at = list.findIndex((x) => x.day < old.day);
  return { workouts: at < 0 ? [...list, old] : [...list.slice(0, at), old, ...list.slice(at)] };
};

/** The read a gym save answers with when the body names none (docs/API.md): its tab's. */
const gymView = (action, b) =>
  ['daynew', 'dayedit', 'dayactive', 'itemadd', 'itemset', 'itemmove', 'itemremove'].includes(action) ? 'gym_plan'
  : ['rename', 'active'].includes(action) || (action === 'new' && b.today !== true) ? 'gym_exercises' : 'gym';

// ---- Home (deploy 99): Now, Pick and Today's card, from tests/samples/home.json -------------------------------------------------

const HM = read('home.json');
const HM_NOW = HM.home.home;
const HM_TODAY = HM_NOW.today;
const HM_HOURS = [5, 15, 30, 60];
/** The chores' own steps and how-to and the zones' spots (Edit zones' sample), for the jobs of the Pick page. */
const HM_EDIT = HM.edit.home_edit;
const HM_CHORE = new Map([...HM_EDIT.flat, ...HM_EDIT.zones.flatMap((z) => z.chores)].map((c) => [c.chore_id, c]));
const HM_SPOTS = new Map(HM_EDIT.zones.map((z) => [z.zone_id, z.spots]));

/** home.age_text and interval_text (the door's words). */
function hmAge(days) {
  if (days === null) return 'not logged yet';
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 14) return `${days} days ago`;
  if (days < 56) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 365) { const n = Math.floor(days / 30); return `${n} month${n === 1 ? '' : 's'} ago`; }
  const n = Math.floor(days / 365);
  return `${n} year${n === 1 ? '' : 's'} ago`;
}
const hmNoon = (ago) => `${shiftIso(HM_TODAY, -ago)}T12:00:00+01:00`;

/** home.interval_text and age_short (the door's words). */
function hmInterval(days) {
  if (days === 1) return 'daily';
  if (days === 7) return 'weekly';
  if (days === 30) return 'monthly';
  if (days === 365) return 'yearly';
  if (days === 730) return 'every 2 years';
  if (days % 30 === 0 && days <= 360) return `every ${days / 30} months`;
  if (days % 7 === 0) return `every ${days / 7} weeks`;
  return `every ${days} days`;
}
function hmAgeShort(days) {
  if (days === null) return 'not yet';
  if (days <= 0) return 'today';
  if (days < 14) return days > 1 ? `${days} days` : '1 day';
  if (days < 56) return `${Math.floor(days / 7)} wk`;
  if (days < 365) return `${Math.floor(days / 30)} mo`;
  return `${Math.floor(days / 365)} yr`;
}
const hmAgo = (day) => Math.round((Date.parse(`${HM_TODAY}T12:00:00Z`) - Date.parse(`${day}T12:00:00Z`)) / 86400_000);

/** The zones and chores of Edit zones' sample (every zone and chore, retired ones too), as the stand-in keeps them; the pairs come from them. */
function homeStart() {
  const cfg = {
    goal: HM_EDIT.goal,
    zones: HM_EDIT.zones.map(({ chores: _c, count: _n, ...z }) => ({ ...z })),
    chores: [...HM_EDIT.flat, ...HM_EDIT.zones.flatMap((z) => z.chores)].map((c) => ({
      chore_id: c.chore_id, name: c.name, zone_id: c.zone_id, active: c.active, interval: c.interval, minutes: c.minutes, steps: [...c.steps], howto: c.howto, words: [...c.words],
      off: (c.per_zone ?? []).filter((p) => !p.on).map((p) => p.zone_id),
      days: Object.fromEntries((c.per_zone ?? []).filter((p) => p.days !== null).map((p) => [p.zone_id, p.days])),
      mins: Object.fromEntries((c.per_zone ?? []).filter((p) => p.minutes !== null).map((p) => [p.zone_id, p.minutes])),
    })),
    nextZone: 5, nextChore: 9,
  };
  // every done row of the History sample, by the pair it belongs to (newest first), and the History entries themselves
  const recent = HM.history.home_history.days.flatMap((d) => structuredClone(d.rows));
  const gone = {};
  for (const e of recent) {
    e.zones.forEach((zn, i) => {
      const z = cfg.zones.find((x) => x.name === zn);
      (gone[hmKey(e.chore_id, z.zone_id)] ??= []).push({ ago: hmAgo(e.day), at: e.at, id: e.ids[i] ?? e.ids[0] });
    });
  }
  const h = { pairs: [], gone, cfg, unknown: [], skips: new Set(), recent, week: structuredClone(HM_NOW.week), timer: null, timerIds: 0, doneIds: 100, empty: false };
  hmSync(h);
  return h;
}
/** Every active chore in every zone it is done in, in a zone's place order (Dust first, own chores, then the other whole-flat ones); a pair keeps its done rows. */
function hmSync(h) {
  const cfg = h.cfg;
  const prev = new Map(Object.entries(h.gone));
  for (const p of h.pairs) prev.set(hmKey(p.chore_id, p.zone_id), p.done);
  const place = (c) => (c.zone_id === null ? (c.name.toLowerCase().startsWith('dust') ? 0 : 2) : 1);
  const pairs = [];
  for (const z of cfg.zones.filter((x) => x.active)) {
    const mine = cfg.chores.filter((c) => c.active && (c.zone_id === z.zone_id || (c.zone_id === null && !c.off.includes(z.zone_id))));
    mine.sort((a, b) => place(a) - place(b) || a.chore_id - b.chore_id);
    for (const c of mine) {
      const flat = c.zone_id === null;
      const interval = flat ? (c.days[z.zone_id] ?? c.interval) : c.interval;
      const key = hmKey(c.chore_id, z.zone_id);
      pairs.push({ chore_id: c.chore_id, zone_id: z.zone_id, name: c.name, zone: z.name, short: z.short, label: `${c.name} · ${z.name}`, flat, interval,
        interval_text: hmInterval(interval), minutes: flat ? (c.mins[z.zone_id] ?? c.minutes) : c.minutes, done: prev.get(key) ?? [] });
      prev.delete(key);
    }
  }
  h.pairs = pairs;
  h.gone = Object.fromEntries(prev);
}
const hmKey = (c, z) => `${c}:${z}`;
const hmPair = (c, z) => state.home.pairs.find((p) => p.chore_id === c && p.zone_id === z);
/** A pair as the door's HomeRow, its age from its done days. */
function hmRow(p) {
  const last = p.done.reduce((a, d) => (a === null || d.ago < a.ago ? d : a), null);
  const age = last ? last.ago : null;
  const { done: _d, ...row } = p;
  return { ...row, age, age_text: hmAge(age), done_today: age === 0, done_at: last ? last.at : null };
}
/** home.load's order: never logged 1.5 times late, then the most overdue; ties by interval, chore, zone. */
function hmRows() {
  const rank = (r) => (r.age === null ? 1.5 : r.age / r.interval);
  return state.home.pairs.map(hmRow).sort((a, b) => rank(b) - rank(a) || a.interval - b.interval || a.chore_id - b.chore_id || a.zone_id - b.zone_id);
}
const hmVisible = () => hmRows().filter((r) => !state.home.skips.has(hmKey(r.chore_id, r.zone_id)));
/** home.worst: one row per chore, its zone waiting longest. */
const hmWorst = (rows) => rows.filter((r, i) => rows.findIndex((x) => x.chore_id === r.chore_id) === i);

/** A job (home._single, _session, _whole). */
function hmSingle(r, over = false) {
  const c = HM_CHORE.get(r.chore_id);
  return { pairs: [[r.chore_id, r.zone_id]], title: r.flat ? `${r.name} the ${r.zone.toLowerCase()}` : r.name, zone: r.zone, age: r.age, age_text: hmAge(r.age),
    minutes: r.minutes, steps: (c?.steps?.length ? c.steps : r.flat ? HM_SPOTS.get(r.zone_id) ?? [] : []).slice(0, 5), howto: c?.howto ?? null, over, session: false };
}
const hmAgeOf = (rs) => (rs.some((r) => r.age === null) ? null : Math.max(...rs.map((r) => r.age)));
function hmSession(rs) {
  const place = (r) => [r.flat ? (r.name.toLowerCase().startsWith('dust') ? 0 : 2) : 1, r.chore_id];
  rs = [...rs].sort((a, b) => place(a)[0] - place(b)[0] || place(a)[1] - place(b)[1]);
  const age = hmAgeOf(rs);
  return { pairs: rs.map((r) => [r.chore_id, r.zone_id]), title: `${rs[0].zone}: ${rs.length} jobs`, zone: rs[0].zone, age, age_text: hmAge(age),
    minutes: rs.reduce((a, r) => a + r.minutes, 0), steps: rs.map((r) => `${r.name} (${r.minutes} min)`), howto: null, over: false, session: true };
}
function hmWhole(rs) {
  rs = [...rs].sort((a, b) => a.zone_id - b.zone_id);
  const age = hmAgeOf(rs);
  return { pairs: rs.map((r) => [r.chore_id, r.zone_id]), title: `${rs[0].name} the whole flat`, zone: 'Whole flat', age, age_text: hmAge(age),
    minutes: rs.reduce((a, r) => a + r.minutes, 0), steps: rs.map((r) => `${r.zone} (${r.minutes} min)`), howto: HM_CHORE.get(rs[0].chore_id)?.howto ?? null, over: false, session: true };
}
/** home.candidates: the jobs that fit, best first; nothing fits: the shortest, over the time. */
function hmCandidates(minutes) {
  const avail = hmRows().filter((r) => r.age !== 0 && !state.home.skips.has(hmKey(r.chore_id, r.zone_id)));
  const fits = avail.filter((r) => r.minutes <= minutes);
  const jobs = [];
  if (minutes >= 60 && fits.length) {
    let total = 0;
    const chosen = [];
    for (const r of fits.filter((x) => x.zone_id === fits[0].zone_id)) if (total + r.minutes <= minutes) { chosen.push(r); total += r.minutes; }
    if (chosen.length >= 2) jobs.push(hmSession(chosen));
  }
  jobs.push(...hmWorst(fits).map((r) => hmSingle(r)));
  if (minutes >= 30 && jobs.length) {
    const wholes = [...new Set(avail.filter((r) => r.flat).map((r) => r.chore_id))].map((id) => avail.filter((r) => r.chore_id === id))
      .filter((rs) => rs.length >= 2 && rs.reduce((a, r) => a + r.minutes, 0) <= minutes && rs.some((r) => r.age === null || r.age >= r.interval)).map(hmWhole);
    jobs.splice(jobs[0].session ? 2 : 1, 0, ...wholes);
  }
  if (!jobs.length && avail.length) jobs.push(hmSingle(hmWorst(avail).sort((a, b) => a.minutes - b.minutes)[0], true));
  return jobs;
}
/** home.job_of: a timer's job rebuilt from its pairs (null when they are gone). */
function hmJobOf(pairs) {
  const rows = hmRows();
  const found = pairs.map(([c, z]) => rows.find((r) => r.chore_id === c && r.zone_id === z)).filter(Boolean);
  if (!found.length) return null;
  if (found.length === 1) return hmSingle(found[0]);
  return new Set(found.map((r) => r.chore_id)).size === 1 && found[0].flat ? hmWhole(found) : hmSession(found);
}
/** The open timer (home.timer_open) as the door's Timer, with its job; null when there is none or its job is gone. */
function hmTimer() {
  const t = state.home.timer;
  if (!t || t.closed) return null;
  const job = hmJobOf(t.pairs);
  if (!job) return null;
  const now = Date.now();
  const st = t.endsAt === null ? 'paused' : t.endsAt > now ? 'running' : 'over';
  const left = st === 'paused' ? t.leftS : st === 'running' ? Math.ceil((t.endsAt - now) / 1000) : 0;
  return { t: { id: t.id, state: st, left, ends_at: st === 'paused' ? null : new Date(t.endsAt).toISOString(), minutes: t.minutes, title: job.title, pairs: job.pairs }, job };
}
const hmMinutes = (v) => (HM_HOURS.includes(Number(v)) ? Number(v) : 15);

/** GET /home?min= as the door answers. */
function homeOut(min) {
  if (state.home.empty) return { ...HM_NOW, empty: true, minutes: hmMinutes(min), timer: null, rows: [], count: 0, hidden: 0, recent: [] };
  const vis = hmVisible();
  const rows = hmWorst(vis);
  return { ...HM_NOW, minutes: hmMinutes(min), timer: hmTimer()?.t ?? null, week: state.home.week, rows, count: rows.length, shown: 6,
    hidden: state.home.pairs.length - vis.length, recent: state.home.recent.filter((e) => e.source !== 'start').slice(0, 5) };
}
/** GET /home/pick?min=&n= as the door answers. */
function pickOut(min, nIn) {
  const minutes = hmMinutes(min);
  const n0 = /^\d+$/.test(String(nIn ?? '')) ? Number(nIn) : 0;
  const base = { ...HM.pick.home_pick, minutes, title: `Your ${{ 5: '5 minutes', 15: '15 minutes', 30: '30 minutes', 60: 'hour' }[minutes]}`, timer: null, job: null, n: null, count: 0, also: [] };
  if (state.home.empty) return { ...base, empty: 'no_chores' };
  const open = hmTimer();
  if (open) return { ...base, minutes: open.t.minutes, title: `Your ${{ 5: '5 minutes', 15: '15 minutes', 30: '30 minutes', 60: 'hour' }[open.t.minutes] ?? `${open.t.minutes} minutes`}`, empty: null, timer: open.t, job: open.job, count: 1 };
  const jobs = hmCandidates(minutes);
  if (!jobs.length) return { ...base, empty: 'nothing_waiting' };
  const n = n0 % jobs.length;
  const also = [(n + 1) % jobs.length, (n + 2) % jobs.length].filter((i, k, a) => i !== n && a.indexOf(i) === k).map((i) => ({ n: i, title: jobs[i].title }));
  return { ...base, empty: null, job: jobs[n], n, count: jobs.length, also };
}
/** Today's Home card (homepage.card_data); null without chores. */
function homeCard() {
  if (state.home.empty) return null;
  const vis = hmVisible();
  const rows = hmWorst(vis);
  const w = state.home.week;
  return { this_week: w.this, goal: w.goal, text: `this week ${w.this} of ${w.goal}`, waiting: rows[0] ?? null, hidden: state.home.pairs.length - vis.length };
}

/** A Home save with Undo: Home as it was, and the Undo's own head. */
const homeSave = (before, answer, undoHead) => {
  state.before = { day: state.day, usual: state.usual, home: before, homeUndo: undoHead };
  state.undo = { token: randomBytes(12).toString('base64url'), head: answer.head, expires_at: new Date(Date.now() + 15 * 60_000).toISOString() };
  return { ...answer, undo: state.undo };
};
const homePlain = (answer) => {
  state.before = null;
  state.undo = null;
  return { ...answer, undo: null };
};
const hmBad = (message) => [400, { error: 'bad_request', message }];
const hmIsId = (v) => Number.isInteger(v) && v > 0;
const hmPairsOk = (v) => Array.isArray(v) && v.length >= 1 && v.length <= 12 && v.every((x) => Array.isArray(x) && x.length === 2 && x.every(hmIsId));
const hmNames = (pairs) => {
  const ps = pairs.map(([c, z]) => hmPair(c, z));
  const byChore = new Map();
  for (const p of ps) byChore.set(p.chore_id, [...(byChore.get(p.chore_id) ?? []), p]);
  return [...byChore.values()].map((g) => (g.length > 1 ? `${g[0].name} · ${g.length} zones` : g[0].label)).join(', ');
};
/** Rows stamped done (ago days back; 0 = now), with their History entry. */
function hmStamp(pairs, source, ago = 0) {
  const at = ago === 0 ? new Date().toISOString() : hmNoon(ago);
  const ids = [];
  for (const [c, z] of pairs) {
    const id = ++state.home.doneIds;
    hmPair(c, z).done.push({ ago, at, id });
    ids.push(id);
  }
  const ps = pairs.map(([c, z]) => hmPair(c, z));
  const day = shiftIso(HM_TODAY, -ago);
  state.home.recent.unshift({ ids, chore_id: ps[0].chore_id, chore: ps[0].name, zones: ps.map((p) => p.zone), flat: ps[0].flat,
    label: ps.length > 1 ? `${ps[0].name} · ${ps.length} zones` : ps[0].label, at, day, dated: ago > 0, source, how: source === 'start' ? 'starting point' : ago > 0 ? 'earlier' : source === 'pick' ? 'timer' : 'ticked',
    time: ago > 0 ? null : hm(), when: ago > 0 ? ddmm(day) : `${ddmm(day)} ${hm()}` });
  state.home.recent.sort((a, b) => (a.at < b.at ? 1 : -1));
}
const hmValid = (pairs) => pairs.filter(([c, z]) => hmPair(c, z));
const hmCloseTimer = () => {
  const t = state.home.timer;
  if (t && !t.closed) { if (t.endsAt !== null && t.endsAt > Date.now()) t.endsAt = null; t.leftS = null; t.closed = true; }
};

/** POST /home/<action> of the Now and Pick pages: [status, answer]; the core's checks and words (home.py). */
function homeAction(action, b) {
  const h = state.home;
  if (action === 'tick') {
    if (!hmIsId(b.chore_id) || !hmIsId(b.zone_id)) return hmBad('chore_id must be a number.');
    const p = hmPair(b.chore_id, b.zone_id);
    if (!p) return [200, rejected('That chore is not in the list.')];
    const before = structuredClone(h);
    if (p.done.some((d) => d.ago === 0)) {
      p.done = p.done.filter((d) => d.ago !== 0);
      h.recent = h.recent.filter((e) => !(e.chore_id === p.chore_id && e.day === HM_TODAY && e.zones.length === 1 && e.zones[0] === p.zone));
      return [200, homeSave(before, { outcome: 'changed', head: `Ticked off: ${p.label}` }, `Undone: ${p.label} is done again.`)];
    }
    hmStamp([[p.chore_id, p.zone_id]], 'web');
    return [200, homeSave(before, { outcome: 'saved', head: `Saved: ${p.label}` }, 'Undone: the tick is gone.')];
  }
  const pairsIn = () => (hmPairsOk(b.pairs) ? b.pairs : null);
  if (['start', 'pickdone', 'picknext', 'skip', 'earlier'].includes(action) && !pairsIn()) return hmBad('pairs must be a list of 1 to 12 [chore_id, zone_id].');
  if (['pause', 'resume', 'stop', 'picknext'].includes(action) && !hmIsId(b.timer_id)) return hmBad('timer_id must be a number.');
  const t = h.timer && !h.timer.closed ? h.timer : null;
  if (action === 'start') {
    if (!Number.isInteger(b.minutes)) return hmBad('minutes must be a whole number.');
    const pairs = hmValid(b.pairs);
    if (!pairs.length || b.minutes < 1 || b.minutes > 240) return [200, rejected('That job is not in the list any more.')];
    hmCloseTimer();
    h.timer = { id: ++h.timerIds, minutes: b.minutes, pairs, endsAt: Date.now() + b.minutes * 60_000, leftS: null, closed: false };
    return [200, homePlain({ outcome: 'changed', head: `Timer started: ${b.minutes} minutes.` })];
  }
  if (action === 'pause') {
    if (!t || t.id !== b.timer_id || t.endsAt === null || t.endsAt <= Date.now()) return [200, rejected('That timer is not running.')];
    t.leftS = Math.max(0, Math.ceil((t.endsAt - Date.now()) / 1000));
    t.endsAt = null;
    return [200, homePlain({ outcome: 'changed', head: 'Timer paused.' })];
  }
  if (action === 'resume') {
    if (!t || t.id !== b.timer_id || t.endsAt !== null || t.leftS === null) return [200, rejected('That timer is not paused.')];
    t.endsAt = Date.now() + t.leftS * 1000;
    t.leftS = null;
    return [200, homePlain({ outcome: 'changed', head: 'Timer running again.' })];
  }
  if (action === 'stop') {
    if (!t || t.id !== b.timer_id) return [200, rejected('That timer is already closed.')];
    hmCloseTimer();
    return [200, homePlain({ outcome: 'changed', head: 'Timer closed.' })];
  }
  if (action === 'pickdone') {
    const pairs = hmValid(b.pairs);
    if (!pairs.length) return [200, rejected('That job is not in the list any more.')];
    const before = structuredClone(h);
    const fresh = pairs.filter(([c, z]) => !hmPair(c, z).done.some((d) => d.ago === 0));
    hmCloseTimer();
    if (!fresh.length) return [200, homePlain({ outcome: 'changed', head: 'Already ticked today.' })];
    const said = hmNames(fresh);
    hmStamp(fresh, 'pick');
    return [200, homeSave(before, { outcome: 'saved', head: `Saved: ${said}`.slice(0, 160) }, 'Undone: the tick is gone.')];
  }
  if (action === 'picknext') {
    const open = hmTimer();
    const pairs = hmValid(b.pairs);
    if (!open || open.t.id !== b.timer_id || open.t.state !== 'running' || !pairs.length) return [200, rejected('That timer is not running.')];
    const before = structuredClone(h);
    const fresh = pairs.filter(([c, z]) => !hmPair(c, z).done.some((d) => d.ago === 0));
    const said = hmNames(fresh.length ? fresh : pairs);
    if (fresh.length) hmStamp(fresh, 'pick');
    const nxt = open.t.left >= 180 ? hmCandidates(Math.floor(open.t.left / 60)).filter((j) => !j.over) : [];
    let head;
    if (nxt.length) {
      h.timer.pairs = nxt[0].pairs;
      head = `Saved: ${said}. Next: ${nxt[0].title}`;
    } else {
      hmCloseTimer();
      head = `Saved: ${said}. Nothing else fits in the time left; the timer is closed.`;
    }
    const answer = { outcome: fresh.length ? 'saved' : 'changed', head: head.slice(0, 160) };
    return [200, fresh.length ? homeSave(before, answer, 'Undone: the tick is gone.') : homePlain(answer)];
  }
  if (action === 'skip') {
    const pairs = hmValid(b.pairs);
    if (!pairs.length) return [200, rejected('That job is not in the list any more.')];
    const fresh = pairs.filter(([c, z]) => !h.skips.has(hmKey(c, z)));
    if (!fresh.length) return [200, homePlain({ outcome: 'changed', head: 'Hidden already.' })];
    const before = structuredClone(h);
    for (const [c, z] of fresh) h.skips.add(hmKey(c, z));
    return [200, homeSave(before, { outcome: 'changed', head: `Not today: ${hmNames(pairs)}`.slice(0, 160) }, 'Undone: the job is back in the list.')];
  }
  if (action === 'earlier') {
    const w = b.when;
    if (!(Number.isInteger(w) || (typeof w === 'string' && /^\d{4}-\d\d-\d\d$/.test(w)))) return hmBad('when must be 1 to 7 (days ago) or a date yyyy-mm-dd.');
    const pairs = hmValid(b.pairs);
    if (!pairs.length) return [200, rejected('Pick a job from the list.')];
    const ago = Number.isInteger(w) ? (w >= 1 && w <= 7 ? w : null) : Math.round((Date.parse(`${HM_TODAY}T12:00:00Z`) - Date.parse(`${w}T12:00:00Z`)) / 86400_000);
    if (ago === null || ago < 1 || ago > 365) return [200, rejected('Pick a day before today, in the last year.')];
    const before = structuredClone(h);
    const said = hmNames(pairs);
    hmStamp(pairs, 'web', ago);
    return [200, homeSave(before, { outcome: 'saved', head: `Saved: ${said} on ${ddmm(shiftIso(HM_TODAY, -ago))}`.slice(0, 160) }, 'Undone: the tick is gone.')];
  }
  return homeMore(action, b) ?? [404, { error: 'not_found', message: 'Not found.' }];
}
// ---- Home's other four pages (deploy 100): Zones, History, a chore's page and Edit zones ------------------------------------------

const hmActiveZones = () => state.home.cfg.zones.filter((z) => z.active);
const hmRank = (r) => (r.age === null ? 1.5 : r.age / r.interval);

/** GET /home/zones as the door answers (homepage.zones_data, start_data, flat_data, zone_data, per_zone_data). */
function hmZonesOut() {
  const h = state.home;
  const answers = HM.zones.home_zones.start.answers;
  if (h.empty) return { today: HM_TODAY, empty: true, start: { jobs: [], more: 0, answers }, flat: [], zones: [] };
  const rows = hmRows();
  const never = rows.filter((r) => r.age === null && !h.unknown.includes(hmKey(r.chore_id, r.zone_id)));
  const byChore = new Map();
  for (const r of never) byChore.set(r.chore_id, [...(byChore.get(r.chore_id) ?? []), r]);
  const jobs = [...byChore.values()];
  const start = {
    jobs: jobs.slice(0, 5).map((ps) => ({ chore_id: ps[0].chore_id, name: ps[0].name, pairs: ps.map((p) => [p.chore_id, p.zone_id]), zone: ps.length === 1 ? ps[0].zone : null,
      zones: ps.length, where: ps.length === 1 ? ps[0].zone : `${ps.length} zones`, interval: ps[0].interval, interval_text: ps[0].interval_text })),
    more: Math.max(0, jobs.length - 5), answers,
  };
  const zs = hmActiveZones();
  const flat = h.cfg.chores.filter((c) => c.zone_id === null && c.active).map((c) => {
    const tiles = zs.flatMap((z) => h.pairs.filter((p) => p.chore_id === c.chore_id && p.zone_id === z.zone_id)).map(hmRow)
      .map((r) => ({ ...r, age_short: hmAgeShort(r.age), tinted: r.age !== null && (r.age === 0 || r.age < r.interval * 0.5) }));
    const groups = new Map();
    for (const z of zs) {
      const d = c.days[z.zone_id] ?? c.interval;
      if (!c.off.includes(z.zone_id) && d !== c.interval) groups.set(d, [...(groups.get(d) ?? []), z]);
    }
    const sorted = [...groups.entries()].sort((a, b) => a[0] - b[0]);
    const off = zs.filter((z) => c.off.includes(z.zone_id));
    const text = [hmInterval(c.interval), ...sorted.map(([d, g]) => `${g.map((z) => z.short).join(', ')} ${hmInterval(d)}`), ...(off.length ? [`not in ${off.map((z) => z.short).join(', ')}`] : [])].join('; ');
    return { chore_id: c.chore_id, name: c.name, interval: c.interval, interval_text: hmInterval(c.interval), minutes: c.minutes,
      all_done_today: tiles.length > 0 && tiles.every((t) => t.age === 0),
      per_zone: { text, groups: sorted.map(([d, g]) => ({ interval: d, interval_text: hmInterval(d), zones: g.map((z) => ({ zone_id: z.zone_id, short: z.short })) })), off: off.map((z) => ({ zone_id: z.zone_id, short: z.short })) }, tiles };
  });
  const zones = zs.map((z) => {
    const mine = h.pairs.filter((p) => p.zone_id === z.zone_id).map(hmRow);
    const own = mine.filter((r) => !r.flat);
    const oldest = rows.find((r) => r.zone_id === z.zone_id);
    return { zone_id: z.zone_id, name: z.name, short: z.short, count: mine.length, own: own.length, chores: mine,
      open: own.some((r) => r.age !== null && r.age <= 14), todoist: z.name.toLowerCase() === 'storage' && own.length === 0,
      oldest_age: oldest ? oldest.age : null, oldest_text: !oldest ? null : oldest.age === null ? 'not yet' : hmAge(oldest.age) };
  });
  return { today: HM_TODAY, empty: !h.cfg.chores.some((c) => c.active), start, flat, zones };
}

const hmDayHead = (day) => `${new Date(`${day}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' })} ${ddmm(day)}`;
/** GET /home/history?n= as the door answers (homepage.history_data): ?n= rows (60 to 600), by day, newest first. */
function hmHistoryOut(nIn) {
  const h = state.home;
  const limit = Math.min(600, Math.max(60, /^\d+$/.test(String(nIn ?? '')) ? Number(nIn) : 60));
  const rows = h.recent.slice(0, limit);
  const days = [];
  for (const e of rows) {
    if (!days.length || days.at(-1).day !== e.day) days.push({ day: e.day, label: hmDayHead(e.day), rows: [] });
    days.at(-1).rows.push(e);
  }
  const zoneIx = (z) => h.cfg.zones.findIndex((x) => x.zone_id === z);
  const jobs = [...h.pairs].sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()) || zoneIx(a.zone_id) - zoneIx(b.zone_id))
    .map((p) => ({ pairs: [[p.chore_id, p.zone_id]], label: p.label }));
  return { today: HM_TODAY, limit, step: 60, max: 600, more: rows.length === limit && limit < 600, count: rows.length, days, jobs, earlier_days: 365 };
}

const hmDate = (day) => (day.slice(0, 4) === HM_TODAY.slice(0, 4) ? ddmm(day) : `${ddmm(day)}${day.slice(0, 4)}`);
function hmDates(entries) {
  const last = entries.slice(0, 10).map((e) => ({ day: e.day, start: e.source === 'start' }));
  const days = [...new Set(entries.filter((e) => e.source !== 'start').map((e) => e.day))].sort();
  const gaps = days.slice(1).map((d, i) => hmAgo(days[i]) - hmAgo(d)).sort((a, b) => a - b);
  const gap = days.length >= 3 ? gaps[Math.floor(gaps.length / 2)] : null;
  return { last, last_text: last.map((l) => `${hmDate(l.day)}${l.start ? ' (starting point)' : ''}`).join(' · ') || 'not logged yet', usually_days: gap, usually: gap === null ? null : `usually every ${gap} day${gap === 1 ? '' : 's'}` };
}
/** GET /home/chore?id= (reads.home_chore): null when there is no such chore. */
function hmChoreOut(id) {
  const h = state.home;
  const c = h.cfg.chores.find((x) => x.chore_id === Number(id));
  if (!c) return null;
  const flat = c.zone_id === null;
  const zone = flat ? 'whole flat' : h.cfg.zones.find((z) => z.zone_id === c.zone_id).name;
  const mine = h.recent.filter((e) => e.chore_id === c.chore_id);
  const base = { chore_id: c.chore_id, name: c.name, zone_id: c.zone_id, zone, flat, active: c.active, interval: c.interval, interval_text: hmInterval(c.interval), minutes: c.minutes,
    meta: `${hmInterval(c.interval)} · ${c.minutes} min · ${zone}${c.active ? '' : ' · retired'}`, steps: c.steps, howto: c.howto, words: c.words };
  if (!flat) return { ...base, ...hmDates(mine), zones: null };
  const zones = hmActiveZones().flatMap((z) => {
    const p = h.pairs.find((x) => x.chore_id === c.chore_id && x.zone_id === z.zone_id);
    const rs = mine.filter((e) => e.zones.includes(z.name));
    if (!p && !rs.length) return [];
    const interval = p ? p.interval : c.interval;
    const minutes = p ? p.minutes : c.minutes;
    return [{ zone_id: z.zone_id, zone: z.name, on: !!p, interval, interval_text: hmInterval(interval), minutes, text: p ? `${hmInterval(interval)} · ${minutes} min` : 'not done here', ...hmDates(rs) }];
  });
  return { ...base, last: [], last_text: null, usually_days: null, usually: null, zones };
}

function hmEditChore(c) {
  const flat = c.zone_id === null;
  return { chore_id: c.chore_id, name: c.name, zone_id: c.zone_id, flat, active: c.active, interval: c.interval, interval_text: hmInterval(c.interval), minutes: c.minutes,
    meta: `${hmInterval(c.interval)} · ${c.minutes} min${c.active ? '' : ' · retired'}`, steps: c.steps, howto: c.howto, words: c.words,
    per_zone: flat && c.active ? hmActiveZones().map((z) => ({ zone_id: z.zone_id, zone: z.name, on: !c.off.includes(z.zone_id), days: c.days[z.zone_id] ?? null, minutes: c.mins[z.zone_id] ?? null })) : null };
}
/** GET /home/edit as the door answers (reads.home_edit). */
function hmEditOut() {
  const { cfg } = state.home;
  return { goal: cfg.goal, flat: cfg.chores.filter((c) => c.zone_id === null).map(hmEditChore),
    zones: cfg.zones.map((z) => { const mine = cfg.chores.filter((c) => c.zone_id === z.zone_id); return { ...z, count: mine.filter((c) => c.active).length, chores: mine.map(hmEditChore) }; }),
    zone_options: [{ zone_id: null, label: 'Whole flat (each zone on its own)', active: true }, ...cfg.zones.map((z) => ({ zone_id: z.zone_id, label: `${z.name}${z.active ? '' : ' (retired)'}`, active: z.active }))],
    limits: HM_EDIT.limits };
}

// the checks of homepage's api forms (_hname, _hlist): too long or not a list is a 400, not a refusal
const hmName = (b, most, name = 'name') => {
  const v = b[name];
  if (v !== undefined && v !== null && typeof v !== 'string') return [`${name} must be text.`];
  const out = String(v ?? '').split(/\s+/).filter(Boolean).join(' ');
  return out.length > most ? [`${name} must be ${most} characters or fewer.`] : [null, out];
};
const hmList = (b, name, most, width, commas) => {
  const v = b[name] ?? [];
  const bad = !Array.isArray(v) || v.length > most || !v.every((x) => typeof x === 'string' && !/[\r\n]/.test(x) && (!commas || !x.includes(',')) && x.split(/\s+/).filter(Boolean).join(' ').length <= width);
  return bad ? [`${name} must be a list of up to ${most} texts of up to ${width} characters${commas ? ', without commas' : ', one line each'}.`] : [null, v.map((x) => x.split(/\s+/).filter(Boolean).join(' ')).filter(Boolean)];
};
const hmInt = (b, name) => (Number.isInteger(b[name]) ? [null, b[name]] : [`${name} must be a whole number.`]);
const hmZoneIn = (b) => {
  const L = HM_EDIT.limits;
  const [e1, name] = hmName(b, L.zone_name_max); if (e1) return [e1];
  const [e2, short] = hmName(b, L.short_max, 'short'); if (e2) return [e2];
  const [e3, spots] = hmList(b, 'spots', L.spots_max, L.spot_max, false); if (e3) return [e3];
  const [e4, words] = hmList(b, 'words', L.words_max, L.word_max, true); if (e4) return [e4];
  return [null, { name, short, spots, words: words.map((w) => w.toLowerCase()) }];
};
const hmChoreIn = (b) => {
  const L = HM_EDIT.limits;
  if (!('zone_id' in b)) return ['zone_id is missing (null = the whole flat).'];
  if (b.zone_id !== null && !hmIsId(b.zone_id)) return ['zone_id must be a number.'];
  if (b.howto !== undefined && b.howto !== null && typeof b.howto !== 'string') return ['howto must be text or null.'];
  const howto = String(b.howto ?? '').split(/\s+/).filter(Boolean).join(' ');
  if (howto.length > L.howto_max) return [`howto must be ${L.howto_max} characters or fewer.`];
  const [e1, name] = hmName(b, L.chore_name_max); if (e1) return [e1];
  const [e2, days] = hmInt(b, 'days'); if (e2) return [e2];
  const [e3, minutes] = b.minutes === null || b.minutes === undefined ? [null, ''] : hmInt(b, 'minutes'); if (e3) return [e3];
  const [e4, steps] = hmList(b, 'steps', L.steps_max, L.step_max, false); if (e4) return [e4];
  const [e5, words] = hmList(b, 'words', L.words_max, L.word_max, true); if (e5) return [e5];
  return [null, { name, zone_id: b.zone_id, days, minutes: minutes === '' ? 15 : minutes, steps, howto: howto || null, words: words.map((w) => w.toLowerCase()) }];
};
const hmChoreRefusal = (f) => !f.name ? "Type the chore's name." : f.days < 1 || f.days > 730 || f.minutes < 1 || f.minutes > 240 ? 'The interval is 1 to 730 days and the time 1 to 240 minutes.' : null;
const hmDays = (n) => `${n} day${n === 1 ? '' : 's'}`;

/** POST /home/<action> of Zones, History and Edit zones: [status, answer] (home.py). */
function homeMore(action, b) {
  const h = state.home;
  const cfg = h.cfg;
  const zoneBy = (id) => cfg.zones.find((z) => z.zone_id === id);
  const choreBy = (id) => cfg.chores.find((c) => c.chore_id === id);
  const done = (head) => { hmSync(h); return [200, homePlain({ outcome: 'changed', head })]; };
  if (action === 'alldone') {
    if (!hmIsId(b.chore_id)) return hmBad('chore_id must be a number.');
    const c = choreBy(b.chore_id);
    if (!c || !c.active || c.zone_id !== null) return [200, rejected('That is not a whole-flat chore.')];
    const before = structuredClone(h);
    const mine = h.pairs.filter((p) => p.chore_id === c.chore_id);
    const said = `${c.name} · whole flat`;
    const fresh = mine.filter((p) => !p.done.some((d) => d.ago === 0));
    if (mine.length && !fresh.length) { // every zone done today: this tap takes it back
      for (const p of mine) p.done = p.done.filter((d) => d.ago !== 0);
      h.recent = h.recent.filter((e) => !(e.chore_id === c.chore_id && e.day === HM_TODAY));
      return [200, homeSave(before, { outcome: 'changed', head: `Ticked off: ${said}` }, `Undone: ${said} is done again.`)];
    }
    hmStamp(fresh.map((p) => [p.chore_id, p.zone_id]), 'web');
    return [200, homeSave(before, { outcome: 'saved', head: `Saved: ${said}` }, 'Undone: the tick is gone.')];
  }
  if (action === 'startpoint') {
    const pairs = hmPairsOk(b.pairs) ? hmValid(b.pairs) : null;
    if (!hmPairsOk(b.pairs)) return hmBad('pairs must be a list of 1 to 12 [chore_id, zone_id].');
    if (!['week', 'month', 'longer', 'unknown'].includes(b.ago)) return hmBad('ago must be week, month, longer or unknown.');
    if (!pairs.length) return [200, rejected('That job is not in the list any more.')];
    const before = structuredClone(h);
    const said = hmNames(pairs);
    if (b.ago === 'unknown') {
      const fresh = pairs.filter(([c, z]) => !h.unknown.includes(hmKey(c, z)));
      h.unknown.push(...fresh.map(([c, z]) => hmKey(c, z)));
      return [200, homeSave(before, { outcome: 'changed', head: `Left as not logged yet: ${said}`.slice(0, 160) }, 'Undone: the job is back on the card.')];
    }
    const todo = pairs.filter(([c, z]) => hmPair(c, z).done.length === 0);
    if (!todo.length) return [200, homePlain({ outcome: 'changed', head: 'Logged already.' })];
    for (const [c, z] of todo) {
      const back = b.ago === 'week' ? 3 : b.ago === 'month' ? 14 : 2 * hmPair(c, z).interval;
      hmStamp([[c, z]], 'start', back);
    }
    return [200, homeSave(before, { outcome: 'changed', head: `Starting point: ${said}`.slice(0, 160) }, 'Undone: the tick is gone.')];
  }
  if (action === 'remove') {
    if (!Array.isArray(b.ids) || b.ids.length < 1 || b.ids.length > 20 || !b.ids.every(hmIsId)) return hmBad("ids must be a list of 1 to 20 ids (a history entry's ids).");
    const gone = h.recent.filter((e) => e.ids.some((i) => b.ids.includes(i)));
    if (!gone.length) return [200, rejected('That is not in the history any more.')];
    const before = structuredClone(h);
    const ids = gone.flatMap((e) => e.ids);
    for (const p of h.pairs) p.done = p.done.filter((d) => !ids.includes(d.id));
    for (const k of Object.keys(h.gone)) h.gone[k] = h.gone[k].filter((d) => !ids.includes(d.id));
    h.recent = h.recent.filter((e) => !gone.includes(e));
    const e = gone[0];
    const said = e.ids.length > 1 && e.flat ? e.chore : e.label;
    return [200, homeSave(before, { outcome: 'changed', head: `Removed: ${said}`.slice(0, 160) }, `Undone: ${said} is back in the history.`)];
  }
  if (action === 'goalset') {
    const [bad, n] = hmInt(b, 'goal');
    if (bad) return hmBad(bad);
    if (n < 1 || n > 7) return [200, rejected('The weekly goal is 1 to 7 sessions.')];
    cfg.goal = n;
    h.week.goal = n;
    return done(`Weekly goal: ${n} session${n === 1 ? '' : 's'}.`);
  }
  if (action === 'zonenew' || action === 'zoneedit') {
    if (action === 'zoneedit' && !hmIsId(b.zone_id)) return hmBad('zone_id must be a number.');
    const [bad, f] = hmZoneIn(b);
    if (bad) return hmBad(bad);
    if (!f.name) return [200, rejected("Type the zone's name.")];
    const same = cfg.zones.find((z) => z.name.toLowerCase() === f.name.toLowerCase() && (action === 'zonenew' || z.zone_id !== b.zone_id));
    const short = f.short || f.name.split(' ')[0].slice(0, 12);
    if (action === 'zonenew') {
      if (same && same.active) return [200, rejected(`${same.name} is already in your list.`)];
      if (same) { same.active = true; return done(`${same.name} is back in your list.`); }
      cfg.zones.push({ zone_id: cfg.nextZone++, name: f.name, short, spots: f.spots, words: f.words, active: true });
      return done(`Added the zone ${f.name}.`);
    }
    if (same) return [200, rejected('Another zone has that name.')];
    const z = zoneBy(b.zone_id);
    if (!z) return [200, rejected('That zone is not in the list.')];
    Object.assign(z, { name: f.name, short, spots: f.spots, words: f.words });
    return done(`Saved the zone ${f.name}.`);
  }
  if (action === 'zoneactive') {
    if (!hmIsId(b.zone_id)) return hmBad('zone_id must be a number.');
    if (typeof b.on !== 'boolean') return hmBad('on must be true or false.');
    const z = zoneBy(b.zone_id);
    if (!z) return [200, rejected('That zone is not in the list.')];
    z.active = b.on;
    return done(b.on ? `${z.name} is back.` : `${z.name} is retired; its history stays.`);
  }
  if (action === 'chorenew' || action === 'choreedit') {
    if (action === 'choreedit' && !hmIsId(b.chore_id)) return hmBad('chore_id must be a number.');
    const [bad, f] = hmChoreIn(b);
    if (bad) return hmBad(bad);
    const stop = hmChoreRefusal(f);
    if (stop) return [200, rejected(stop)];
    const zoneOk = f.zone_id === null || (action === 'chorenew' ? zoneBy(f.zone_id)?.active : zoneBy(f.zone_id));
    if (!zoneOk) return [200, rejected('Pick a zone from the list, or the whole flat.')];
    const fields = { name: f.name, zone_id: f.zone_id, interval: f.days, minutes: f.minutes, steps: f.steps, howto: f.howto, words: f.words };
    if (action === 'chorenew') {
      cfg.chores.push({ chore_id: cfg.nextChore++, active: true, off: [], days: {}, mins: {}, ...fields });
      return done(`Added ${f.name} (${hmInterval(f.days)}).`);
    }
    const c = choreBy(b.chore_id);
    if (!c) return [200, rejected('That chore is not in the list.')];
    Object.assign(c, fields);
    return done(`Saved ${f.name} (${hmInterval(f.days)}).`);
  }
  if (action === 'choreactive') {
    if (!hmIsId(b.chore_id)) return hmBad('chore_id must be a number.');
    if (typeof b.on !== 'boolean') return hmBad('on must be true or false.');
    const c = choreBy(b.chore_id);
    if (!c) return [200, rejected('That chore is not in the list.')];
    c.active = b.on;
    return done(b.on ? `${c.name} is back.` : `${c.name} is retired; its history stays.`);
  }
  if (action === 'chorezones') {
    if (!hmIsId(b.chore_id)) return hmBad('chore_id must be a number.');
    if (!Array.isArray(b.zones) || !b.zones.every((z) => z && typeof z === 'object' && hmIsId(z.zone_id) && typeof z.on === 'boolean')) return hmBad('zones must be a list of {zone_id, on, days, minutes}.');
    const c = choreBy(b.chore_id);
    if (!c || c.zone_id !== null) return [200, rejected('That is not a whole-flat chore.')];
    const ids = hmActiveZones().map((z) => z.zone_id);
    const off = c.off.filter((x) => !ids.includes(x));
    const days = Object.fromEntries(Object.entries(c.days).filter(([k]) => !ids.includes(Number(k))));
    const mins = Object.fromEntries(Object.entries(c.mins).filter(([k]) => !ids.includes(Number(k))));
    for (const z of ids) {
      const row = b.zones.find((x) => x.zone_id === z);
      if (!row || !row.on) off.push(z);
      for (const [field, into, top, own] of [['days', days, 730, c.interval], ['minutes', mins, 240, c.minutes]]) {
        const v = row?.[field];
        if (v === null || v === undefined) continue;
        if (!Number.isInteger(v)) return hmBad(`${field} must be a whole number.`);
        if (v < 1 || v > top) return [200, rejected('Give the days (1 to 730) and minutes (1 to 240) as whole numbers, or leave them blank.')];
        if (v !== own) into[z] = v;
      }
    }
    if (ids.every((z) => off.includes(z))) return [200, rejected(`${c.name} needs at least one zone. Retire it instead.`)];
    Object.assign(c, { off: off.sort((a, b2) => a - b2), days, mins });
    return done(`Saved ${c.name} per zone.`);
  }
  return null;
}

/** The read a Home save answers with when the body names none (docs/API.md): tick and pickdone Now, the others Pick. */
const homeView = (action) =>
  ['tick', 'pickdone'].includes(action) ? 'home'
  : ['alldone', 'startpoint'].includes(action) ? 'home_zones'
  : action === 'remove' ? 'home_history'
  : ['zonenew', 'zoneedit', 'zoneactive', 'chorenew', 'choreedit', 'choreactive', 'chorezones', 'goalset'].includes(action) ? 'home_edit'
  : 'home_pick';


// ---- Trends' Week and the Week review (deploy 102) ------------------------------------------------------------------------------
// GET /week?p= from tests/samples/week.json (real answers of the door for invented weeks): 7 (or 7_latest), 30, last (the sample's
// last week with its review in the state kept here), this (the sample's this-week with its review in its state; this_monday when
// POST /standin/week?monday=1). The review of each week is made from the sample's cards of that state (none, working, done, failed),
// with the week's own start, end and button. POST /coach/start as coach.start: kind "week" and dates checked, the daily limit
// (POST /standin/week?limit=1: the sample's refusal), a week already being read is "already on it" (the sample's answer), else a new
// coaching that is working; it answers with the fresh Week (view_p, else the started week). GET /coach/status?id= says working until
// it has been asked `polls` times (2 unless POST /standin/week?polls=n; 0 = never done), then the review is done (or failed with
// ?fail=1). Every start is counted (GET /standin/week-starts) so a page check can see that the page sent one start for one press.
// POST /standin/week?last=done|failed|working|none&this=…&latest=1&foods=8 sets the states; POST /standin/reset puts it back.
const WK = read('week.json');
const WK_REVIEW = {
  none: WK.last_none.week.review,
  failed: WK.last_failed.week.review,
  done: WK.last_done.week.review,
  working: WK.this_working.week.review,
};
const WK_BUTTON = { last: 'Review last week', this: 'Review this week so far' };
const WK_PERIOD = { last: WK.last_none.week, this: WK.this_working.week };
function weekStart() {
  return { last: 'none', this: 'none', monday: false, latest: false, foods: 0, limit: false, polls: 2, fail: false, starts: 0, coachings: new Map(), nextId: 10 };
}
function wkReview(which) {
  const st = state.week[which];
  const per = WK_PERIOD[which];
  const id = st === 'none' ? null : [...state.week.coachings.entries()].filter(([, c]) => c.which === which).map(([k]) => k).at(-1) ?? { failed: 1, done: 2, working: 3 }[st];
  const r = structuredClone(WK_REVIEW[st]);
  r.start = per.start;
  r.end = per.end;
  r.id = id;
  if (st === 'none' || st === 'failed') r.button = WK_BUTTON[which];
  if (st === 'failed' && which === 'this') r.failed = WK.this_cut_off.week.review.failed;
  return r;
}
function weekOut(p) {
  if (p === '7') return structuredClone(state.week.latest ? WK['7_latest'].week : WK['7'].week);
  if (p === '30') {
    const w = structuredClone(WK['30'].week);
    // POST /standin/week?foods=8: eight foods in each list (the door's most), so "Show all 8" shows; the extra names are invented
    for (let i = w.foods.by_kcal.length; i < state.week.foods; i++) {
      w.foods.by_kcal.push({ name: `Test food ${i + 1}`, kcal: 800 - i * 50, n: 2, text: `${800 - i * 50} kcal` });
      w.foods.by_count.push({ name: `Test food ${i + 1}`, kcal: 800 - i * 50, n: 2, text: '2×' });
    }
    return w;
  }
  if (p === 'this' && state.week.monday) return structuredClone(WK.this_monday.week);
  const w = structuredClone(WK_PERIOD[p]);
  w.review = wkReview(p);
  return w;
}
const wkWhich = (start) => (start === WK_PERIOD.last.start ? 'last' : start === WK_PERIOD.this.start ? 'this' : null);
function coachStart(b) {
  if (b.kind !== 'week') return [400, { error: 'bad_request', message: 'kind must be "week" (a day coaching is not in the door yet).' }];
  for (const f of ['start', 'end']) if (!/^\d{4}-\d\d-\d\d$/.test(b[f] ?? '')) return [400, { error: 'bad_request', message: `${f} must be a date yyyy-mm-dd.` }];
  state.week.starts++;
  const which = wkWhich(b.start);
  if (!which || b.end < b.start) return [200, { ...WK.saves.limit, reason: 'That is not a day or week to coach.' }];
  if (state.week.limit) return [200, structuredClone(WK.saves.limit)];
  const busy = [...state.week.coachings.entries()].find(([, c]) => c.which === which && c.state === 'working');
  if (busy || state.week[which] === 'working') {
    const id = busy?.[0] ?? wkReview(which).id;
    return [200, { ...structuredClone(WK.saves.on_it), coaching: { id, state: 'working' } }];
  }
  const id = state.week.nextId++;
  state.week.coachings.set(id, { which, state: 'working', asked: 0 });
  state.week[which] = 'working';
  return [200, { ...structuredClone(WK.saves.start), coaching: { id, state: 'working' } }];
}
function coachStatus(id) {
  const c = state.week.coachings.get(Number(id));
  if (!c) {
    const st = { 1: 'failed', 2: 'done', 3: 'working' }[id] ?? 'gone';
    return { id: Number(id), state: st };
  }
  if (c.state === 'working' && state.week.polls > 0 && ++c.asked >= state.week.polls) {
    c.state = state.week.fail ? 'failed' : 'done';
    state.week[c.which] = c.state;
  }
  return { id: Number(id), state: c.state };
}

const KEYED = ['/gym/tick', '/health/day', '/home/tick', '/home/pickdone', '/home/picknext', '/home/earlier', '/home/alldone', '/home/startpoint', '/body', '/food/labeladd', '/log', '/water', '/again', '/usual', '/habit', '/checkin', '/health', '/held/retry', '/held/delete', '/usual/meal', '/usual/new', '/usual/from_meal'];

// ---- Library's Foods tab (deploy 105) ---------------------------------------------------------------------------------------------

const CT_TODAY = '2026-11-17';
const CT_VALUES = CAT.items.oats.food_item.values.map(({ key, label }) => ({ key, label }));
const CT_WORDS = CAT.items.oats.food_item.words;
const CT_LIMITS = CAT.items.oats.food_item.limits;
const CT_FILTERS = CAT.all.catalogue.filters.map(({ key, label }) => ({ key, label }));
const CT_SORTS = CAT.all.catalogue.sorts.map(({ key, label }) => ({ key, label }));
const CT_HINTS = Object.fromEntries(['all', 'review', 'new'].map((k) => [CAT[k].catalogue.sort, CAT[k].catalogue.hint]));
const dmy3 = (iso) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
const dmyShort = (iso) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(2, 4)}`;
const ctTidy = (x) => String(x ?? '').split(/\s+/).filter(Boolean).join(' ');

/** The catalogue's foods: the sample's rows, with the samples' boxes where there is one (values, units, barcode, source, recipe). */
function catStart() {
  const boxes = new Map([...Object.values(CAT.items).map((x) => x.food_item), CAT.saves.values_ask.food_item].map((i) => [i.id, i]));
  const foods = CAT.all.catalogue.rows.map((r) => {
    const it = boxes.get(r.id);
    const values = Object.fromEntries(CT_VALUES.map((v) => [v.key, null]));
    if (it) for (const v of it.values) values[v.key] = v.value;
    else Object.assign(values, r.per_100);
    return { id: r.id, name: r.name, basis: r.basis, drink: r.drink, active: true, review: r.review,
      reason: it?.review_reason ?? (r.review ? 'values from an estimate' : null), aliases: [...r.aliases],
      units: it ? it.units.map((u) => ({ unit: u.unit, grams: u.grams })) : [], barcode: it?.barcode ?? null, values,
      eaten: r.eaten, first: it?.first ?? r.last, last: r.last, added: r.added,
      source: it ? structuredClone(it.source) : { line: 'database', source: 'database', brand: null, note: null }, recipe: it?.recipe ?? null };
  });
  return { foods, lookups: new Map(), next: Math.max(...foods.map((f) => f.id)) + 1 };
}

const ctText = (n) => (n === null ? '?' : String(n));
function ctRow(f) {
  const per = { kcal: f.values.kcal, protein: f.values.protein, fat: f.values.fat, carbs: f.values.carbs };
  return { id: f.id, ref: `N${f.id}`, name: f.name, review: f.review, drink: f.drink, aliases: [...f.aliases], basis: f.basis, per_100: per,
    per_100_text: Object.fromEntries(Object.entries(per).map(([k, v]) => [k, ctText(v)])), eaten: f.eaten, last: f.last,
    last_text: f.last ? ddmm(f.last) : '–', added: f.added, added_text: dmyShort(f.added) };
}

/** GET /food/catalogue as the door answers: the active foods matching q and f, in the order s (ties by name). */
function catalogueOut(q0, f, s) {
  const q = String(q0 ?? '').trim().slice(0, 60);
  const k = q.toLowerCase();
  const since = shiftIso(CT_TODAY, -14);
  let foods = state.cat.foods.filter((x) => x.active);
  if (k) foods = foods.filter((x) => x.name.toLowerCase().includes(k) || x.aliases.some((a) => a.includes(k)) || `n${x.id}` === k || (x.barcode ?? '').includes(k));
  if (f === 'drinks') foods = foods.filter((x) => x.drink);
  if (f === 'new') foods = foods.filter((x) => x.added >= since);
  if (f === 'review') foods = foods.filter((x) => x.review);
  const num = (x) => x ?? -1;
  const by = {
    eaten: (a, b) => b.eaten - a.eaten, recent: (a, b) => b.eaten - a.eaten,
    last: (a, b) => (b.last ?? '').localeCompare(a.last ?? ''), added: (a, b) => b.added.localeCompare(a.added),
    kcal: (a, b) => num(b.values.kcal) - num(a.values.kcal), kcal_low: (a, b) => num(a.values.kcal) - num(b.values.kcal),
    protein: (a, b) => num(b.values.protein) - num(a.values.protein), name: () => 0,
  }[s];
  foods = [...foods].sort((a, b) => by(a, b) || a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
  const rows = foods.slice(0, 400).map(ctRow);
  const label = CT_SORTS.find((x) => x.key === s).label;
  return { q, filter: f, sort: s, filters: CT_FILTERS.map((x) => ({ ...x, on: x.key === f })), sorts: CT_SORTS.map((x) => ({ ...x, on: x.key === s })),
    limit: 400, more: foods.length > 400 ? 'Showing the first 400; search to find others.' : null, empty: rows.length ? null : 'No food matches.',
    hint: CT_HINTS[s] ?? `Sorted by: ${label.toLowerCase()}. Click a food to see and change it.`, placeholder: CAT.all.catalogue.placeholder,
    count: rows.length, rows };
}

/** GET /food/item: one food's box (a hidden one too). */
function itemOut(id) {
  const f = state.cat.foods.find((x) => x.id === id);
  if (!f) return null;
  const per = `values per 100 ${f.basis}`;
  const eaten = f.eaten ? `eaten ${f.eaten} times, last ${dmy3(f.last)}` : 'eaten 0 times';
  const line = [f.source.source, f.source.brand, f.source.note].filter(Boolean).join(' · ');
  return { id: f.id, ref: `N${f.id}`, name: f.name, basis: f.basis,
    source: { ...f.source, line, text: `Source: ${line} · added ${dmy3(f.added)} · ${eaten} · ${per}` },
    needs_review: f.review, review_reason: f.review ? f.reason : null,
    values: CT_VALUES.map((v) => ({ ...v, value: f.values[v.key] })), aliases: [...f.aliases], drink: f.drink, active: f.active,
    units: f.units.map((u) => ({ ...u, text: `1 ${u.unit} = ${u.grams} ${f.basis}` })), barcode: f.barcode, eaten: f.eaten,
    first: f.eaten ? f.first : null, last: f.last, last_text: f.last ? dmy3(f.last) : null, added: f.added, added_text: dmy3(f.added),
    recipe: f.recipe, values_editable: !f.recipe,
    past: f.eaten ? { n: f.eaten, text: `Also recalculate the ${f.eaten} past ${f.eaten === 1 ? 'entry' : 'entries'} (${dmy3(f.first)} to ${dmy3(f.last)})` } : null,
    words: structuredClone(CT_WORDS), limits: structuredClone(CT_LIMITS) };
}

const CT_F = ['all', 'drinks', 'new', 'review'];
const CT_S = CT_SORTS.map((x) => x.key);
/** A save's fresh read (view "catalogue"): the Catalogue of view_q, view_f, view_s and the box of view_food when it is in the list. */
function catView(b) {
  const cat = catalogueOut(typeof b.view_q === 'string' ? b.view_q : '', CT_F.includes(b.view_f) ? b.view_f : 'all', CT_S.includes(b.view_s) ? b.view_s : 'eaten');
  const id = typeof b.view_food === 'number' ? b.view_food : Number(/^[Nn]?(\d+)$/.exec(String(b.view_food ?? ''))?.[1] ?? NaN);
  return { catalogue: cat, food_item: cat.rows.some((r) => r.id === id) ? itemOut(id) : null };
}

const ctNo = (outcome, reason) => [200, { outcome, head: outcome === 'unchanged' ? 'Nothing changed.' : 'Nothing saved.', reason, undo: null }];
const ctOk = (head) => [200, { outcome: 'changed', head, undo: null }];
const ctBad = (message) => [400, { error: 'bad_request', message }];
const ctKey = (w) => w.toLowerCase();

/** POST /food/catalogue/<action>: webfood's checks and words; no key, no Undo (the session's Undo goes). */
function catalogueSave(action, b) {
  if (!Number.isInteger(b.id)) return ctBad('id must be a number.');
  const f = state.cat.foods.find((x) => x.id === b.id);
  if (!f) return ctNo('rejected', 'Unknown food.');
  const ref = `N${f.id}`;
  if (action === 'values') {
    const changed = {};
    for (const v of CT_VALUES) {
      const n = b[v.key];
      if (n === undefined || n === null) continue;
      if (typeof n !== 'number') return ctBad(`${v.key} must be a number or null.`);
      if (n < 0) return ctNo('rejected', `${v.label}: give a number of 0 or more.`);
      if (f.values[v.key] === null || Math.abs(n - f.values[v.key]) > 1e-9) changed[v.key] = n;
    }
    if (b.past !== undefined && typeof b.past !== 'boolean') return ctBad('past must be true or false.');
    if (!Object.keys(changed).length) return ctNo('unchanged', 'Nothing changed.');
    if (f.recipe) return ctNo('rejected', `${ref} is calculated from recipe ${f.recipe}: change the recipe (${f.recipe}) instead`);
    if (b.confirmed !== true) {
      const said = Object.entries(changed).map(([k, n]) => `${k} ${ctText(f.values[k])} -> ${n}`).join(', ');
      const past = b.past === true && f.eaten ? `\npast entries rewritten from the food: ${f.eaten}` : '\npast entries keep their old values (only from now on)';
      const { v: _v, food_item: _i, ...ask } = CAT.saves.values_ask;
      return [200, { ...ask, read_back: `OK changed ${ref} ${f.name}: ${said}${past}` }];
    }
    Object.assign(f.values, changed);
    return ctOk(`Changed ${ref} ${f.name}.`);
  }
  if (action === 'words') {
    if (!['add', 'remove'].includes(b.act)) return ctBad('act must be add or remove.');
    const w = ctTidy(b.word).toLowerCase().slice(0, 60);
    if (!/\p{L}/u.test(w)) return ctNo('rejected', 'Type a word first.');
    if (b.act === 'remove') {
      if (!f.aliases.includes(w)) return ctNo('unchanged', 'Nothing changed.');
      f.aliases = f.aliases.filter((a) => a !== w);
      return ctOk(`"${w}" no longer means ${ref} ${f.name}.`);
    }
    if (ctKey(f.name) === w || f.aliases.includes(w)) return ctNo('unchanged', `'${w}' is already a name or alias of ${ref}`);
    const other = state.cat.foods.find((x) => x.active && x.id !== f.id && ctKey(x.name) === w);
    if (other) return ctNo('rejected', `'${w}' is the name of N${other.id} ${other.name}: an alias must not shadow another food`);
    const alias = state.cat.foods.find((x) => x.active && x.id !== f.id && x.aliases.includes(w));
    if (alias) return ctNo('rejected', `'${w}' is already an alias of N${alias.id} ${alias.name}: remove it there first, or use a more specific word`);
    if (f.aliases.length >= 20) return ctNo('rejected', `${ref} would have ${f.aliases.length + 1} aliases (maximum 20)`);
    f.aliases = [...f.aliases, w];
    return ctOk(`"${w}" now means ${ref} ${f.name}.`);
  }
  if (action === 'barcode') {
    if (b.barcode !== undefined && b.barcode !== null && typeof b.barcode !== 'string') return ctBad('barcode must be text or null.');
    const code = String(b.barcode ?? '').replace(/\s/g, '');
    if (!/^\d{8,14}$/.test(code)) return ctNo('rejected', 'A barcode is 8 to 14 digits.');
    if (code === (f.barcode ?? '')) return ctNo('unchanged', 'Nothing changed.');
    f.barcode = code;
    return ctOk(`Barcode ${code} saved for ${ref} ${f.name}.`);
  }
  if (action === 'basics') {
    for (const k of ['drink', 'hide']) if (b[k] !== undefined && b[k] !== null && typeof b[k] !== 'boolean') return ctBad(`${k} must be true or false.`);
    const name = ctTidy(b.name ?? f.name).slice(0, 120);
    if (name.length < 2) return ctNo('rejected', 'Give the food a name.');
    const drink = b.drink ?? f.drink;
    const hide = b.hide ?? !f.active;
    const said = [];
    if (name !== f.name) {
      if (state.cat.foods.some((x) => x.id !== f.id && ctKey(x.name) === ctKey(name))) return ctNo('rejected', `a food called '${name}' already exists`);
      said.push(`name "${name}"`);
    }
    if (drink !== f.drink) said.push(drink ? 'a drink' : 'not a drink');
    if (hide === f.active) said.push(hide ? 'hidden from the lists' : 'back in the lists');
    if (!said.length) return ctNo('unchanged', 'Nothing changed.');
    Object.assign(f, { name, drink, active: !hide });
    return ctOk(`${ref} ${name}: ${said.join(', ')}.`);
  }
  if (action === 'unit') {
    if (b.grams !== undefined && b.grams !== null && typeof b.grams !== 'number') return ctBad('grams must be a number.');
    const unit = ctTidy(b.unit).toLowerCase().slice(0, 30);
    if (!unit || !/\p{L}/u.test(unit) || ['g', 'ml', 'kg', 'l'].includes(unit)) return ctNo('rejected', 'Name the unit, e.g. slice, piece, scoop or cup.');
    const g = b.grams;
    if (typeof g !== 'number' || !(g > 0 && g <= 2000)) return ctNo('rejected', `Give its weight as a number above 0 and at most 2000 ${f.basis}.`);
    f.units = [...f.units.filter((u) => u.unit !== unit), { unit, grams: g }];
    return ctOk(`1 ${unit} of ${f.name} = ${g} ${f.basis}.`);
  }
  if (action === 'reviewed') {
    f.review = false;
    return ctOk(`Kept. ${ref} ${f.name} is no longer flagged.`);
  }
  return [404, { error: 'not_found', message: 'Not found.' }];
}

/** POST /lookup with view "catalogue": after a moment, the words typed read back as the door's question (Yes or No through /answer). */
async function catLookUp(b) {
  await new Promise((r) => setTimeout(r, 900)); // the look-up takes a moment: the button says it is working
  const word = ctTidy(b.text).slice(0, 120);
  if (!word) return rejected('Give a name or a barcode to look up.');
  const name = word[0].toUpperCase() + word.slice(1);
  const sample = SCAN.saves.lookup;
  const readBack = `Open Food Facts has ${name}: 61 kcal, P 1, F 2.3 (sat 0.3), C 9, sugar 4 per 100 g (it would be added as "${name}")`;
  const q = ask(sample.questions[0], null, readBack);
  state.day = { ...structuredClone(state.day) };
  state.day.needs.questions.unshift(q);
  state.cat.lookups.set(q.id, name);
  return { ...sample, questions: [q], read_back: `${readBack}.` };
}

/** POST /answer to a look-up of the catalogue: yes adds the food (with Undo, as the door's /answer), no closes the question. */
function catAnswer(b) {
  const name = state.cat.lookups.get(b.question_id);
  if (!name) return null;
  state.cat.lookups.delete(b.question_id);
  state.day = { ...structuredClone(state.day) };
  state.day.needs.questions = state.day.needs.questions.filter((q) => q.id !== b.question_id);
  if (String(b.reply).toLowerCase() !== 'yes') return { outcome: 'cancelled', head: 'Skipped.', undo: null };
  const id = state.cat.next++;
  state.before = { day: state.day, usual: state.usual, cat: structuredClone(state.cat) }; // Undo takes the new food out again
  state.cat.foods = [...state.cat.foods, { id, name, basis: 'g', drink: false, active: true, review: false, reason: null, aliases: [],
    units: [], barcode: null, values: { ...Object.fromEntries(CT_VALUES.map((v) => [v.key, null])), kcal: 61, protein: 1, fat: 2.3, sat_fat: 0.3, carbs: 9, sugar_total: 4 },
    eaten: 0, first: null, last: null, added: CT_TODAY, source: { line: 'database', source: 'database', brand: null, note: null }, recipe: null }];
  state.undo = { token: randomBytes(12).toString('base64url'), head: `Saved: + N${id} NEW food '${name}' (database)`, expires_at: new Date(Date.now() + 15 * 60_000).toISOString() };
  return { ...SCAN.saves.answer, v: undefined, receipt: [`+ N${id} NEW food '${name}' (database): per 100 g: 61 kcal, P 1.0, F 2.3 (sat 0.3), C 9.0`], notes: [], undo: state.undo };
}

// ---- Deploy 108: More's Search, Recent and Usage (tests/samples/search.json, recent.json, usage.json) ---------------------------------------------------
/** GET /search?q=: the sample of that word; under two letters the hint; "many": a food group cut at 15; any other word finds nothing. */
function searchOut(raw) {
  const q = raw.replace(/\s+/g, ' ').trim().slice(0, 80);
  if ([...q].length < 2) return { ...structuredClone(SEARCH.m.search), q };
  const key = q.toLowerCase();
  if (key === 'many') {
    const s = structuredClone(SEARCH.zzqq.search);
    s.foods.rows = Array.from({ length: 15 }, (_, i) => ({ id: `N${100 + i}`, food_id: 100 + i, name: `Invented many food ${i + 1}` }));
    s.foods.more = true;
    return { ...s, q };
  }
  return { ...structuredClone((SEARCH[key] ?? SEARCH.zzqq).search), q };
}

/** GET /recent: the sample; after POST /standin/recent-none no message and none waiting. */
const recentOut = () => (state.recentNone ? { ...structuredClone(RECENT.recent), days: [], not_read: 0 } : structuredClone(RECENT.recent));

/** GET /usage?r=: the sample of the range; after POST /standin/usage-empty no call in any range (no chart, no kinds, no costly message). */
function usageOut(r) {
  const u = structuredClone(USAGE[r].usage);
  if (!state.usageEmpty) return u;
  const none = { calls: 0, tokens_in: 0, tokens_out: 0, tokens_known: true, tokens_in_text: '0.0k', tokens_out_text: '0.0k', usd: 0, usd_text: '$0.00' };
  return { ...u, first: null, tiles: { ...u.tiles, calls: 0, usd: 0, usd_text: '$0.00', per_message: null, per_message_text: '–', messages: 0, tokens_in: 0, tokens_out: 0, tokens_text: '0k / 0k', tokens_known: true, tokens_note: null },
    chart: null, kinds: [], all: { kind: 'All', ...none }, kinds_note: null, pushes: 0, pushes_text: 'Phone notifications sent: 0 (free).', top: [] };
}

// ---- Deploy 106: Medical (Reports, Tests over time, Medication), from tests/samples/labs.json (real answers of the door for invented data) ------------
// The three tabs are worked out from the values, reports and courses as they stand: R1 to R3 get invented values of the same three tests as R4's (the
// sample gives the counts and the Vitamin D history; the flags follow a simple range rule: below the low end L, above the high end H, else none; an
// imaging value keeps A), so the list, the flagged chips, the tests' counts and the charts agree with each other.
const LB_TODAY = LABS.meds.labs_meds.today;
const LB_FLAGS = { H: 'high', L: 'low', A: 'abnormal' };
const LB_REPORT_REF = /^[Rr]?(\d{1,9})$/;

function lbParseRange(ref) {
  const t = String(ref ?? '').trim();
  let m = /^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)$/.exec(t);
  if (m) return [Number(m[1]), Number(m[2])];
  m = /^<\s*(\d+(?:\.\d+)?)$/.exec(t);
  if (m) return [null, Number(m[1])];
  m = /^>\s*(\d+(?:\.\d+)?)$/.exec(t);
  return m ? [Number(m[1]), null] : [null, null];
}

/** The tests, the reports and the values as the invented data has them. */
function labsStart() {
  const open4 = LABS.open.labs.open.values;
  const tests = new Map(open4.map((v) => [v.test_id, { id: v.test_id, name: v.test, unit: v.unit, ref: v.printed.ref }]));
  const liver = LABS.open_imaging.labs.open.values[0];
  tests.set(liver.test_id, { id: liver.test_id, name: liver.test, unit: null, ref: '' });
  const reports = LABS.reports.labs.reports.map((r) => ({ id: r.id, date: r.date, title: r.title, kind: r.kind, provider: r.provider ?? '', notes: '' }));
  const values = [];
  const num = (id, report_id, test_id, v) => values.push({ id, report_id, test_id, value: String(v), unit: tests.get(test_id).unit, ref: tests.get(test_id).ref, site: null, note: null, abnormal: false });
  // R1 to R3: three tests each (Haemoglobin, Ferritin, Vitamin D), invented
  [[1, 12.1, 20, 18], [2, 14, 120, 22], [3, 12.8, 410, 31]].forEach(([r, hb, fe, d], i) => {
    num(3 * i + 1, r, 19, hb);
    num(3 * i + 2, r, 20, fe);
    num(3 * i + 3, r, 21, d);
  });
  for (const v of open4) num(v.id, 4, v.test_id, v.printed.value);
  values.push({ id: liver.id, report_id: 5, test_id: liver.test_id, value: liver.printed.value, unit: null, ref: '', site: liver.site, note: null, abnormal: true });
  const meds = LABS.meds.labs_meds.meds.map((m) => ({ id: m.id, name: m.name, ingredient: m.ingredient, dose: m.dose, frequency: m.frequency, indication: m.indication, start: m.start, stop: m.stop }));
  return { tests, reports, values, meds, nextValue: 20, nextMed: 5, asks: new Map() };
}

const lbDmy = (iso) => (iso ? dmy3(iso) : null);
const lbNumber = (v) => (/^-?\d+(?:\.\d+)?$/.test(v.value) ? Number(v.value) : null);
function lbFlag(v) {
  if (v.abnormal) return 'A';
  const n = lbNumber(v);
  const [low, high] = lbParseRange(v.ref);
  if (n === null) return 'N';
  return low !== null && n < low ? 'L' : high !== null && n > high ? 'H' : 'N';
}
const lbText = (v) => [v.value, v.unit].filter(Boolean).join(' ');

/** A lab value as the door sends it (LabValue). */
function lbValueOut(v) {
  const t = state.labs.tests.get(v.test_id);
  const [low, high] = lbParseRange(v.ref);
  const flag = lbFlag(v);
  return { id: v.id, ref: `V${v.id}`, test_id: v.test_id, test: t.name, note: v.note, text: lbText(v), value: lbNumber(v), unit: v.unit || null,
    range: v.ref || '-', ref_low: low, ref_high: high, flag, flag_word: LB_FLAGS[flag] ?? null, site: v.site, printed: { value: v.value, unit: v.unit ?? '', ref: v.ref } };
}

const lbReportOf = (id) => state.labs.reports.find((r) => r.id === id);
const lbValuesOf = (id) => state.labs.values.filter((v) => v.report_id === id).sort((a, b) => a.id - b.id);
const lbFlagged = (v) => ['H', 'L', 'A'].includes(lbFlag(v));

/** GET /labs?open=: the Reports tab (the flagged card of the newest lab report, the reports newest first, the open one). */
function labsOut(openRaw) {
  const L = state.labs;
  const reports = [...L.reports].sort((a, b) => (a.date === b.date ? b.id - a.id : a.date < b.date ? 1 : -1));
  const newest = reports.find((r) => r.kind === 'lab');
  const chips = newest ? lbValuesOf(newest.id).filter(lbFlagged).map(lbValueOut).sort((a, b) => a.test.localeCompare(b.test))
    .map((v) => ({ test_id: v.test_id, test: v.test, value: v.text, range: v.range, flag: v.flag, flag_word: v.flag_word })) : [];
  const flagged = newest && { report_id: newest.id, ref: `R${newest.id}`, date: newest.date, date_text: lbDmy(newest.date), title: newest.title,
    heading: LABS.reports.labs.flagged.heading, hint: LABS.reports.labs.flagged.hint, empty: chips.length ? null : 'Nothing flagged.', chips };
  const m = LB_REPORT_REF.exec(String(openRaw ?? ''));
  const o = m ? lbReportOf(Number(m[1])) : null;
  const sample = LABS.open.labs.open;
  const open = o && { id: o.id, ref: `R${o.id}`, date: o.date, date_text: lbDmy(o.date), title: o.title, kind: o.kind, provider: o.provider || null, notes: o.notes || null,
    values: lbValuesOf(o.id).map(lbValueOut), empty: lbValuesOf(o.id).length ? null : 'No values in this report.',
    form: { collected: o.date, title: o.title, provider: o.provider, notes: o.notes }, value_hint: sample.value_hint, report_hint: sample.report_hint };
  return { flagged, reports: reports.map((r) => ({ id: r.id, ref: `R${r.id}`, date: r.date, date_text: lbDmy(r.date), title: r.title, kind: r.kind, provider: r.provider || null,
    values: lbValuesOf(r.id).length, flagged: lbValuesOf(r.id).filter(lbFlagged).length })), empty: reports.length ? null : 'No reports yet.',
    hint: LABS.reports.labs.hint, open, limits: LABS.reports.labs.limits };
}

/** One test's values, oldest first, with the date and site. */
function lbRows(testId) {
  return state.labs.values.filter((v) => v.test_id === testId).map((v) => ({ v, r: lbReportOf(v.report_id) })).sort((a, b) => (a.r.date === b.r.date ? a.v.id - b.v.id : a.r.date < b.r.date ? -1 : 1));
}

/** app.'s test_chart: the band from the newest value, the dots by flag, a line when there is one value a day; or the thin cases' words. */
function lbCard(test) {
  const rows = lbRows(test.id);
  const nums = rows.filter(({ v }) => lbNumber(v) !== null);
  const card = { id: 'test', title: test.name, small: `${rows.length} values`, stat: [], chart: null, legend: [], note: null };
  const dates = [...new Set(nums.map(({ r }) => r.date))].sort();
  if (dates.length >= 2) {
    const first = dates[0];
    const days = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400_000);
    const pt = ({ v, r }) => [days(first, r.date), lbNumber(v), `${lbDmy(r.date)}: ${lbText(v)}${v.site ? ` (${v.site})` : ''}`];
    const newest = rows.at(-1).v;
    const band = lbParseRange(newest.ref);
    const one = dates.length === nums.length;
    const dot = (cls, pick) => ({ mark: 'dot', cls, pts: nums.filter(({ v }) => pick(lbFlag(v))).map(pt) });
    card.chart = { start: first, days: days(first, dates.at(-1)) + 1, label: `${test.name} over time`, years: true, band: band.some((b) => b !== null) ? band : null,
      series: [...(one ? [{ mark: 'line', cls: 'a', pts: nums.map(pt) }] : []), dot('a', (f) => !['H', 'L', 'A'].includes(f)), dot('w', (f) => f === 'H' || f === 'L'), dot('r', (f) => f === 'A')] };
    card.legend = [{ key: 'sq band', text: 'reference range (from the newest value)' }, { key: 'w', text: 'outside the range' + (one ? '' : '; no line: some days have several values') }];
  } else if (nums.length > 1) card.note = 'All values are from one day (different sites); see them below. The chart starts with a second day.';
  else if (nums.length) card.note = 'Only one value so far; the chart starts with the second.';
  return card;
}

/** GET /labs/tests?q=&t=: the list (tests with numbers on three or more days, or the matches of q; one match opens it) or a test with its chart and rows. */
function testsOut(q0, t0) {
  const L = state.labs;
  const q = String(q0 ?? '').slice(0, 60).trim();
  const count = (id) => L.values.filter((v) => v.test_id === id).length;
  let test = /^\d{1,9}$/.test(String(t0 ?? '')) ? L.tests.get(Number(t0)) ?? null : null;
  let matches = [];
  if (q && !test) {
    matches = [...L.tests.values()].filter((t) => t.name.toLowerCase().includes(q.toLowerCase())).sort((a, b) => count(b.id) - count(a.id) || a.name.localeCompare(b.name));
    if (matches.length === 1) test = matches[0];
  }
  if (!test && !q) {
    matches = [...L.tests.values()].filter((t) => new Set(lbRows(t.id).map(({ r }) => r.date)).size >= 3).sort((a, b) => count(b.id) - count(a.id) || a.name.localeCompare(b.name));
  }
  const ref = (t) => ({ id: t.id, name: t.name, unit: t.unit, values: count(t.id) });
  const listed = matches.length > 0 && !test;
  const rows = test ? lbRows(test.id).reverse().map(({ v, r }) => {
    const o = lbValueOut(v);
    return { id: v.id, date: r.date, date_text: lbDmy(r.date), site: v.site, value: o.text, range: o.range, flag: o.flag, flag_word: o.flag_word, report_id: r.id, report_ref: `R${r.id}` };
  }) : [];
  return { q, placeholder: LABS.tests.labs_tests.placeholder, title: !q && !test && listed ? LABS.tests.labs_tests.title : null,
    empty: !test && !listed ? (q ? 'No test with that name. Try another word.' : 'No test has numbers on three or more days yet.') : null,
    tests: listed ? matches.map(ref) : [], test: test ? ref(test) : null, card: test ? lbCard(test) : null, rows };
}

/** The courses in app.'s order (running first, then by start, newest first), as the door sends them. */
function medsOut() {
  const meds = state.labs.meds.map((m) => {
    const running = !m.stop || m.stop > LB_TODAY;
    return { id: m.id, ref: `D${m.id}`, name: m.name, ingredient: m.ingredient, dose: m.dose, frequency: m.frequency, indication: m.indication, start: m.start, stop: m.stop,
      start_text: lbDmy(m.start), stop_text: lbDmy(m.stop), running, can_end: running && !m.stop };
  }).sort((a, b) => (a.running === b.running ? (a.start < b.start ? 1 : a.start > b.start ? -1 : b.id - a.id) : a.running ? -1 : 1));
  const M = LABS.meds.labs_meds;
  return { today: LB_TODAY, running: meds.filter((m) => m.running).length, empty: meds.length ? null : 'No medication recorded.', hint: M.hint, form_hint: M.form_hint, meds, limits: M.limits };
}

const lbNo = (outcome, reason) => [200, { outcome, head: outcome === 'unchanged' ? 'Nothing changed.' : 'Nothing saved.', reason, undo: null }];
const lbOk = (head) => [200, { outcome: 'changed', head, undo: null }];
const lbAsk = (readBack, label) => {
  const { v: _v, ...ask } = LABS.saves.value_ask;
  return [200, { ...ask, read_back: readBack, confirm: { label, no_label: 'No' }, undo: null }];
};
const lbIsDate = (s) => typeof s === 'string' && /^\d{4}-\d\d-\d\d$/.test(s) && !Number.isNaN(Date.parse(s));
const lbTidy = (x) => String(x ?? '').split(/\s+/).filter(Boolean).join(' ');

/** POST /labs/value, /labs/report, /labs/med: shown first (needs_confirmation), made with confirmed; the door's refusals and words; no key, no Undo. */
function labsSave(action, b) {
  const L = state.labs;
  if (!Number.isInteger(b.id)) return [400, { error: 'bad_request', message: 'id must be a number.' }];
  if (b.confirmed !== undefined && typeof b.confirmed !== 'boolean') return [400, { error: 'bad_request', message: 'confirmed must be true or false.' }];
  const text = (k, most) => {
    if (!(k in b)) return undefined;
    if (b[k] === null) return '';
    if (typeof b[k] !== 'string') return null;
    return b[k];
  };
  if (action === 'value') {
    const v = L.values.find((x) => x.id === b.id);
    if (!v) return lbNo('rejected', 'That value is not there any more.');
    const nv = text('value'), nu = text('unit'), nr = text('ref');
    if ([nv, nu, nr].includes(null)) return [400, { error: 'bad_request', message: 'value must be text or null.' }];
    const next = { value: nv === undefined ? v.value : lbTidy(nv), unit: nu === undefined ? v.unit ?? '' : lbTidy(nu), ref: nr === undefined ? v.ref : lbTidy(nr) };
    if (!next.value) return lbNo('rejected', 'The value cannot be empty.');
    if (next.value.length > 60 || next.unit.length > 30 || next.ref.length > 60) return [400, { error: 'bad_request', message: 'The text is too long.' }];
    const changed = ['value', 'unit', 'ref'].filter((k) => next[k] !== (k === 'unit' ? v.unit ?? '' : v[k]));
    if (!changed.length) return [200, { outcome: 'unchanged', head: 'Nothing changed.', reason: 'Nothing changed.', undo: null }];
    const after = { ...v, value: next.value, unit: next.unit || null, ref: next.ref };
    const t = L.tests.get(v.test_id);
    const flag = lbFlag(after);
    if (b.confirmed !== true) return lbAsk(`OK changed V${v.id}: conversion, flag, qualifier, ref_high, ref_low, ref_range_raw, unit, unit_raw, value, value_raw, value_text\nnow: ${t.name} ${lbText(after)} [${after.ref || '-'}]${flag === 'N' ? '' : ` ${flag}`}`, 'Yes, change');
    Object.assign(v, after);
    return lbOk(`Changed ${t.name}.`);
  }
  if (action === 'report') {
    const r = lbReportOf(b.id);
    if (!r) return lbNo('rejected', 'That report is not there any more.');
    const got = { collected: !('collected' in b) ? undefined : b.collected === null ? '' : b.collected, title: text('title'), provider: text('provider'), notes: text('notes') };
    if (got.collected !== undefined && typeof got.collected !== 'string') return [400, { error: 'bad_request', message: 'collected must be a date yyyy-mm-dd or null.' }];
    if ([got.title, got.provider, got.notes].includes(null)) return [400, { error: 'bad_request', message: 'The text must be text or null.' }];
    const next = { collected: got.collected ?? r.date, title: lbTidy(got.title ?? r.title), provider: lbTidy(got.provider ?? r.provider), notes: (got.notes ?? r.notes).trim() };
    if (!lbIsDate(next.collected)) return lbNo('rejected', "Give the report's date.");
    if (!next.title) return lbNo('rejected', 'The title cannot be empty.');
    if (!next.provider) return lbNo('rejected', 'The lab cannot be empty.');
    const changed = [['collected', r.date], ['title', r.title], ['provider', r.provider], ['notes', r.notes]].filter(([k, was]) => next[k] !== was).map(([k]) => k);
    if (!changed.length) return [200, { outcome: 'unchanged', head: 'Nothing changed.', reason: 'Nothing changed.', undo: null }];
    if (b.confirmed !== true) return lbAsk(`OK changed R${r.id}: ${changed.join(', ')}\nnow: ${lbDmy(next.collected)} ${next.title} (${next.provider})`, 'Yes, change');
    Object.assign(r, { date: next.collected, title: next.title, provider: next.provider, notes: next.notes });
    return lbOk('Changed the report.');
  }
  if (action === 'med') {
    const m = L.meds.find((x) => x.id === b.id);
    if (!m) return lbNo('rejected', 'That course is not there any more.');
    if (!['save', 'end'].includes(b.act)) return [400, { error: 'bad_request', message: 'act must be save or end.' }];
    const line = (x) => `D${x.id} ${x.name}${x.ingredient ? ` (${x.ingredient})` : ''} ${[x.dose, x.frequency].filter(Boolean).join(' ')}, from ${lbDmy(x.start)}${x.stop ? ` to ${lbDmy(x.stop)}` : ''}`;
    if (b.act === 'end') {
      if (m.stop) return [200, { outcome: 'unchanged', head: 'Nothing changed.', reason: 'That course has a stop date already.', undo: null }];
      if (b.confirmed !== true) return lbAsk(`OK changed D${m.id}: stop_date\nnow: ${line({ ...m, stop: LB_TODAY })}`, 'Yes, end it today');
      m.stop = LB_TODAY;
      return lbOk(`${m.name} ended today.`);
    }
    const fields = ['dose', 'frequency', 'indication'];
    const next = Object.fromEntries(fields.map((k) => [k, k in b ? lbTidy(b[k] ?? '') : m[k] ?? '']));
    next.start = !('start' in b) ? m.start : b.start === null ? '' : b.start;
    next.stop = !('stop' in b) ? m.stop ?? '' : b.stop === null ? '' : b.stop;
    if (!lbIsDate(next.start)) return lbNo('rejected', 'Give the start as a date.');
    if (next.stop && !lbIsDate(next.stop)) return lbNo('rejected', 'Give the stop as a date, or leave it empty.');
    if (next.stop && next.stop < next.start) return lbNo('rejected', `stop ${lbDmy(next.stop)} lies before start ${lbDmy(next.start)}`);
    const changed = [...fields, 'start', 'stop'].filter((k) => (next[k] || null) !== (m[k] || null));
    if (!changed.length) return [200, { outcome: 'unchanged', head: 'Nothing changed.', reason: 'Nothing changed.', undo: null }];
    const after = { ...m, ...Object.fromEntries(fields.map((k) => [k, next[k] || null])), start: next.start, stop: next.stop || null };
    if (b.confirmed !== true) return lbAsk(`OK changed D${m.id}: ${changed.join(', ')}\nnow: ${line(after)}`, 'Yes, change');
    Object.assign(m, after);
    return lbOk(`Changed ${m.name}.`);
  }
  return [404, { error: 'not_found', message: 'Not found.' }];
}

/** POST /log with view "labs_meds": "started vitamin D 1000 IU daily" read back as the door's question (Yes or No through /answer); null: not a course. */
function labsLog(b) {
  const words = lbTidy(b.text);
  const m = /^(?:started|start|begin|began)\s+(.+?)\s+(\d+(?:[.,]\d+)?\s*(?:mg|g|µg|mcg|iu|ml))\s*(.*)$/i.exec(words);
  if (!m) return null;
  const dose = m[2].replace(/\s+/, ' ').replace(/iu$/i, 'IU');
  const name = `${m[1][0].toUpperCase()}${m[1].slice(1)} ${dose}`;
  const course = { name, ingredient: null, dose, frequency: m[3] || null, indication: null, start: LB_TODAY, stop: null };
  const readBack = `start ${name} ${m[3] || ''}`.replace(/\s+$/, '') + ` from ${lbDmy(LB_TODAY)}`;
  const q = ask(LABS.saves.log_ask.questions[0], words, readBack);
  state.day = { ...structuredClone(state.day) };
  state.day.needs.questions.unshift(q);
  state.labs.asks.set(q.id, course);
  const { v: _v, ...rest } = LABS.saves.log_ask;
  return { ...rest, questions: [q], read_back: `Preview, nothing changed yet:\n${readBack}` };
}

/** POST /answer to a typed course: yes adds the course, no closes the question. */
function labsAnswer(b) {
  const course = state.labs.asks.get(b.question_id);
  if (!course) return null;
  state.labs.asks.delete(b.question_id);
  state.day = { ...structuredClone(state.day) };
  state.day.needs.questions = state.day.needs.questions.filter((q) => q.id !== b.question_id);
  const { v: _v, ...yes } = LABS.saves.log_yes;
  if (String(b.reply).toLowerCase() !== 'yes') return { outcome: 'cancelled', head: 'Skipped.', undo: null };
  const id = state.labs.nextMed++;
  state.labs.meds = [...state.labs.meds, { id, ...course }];
  return { ...yes, receipt: [`+ D${id} ${course.name} ${course.frequency ?? ''}, from ${lbDmy(LB_TODAY)}`.replace(' ,', ',')], undo: null };
}


reset();

createServer(async (req, res) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const buf = Buffer.concat(chunks);
  const multipart = /^multipart\/form-data/.test(req.headers['content-type'] ?? '');
  const raw = multipart ? '' : buf.toString('utf8');
  const seen = Object.keys(req.headers).sort().join(' ');
  console.log(`${req.method} ${req.url}  headers: ${seen}${raw && req.url !== '/api/v1/session' ? `  body: ${raw}` : ''}${multipart ? `  multipart: ${buf.length} bytes` : ''}`);
  if (req.url === '/standin/reset' && req.method === 'POST') {
    reset();
    mode = 'up';
    return send(res, 200, { outcome: 'reset' });
  }
  // deploy 102: the Week's states (see weekOut), and how many review starts the stand-in got
  if (req.url.startsWith('/standin/week?') && req.method === 'POST') {
    const q = new URL(req.url, 'http://standin').searchParams;
    for (const k of ['last', 'this']) if (q.has(k)) state.week[k] = q.get(k);
    for (const k of ['monday', 'latest', 'limit', 'fail']) if (q.has(k)) state.week[k] = q.get(k) === '1';
    for (const k of ['foods', 'polls']) if (q.has(k)) state.week[k] = Number(q.get(k));
    return send(res, 200, { outcome: 'week', week: { ...state.week, coachings: [...state.week.coachings] } });
  }
  if (req.url.startsWith('/standin/trends?') && req.method === 'POST') {
    state.fail = new Set((new URL(req.url, 'http://standin').searchParams.get('fail') ?? '').split(',').filter(Boolean));
    return send(res, 200, { outcome: 'trends', fail: [...state.fail] });
  }
  if (req.url === '/standin/body-none' && req.method === 'POST') {
    state.sessions = {};
    return send(res, 200, { outcome: 'body-none' });
  }
  if (req.url === '/standin/week-starts' && req.method === 'GET') return send(res, 200, { starts: state.week.starts });
  if (req.url === '/standin/slow' && req.method === 'POST') {
    state.slow = 700; // the next day taps of the Habits page (and the Gym's ticks) take a moment
    return send(res, 200, { outcome: 'slow' });
  }
  // Medical (deploy 106): no reports and no courses; an imaging report with no values but notes; every value on one day; a course ended
  // elsewhere (POST /standin/labs-end?id=1: its End on a page that does not know yet is refused in the door's words)
  if (req.url === '/standin/labs-empty' && req.method === 'POST') {
    Object.assign(state.labs, { reports: [], values: [], meds: [] });
    return send(res, 200, { outcome: 'labs-empty' });
  }
  if (req.url === '/standin/labs-novalues' && req.method === 'POST') {
    state.labs.values = state.labs.values.filter((v) => v.report_id !== 5);
    lbReportOf(5).notes = 'Notes of the invented ultrasound.';
    return send(res, 200, { outcome: 'labs-novalues' });
  }
  if (req.url === '/standin/labs-oneday' && req.method === 'POST') {
    for (const r of state.labs.reports) r.date = '2026-10-05';
    return send(res, 200, { outcome: 'labs-oneday' });
  }
  if (req.url.startsWith('/standin/labs-end') && req.method === 'POST') {
    const m = state.labs.meds.find((x) => x.id === Number(new URL(req.url, 'http://standin').searchParams.get('id')));
    if (m) m.stop = LB_TODAY;
    return send(res, 200, { outcome: 'labs-end' });
  }
  if (req.url === '/standin/recent-none' && req.method === 'POST') {
    state.recentNone = true;
    return send(res, 200, { outcome: 'recent-none' });
  }
  if (req.url === '/standin/usage-empty' && req.method === 'POST') {
    state.usageEmpty = true;
    return send(res, 200, { outcome: 'usage-empty' });
  }
  if (req.url === '/standin/watch-none' && req.method === 'POST') {
    state.watchNone = true; // the watch has sent nothing: Activity shows the set-up guide
    return send(res, 200, { outcome: 'watch-none' });
  }
  if (req.url === '/standin/gym-empty' && req.method === 'POST') {
    Object.assign(state.gym, { ex: [], days: [], plan: new Map(), day: null, auto: null, logs: [] }); // no exercises, no days
    state.gymEmpty = true;
    return send(res, 200, { outcome: 'gym-empty' });
  }
  // Home (deploy 99): an open timer running (15 minutes on the first job), one about to end (6 seconds left), one paused, no chores
  if (['/standin/home-running', '/standin/home-ending', '/standin/home-paused'].includes(req.url) && req.method === 'POST') {
    const job = hmCandidates(15)[0];
    const s = req.url.endsWith('ending') ? 6 : req.url.endsWith('paused') ? 425 : 900;
    state.home.timer = { id: ++state.home.timerIds, minutes: 15, pairs: job.pairs, endsAt: req.url.endsWith('paused') ? null : Date.now() + s * 1000,
      leftS: req.url.endsWith('paused') ? s : null, closed: false };
    return send(res, 200, { outcome: req.url.slice('/standin/'.length) });
  }
  if (req.url === '/standin/home-closed' && req.method === 'POST') {
    hmCloseTimer(); // the timer stopped elsewhere (app. or another device): the page's next timer button is refused
    return send(res, 200, { outcome: 'home-closed' });
  }
  // deploy 100: History with 70 more rows (Show more), History with nothing ticked
  if (req.url === '/standin/home-many' && req.method === 'POST') {
    const p = state.home.pairs.find((x) => x.chore_id === 3);
    for (let i = 0; i < 70; i++) {
      const ago = 20 + i;
      const day = shiftIso(HM_TODAY, -ago);
      const id = ++state.home.doneIds;
      p.done.push({ ago, at: hmNoon(ago), id });
      state.home.recent.push({ ids: [id], chore_id: p.chore_id, chore: p.name, zones: [p.zone], flat: false, label: p.label, at: `${day}T20:00:00+01:00`, day, dated: false, source: 'web', how: 'ticked', time: '20:00', when: `${ddmm(day)} 20:00` });
    }
    state.home.recent.sort((a, b) => (a.at < b.at ? 1 : -1));
    return send(res, 200, { outcome: 'home-many' });
  }
  if (req.url === '/standin/home-bare' && req.method === 'POST') {
    // two more zones with no chore at all (the whole-flat ones are off there): "no recurring chores", and Storage with its link to Todoist
    const cfg = state.home.cfg;
    for (const name of ['Balcony', 'Storage']) {
      const zone_id = cfg.nextZone++;
      cfg.zones.push({ zone_id, name, short: name, spots: [], words: [], active: true });
      for (const c of cfg.chores) if (c.zone_id === null) c.off.push(zone_id);
    }
    hmSync(state.home);
    return send(res, 200, { outcome: 'home-bare' });
  }
  if (req.url === '/standin/home-nohistory' && req.method === 'POST') {
    state.home.recent = [];
    return send(res, 200, { outcome: 'home-nohistory' });
  }
  if (req.url === '/standin/home-empty' && req.method === 'POST') {
    state.home.empty = true; // no zones or chores: Now's empty card, Pick's, no card on Today
    return send(res, 200, { outcome: 'home-empty' });
  }
  if (req.url === '/standin/week-done' && req.method === 'POST') {
    state.gym.done.set(1, '2026-11-16'); // Day 1 counts as done this week
    return send(res, 200, { outcome: 'week-done' });
  }
  if (req.url === '/standin/locked' && req.method === 'POST') {
    state.locked = new Set(['meds']); // the read marks Medication as not editable (a time, as Wake-up would be)
    return send(res, 200, { outcome: 'locked' });
  }
  if (req.url === '/standin/label-unreadable' && req.method === 'POST') {
    state.labelFail = true; // the next label read fails, as when the table is cut off
    return send(res, 200, { outcome: 'label-unreadable' });
  }
  if (['/standin/ai-down', '/standin/ai-up'].includes(req.url) && req.method === 'POST') {
    state.aiDown = req.url.endsWith('down');
    return send(res, 200, { outcome: req.url.slice(9) });
  }
  if (['/standin/core-down', '/standin/door-off', '/standin/up'].includes(req.url) && req.method === 'POST') {
    mode = req.url.slice('/standin/'.length);
    return send(res, 200, { outcome: mode });
  }
  if (mode === 'core-down') return req.socket.destroy(); // no answer at all, as from a stopped core
  if (mode === 'door-off') return send(res, 404, { error: 'not_found', message: 'Not found.' });
  if (req.url === '/standin/drop-sessions' && req.method === 'POST') {
    sessions.clear(); // as if the session ended elsewhere: the next call is signed out
    return send(res, 200, { outcome: 'dropped' });
  }
  if (!token || req.headers['x-front-token'] !== token || PROXY.some((h) => h in req.headers)) {
    return send(res, 404, { error: 'not_found', message: 'Not found.' });
  }
  const bearer = (req.headers.authorization ?? '').replace(/^Bearer /, '');
  const body = raw ? JSON.parse(raw) : {};
  if (req.url === '/api/v1/session' && req.method === 'POST') {
    if (body.password !== 'test' || body.code !== '123456') {
      return send(res, 401, { error: 'wrong_credentials', message: 'Wrong password or code.' });
    }
    const t = randomBytes(32).toString('base64url');
    sessions.add(t);
    return send(res, 201, { token: t, device: body.device ?? randomBytes(32).toString('base64url'), expires_at: ends() });
  }
  if (!sessions.has(bearer)) return send(res, 401, { error: 'signed_out', message: 'Sign in again.' });
  const signedIn = { 'X-Session-Expires': ends() };
  const undo = () => (state.undo && Date.parse(state.undo.expires_at) > Date.now() ? state.undo : null);
  if (req.url === '/api/v1/session' && req.method === 'GET') {
    return send(res, 200, { signed_in: true, sid: '00000000-0000-0000-0000-000000000000', expires_at: ends() }, signedIn);
  }
  if (req.url.startsWith('/api/v1/day') && req.method === 'GET') return send(res, 200, { day: { ...dayOut(state.day), home: homeCard() }, undo: undo() }, signedIn);
  const url = new URL(req.url, 'http://standin');
  // deploy 103: POST /standin/trends?fail=food,health,body,gym,insights makes those reads answer 500 (a section's problem on Trends' Charts
  // tab, the others drawn); POST /standin/body-none: no body session at all (Body's empty words)
  const failing = { '/api/v1/food/trends': 'food', '/api/v1/health': 'health', '/api/v1/body': 'body', '/api/v1/gym/progress': 'gym', '/api/v1/insights': 'insights' }[url.pathname];
  if (failing && req.method === 'GET' && state.fail.has(failing)) return send(res, 500, { error: 'server_error', message: 'Something went wrong.' }, signedIn);
  if (url.pathname === '/api/v1/food/trends' && req.method === 'GET') {
    const r = url.searchParams.get('range') ?? '30';
    if (!['7', '30', '90'].includes(r)) return send(res, 400, { error: 'bad_request', message: 'range must be 7, 30 or 90.' }, signedIn);
    return send(res, 200, { trends: structuredClone(FOODTRENDS[r].trends), undo: undo() }, signedIn);
  }
  if (url.pathname === '/api/v1/insights' && req.method === 'GET') return send(res, 200, { insights: structuredClone(INSIGHTS.insights.insights), undo: undo() }, signedIn);
  if (url.pathname === '/api/v1/food/day' && req.method === 'GET') {
    return send(res, 200, { food_day: foodDay(url.searchParams.get('day')), undo: undo() }, signedIn);
  }
  if (url.pathname === '/api/v1/food/entry' && req.method === 'GET') {
    const entry = foodEntry(url.searchParams.get('ref'));
    return entry ? send(res, 200, { entry }, signedIn) : send(res, 404, { error: 'no_entry', message: 'No such entry.' }, signedIn);
  }
  if (url.pathname === '/api/v1/usual' && req.method === 'GET') return send(res, 200, { usual: state.usual, undo: undo() }, signedIn);
  if ((url.pathname === '/api/v1/health' || url.pathname === '/api/v1/body') && req.method === 'GET') {
    const r = url.searchParams.get('range') ?? '30';
    if (!['7', '30', '90'].includes(r)) return send(res, 400, { error: 'bad_request', message: 'range must be 7, 30 or 90.' }, signedIn);
    if (url.pathname.endsWith('/body')) return send(res, 200, { body: bodyOut(url.searchParams.get('day')), undo: undo() }, signedIn);
    return send(res, 200, { health: healthOut(Number(r), url.searchParams.get('all') === '1'), undo: undo() }, signedIn);
  }
  if (url.pathname === '/api/v1/habits' && req.method === 'GET') {
    const show = url.searchParams.get('show') ?? 'tracked';
    if (!['tracked', 'untracked', 'retired', 'all'].includes(show)) return send(res, 400, { error: 'bad_request', message: 'show must be tracked, untracked, retired or all.' }, signedIn);
    return send(res, 200, { habits: habitsOut(show), undo: undo() }, signedIn);
  }
  if ((url.pathname === '/api/v1/foods/barcode' || url.pathname === '/api/v1/foods/off') && req.method === 'GET') {
    const code = codeOf(url);
    if (!code) return send(res, 400, { error: 'bad_request', message: 'A barcode is 8 to 14 digits.' }, signedIn);
    if (url.pathname.endsWith('/barcode')) return send(res, 200, { code, food: state.scanned.get(code) ?? null }, signedIn);
    const { v: _v, ...off } = code === SCAN.barcode_none.code ? SCAN.off_none : SCAN.off;
    return send(res, 200, off, signedIn);
  }
  if (url.pathname === '/api/v1/food/label' && req.method === 'POST') {
    if (!multipart) return send(res, 400, { error: 'bad_request', message: 'Send the photos as multipart/form-data, in the field photo.' }, signedIn);
    const [status, out] = await labelRead(buf, req.headers['content-type']);
    const { v: _v, ...rest } = out;
    return send(res, status, rest, signedIn);
  }
  if (url.pathname === '/api/v1/home' && req.method === 'GET') return send(res, 200, { home: homeOut(url.searchParams.get('min')), undo: undo() }, signedIn);
  if (url.pathname === '/api/v1/home/pick' && req.method === 'GET') {
    return send(res, 200, { home_pick: pickOut(url.searchParams.get('min'), url.searchParams.get('n')), undo: undo() }, signedIn);
  }
  if (url.pathname === '/api/v1/home/zones' && req.method === 'GET') return send(res, 200, { home_zones: hmZonesOut(), undo: undo() }, signedIn);
  if (url.pathname === '/api/v1/home/history' && req.method === 'GET') return send(res, 200, { home_history: hmHistoryOut(url.searchParams.get('n')), undo: undo() }, signedIn);
  if (url.pathname === '/api/v1/home/edit' && req.method === 'GET') return send(res, 200, { home_edit: hmEditOut(), undo: undo() }, signedIn);
  if (url.pathname === '/api/v1/home/chore' && req.method === 'GET') {
    const id = url.searchParams.get('id');
    if (id === null || !/^\d+$/.test(id)) return send(res, 400, { error: 'bad_request', message: "id must be a chore's id." }, signedIn);
    const chore = hmChoreOut(id);
    return chore ? send(res, 200, { home_chore: chore, undo: undo() }, signedIn) : send(res, 404, { error: 'no_entry', message: 'That chore is not in the list.' }, signedIn);
  }
  if (url.pathname === '/api/v1/week' && req.method === 'GET') {
    const p = url.searchParams.get('p') ?? '7';
    if (!['7', 'last', '30', 'this'].includes(p)) return send(res, 400, { error: 'bad_request', message: 'p must be 7, last, 30 or this.' }, signedIn);
    return send(res, 200, { week: weekOut(p), undo: undo() }, signedIn);
  }
  if (url.pathname === '/api/v1/coach/status' && req.method === 'GET') {
    const id = url.searchParams.get('id') ?? '';
    if (!/^\d+$/.test(id)) return send(res, 400, { error: 'bad_request', message: "id must be a coaching's id." }, signedIn);
    return send(res, 200, { coaching: coachStatus(id), undo: undo() }, signedIn);
  }
  if (url.pathname === '/api/v1/food/catalogue' && req.method === 'GET') {
    const f = url.searchParams.get('f') || 'all';
    const so = url.searchParams.get('s') || 'eaten';
    if (!CT_F.includes(f)) return send(res, 400, { error: 'bad_request', message: 'f must be all, drinks, new or review.' }, signedIn);
    if (!CT_S.includes(so)) return send(res, 400, { error: 'bad_request', message: `s must be ${CT_S.slice(0, -1).join(', ')} or ${CT_S.at(-1)}.` }, signedIn);
    return send(res, 200, { catalogue: catalogueOut(url.searchParams.get('q') ?? '', f, so), undo: undo() }, signedIn);
  }
  if (url.pathname === '/api/v1/food/item' && req.method === 'GET') {
    const m = /^[Nn]?(\d{1,9})$/.exec(url.searchParams.get('id') ?? '');
    if (!m) return send(res, 400, { error: 'bad_request', message: "id must be a food's id (N12 or 12)." }, signedIn);
    const item = itemOut(Number(m[1]));
    return item ? send(res, 200, { food_item: item, undo: undo() }, signedIn) : send(res, 404, { error: 'no_entry', message: 'That food is not there any more.' }, signedIn);
  }
  if (url.pathname === '/api/v1/labs' && req.method === 'GET') {
    const open = url.searchParams.get('open');
    if (open !== null && open !== '' && !LB_REPORT_REF.test(open)) return send(res, 400, { error: 'bad_request', message: "open must be a report's id (R12 or 12)." }, signedIn);
    return send(res, 200, { labs: labsOut(open), undo: undo() }, signedIn);
  }
  if (url.pathname === '/api/v1/labs/tests' && req.method === 'GET') {
    const t = url.searchParams.get('t');
    if (t !== null && t !== '' && !/^\d{1,9}$/.test(t)) return send(res, 400, { error: 'bad_request', message: "t must be a test's id." }, signedIn);
    return send(res, 200, { labs_tests: testsOut(url.searchParams.get('q') ?? '', t), undo: undo() }, signedIn);
  }
  if (url.pathname === '/api/v1/labs/meds' && req.method === 'GET') return send(res, 200, { labs_meds: medsOut(), undo: undo() }, signedIn);
  if (url.pathname === '/api/v1/gym' && req.method === 'GET') return send(res, 200, { gym: gymOut(), undo: undo() }, signedIn);
  if (url.pathname === '/api/v1/gym/plan' && req.method === 'GET') return send(res, 200, { gym_plan: planOut(), undo: undo() }, signedIn);
  if (url.pathname === '/api/v1/gym/exercises' && req.method === 'GET') return send(res, 200, { gym_exercises: exercisesOut(), undo: undo() }, signedIn);
  if (url.pathname === '/api/v1/gym/history' && req.method === 'GET') {
    const w = url.searchParams.get('w');
    if (w !== null && !/^\d+$/.test(w)) return send(res, 400, { error: 'bad_request', message: "w must be a workout's id." }, signedIn);
    return send(res, 200, { gym_history: historyOut(w), undo: undo() }, signedIn);
  }
  if (url.pathname === '/api/v1/search' && req.method === 'GET') return send(res, 200, { v: 1, search: searchOut(url.searchParams.get('q') ?? ''), undo: undo() }, signedIn);
  if (url.pathname === '/api/v1/recent' && req.method === 'GET') return send(res, 200, { v: 1, recent: recentOut(), undo: undo() }, signedIn);
  if (url.pathname === '/api/v1/usage' && req.method === 'GET') {
    const r = url.searchParams.get('r') ?? '7';
    if (!['7', '30', 'all'].includes(r)) return send(res, 400, { error: 'bad_request', message: 'r must be 7, 30 or all.' }, signedIn);
    return send(res, 200, { v: 1, usage: usageOut(r), undo: undo() }, signedIn);
  }
  if (url.pathname === '/api/v1/gym/progress' && req.method === 'GET') {
    const x = url.searchParams.get('x');
    if (x !== null && !/^\d+$/.test(x)) return send(res, 400, { error: 'bad_request', message: "x must be an exercise's id." }, signedIn);
    return send(res, 200, { gym_progress: progressOut(x), undo: undo() }, signedIn);
  }
  if (url.pathname === '/api/v1/gym/activity' && req.method === 'GET') {
    const day = url.searchParams.get('day');
    if (day !== null && !/^\d{4}-\d\d-\d\d$/.test(day)) return send(res, 400, { error: 'bad_request', message: 'day must be yyyy-mm-dd.' }, signedIn);
    return send(res, 200, { gym_activity: activityOut(day), undo: undo() }, signedIn);
  }
  if (url.pathname === '/api/v1/foods' && req.method === 'GET') return send(res, 200, { foods: foods(url.searchParams.get('q')) }, signedIn);
  // A save's fresh read: the Food day or the usual meals when the body asks for it (view "food" with view_day, "usual"), else
  // Today; as the core, /usual/meal and /usual/new default to the usual meals and /usual/from_meal to the Food day.
  const view = body.view ?? ({ '/api/v1/usual/meal': 'usual', '/api/v1/usual/new': 'usual', '/api/v1/usual/from_meal': 'food', '/api/v1/health/day': 'health', '/api/v1/body': 'body', '/api/v1/habit/day': 'habits', '/api/v1/habits/manage': 'habits' })[req.url] ?? (req.url.startsWith('/api/v1/food/catalogue/') ? 'catalogue' : req.url.startsWith('/api/v1/labs/med') ? 'labs_meds' : req.url.startsWith('/api/v1/labs/') ? 'labs' : req.url.startsWith('/api/v1/gym/') ? gymView(req.url.slice('/api/v1/gym/'.length), body) : req.url.startsWith('/api/v1/home/') ? homeView(req.url.slice('/api/v1/home/'.length)) : undefined);
  const range = [7, 30, 90].includes(body.range) ? body.range : 30;
  const fresh = () =>
    view === 'food' ? { food_day: foodDay(body.view_day) }
    : view === 'usual' ? { usual: state.usual }
    : view === 'health' ? { health: healthOut(range, body.all === true) }
    : view === 'body' ? { body: bodyOut(req.url === '/api/v1/body' ? body.day : body.view_day) }
    : view === 'gym' ? { gym: gymOut() }
    : view === 'gym_plan' ? { gym_plan: planOut() }
    : view === 'gym_exercises' ? { gym_exercises: exercisesOut() }
    : view === 'home' ? { home: homeOut(body.view_min) }
    : view === 'home_pick' ? { home_pick: pickOut(body.view_min, body.view_n) }
    : view === 'home_zones' ? { home_zones: hmZonesOut() }
    : view === 'home_history' ? { home_history: hmHistoryOut(body.view_limit) }
    : view === 'home_chore' ? { home_chore: body.view_id ? hmChoreOut(body.view_id) : null }
    : view === 'home_edit' ? { home_edit: hmEditOut() }
    : view === 'catalogue' ? catView(body)
    : view === 'labs' ? { labs: labsOut(body.view_open) }
    : view === 'labs_tests' ? { labs_tests: testsOut(body.view_q, body.view_t) }
    : view === 'labs_meds' ? { labs_meds: medsOut() }
    : view === 'habits' ? { habits: habitsOut(['tracked', 'untracked', 'retired', 'all'].includes(body.show) ? body.show : 'tracked') }
    : { day: dayOut(state.day) };
  if (req.url === '/api/v1/session' && req.method === 'DELETE') {
    sessions.delete(bearer);
    return send(res, 200, { outcome: 'signed_out' });
  }
  if (req.method === 'POST' && req.url.startsWith('/api/v1/')) {
    const path = req.url.slice('/api/v1'.length);
    const base = { ...SAVE.saved, head: 'Saved.', receipt: [], undo: undo() };
    if (path === '/undo') {
      if (!undo() || body.token !== state.undo.token) {
        return send(res, 200, { ...base, outcome: 'rejected', tone: 'warning', head: 'Nothing undone.', reason: 'There is nothing to undo any more.', ...fresh() }, signedIn);
      }
      if (state.before.hv) [state.hv, state.sessions] = [state.before.hv, state.before.sessions];
      if (state.before.hab) state.hab = state.before.hab;
      if (state.before.cat) state.cat = state.before.cat;
      const head = state.before.gymUndo ?? state.before.homeUndo ?? 'Undone.';
      if (state.before.gym) state.gym = state.before.gym;
      if (state.before.home) state.home = state.before.home;
      [state.day, state.usual, state.before, state.undo] = [state.before.day, state.before.usual, null, null];
      return send(res, 200, { ...base, outcome: 'changed', head, undo: null, ...fresh() }, signedIn);
    }
    // The key rule, as logbook's: the same key again answers as before and saves nothing twice.
    if (KEYED.includes(path) && body.key && state.keys.has(body.key)) {
      return send(res, 200, { ...state.keys.get(body.key), replayed: true, head: 'Already saved earlier (same message).', ...fresh() }, signedIn);
    }
    if (path === '/log') {
      await new Promise((r) => setTimeout(r, READ_MS));
      if (!sessions.has(bearer)) return send(res, 401, { error: 'signed_out', message: 'Sign in again.' });
      const course = body.view === 'labs_meds' ? labsLog(body) : null;
      if (course) return send(res, 200, { ...course, replayed: false, undo: undo(), ...fresh() }, signedIn);
      const r = logLine(body);
      if (r.day) {
        if (r.undo) [state.before, state.undo] = [{ day: state.day, usual: state.usual }, { token: randomBytes(12).toString('base64url'), head: r.undo, expires_at: new Date(Date.now() + 15 * 60_000).toISOString() }];
        state.day = r.day;
      }
      const answer = { ...r.answer, v: 1, replayed: false, undo: r.undo ? state.undo : null };
      if (body.key && !['rejected', 'needs_confirmation', 'held'].includes(answer.outcome)) state.keys.set(body.key, answer);
      return send(res, 200, { ...answer, ...fresh() }, signedIn);
    }
    if (path === '/health/day' || path === '/body') {
      const [status, out] = path === '/body' ? bodySave(body) : healthDay(body);
      if (status !== 200) return send(res, status, out, signedIn);
      const answer = { ...base, undo: out.undo ?? undo(), ...out, v: 1, tone: ['saved', 'changed', 'unchanged'].includes(out.outcome) ? 'ok' : 'warning' };
      if (body.key && !['rejected', 'needs_confirmation'].includes(answer.outcome)) state.keys.set(body.key, answer);
      return send(res, 200, { ...answer, ...fresh() }, signedIn);
    }
    if (path === '/habits/manage') {
      const [status, out] = habitsManage(body);
      if (status !== 200) return send(res, status, out, signedIn);
      return send(res, 200, { ...base, ...out, tone: out.outcome === 'changed' ? 'ok' : 'warning', ...(out.undo === null ? { undo: null } : {}), ...fresh() }, signedIn);
    }
    if (path.startsWith('/gym/')) {
      if (state.slow) await new Promise((r) => setTimeout(r, state.slow)); // POST /standin/slow
      const [status, out] = gymAction(path.slice('/gym/'.length), body);
      if (status !== 200) return send(res, status, out, signedIn);
      const answer = { ...base, ...out, v: 1, tone: out.outcome === 'rejected' ? 'warning' : 'ok' };
      if (path === '/gym/tick' && body.key && answer.outcome !== 'rejected') state.keys.set(body.key, answer);
      return send(res, 200, { ...answer, ...fresh() }, signedIn);
    }
    if (path.startsWith('/home/')) {
      if (state.slow) await new Promise((r) => setTimeout(r, state.slow)); // POST /standin/slow
      const [status, out] = homeAction(path.slice('/home/'.length), body);
      if (status !== 200) return send(res, status, out, signedIn);
      const answer = { ...base, ...out, v: 1, tone: out.outcome === 'rejected' ? 'warning' : 'ok' };
      if (KEYED.includes(path) && body.key && answer.outcome !== 'rejected') state.keys.set(body.key, answer);
      return send(res, 200, { ...answer, ...fresh() }, signedIn);
    }
    if (path.startsWith('/food/catalogue/')) {
      if ('key' in body) return send(res, 400, { error: 'bad_request', message: 'The stand-in: the catalogue takes no key.' }, signedIn);
      const [status, out] = catalogueSave(path.slice('/food/catalogue/'.length), body);
      if (status !== 200) return send(res, status, out, signedIn);
      if (out.outcome === 'changed') state.undo = null; // as app., a change here ends the session's Undo bar
      const answer = { ...base, ...out, v: 1, tone: ['changed', 'unchanged'].includes(out.outcome) ? 'ok' : 'warning' };
      return send(res, 200, { ...answer, ...fresh() }, signedIn);
    }
    if (path.startsWith('/labs/')) {
      if ('key' in body) return send(res, 400, { error: 'bad_request', message: 'The stand-in: Medical takes no key.' }, signedIn);
      if (state.slow) await new Promise((r) => setTimeout(r, state.slow)); // POST /standin/slow
      const [status, out] = labsSave(path.slice('/labs/'.length), body);
      if (status !== 200) return send(res, status, out, signedIn);
      if (out.outcome === 'changed') state.undo = null; // as app., a change here ends the session's Undo bar
      // the Reports tab answers with the report of the change open (as the door does)
      if ((path === '/labs/value' || path === '/labs/report') && !('view_open' in body)) {
        const rid = path === '/labs/report' ? body.id : state.labs.values.find((x) => x.id === body.id)?.report_id;
        if (rid) body.view_open = `R${rid}`;
      }
      const answer = { ...base, ...out, v: 1, tone: ['changed', 'unchanged'].includes(out.outcome) ? 'ok' : 'warning' };
      return send(res, 200, { ...answer, ...fresh() }, signedIn);
    }
    if (body.view === 'labs_meds' && path === '/answer' && state.labs.asks.has(body.question_id)) {
      const out = labsAnswer(body);
      const answer = { ...base, ...out, tone: ['changed', 'cancelled'].includes(out.outcome) ? 'ok' : 'warning' };
      return send(res, 200, { ...answer, ...fresh() }, signedIn);
    }
    if (body.view === 'catalogue' && (path === '/lookup' || (path === '/answer' && state.cat.lookups.has(body.question_id)))) {
      const out = path === '/lookup' ? await catLookUp(body) : catAnswer(body);
      const { v: _v, ...rest } = out;
      const answer = { ...base, ...rest, tone: rest.tone ?? (['saved', 'cancelled'].includes(rest.outcome) ? 'ok' : 'warning') };
      return send(res, 200, { ...answer, ...fresh() }, signedIn);
    }
    if (path === '/coach/start') {
      if ('key' in body) return send(res, 400, { error: 'bad_request', message: 'The stand-in: /coach/start takes no key.' }, signedIn);
      await new Promise((r) => setTimeout(r, 600)); // a moment, so a check can see the button disabled while the start is on its way
      const [status, out] = coachStart(body);
      if (status !== 200) return send(res, status, out, signedIn);
      const which = ['7', 'last', '30', 'this'].includes(body.view_p) ? body.view_p : wkWhich(body.start) ?? '7';
      state.undo = null; // as app., a start ends the session's Undo bar
      const { v: _v, ...answer } = out;
      return send(res, 200, { ...answer, v: 1, undo: null, week: weekOut(which) }, signedIn);
    }
    if (path === '/body/skip') {
      state.day = { ...structuredClone(state.day), needs: { ...state.day.needs, body_due: null } };
      return send(res, 200, { ...HEALTH.saves.body_skip, undo: undo(), ...fresh() }, signedIn);
    }
    const out = path === '/habit' && body.view === 'habits' ? habitTick(body) : path === '/habit/day' ? await habitDay(body) : path.startsWith('/usual/') ? usualSave(path, body) : path === '/food/labeladd' ? labelAdd(body) : path === '/lookup' ? lookUp(body) : save(path, body);
    if (!out) return send(res, 404, { error: 'not_found', message: 'Not found.' });
    const answer = { ...base, ...out, tone: out.tone ?? (['saved', 'changed', 'removed', 'unchanged', 'cancelled'].includes(out.outcome) ? 'ok' : 'warning') };
    if (KEYED.includes(path) && body.key && answer.outcome !== 'rejected' && answer.outcome !== 'needs_confirmation') state.keys.set(body.key, answer);
    return send(res, 200, { ...answer, ...fresh() }, signedIn);
  }
  return send(res, 404, { error: 'not_found', message: 'Not found.' });
}).listen(port, () => console.log(`stand-in door on ${port}`));

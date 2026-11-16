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
const READ_MS = 1200; // the AI's moment: long enough to see the "being read" row

let state; // { day, usual, undo: {token, head, expires_at} | null, before: {day, usual} before the last save (for Undo), keys: Map, lines: Map, aiDown }
let ids = 9000;
let mode = 'up'; // 'up' | 'core-down' | 'door-off' (step F)
function reset() {
  state = { day: read('day.json').day, usual: usualStart(), undo: null, before: null, keys: new Map(), lines: new Map(), aiDown: false,
    scanned: new Map([[SCAN.barcode.code, SCAN.barcode.food]]), labelFail: false,
    hv: healthStart(), sessions: sessionsStart(), hab: habitsStart(), dayKeys: new Set(), slow: 0, locked: new Set(), gym: gymStart() };
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
  return {
    ex: GEX.exercises.map((e) => ({ id: e.exercise_id, name: e.name, kind: e.kind, active: e.active, last: rows.get(e.exercise_id)?.last ?? null, lastText: rows.get(e.exercise_id)?.last_text ?? null })),
    logs: [...rows.values()].flatMap((r) => r.logged.map((s) => ({ ...s, exercise_id: r.exercise_id }))),
    plan: new Map(GPL.days.map((d) => [d.day_id, d.items.map((i) => ({ item_id: i.item_id, exercise_id: i.exercise_id, sets: i.sets, reps: i.reps }))])),
    day: GW.day.day_id, auto: GW.day.day_id, startedAt: GW.started_at, setIds: 100, itemIds: 100,
  };
}

const gLabel = (id) => GW.chips.find((c) => c.day_id === id)?.label ?? 'Free workout';
const gDayName = (id) => GPL.days.find((d) => d.day_id === id)?.name;

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
    chips: GW.chips.map((c) => ({ ...c, on: c.day_id === g.day })),
    why: free ? 'Free workout: all your exercises.' : hand ? `Picked by you instead of ${gLabel(g.auto)}.` : started ? 'Today’s day. Tap another day to switch.' : 'Your 1st workout this week: the first day not done yet. Tap another day to switch.',
    exercises: shown, other: rest,
    empty: shown.length ? null : free ? 'No exercises yet: add your first one below.' : 'No exercises on this day yet: add them on the Plan tab.',
    hint: shown.length || rest.length ? GW.hint : null,
    week_split: GW.week_split.map((x) => ({ ...x, today: x.day_id === g.day })),
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
    if (b.day_id !== null && !g.plan.has(b.day_id)) return [200, rejected('Unknown day.')];
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
    const x = { id: Math.max(...g.ex.map((e) => e.id)) + 1, name, kind: b.kind, active: true, last: null, lastText: null };
    g.ex.push(x);
    return [200, gymPlain({ outcome: 'changed', head: `Added ${name} (${KINDS[b.kind].toLowerCase()}).${onToday(x.id)}` })];
  }
  return [404, { error: 'not_found', message: 'Not found.' }];
}

const KEYED = ['/gym/tick', '/health/day', '/body', '/food/labeladd', '/log', '/water', '/again', '/usual', '/habit', '/checkin', '/health', '/held/retry', '/held/delete', '/usual/meal', '/usual/new', '/usual/from_meal'];

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
  if (req.url === '/standin/slow' && req.method === 'POST') {
    state.slow = 700; // the next day taps of the Habits page (and the Gym's ticks) take a moment
    return send(res, 200, { outcome: 'slow' });
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
  if (req.url.startsWith('/api/v1/day') && req.method === 'GET') return send(res, 200, { day: dayOut(state.day), undo: undo() }, signedIn);
  const url = new URL(req.url, 'http://standin');
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
  if (url.pathname === '/api/v1/gym' && req.method === 'GET') return send(res, 200, { gym: gymOut(), undo: undo() }, signedIn);
  if (url.pathname === '/api/v1/foods' && req.method === 'GET') return send(res, 200, { foods: foods(url.searchParams.get('q')) }, signedIn);
  // A save's fresh read: the Food day or the usual meals when the body asks for it (view "food" with view_day, "usual"), else
  // Today; as the core, /usual/meal and /usual/new default to the usual meals and /usual/from_meal to the Food day.
  const view = body.view ?? ({ '/api/v1/usual/meal': 'usual', '/api/v1/usual/new': 'usual', '/api/v1/usual/from_meal': 'food', '/api/v1/health/day': 'health', '/api/v1/body': 'body', '/api/v1/habit/day': 'habits', '/api/v1/habits/manage': 'habits' })[req.url] ?? (req.url.startsWith('/api/v1/gym/') ? 'gym' : undefined);
  const range = [7, 30, 90].includes(body.range) ? body.range : 30;
  const fresh = () =>
    view === 'food' ? { food_day: foodDay(body.view_day) }
    : view === 'usual' ? { usual: state.usual }
    : view === 'health' ? { health: healthOut(range, body.all === true) }
    : view === 'body' ? { body: bodyOut(req.url === '/api/v1/body' ? body.day : body.view_day) }
    : view === 'gym' ? { gym: gymOut() }
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
      const head = state.before.gymUndo ?? 'Undone.';
      if (state.before.gym) state.gym = state.before.gym;
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
      if (state.slow && path === '/gym/tick') await new Promise((r) => setTimeout(r, state.slow)); // POST /standin/slow
      const [status, out] = gymAction(path.slice('/gym/'.length), body);
      if (status !== 200) return send(res, status, out, signedIn);
      const answer = { ...base, ...out, v: 1, tone: out.outcome === 'rejected' ? 'warning' : 'ok' };
      if (path === '/gym/tick' && body.key && answer.outcome !== 'rejected') state.keys.set(body.key, answer);
      return send(res, 200, { ...answer, ...fresh() }, signedIn);
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

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
// Usage: node tests/standin/door.mjs [port]  (FRONT_TOKEN from the environment). POST /standin/reset starts the day again,
// POST /standin/drop-sessions signs every session out (for the re-send after a sign-in), POST /standin/ai-down and
// /standin/ai-up make /log hold its lines or read them again.
// Step F: POST /standin/core-down makes every door call fail with no answer (the connection is dropped, as when the core is
// stopped), POST /standin/door-off answers 404 not_found to every door call (FRONT_TOKEN unset at the core), and POST
// /standin/up (or /standin/reset) brings it back. Sessions survive both, as at the core.
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
const READ_MS = 1200; // the AI's moment: long enough to see the "being read" row

let state; // { day, usual, undo: {token, head, expires_at} | null, before: {day, usual} before the last save (for Undo), keys: Map, lines: Map, aiDown }
let ids = 9000;
let mode = 'up'; // 'up' | 'core-down' | 'door-off' (step F)
function reset() {
  state = { day: read('day.json').day, usual: usualStart(), undo: null, before: null, keys: new Map(), lines: new Map(), aiDown: false,
    scanned: new Map([[SCAN.barcode.code, SCAN.barcode.food]]), labelFail: false };
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

const KEYED = ['/food/labeladd', '/log', '/water', '/again', '/usual', '/habit', '/checkin', '/health', '/held/retry', '/held/delete', '/usual/meal', '/usual/new', '/usual/from_meal'];

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
  if (url.pathname === '/api/v1/foods' && req.method === 'GET') return send(res, 200, { foods: foods(url.searchParams.get('q')) }, signedIn);
  // A save's fresh read: the Food day or the usual meals when the body asks for it (view "food" with view_day, "usual"), else
  // Today; as the core, /usual/meal and /usual/new default to the usual meals and /usual/from_meal to the Food day.
  const view = body.view ?? ({ '/api/v1/usual/meal': 'usual', '/api/v1/usual/new': 'usual', '/api/v1/usual/from_meal': 'food' })[req.url];
  const fresh = () => (view === 'food' ? { food_day: foodDay(body.view_day) } : view === 'usual' ? { usual: state.usual } : { day: dayOut(state.day) });
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
      [state.day, state.usual, state.before, state.undo] = [state.before.day, state.before.usual, null, null];
      return send(res, 200, { ...base, outcome: 'changed', head: 'Undone.', undo: null, ...fresh() }, signedIn);
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
    const out = path.startsWith('/usual/') ? usualSave(path, body) : path === '/food/labeladd' ? labelAdd(body) : path === '/lookup' ? lookUp(body) : save(path, body);
    if (!out) return send(res, 404, { error: 'not_found', message: 'Not found.' });
    const answer = { ...base, ...out, tone: out.tone ?? (['saved', 'changed', 'removed', 'unchanged', 'cancelled'].includes(out.outcome) ? 'ok' : 'warning') };
    if (KEYED.includes(path) && body.key && answer.outcome !== 'rejected' && answer.outcome !== 'needs_confirmation') state.keys.set(body.key, answer);
    return send(res, 200, { ...answer, ...fresh() }, signedIn);
  }
  return send(res, 404, { error: 'not_found', message: 'Not found.' });
}).listen(port, () => console.log(`stand-in door on ${port}`));

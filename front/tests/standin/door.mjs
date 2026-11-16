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
const READ_MS = 1200; // the AI's moment: long enough to see the "being read" row

let state; // { day, undo: {token, head, expires_at} | null, before: the day before the last save (for Undo), keys: Map, lines: Map, aiDown }
let ids = 9000;
let mode = 'up'; // 'up' | 'core-down' | 'door-off' (step F)
function reset() {
  state = { day: read('day.json').day, undo: null, before: null, keys: new Map(), lines: new Map(), aiDown: false };
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
reset();

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
    const chip = d.chips.again.find((c) => String(c.food_id) === String(b.food_id));
    if (!chip) return { outcome: 'rejected', head: 'Nothing saved.', reason: 'Unknown food.' };
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
  state.before = state.day;
  state.day = d;
  state.undo = { token: randomBytes(12).toString('base64url'), head: `Saved: ${head}`, expires_at: new Date(Date.now() + 15 * 60_000).toISOString() };
  return { outcome, head, undo: state.undo, tone: 'ok' };
}

const KEYED = ['/log', '/water', '/again', '/usual', '/habit', '/checkin', '/health', '/held/retry', '/held/delete'];

createServer(async (req, res) => {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  const seen = Object.keys(req.headers).sort().join(' ');
  console.log(`${req.method} ${req.url}  headers: ${seen}${raw && req.url !== '/api/v1/session' ? `  body: ${raw}` : ''}`);
  if (req.url === '/standin/reset' && req.method === 'POST') {
    reset();
    mode = 'up';
    return send(res, 200, { outcome: 'reset' });
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
  // A save's fresh day: the Food day when the body asks for it (view "food", view_day), else Today.
  const fresh = () => (body.view === 'food' ? { food_day: foodDay(body.view_day) } : { day: dayOut(state.day) });
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
      [state.day, state.before, state.undo] = [state.before, null, null];
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
        if (r.undo) [state.before, state.undo] = [state.day, { token: randomBytes(12).toString('base64url'), head: r.undo, expires_at: new Date(Date.now() + 15 * 60_000).toISOString() }];
        state.day = r.day;
      }
      const answer = { ...r.answer, v: 1, replayed: false, undo: r.undo ? state.undo : null };
      if (body.key && !['rejected', 'needs_confirmation', 'held'].includes(answer.outcome)) state.keys.set(body.key, answer);
      return send(res, 200, { ...answer, ...fresh() }, signedIn);
    }
    const out = save(path, body);
    if (!out) return send(res, 404, { error: 'not_found', message: 'Not found.' });
    const answer = { ...base, ...out, tone: out.tone ?? (['saved', 'changed', 'removed', 'unchanged', 'cancelled'].includes(out.outcome) ? 'ok' : 'warning') };
    if (KEYED.includes(path) && body.key && answer.outcome !== 'rejected' && answer.outcome !== 'needs_confirmation') state.keys.set(body.key, answer);
    return send(res, 200, { ...answer, ...fresh() }, signedIn);
  }
  return send(res, 404, { error: 'not_found', message: 'Not found.' });
}).listen(port, () => console.log(`stand-in door on ${port}`));

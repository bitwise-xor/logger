// A stand-in for the core's JSON door (docs/API.md), for the page tests and the screenshots: the sign-in, the session, GET /day
// and Today's saves (step C). Password "test", code "123456". GET /day starts as tests/samples/day.json, a real answer of the door
// that tests/test_front_samples.py writes (and checks against the door's shape on every Python test run). The saves answer in the
// shape of tests/samples/save.json (written by the same test) and change the day a little, as the core would (a glass of water,
// a tick, a new row), so the page tests can see the page change without a reload; Undo puts the day back. It also checks what the
// real door checks: the token, the call without proxy headers and the bearer.
// Usage: node tests/standin/door.mjs [port]  (FRONT_TOKEN from the environment). POST /standin/reset starts the day again,
// POST /standin/drop-sessions signs every session out (for the re-send after a sign-in).
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

let state; // { day, undo: {token, head, expires_at} | null, before: the day before the last save (for Undo), keys: Set }
let ids = 9000;
function reset() {
  state = { day: read('day.json').day, undo: null, before: null, keys: new Map() };
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
  } else if (path === '/health') {
    const h = d.health.find((x) => x.row === b.row);
    if (!h) return { outcome: 'rejected', head: 'Nothing saved.', reason: 'Unknown row.' };
    if (h.type === 'weight' && Number(b.v1) > 300 && b.confirmed !== true) return { ...SAVE.needs_confirmation, day: state.day };
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

const KEYED = ['/water', '/again', '/usual', '/habit', '/checkin', '/health', '/held/retry', '/held/delete'];

createServer(async (req, res) => {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  const seen = Object.keys(req.headers).sort().join(' ');
  console.log(`${req.method} ${req.url}  headers: ${seen}${raw && req.url !== '/api/v1/session' ? `  body: ${raw}` : ''}`);
  if (req.url === '/standin/reset' && req.method === 'POST') {
    reset();
    return send(res, 200, { outcome: 'reset' });
  }
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
  if (req.url.startsWith('/api/v1/day') && req.method === 'GET') return send(res, 200, { day: state.day, undo: undo() }, signedIn);
  if (req.url === '/api/v1/session' && req.method === 'DELETE') {
    sessions.delete(bearer);
    return send(res, 200, { outcome: 'signed_out' });
  }
  if (req.method === 'POST' && req.url.startsWith('/api/v1/')) {
    const path = req.url.slice('/api/v1'.length);
    const base = { ...SAVE.saved, head: 'Saved.', receipt: [], undo: undo() };
    if (path === '/undo') {
      if (!undo() || body.token !== state.undo.token) {
        return send(res, 200, { ...base, outcome: 'rejected', tone: 'warning', head: 'Nothing undone.', reason: 'There is nothing to undo any more.', day: state.day }, signedIn);
      }
      [state.day, state.before, state.undo] = [state.before, null, null];
      return send(res, 200, { ...base, outcome: 'changed', head: 'Undone.', undo: null, day: state.day }, signedIn);
    }
    // The key rule, as logbook's: the same key again answers as before and saves nothing twice.
    if (KEYED.includes(path) && body.key && state.keys.has(body.key)) {
      return send(res, 200, { ...state.keys.get(body.key), replayed: true, head: 'Already saved earlier (same message).', day: state.day }, signedIn);
    }
    const out = save(path, body);
    if (!out) return send(res, 404, { error: 'not_found', message: 'Not found.' });
    const answer = { ...base, ...out, tone: out.tone ?? (['saved', 'changed', 'removed', 'unchanged', 'cancelled'].includes(out.outcome) ? 'ok' : 'warning') };
    if (KEYED.includes(path) && body.key && answer.outcome !== 'rejected' && answer.outcome !== 'needs_confirmation') state.keys.set(body.key, answer);
    return send(res, 200, { ...answer, day: state.day }, signedIn);
  }
  return send(res, 404, { error: 'not_found', message: 'Not found.' });
}).listen(port, () => console.log(`stand-in door on ${port}`));

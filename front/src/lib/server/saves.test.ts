// Today's saves through the door client, against a faked network: which route each form action calls, the key rule, the fresh
// day asked for, and a gone session told apart from other problems.
import { describe, expect, it } from 'vitest';
import { makeDoor, type Fetch } from './door.js';
import { bodyFor, CATALOGUE_SAVES, MEDICAL_MEDS_SAVES, MEDICAL_REPORTS_SAVES, EXERCISES_SAVES, LIBRARY_HABITS_SAVES, FOOD_SAVES, GYM_SAVES, HABITS_SAVES, HEALTH_SAVES, EDIT_SAVES, HISTORY_SAVES, HOME_SAVES, PICK_SAVES, PLAN_SAVES, runSave, SAVE_NAMES, SAVES, TODAY_SAVES, TRENDS_SAVES, COACH_SAVES, USUAL_SAVES, ZONES_SAVES, SETTINGS_ONLY, SETTINGS_TARGETS_SAVES, SETTINGS_TODAY_SAVES, SETTINGS_BODY_SAVES, SETTINGS_COACH_SAVES, SETTINGS_DEVICES_SAVES, SETTINGS_NOTIFY_SAVES } from './saves.js';
import { mayResend } from '../saver.js';

const TOKEN = 'f'.repeat(40);
/** A browser's push subscription as the page sends it (invented: an address of the right shape, keys of the right lengths). */
const SUB = { endpoint: 'https://fcm.googleapis.com/fcm/send/invented-endpoint-1', p256dh: 'B' + 'A'.repeat(86), auth: 'C'.repeat(22) };
const SESSION = 's'.repeat(43);
const KEY = '0b7c3c4e-2f7a-4a59-9d4e-6f1f0f2b9a11';

function form(fields: Record<string, string | string[]>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) for (const x of Array.isArray(v) ? v : [v]) f.append(k, x);
  return f;
}

function net(status = 200, body: unknown = { v: 1, outcome: 'saved', head: 'Saved.', day: {} }) {
  const seen: { path: string; body: Record<string, unknown>; timeout: boolean }[] = [];
  const fetch: Fetch = async (url, init) => {
    seen.push({ path: url.pathname, body: JSON.parse(init.body as string), timeout: !!init.signal });
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json', 'X-Session-Expires': '2099-01-01T00:00:00+00:00' },
    });
  };
  return { door: makeDoor({ url: 'http://logger-v2-core:8000', token: TOKEN, fetch }), seen };
}

describe('the save bodies', () => {
  it('passes the browser key on, unchanged, so a re-sent tap saves once', () => {
    const a = bodyFor('water', form({ ml: '250', key: KEY }), undefined);
    const b = bodyFor('water', form({ ml: '250', key: KEY }), undefined);
    expect(a).toEqual({ ml: 250, key: KEY, view: 'day' });
    expect(b.key).toBe(a.key);
  });

  it('makes a new key for a form sent without one, or with an odd one', () => {
    let n = 0;
    const make = () => `server-made-key-${++n}`.padEnd(20, 'x');
    expect(bodyFor('again', form({ food_id: '7', amount: '200' }), undefined, make).key).toBe('server-made-key-1xxx');
    expect(bodyFor('again', form({ food_id: '7', amount: '200', key: 'a b' }), undefined, make).key).toBe('server-made-key-2xxx');
  });

  it('sends no key where the door takes none (answer, review, undo)', () => {
    for (const name of SAVE_NAMES.filter((x) => !SAVES[x].keyed)) {
      expect(bodyFor(name, form({ key: KEY }), undefined)).not.toHaveProperty('key');
    }
  });

  it('builds each route body from the form fields', () => {
    expect(bodyFor('habit', form({ name: 'meds', action: 'untick', ref: 'e12', key: KEY }), undefined)).toEqual({
      name: 'meds',
      action: 'untick',
      ref: 'e12',
      key: KEY,
      view: 'day',
    });
    expect(bodyFor('checkin', form({ type: 'mood', value: '4', day: '2026-01-31', key: KEY }), undefined)).toMatchObject({
      type: 'mood',
      value: '4',
      day: '2026-01-31',
    });
    expect(bodyFor('health', form({ row: 'bp_morning', v1: '118', v2: '76', key: KEY }), undefined)).toEqual({
      row: 'bp_morning',
      v1: '118',
      v2: '76',
      key: KEY,
      view: 'day',
    });
    expect(bodyFor('health', form({ row: 'weight', ref: 'm3', v1: '400', confirmed: '1', key: KEY }), undefined)).toMatchObject({
      ref: 'm3',
      confirmed: true,
    });
    expect(bodyFor('review', form({ action: 'all', refs: ['f1', 'm2', 't3'] }), undefined)).toEqual({
      action: 'all',
      refs: ['f1', 'm2', 't3'],
      view: 'day',
    });
    expect(bodyFor('review', form({ action: 'ok', ref: 'f1' }), undefined)).toEqual({ action: 'ok', ref: 'f1', view: 'day' });
    expect(bodyFor('answer', form({ question_id: 'pq1', reply: 'yes' }), undefined)).toEqual({
      question_id: 'pq1',
      reply: 'yes',
      view: 'day',
    });
    // the door wants the message's id as a number
    expect(bodyFor('held_delete', form({ id: '42', key: KEY }), undefined)).toEqual({ id: 42, key: KEY, view: 'day' });
    expect(bodyFor('undo', form({ token: 'tok' }), undefined)).toEqual({ token: 'tok', view: 'day' });
  });

  it('sends a typed line with its key, every line of it, and waits up to 60 s for the AI (step D)', () => {
    expect(bodyFor('log', form({ text: '  150 g skyr\nweight 82.4  ', key: KEY }), '2026-01-31')).toEqual({
      text: '150 g skyr\nweight 82.4',
      key: KEY,
      view: 'day',
      view_day: '2026-01-31',
    });
    expect((bodyFor('log', form({ text: 'x'.repeat(5000), key: KEY }), undefined).text as string).length).toBe(4000);
    expect(bodyFor('log', form({ text: '   ', key: KEY }), undefined)).toEqual({ key: KEY, view: 'day' }); // the door says it is empty
    expect(SAVES.log).toMatchObject({ path: '/log', keyed: true, timeoutMs: 60_000 });
  });

  it('leaves out empty fields and asks for the day shown', () => {
    expect(bodyFor('health', form({ row: 'wake', ref: '', time: '06:10', v1: '', key: KEY }), '2026-01-31')).toEqual({
      row: 'wake',
      time: '06:10',
      key: KEY,
      view: 'day',
      view_day: '2026-01-31',
    });
    expect(bodyFor('water', form({ ml: 'lots', key: KEY }), 'not a day')).toEqual({ key: KEY, view: 'day' });
  });
});

describe('a save through the door', () => {
  it('posts to the route with the session and gives back the answer and the session end', async () => {
    const n = net();
    const r = await runSave(n.door, SESSION, 'held_retry', form({ id: '5', key: KEY }));
    expect(n.seen).toEqual([{ path: '/api/v1/held/retry', body: { id: 5, key: KEY, view: 'day' }, timeout: true }]);
    expect(r).toEqual({ ok: true, answer: { v: 1, outcome: 'saved', head: 'Saved.', day: {} }, expiresAt: '2099-01-01T00:00:00+00:00' });
  });

  it('calls each route once per tap', async () => {
    for (const name of SAVE_NAMES) {
      const n = net();
      await runSave(n.door, SESSION, name, form(name === 'push_subscribe' ? { ...SUB, key: KEY } : { key: KEY }));
      expect(n.seen.map((s) => s.path)).toEqual([`/api/v1${SAVES[name].path}`]);
    }
  });

  it('tells a gone session apart, so the tap can be kept for after the sign-in', async () => {
    const out = await runSave(net(401, { v: 1, error: 'signed_out', message: 'Sign in first.' }).door, SESSION, 'water', form({}));
    expect(out).toEqual({ ok: false, status: 401, signedOut: true, message: 'Sign in first.' });
  });

  it('says plainly when the door is off or the core is down, and keeps the session (step F)', async () => {
    const off = await runSave(net(404, { v: 1, error: 'not_found', message: 'Not found.' }).door, SESSION, 'water', form({}));
    expect(off).toMatchObject({ ok: false, status: 503, signedOut: false, problem: 'door_off' });
    expect(off.ok === false && off.message).toContain('switched off');
    const down = makeDoor({ url: 'http://logger-v2-core:8000', token: TOKEN, fetch: async () => { throw new TypeError('fetch failed'); } });
    const out = await runSave(down, SESSION, 'water', form({}));
    expect(out).toMatchObject({ ok: false, status: 503, signedOut: false, problem: 'core_down' });
    expect(out.ok === false && out.message).toContain('Nothing was saved');
  });

  it('passes other problems on as they are, not as a sign-out', async () => {
    const out = await runSave(net(500, { v: 1, error: 'server_error', message: 'Something went wrong.' }).door, SESSION, 'water', form({}));
    expect(out).toEqual({ ok: false, status: 500, signedOut: false, message: 'Something went wrong.', problem: 'trouble' });
  });
});

describe('the Food day saves (step E)', () => {
  it('changes a row: amount, unit, time and another food, asking for the fresh food day of the day shown', () => {
    const f = form({ ref: 'f7', action: 'save', amount: '2', unit: 'slice', time: '13:20', food_name: 'Rye bread', view_day: '2026-11-15' });
    expect(bodyFor('food_entry', f, '2026-11-15', undefined, 'food')).toEqual({
      ref: 'f7',
      action: 'save',
      amount: '2',
      unit: 'slice',
      time: '13:20',
      food_name: 'Rye bread',
      view: 'food',
      view_day: '2026-11-15',
    });
  });

  it('sends confirmed only for the Yes to a read-back, and no key (the door takes none)', () => {
    expect(bodyFor('food_entry', form({ ref: 'f7', action: 'delete', key: KEY }), undefined, undefined, 'food')).toEqual({
      ref: 'f7',
      action: 'delete',
      view: 'food',
    });
    expect(bodyFor('food_entry', form({ ref: 'f7', action: 'save', amount: '90', confirmed: '1' }), undefined, undefined, 'food').confirmed).toBe(true);
  });

  it('sends an empty note to remove it', () => {
    expect(bodyFor('food_note', form({ ref: 'f7', note: '  ' }), undefined, undefined, 'food')).toEqual({ ref: 'f7', note: '', view: 'food' });
    expect(bodyFor('food_note', form({ ref: 'f7', note: 'with butter' }), undefined, undefined, 'food').note).toBe('with butter');
  });

  it('goes to the door with view "food"', async () => {
    const { door, seen } = net(200, { v: 1, outcome: 'changed', head: 'Note saved.', food_day: {} });
    const r = await runSave(door, SESSION, 'food_note', form({ ref: 'f7', note: 'x' }), '2026-11-15', 'food');
    expect(r.ok).toBe(true);
    expect(seen).toMatchObject([{ path: '/api/v1/food/note', body: { ref: 'f7', note: 'x', view: 'food', view_day: '2026-11-15' } }]);
  });

  it('offers the Food day and the Usual meals page their saves and Undo, and Today all the others', () => {
    expect(FOOD_SAVES).toEqual(['food_entry', 'food_note', 'usual_from_meal', 'undo']);
    expect(USUAL_SAVES).toEqual(['usual_meal', 'usual_new', 'undo']);
    expect(TODAY_SAVES).not.toContain('food_entry');
    expect(TODAY_SAVES).not.toContain('usual_meal');
    expect(TODAY_SAVES).toContain('usual');
    expect(TODAY_SAVES).toContain('undo');
    expect(new Set([...TODAY_SAVES, ...FOOD_SAVES, ...USUAL_SAVES, ...HEALTH_SAVES, ...HABITS_SAVES, ...GYM_SAVES, ...PLAN_SAVES, ...EXERCISES_SAVES, ...HOME_SAVES, ...PICK_SAVES, ...ZONES_SAVES, ...HISTORY_SAVES, ...EDIT_SAVES, ...TRENDS_SAVES, ...COACH_SAVES, ...CATALOGUE_SAVES, ...LIBRARY_HABITS_SAVES, ...MEDICAL_REPORTS_SAVES, ...MEDICAL_MEDS_SAVES, ...SETTINGS_ONLY])).toEqual(new Set(SAVE_NAMES));
  });
});

describe('the usual meals (deploy 87)', () => {
  it('a changed meal: numbers where the door wants numbers, the whole list in order, always confirmed, keyed', () => {
    const body = bodyFor(
      'usual_meal',
      form({ meal_id: '84', action: 'save', name: ' Big breakfast ', food_id: ['10', '8', '2'], amount: ['90', '200', '12.5'], key: KEY }),
      undefined,
      undefined,
      'usual',
    );
    expect(body).toEqual({
      meal_id: 84,
      action: 'save',
      confirmed: true,
      name: 'Big breakfast',
      items: [
        { food_id: 10, amount: 90 },
        { food_id: 8, amount: 200 },
        { food_id: 2, amount: 12.5 },
      ],
      view: 'usual',
      key: KEY,
    });
  });

  it('a delete sends no name or foods; an odd amount goes as typed, for the door to refuse in plain words', () => {
    expect(bodyFor('usual_meal', form({ meal_id: '84', action: 'delete', key: KEY }), undefined, undefined, 'usual')).toEqual({
      meal_id: 84,
      action: 'delete',
      confirmed: true,
      view: 'usual',
      key: KEY,
    });
    const odd = bodyFor('usual_meal', form({ meal_id: '84', action: 'save', name: 'X', food_id: ['10'], amount: ['lots'] }), undefined);
    expect(odd.items).toEqual([{ food_id: 10, amount: 'lots' }]);
  });

  it('a new meal or drink, and a meal of the Food day saved as a usual meal', () => {
    expect(bodyFor('usual_new', form({ name: 'Shake', drink: '1', food_id: ['11'], amount: ['300'], key: KEY }), undefined, undefined, 'usual')).toEqual({
      name: 'Shake',
      drink: true,
      items: [{ food_id: 11, amount: 300 }],
      view: 'usual',
      key: KEY,
    });
    expect(bodyFor('usual_new', form({ name: 'Bowl', food_id: ['10'], amount: ['60'], key: KEY }), undefined).drink).toBe(false);
    expect(bodyFor('usual_from_meal', form({ day: '2026-11-16', meal: '2', name: 'Lunch box', key: KEY }), '2026-11-16', undefined, 'food')).toEqual({
      day: '2026-11-16',
      meal: 2,
      name: 'Lunch box',
      view: 'food',
      view_day: '2026-11-16',
      key: KEY,
    });
  });

  it('goes to the door’s routes and brings the fresh list back', async () => {
    const usual = [{ meal_id: 84, name: 'Big breakfast', drink: false, items: [], nutrients: {} }];
    const { door, seen } = net(200, { v: 1, outcome: 'changed', head: 'Changed the usual meal "Big breakfast".', usual });
    const r = await runSave(door, SESSION, 'usual_meal', form({ meal_id: '84', action: 'delete', key: KEY }), undefined, 'usual');
    expect(r).toMatchObject({ ok: true, answer: { usual } });
    await runSave(door, SESSION, 'usual_new', form({ name: 'Shake', food_id: ['11'], amount: ['300'], key: KEY }), undefined, 'usual');
    await runSave(door, SESSION, 'usual_from_meal', form({ day: '2026-11-16', meal: '1', name: 'Bowl', key: KEY }), '2026-11-16', 'food');
    expect(seen.map((x) => x.path)).toEqual(['/api/v1/usual/meal', '/api/v1/usual/new', '/api/v1/usual/from_meal']);
  });
});

describe('the scan sheet’s saves (deploy 90)', () => {
  it('logs a scanned food as an Again chip, with its time', () => {
    expect(bodyFor('again', form({ food_id: '10', amount: '45', time: '08:30', key: KEY }), undefined)).toEqual({
      food_id: '10',
      amount: '45',
      time: '08:30',
      key: KEY,
      view: 'day',
    });
  });

  it('adds a label food: numbers per 100, the optional ones null, keyed; logged with an amount', () => {
    const f = form({
      name: ' Crunchy granola (Testmarke) ', basis: 'g', source: 'label', barcode: '4012345678901',
      kcal: '452', protein: '9,5', fat: '17.8', sat_fat: '', carbs: '61.2', sugar_total: '19', fibre: '', salt_g: '0.3',
      amount: '45', time: '08:30', key: KEY,
    });
    expect(bodyFor('labeladd', f, undefined)).toEqual({
      name: 'Crunchy granola (Testmarke)', basis: 'g', source: 'label', barcode: '4012345678901',
      kcal: 452, protein: 9.5, fat: 17.8, sat_fat: null, carbs: 61.2, sugar_total: 19, fibre: null, salt_g: 0.3,
      amount: 45, time: '08:30', key: KEY, view: 'day',
    });
    expect(SAVES.labeladd).toMatchObject({ path: '/food/labeladd', keyed: true });
  });

  it('adds without logging when no amount is given (no time either), and from Open Food Facts', () => {
    const body = bodyFor('labeladd', form({
      name: 'Oat drink (Samplemarke)', basis: 'ml', source: 'off', barcode: '', kcal: '46', protein: '1', fat: '1.5', carbs: '6.6',
      amount: '', time: '08:30', key: KEY,
    }), undefined);
    expect(body).toEqual({
      name: 'Oat drink (Samplemarke)', basis: 'ml', source: 'off', kcal: 46, protein: 1, fat: 1.5, carbs: 6.6,
      sat_fat: null, sugar_total: null, fibre: null, salt_g: null, key: KEY, view: 'day',
    });
  });

  it('looks a food up for a question, with or without words, waiting up to 60 s; no key', () => {
    expect(bodyFor('lookup', form({ question_id: 'p1a2b3c4', text: ' oat drink ' }), undefined)).toEqual({
      question_id: 'p1a2b3c4',
      text: 'oat drink',
      view: 'day',
    });
    expect(bodyFor('lookup', form({ question_id: 'p1a2b3c4', text: '' }), undefined)).toEqual({ question_id: 'p1a2b3c4', view: 'day' });
    expect(SAVES.lookup).toMatchObject({ path: '/lookup', keyed: false, timeoutMs: 60_000 });
  });

  it('are Today’s, and go to the door’s routes', async () => {
    expect(TODAY_SAVES).toContain('labeladd');
    expect(TODAY_SAVES).toContain('lookup');
    const { door, seen } = net();
    await runSave(door, SESSION, 'labeladd', form({ name: 'Granola', kcal: '1', protein: '1', fat: '1', carbs: '1', key: KEY }));
    await runSave(door, SESSION, 'lookup', form({ question_id: 'p1' }));
    expect(seen.map((x) => x.path)).toEqual(['/api/v1/food/labeladd', '/api/v1/lookup']);
  });
});


describe('the Health page (deploy 92)', () => {
  it('a day row: only the rows sent, numbers where the door wants numbers, blood pressure as [upper, lower], keyed', () => {
    const body = bodyFor(
      'health_day',
      form({ day: '2026-11-15', weight: '81,2', bp_morning_1: '121', bp_morning_2: '79', bed: '22:40', key: KEY, range: '7' }),
      undefined,
      undefined,
      'health',
    );
    expect(body).toEqual({
      day: '2026-11-15',
      values: { weight: 81.2, bp_morning: [121, 79], bed: '22:40' },
      key: KEY,
      view: 'health',
      range: 7,
    });
  });

  it('a cleared value is null (a delete); its yes is confirm_delete, an odd value’s confirmed; "Show all" asks for every day', () => {
    const body = bodyFor(
      'health_day',
      form({ day: '2026-11-15', sugar: '', bp_evening_1: '', bp_evening_2: '', wake: '', confirmed: '1', confirm_delete: '1', all: '1', range: '30', key: KEY }),
      undefined,
      undefined,
      'health',
    );
    expect(body).toMatchObject({
      values: { sugar: null, bp_evening: null, wake: null },
      confirmed: true,
      confirm_delete: true,
      all: true,
      range: 30,
    });
  });

  it('one number of a blood pressure goes as it is (the door says "give both numbers"); words go as typed', () => {
    expect(bodyFor('health_day', form({ day: '2026-11-15', bp_morning_1: '121', bp_morning_2: '', weight: 'heavy' }), undefined, () => KEY, 'health'))
      .toMatchObject({ values: { bp_morning: [121, null], weight: 'heavy' } });
  });

  it('a body session: the measures sent in cm, keyed, the card in the answer; a range other than 7, 30, 90 is left out', () => {
    expect(bodyFor('body', form({ day: '2026-11-16', waist: '91.8', thigh: '', key: KEY, range: '45' }), undefined, undefined, 'body')).toEqual({
      day: '2026-11-16',
      values: { waist: 91.8, thigh: null },
      key: KEY,
      view: 'body',
    });
  });

  it('"Not today" on Today: no body, no key', () => {
    expect(bodyFor('body_skip', form({ key: KEY }), undefined)).toEqual({ view: 'day' });
    expect(SAVES.body_skip).toMatchObject({ path: '/body/skip', keyed: false });
  });

  it('offers the Health page its saves and Undo; Not today stays Today’s', async () => {
    expect(HEALTH_SAVES).toEqual(['health_day', 'body', 'undo']);
    expect(TODAY_SAVES).toContain('body_skip');
    expect(TODAY_SAVES).not.toContain('health_day');
    expect(TODAY_SAVES).not.toContain('body');
    const { door, seen } = net();
    await runSave(door, SESSION, 'health_day', form({ day: '2026-11-15', mood: '4', key: KEY }), undefined, 'health');
    await runSave(door, SESSION, 'body', form({ day: '2026-11-16', hips: '101.5', key: KEY }), undefined, 'body');
    await runSave(door, SESSION, 'body_skip', form({}));
    expect(seen.map((x) => [x.path, x.body.view])).toEqual([
      ['/api/v1/health/day', 'health'],
      ['/api/v1/body', 'body'],
      ['/api/v1/body/skip', 'day'],
    ]);
  });
});

describe('the Habits page (deploy 94)', () => {
  it('offers the Habits page its saves, Today the tick, and keeps the page-only ones off Today', () => {
    expect(HABITS_SAVES).toEqual(['habit', 'habit_day', 'habits_manage', 'undo']);
    expect(TODAY_SAVES).toContain('habit');
    expect(TODAY_SAVES).not.toContain('habit_day');
    expect(TODAY_SAVES).not.toContain('habits_manage');
  });

  it("a day tick: the habit and the day, keyed, and the habits read of the filter shown", () => {
    expect(bodyFor('habit_day', form({ name: 'sample_reading', day: '2026-11-13', show: 'all', key: KEY }), undefined, undefined, 'habits')).toEqual({
      name: 'sample_reading',
      day: '2026-11-13',
      view: 'habits',
      show: 'all',
      key: KEY,
    });
    // the tick of Today's button, asked for the habits read
    expect(bodyFor('habit', form({ name: 'meds', action: 'tick', show: 'retired', key: KEY }), undefined, undefined, 'habits')).toEqual({
      name: 'meds',
      action: 'tick',
      view: 'habits',
      show: 'retired',
      key: KEY,
    });
    // an unknown filter is left out (the door then shows the tracked ones)
    expect(bodyFor('habit_day', form({ name: 'a', day: '2026-11-13', show: 'everything', key: KEY }), undefined, undefined, 'habits')).not.toHaveProperty('show');
  });

  it('makes a new key for a day tick sent without one', () => {
    expect(bodyFor('habit_day', form({ name: 'a', day: '2026-11-13' }), undefined, () => 'server-made-key-0123', 'habits').key).toBe('server-made-key-0123');
  });

  it('each list form sends only the fields of its action, with numbers and true or false where the door wants them', () => {
    const body = (f: Record<string, string>) => bodyFor('habits_manage', form({ ...f, key: KEY }), undefined, undefined, 'habits');
    expect(body({ action: 'track', name: 'meds', on: '1' })).toEqual({ action: 'track', name: 'meds', on: true, view: 'habits', key: KEY });
    expect(body({ action: 'track', name: 'meds', on: '0' })).toMatchObject({ on: false });
    expect(body({ action: 'retire', name: 'meds', on: '1', label: 'x' })).toEqual({ action: 'retire', name: 'meds', view: 'habits', key: KEY });
    expect(body({ action: 'restore', name: 'meds' })).toEqual({ action: 'restore', name: 'meds', view: 'habits', key: KEY });
    expect(body({ action: 'edit', name: 'meds', label: '  Evening   walk ', target: '2', order: '30', aim: 'avoid' })).toEqual({
      action: 'edit',
      name: 'meds',
      label: 'Evening walk',
      target: 2,
      order: 30,
      aim: 'avoid',
      view: 'habits',
      key: KEY,
    });
    // an order left out is kept by the door; an odd aim is not sent
    expect(body({ action: 'edit', name: 'meds', label: 'A', target: '1', aim: 'maybe' })).toEqual({ action: 'edit', name: 'meds', label: 'A', target: 1, view: 'habits', key: KEY });
    expect(body({ action: 'new', label: 'Evening walk', group: 'practice', target: '2', track: '1' })).toEqual({
      action: 'new',
      label: 'Evening walk',
      group: 'practice',
      target: 2,
      track: true,
      view: 'habits',
      key: KEY,
    });
    expect(body({ action: 'new', label: 'Evening walk', group: 'daily', target: '1', track: '0' })).toMatchObject({ track: false });
  });

  it('Delete sends confirmed only with its yes', () => {
    const body = (f: Record<string, string>) => bodyFor('habits_manage', form({ ...f, key: KEY }), undefined, undefined, 'habits');
    expect(body({ action: 'delete', name: 'x', confirmed: '1' })).toEqual({ action: 'delete', name: 'x', confirmed: true, view: 'habits', key: KEY });
    expect(body({ action: 'delete', name: 'x' })).not.toHaveProperty('confirmed');
  });

  it('a day tick goes to /habit/day and a list form to /habits/manage, and a refusal is the door\'s answer', async () => {
    const { door, seen } = net(200, { v: 1, outcome: 'rejected', head: 'Nothing saved.', reason: 'Only the last 30 days can be changed here.' });
    const r = await runSave<{ reason: string }>(door, SESSION, 'habit_day', form({ name: 'a', day: '2026-01-01', key: KEY }), undefined, 'habits');
    expect(r).toMatchObject({ ok: true, answer: { reason: 'Only the last 30 days can be changed here.' } });
    await runSave(door, SESSION, 'habits_manage', form({ action: 'retire', name: 'a', key: KEY }), undefined, 'habits');
    expect(seen.map((x) => x.path)).toEqual(['/api/v1/habit/day', '/api/v1/habits/manage']);
  });
});

describe('the Gym’s Workout page (deploy 96)', () => {
  it('offers the Workout page its saves and keeps them off Today', () => {
    expect(GYM_SAVES).toEqual(['gym_tick', 'gym_remove', 'gym_pick', 'gym_new', 'undo']);
    for (const n of ['gym_tick', 'gym_remove', 'gym_pick', 'gym_new']) expect(TODAY_SAVES).not.toContain(n);
  });

  it('only the tick takes a key (app.’s rule)', () => {
    expect(SAVES.gym_tick.keyed).toBe(true);
    for (const n of ['gym_remove', 'gym_pick', 'gym_new'] as const) {
      expect(SAVES[n].keyed).toBe(false);
      expect(bodyFor(n, form({ key: KEY, exercise_id: '1', day_id: '2', name: 'x', kind: 'weights' }), undefined, undefined, 'gym')).not.toHaveProperty('key');
    }
  });

  it('a tick: the exercise and every number as a JSON number, an empty one null, keyed, the Workout read', () => {
    expect(bodyFor('gym_tick', form({ exercise_id: '2', sets: '3', reps: '10', kg: '62.5', key: KEY }), undefined, undefined, 'gym')).toEqual({
      exercise_id: 2,
      sets: 3,
      reps: 10,
      kg: 62.5,
      minutes: null,
      km: null,
      view: 'gym',
      key: KEY,
    });
    expect(bodyFor('gym_tick', form({ exercise_id: '8', minutes: '25', km: '', key: KEY }), undefined, undefined, 'gym')).toMatchObject({ minutes: 25, km: null, sets: null });
    // words are sent as typed: the door refuses them in plain words
    expect(bodyFor('gym_tick', form({ exercise_id: '8', minutes: 'ten', key: KEY }), undefined, undefined, 'gym')).toMatchObject({ minutes: 'ten' });
    // a tick sent without the page's script gets a key made here
    expect(bodyFor('gym_tick', form({ exercise_id: '2', sets: '3', reps: '10', kg: '45' }), undefined, () => 'server-made-key-0123', 'gym').key).toBe('server-made-key-0123');
  });

  it('a remove: one row by set_id, or all of an exercise’s rows by exercise_id, never both', () => {
    expect(bodyFor('gym_remove', form({ set_id: '62' }), undefined, undefined, 'gym')).toEqual({ set_id: 62, view: 'gym' });
    expect(bodyFor('gym_remove', form({ exercise_id: '1' }), undefined, undefined, 'gym')).toEqual({ exercise_id: 1, view: 'gym' });
    expect(bodyFor('gym_remove', form({ set_id: '62', exercise_id: '1' }), undefined, undefined, 'gym')).toEqual({ set_id: 62, view: 'gym' });
  });

  it('the day pick: a day of the split, or Free workout as null', () => {
    expect(bodyFor('gym_pick', form({ day_id: '2' }), undefined, undefined, 'gym')).toEqual({ day_id: 2, view: 'gym' });
    expect(bodyFor('gym_pick', form({ day_id: '' }), undefined, undefined, 'gym')).toEqual({ day_id: null, view: 'gym' });
  });

  it('+ Add exercise: the name, its kind, the other words as a list, for today', () => {
    expect(bodyFor('gym_new', form({ name: ' Cable fly ', kind: 'weights', words: 'fly, chest  press,', today: '1' }), undefined, undefined, 'gym')).toEqual({
      name: 'Cable fly',
      kind: 'weights',
      words: ['fly', 'chest press'],
      today: true,
      view: 'gym',
    });
  });

  it('each goes to its /gym/<action>, and Undo asks for the Workout read', async () => {
    const { door, seen } = net(200, { v: 1, outcome: 'saved', head: 'Saved: Shoulder press 3 × 10 at 45 kg', gym: {} });
    await runSave(door, SESSION, 'gym_tick', form({ exercise_id: '2', sets: '3', reps: '10', kg: '45', key: KEY }), undefined, 'gym');
    await runSave(door, SESSION, 'gym_remove', form({ set_id: '62' }), undefined, 'gym');
    await runSave(door, SESSION, 'gym_pick', form({ day_id: '' }), undefined, 'gym');
    await runSave(door, SESSION, 'gym_new', form({ name: 'Cable fly', kind: 'weights' }), undefined, 'gym');
    await runSave(door, SESSION, 'undo', form({ token: 'T4v0N4V_gRMyUTvZ' }), undefined, 'gym');
    expect(seen.map((x) => x.path)).toEqual(['/api/v1/gym/tick', '/api/v1/gym/remove', '/api/v1/gym/pick', '/api/v1/gym/new', '/api/v1/undo']);
    expect(seen.at(-1)!.body).toEqual({ token: 'T4v0N4V_gRMyUTvZ', view: 'gym' });
  });
});

describe('the Gym’s Plan and Exercises parts (deploy 97)', () => {
  const PLAN_ACTIONS = ['gym_itemset', 'gym_itemmove', 'gym_itemremove', 'gym_itemadd', 'gym_daynew', 'gym_dayedit', 'gym_dayactive'] as const;
  const EX_ACTIONS = ['gym_rename', 'gym_active', 'gym_new'] as const;

  it('offers each part its saves and keeps them off Today', () => {
    expect(PLAN_SAVES).toEqual([...PLAN_ACTIONS, 'undo']);
    expect(EXERCISES_SAVES).toEqual(['gym_rename', 'gym_active', 'gym_new']);
    for (const n of PLAN_ACTIONS) expect(TODAY_SAVES).not.toContain(n);
    for (const n of EX_ACTIONS) expect(TODAY_SAVES).not.toContain(n);
  });

  it('none takes a key at the door: a key sent is not passed on', () => {
    for (const n of [...PLAN_ACTIONS, ...EX_ACTIONS]) {
      expect(SAVES[n].keyed, n).toBe(false);
      expect(bodyFor(n, form({ key: KEY, item_id: '1', day_id: '1', exercise_id: '1', name: 'x', kind: 'weights', dir: 'up', on: '1' }), undefined, undefined, 'gym_plan'), n).not.toHaveProperty('key');
    }
  });

  it('a plan exercise’s numbers: JSON numbers, both null for none', () => {
    expect(bodyFor('gym_itemset', form({ item_id: '2', sets: '4', reps: '6' }), undefined, undefined, 'gym_plan')).toEqual({ item_id: 2, sets: 4, reps: 6, view: 'gym_plan' });
    expect(bodyFor('gym_itemset', form({ item_id: '2' }), undefined, undefined, 'gym_plan')).toEqual({ item_id: 2, sets: null, reps: null, view: 'gym_plan' });
    // words are sent as typed: the door refuses them in plain words
    expect(bodyFor('gym_itemset', form({ item_id: '2', sets: 'x', reps: '6' }), undefined, undefined, 'gym_plan')).toMatchObject({ sets: 'x', reps: 6 });
  });

  it('up and down, and take off', () => {
    expect(bodyFor('gym_itemmove', form({ item_id: '3', dir: 'down' }), undefined, undefined, 'gym_plan')).toEqual({ item_id: 3, dir: 'down', view: 'gym_plan' });
    expect(bodyFor('gym_itemremove', form({ item_id: '3' }), undefined, undefined, 'gym_plan')).toEqual({ item_id: 3, view: 'gym_plan' });
  });

  it('+ Add exercise on a day: the day, the exercise, sets and reps or null', () => {
    expect(bodyFor('gym_itemadd', form({ day_id: '2', exercise_id: '4', sets: '3', reps: '10' }), undefined, undefined, 'gym_plan')).toEqual({ day_id: 2, exercise_id: 4, sets: 3, reps: 10, view: 'gym_plan' });
    expect(bodyFor('gym_itemadd', form({ day_id: '2', exercise_id: '4' }), undefined, undefined, 'gym_plan')).toEqual({ day_id: 2, exercise_id: 4, sets: null, reps: null, view: 'gym_plan' });
  });

  it('the days: new, rename, and remove or bring back as true or false', () => {
    expect(bodyFor('gym_daynew', form({ name: '  Arms ' }), undefined, undefined, 'gym_plan')).toEqual({ name: 'Arms', view: 'gym_plan' });
    expect(bodyFor('gym_dayedit', form({ day_id: '1', name: 'Chest' }), undefined, undefined, 'gym_plan')).toEqual({ day_id: 1, name: 'Chest', view: 'gym_plan' });
    expect(bodyFor('gym_dayactive', form({ day_id: '1', on: '0' }), undefined, undefined, 'gym_plan')).toEqual({ day_id: 1, on: false, view: 'gym_plan' });
    expect(bodyFor('gym_dayactive', form({ day_id: '4', on: '1' }), undefined, undefined, 'gym_plan')).toEqual({ day_id: 4, on: true, view: 'gym_plan' });
  });

  it('rename, retire and bring back', () => {
    expect(bodyFor('gym_rename', form({ exercise_id: '5', name: ' Chin-up ' }), undefined, undefined, 'gym_exercises')).toEqual({ exercise_id: 5, name: 'Chin-up', view: 'gym_exercises' });
    expect(bodyFor('gym_active', form({ exercise_id: '5', on: '0' }), undefined, undefined, 'gym_exercises')).toEqual({ exercise_id: 5, on: false, view: 'gym_exercises' });
    expect(bodyFor('gym_active', form({ exercise_id: '9', on: '1' }), undefined, undefined, 'gym_exercises')).toEqual({ exercise_id: 9, on: true, view: 'gym_exercises' });
  });

  it('+ New exercise on the Exercises part is not put on today’s day; the Workout page’s is', () => {
    const typed = { name: ' Rowing machine ', kind: 'cardio', words: 'rower, erg,' };
    expect(bodyFor('gym_new', form(typed), undefined, undefined, 'gym_exercises')).toEqual({ name: 'Rowing machine', kind: 'cardio', words: ['rower', 'erg'], view: 'gym_exercises' });
    expect(bodyFor('gym_new', form({ ...typed, today: '1' }), undefined, undefined, 'gym')).toMatchObject({ today: true, view: 'gym' });
  });

  it('each goes to its /gym/<action>; Undo of a take-off asks for the Plan read', async () => {
    const { door, seen } = net(200, { v: 1, outcome: 'changed', head: 'Moved Bench press down.', gym_plan: {} });
    for (const n of PLAN_ACTIONS) await runSave(door, SESSION, n, form({ item_id: '1', day_id: '1', exercise_id: '1', name: 'x', dir: 'up', on: '1' }), undefined, 'gym_plan');
    for (const n of EX_ACTIONS) await runSave(door, SESSION, n, form({ exercise_id: '1', name: 'x', kind: 'weights', on: '1' }), undefined, 'gym_exercises');
    await runSave(door, SESSION, 'undo', form({ token: 'T4v0N4V_gRMyUTvZ' }), undefined, 'gym_plan');
    expect(seen.map((x) => x.path)).toEqual([
      '/api/v1/gym/itemset', '/api/v1/gym/itemmove', '/api/v1/gym/itemremove', '/api/v1/gym/itemadd', '/api/v1/gym/daynew', '/api/v1/gym/dayedit', '/api/v1/gym/dayactive',
      '/api/v1/gym/rename', '/api/v1/gym/active', '/api/v1/gym/new', '/api/v1/undo',
    ]);
    expect(seen.at(-1)!.body).toEqual({ token: 'T4v0N4V_gRMyUTvZ', view: 'gym_plan' });
    expect(seen.slice(0, 7).every((x) => (x.body as { view: string }).view === 'gym_plan')).toBe(true);
    expect(seen.slice(7, 10).every((x) => (x.body as { view: string }).view === 'gym_exercises')).toBe(true);
  });
});

describe('Home’s Now and Pick pages (deploy 99)', () => {
  const HOME = ['home_tick', 'home_start', 'home_pause', 'home_resume', 'home_stop', 'home_pickdone', 'home_picknext', 'home_skip', 'home_earlier'] as const;

  it('offers Now the tick and Undo, Pick its eight buttons and Undo, and keeps them off Today', () => {
    expect(HOME_SAVES).toEqual(['home_tick', 'undo']);
    expect(PICK_SAVES).toEqual(['home_start', 'home_pause', 'home_resume', 'home_stop', 'home_pickdone', 'home_picknext', 'home_skip', 'home_earlier', 'undo']);
    for (const n of HOME) expect(TODAY_SAVES).not.toContain(n);
  });

  it('keys only tick, Done, Done next job and Done it earlier? (the door’s home._once)', () => {
    expect(HOME.filter((n) => SAVES[n].keyed)).toEqual(['home_tick', 'home_pickdone', 'home_picknext', 'home_earlier']);
    for (const n of HOME) {
      const b = bodyFor(n, form({ key: KEY, chore_id: '3', zone_id: '1', pairs: '3-1', minutes: '15', timer_id: '1', when: '1' }), undefined, undefined, 'home_pick');
      if (SAVES[n].keyed) expect(b.key, n).toBe(KEY);
      else expect(b, n).not.toHaveProperty('key');
    }
  });

  it('sends ids as numbers and pairs as [[chore_id, zone_id], …], with the page’s time and job for the fresh read', () => {
    expect(bodyFor('home_tick', form({ chore_id: '4', zone_id: '1', key: KEY, view_min: '30' }), undefined, undefined, 'home')).toEqual({
      chore_id: 4,
      zone_id: 1,
      key: KEY,
      view: 'home',
      view_min: 30,
    });
    expect(bodyFor('home_start', form({ pairs: '1-2,7-2,2-2', minutes: '60', view_min: '60', view_n: '0' }), undefined, undefined, 'home_pick')).toEqual({
      pairs: [[1, 2], [7, 2], [2, 2]],
      minutes: 60,
      view: 'home_pick',
      view_min: 60,
      view_n: 0,
    });
    for (const n of ['home_pause', 'home_resume', 'home_stop'] as const) {
      expect(bodyFor(n, form({ timer_id: '12' }), undefined, undefined, 'home_pick')).toEqual({ timer_id: 12, view: 'home_pick' });
    }
    expect(bodyFor('home_pickdone', form({ pairs: '3-1', key: KEY }), undefined, undefined, 'home')).toEqual({ pairs: [[3, 1]], key: KEY, view: 'home' });
    expect(bodyFor('home_pickdone', form({ pairs: '3-1', timer_id: '5', key: KEY, view_min: '15', view_n: '2' }), undefined, undefined, 'home')).toEqual({
      pairs: [[3, 1]],
      timer_id: 5,
      key: KEY,
      view: 'home',
      view_min: 15,
    });
    expect(bodyFor('home_picknext', form({ pairs: '3-1', timer_id: '5', key: KEY }), undefined, undefined, 'home_pick')).toMatchObject({ pairs: [[3, 1]], timer_id: 5 });
    expect(bodyFor('home_skip', form({ pairs: '6-3' }), undefined, undefined, 'home_pick')).toEqual({ pairs: [[6, 3]], view: 'home_pick' });
    expect(bodyFor('home_earlier', form({ pairs: '5-2', when: '2', key: KEY }), undefined, undefined, 'home_pick')).toMatchObject({ pairs: [[5, 2]], when: 2 });
    expect(bodyFor('home_earlier', form({ pairs: '5-2', when: '2026-11-02', key: KEY }), undefined, undefined, 'home_pick')).toMatchObject({ when: '2026-11-02' });
  });

  it('leaves out pairs that are not pairs and a time or job that is not a number (the door then says what is wrong)', () => {
    expect(bodyFor('home_skip', form({ pairs: '3-1;drop' }), undefined, undefined, 'home_pick')).toEqual({ view: 'home_pick' });
    expect(bodyFor('home_skip', form({ pairs: Array.from({ length: 13 }, (_, i) => `${i + 1}-1`).join(',') }), undefined, undefined, 'home_pick')).not.toHaveProperty('pairs');
    expect(bodyFor('home_tick', form({ chore_id: '4', zone_id: '1', key: KEY, view_min: 'all' }), undefined, undefined, 'home')).not.toHaveProperty('view_min');
    // view_n belongs to the Pick read only
    expect(bodyFor('home_tick', form({ chore_id: '4', zone_id: '1', key: KEY, view_n: '3' }), undefined, undefined, 'home')).not.toHaveProperty('view_n');
  });

  it('each goes to its /home/<action>, and Undo asks for its page’s read', async () => {
    const { door, seen } = net(200, { v: 1, outcome: 'saved', head: 'Saved: Clean the fridge · Kitchen', home: {} });
    for (const n of HOME) await runSave(door, SESSION, n, form({ chore_id: '3', zone_id: '1', pairs: '3-1', minutes: '15', timer_id: '1', when: '1', key: KEY }), undefined, 'home_pick');
    await runSave(door, SESSION, 'undo', form({ token: 'xxr8bM8hNQ71ey7c', view_min: '15' }), undefined, 'home');
    expect(seen.map((x) => x.path)).toEqual([...HOME.map((n) => `/api/v1/home/${n.slice(5)}`), '/api/v1/undo']);
    expect(seen.at(-1)!.body).toEqual({ token: 'xxr8bM8hNQ71ey7c', view: 'home', view_min: 15 });
  });
});

describe('Home’s Zones, History and Edit zones pages (deploy 100)', () => {
  const ZONES = ['home_tick', 'home_alldone', 'home_startpoint'] as const;
  const EDIT = ['home_goalset', 'home_zonenew', 'home_zoneedit', 'home_zoneactive', 'home_chorenew', 'home_choreedit', 'home_choreactive', 'home_chorezones'] as const;

  it('offers each page its saves, and keeps them off Today', () => {
    expect(ZONES_SAVES).toEqual([...ZONES, 'undo']);
    expect(HISTORY_SAVES).toEqual(['home_remove', 'home_earlier', 'undo']);
    expect(EDIT_SAVES).toEqual(EDIT);
    expect(EDIT_SAVES).not.toContain('undo'); // none of Edit zones' saves has an Undo
    for (const n of [...ZONES, 'home_remove', ...EDIT]) expect(TODAY_SAVES).not.toContain(n);
  });

  it('keys only tick, All done, a starting point and Done earlier (the door’s home._once)', () => {
    const all = [...ZONES, 'home_remove', 'home_earlier', ...EDIT] as const;
    expect(all.filter((n) => SAVES[n].keyed)).toEqual(['home_tick', 'home_alldone', 'home_startpoint', 'home_earlier']);
    for (const n of all) {
      const b = bodyFor(n, form({ key: KEY, chore_id: '3', zone_id: '1', pairs: '3-1', ago: 'week', ids: '7', when: '1', goal: '3' }), undefined, undefined, 'home_zones');
      if (SAVES[n].keyed) expect(b.key, n).toBe(KEY);
      else expect(b, n).not.toHaveProperty('key');
    }
  });

  it('sends All done, a starting point and a remove with their door fields and the page’s read', () => {
    expect(bodyFor('home_alldone', form({ chore_id: '2', key: KEY }), undefined, undefined, 'home_zones')).toEqual({ chore_id: 2, key: KEY, view: 'home_zones' });
    expect(bodyFor('home_tick', form({ chore_id: '4', zone_id: '1', key: KEY }), undefined, undefined, 'home_zones')).toEqual({ chore_id: 4, zone_id: 1, key: KEY, view: 'home_zones' });
    expect(bodyFor('home_startpoint', form({ pairs: '2-2,2-3', ago: 'unknown', key: KEY }), undefined, undefined, 'home_zones')).toEqual({
      pairs: [[2, 2], [2, 3]],
      ago: 'unknown',
      key: KEY,
      view: 'home_zones',
    });
    expect(bodyFor('home_remove', form({ ids: '7,9', view_limit: '120' }), undefined, undefined, 'home_history')).toEqual({ ids: [7, 9], view: 'home_history', view_limit: 120 });
    expect(bodyFor('home_remove', form({ ids: '7;drop' }), undefined, undefined, 'home_history')).toEqual({ view: 'home_history' });
    expect(bodyFor('home_remove', form({ ids: Array.from({ length: 21 }, (_, i) => i + 1).join(',') }), undefined, undefined, 'home_history')).not.toHaveProperty('ids');
    expect(bodyFor('home_earlier', form({ pairs: '5-2', when: '2026-11-02', key: KEY, view_limit: 'many' }), undefined, undefined, 'home_history')).toEqual({
      pairs: [[5, 2]],
      when: '2026-11-02',
      key: KEY,
      view: 'home_history',
    });
  });

  it('sends the goal and Retire or Bring back as numbers and true or false', () => {
    expect(bodyFor('home_goalset', form({ goal: '4' }), undefined, undefined, 'home_edit')).toEqual({ goal: 4, view: 'home_edit' });
    expect(bodyFor('home_choreactive', form({ chore_id: '3', on: '0' }), undefined, undefined, 'home_edit')).toEqual({ chore_id: 3, on: false, view: 'home_edit' });
    expect(bodyFor('home_choreactive', form({ chore_id: '3', on: '1' }), undefined, undefined, 'home_edit')).toEqual({ chore_id: 3, on: true, view: 'home_edit' });
    expect(bodyFor('home_zoneactive', form({ zone_id: '4', on: '1' }), undefined, undefined, 'home_edit')).toEqual({ zone_id: 4, on: true, view: 'home_edit' });
  });

  it('sends a zone form with its spots a line each and its words as a list', () => {
    const f = form({ name: 'Balcony', short: '', spots: 'Table\n\n  Plants  \r\nFloor', words: 'terrace, , Outdoor ' });
    expect(bodyFor('home_zonenew', f, undefined, undefined, 'home_edit')).toEqual({
      name: 'Balcony',
      short: '',
      spots: ['Table', 'Plants', 'Floor'],
      words: ['terrace', 'Outdoor'],
      view: 'home_edit',
    });
    expect(bodyFor('home_zoneedit', form({ zone_id: '2', name: 'Bath', short: 'B', spots: '', words: '' }), undefined, undefined, 'home_edit')).toEqual({
      zone_id: 2,
      name: 'Bath',
      short: 'B',
      spots: [],
      words: [],
      view: 'home_edit',
    });
  });

  it('sends a chore form with the zone as a number or null for the whole flat, and blank minutes as null', () => {
    const base = { name: ' Clean the oven ', days: '90', minutes: '30', steps: 'Racks\nGlass', howto: 'Cold oven.', words: 'oven, stove' };
    expect(bodyFor('home_chorenew', form({ ...base, zone_id: '1' }), undefined, undefined, 'home_edit')).toEqual({
      name: 'Clean the oven',
      zone_id: 1,
      days: 90,
      minutes: 30,
      steps: ['Racks', 'Glass'],
      howto: 'Cold oven.',
      words: ['oven', 'stove'],
      view: 'home_edit',
    });
    expect(bodyFor('home_choreedit', form({ ...base, chore_id: '8', zone_id: 'flat', minutes: '', howto: '', steps: '', words: '' }), undefined, undefined, 'home_edit')).toEqual({
      chore_id: 8,
      name: 'Clean the oven',
      zone_id: null,
      days: 90,
      minutes: null,
      steps: [],
      howto: null,
      words: [],
      view: 'home_edit',
    });
    // days that are no number are left out: the door then says 400 (the page says it first)
    expect(bodyFor('home_chorenew', form({ ...base, zone_id: '1', days: '7.5' }), undefined, undefined, 'home_edit')).not.toHaveProperty('days');
    // no zone chosen: left out (the door: zone_id is missing)
    expect(bodyFor('home_chorenew', form({ ...base, zone_id: 'x;1' }), undefined, undefined, 'home_edit')).not.toHaveProperty('zone_id');
  });

  it('sends the Per zone table as a list of zones: a zone unticked is off, blank days and minutes are null', () => {
    const f = form({ chore_id: '2', zone_ids: ['1', '2', '3'], on_1: '1', days_1: '3', min_1: '', on_2: '1', days_2: '', min_2: '5', days_3: '', min_3: '' });
    expect(bodyFor('home_chorezones', f, undefined, undefined, 'home_edit')).toEqual({
      chore_id: 2,
      zones: [
        { zone_id: 1, on: true, days: 3, minutes: null },
        { zone_id: 2, on: true, days: null, minutes: 5 },
        { zone_id: 3, on: false, days: null, minutes: null },
      ],
      view: 'home_edit',
    });
    expect(bodyFor('home_chorezones', form({ chore_id: '2', zone_ids: ['1;x'] }), undefined, undefined, 'home_edit')).not.toHaveProperty('zones');
  });

  it('each goes to its /home/<action>, and Undo on History asks for its page’s read with its limit', async () => {
    const { door, seen } = net(200, { v: 1, outcome: 'saved', head: 'Saved.', home_zones: {} });
    const fields = { chore_id: '3', zone_id: '1', pairs: '3-1', ago: 'week', ids: '7', when: '1', goal: '3', name: 'x', zone_ids: ['1'], key: KEY };
    const names = [...ZONES, 'home_remove', ...EDIT] as const;
    for (const n of names) await runSave(door, SESSION, n, form(fields), undefined, 'home_zones');
    await runSave(door, SESSION, 'undo', form({ token: 'xxr8bM8hNQ71ey7c', view_limit: '180' }), undefined, 'home_history');
    expect(seen.map((x) => x.path)).toEqual([...names.map((n) => `/api/v1/home/${n.slice(5)}`), '/api/v1/undo']);
    expect(seen.at(-1)!.body).toEqual({ token: 'xxr8bM8hNQ71ey7c', view: 'home_history', view_limit: 180 });
  });

  it('asks a chore’s page for its chore', () => {
    expect(bodyFor('undo', form({ token: 'xxr8bM8hNQ71ey7c', view_id: '3' }), undefined, undefined, 'home_chore')).toEqual({ token: 'xxr8bM8hNQ71ey7c', view: 'home_chore', view_id: 3 });
  });
});

// Deploy 102: the Week review's button (POST /coach/start): kind "week" and the card's period, never a key, the page's period for the
// fresh Week, and time enough for the door so a slow answer is not mistaken for "not saved".
describe('the Week review', () => {
  it('starts a week review with the card\'s period and no key, and asks for the Week of the page\'s period', () => {
    const body = bodyFor('coach_start', form({ start: '2026-11-02', end: '2026-11-08', view_p: 'last', key: KEY }), undefined, undefined, 'week');
    expect(body).toEqual({ kind: 'week', start: '2026-11-02', end: '2026-11-08', view: 'week', view_p: 'last' });
    expect(SAVES.coach_start.keyed).toBe(false);
    expect(TRENDS_SAVES).toEqual(['coach_start']);
    expect(TODAY_SAVES).not.toContain('coach_start');
  });

  it('leaves out a date that is no date and a period that is not one of the four (the door then refuses in its words)', () => {
    const body = bodyFor('coach_start', form({ start: '2.11.2026', end: '2026-11-08', view_p: '90' }), undefined, undefined, 'week');
    expect(body).toEqual({ kind: 'week', end: '2026-11-08', view: 'week' });
  });

  it('goes to /coach/start once, with 60 s for the door', async () => {
    const seen: { path: string; body: Record<string, unknown>; timeout: boolean }[] = [];
    const { door } = net(200, { v: 1, outcome: 'changed', head: 'The coach is reading your week: about 45 seconds.', coaching: { id: 5, state: 'working' }, week: {} });
    const wrapped = { ...door, post: (path: string, session: string | null, body: Record<string, unknown>, timeoutMs?: number) => {
      seen.push({ path, body, timeout: timeoutMs === 60_000 });
      return door.post(path, session, body, timeoutMs);
    } };
    const r = await runSave(wrapped as typeof door, SESSION, 'coach_start', form({ start: '2026-11-09', end: '2026-11-10', view_p: 'this' }), undefined, 'week');
    expect(r.ok).toBe(true);
    expect(seen).toEqual([{ path: '/coach/start', body: { kind: 'week', start: '2026-11-09', end: '2026-11-10', view: 'week', view_p: 'this' }, timeout: true }]);
  });
});

// Deploy 109: the day coaching's button (POST /coach/start, kind "day"), on Today's Coach card and on the Coach page: the day twice, never a
// key, Today's fresh read (view "day", view_day) or the Coach page's (view "coach", view_f, view_day). Today keeps it (TODAY_SAVES is made
// by exclusion); the Week review's button stays Trends' own.
describe('the day coaching', () => {
  it('starts a day coaching for the card\'s day twice, with no key', () => {
    const body = bodyFor('coach_day', form({ start: '2026-11-14', end: '2026-11-15', key: KEY }), '2026-11-14', undefined, 'day');
    expect(body).toEqual({ kind: 'day', start: '2026-11-14', end: '2026-11-14', view: 'day', view_day: '2026-11-14' });
    expect(SAVES.coach_day.keyed).toBe(false);
    expect(SAVES.coach_day.timeoutMs).toBe(60_000);
  });

  it('asks the Coach page for its filter and day', () => {
    const body = bodyFor('coach_day', form({ start: '2026-11-14', view_f: 'weeks', view_day: '2026-11-14' }), '2026-11-14', undefined, 'coach');
    expect(body).toEqual({ kind: 'day', start: '2026-11-14', end: '2026-11-14', view: 'coach', view_f: 'weeks', view_day: '2026-11-14' });
  });

  it('leaves out a filter that is none of the three and a day that is no day (the door then answers in its words)', () => {
    const body = bodyFor('coach_day', form({ start: '14.11.2026', view_f: 'drinks', view_day: 'x' }), 'x', undefined, 'coach');
    expect(body).toEqual({ kind: 'day', view: 'coach' });
  });

  it('is on Today\'s and the Coach page\'s form actions, not on Trends\'; the week review is on Trends\' only', () => {
    expect(COACH_SAVES).toEqual(['coach_day']);
    expect(TODAY_SAVES).toContain('coach_day');
    expect(TODAY_SAVES).not.toContain('coach_start');
    expect(TRENDS_SAVES).toEqual(['coach_start']);
    expect(FOOD_SAVES).not.toContain('coach_day');
  });

  it('goes to /coach/start once, with 60 s for the door', async () => {
    const seen: { path: string; body: Record<string, unknown>; timeout: boolean }[] = [];
    const { door } = net(200, { v: 1, outcome: 'changed', head: 'The coach is reading your day: about 30 seconds.', coaching: { id: 8, state: 'working' }, day: {} });
    const wrapped = { ...door, post: (path: string, session: string | null, body: Record<string, unknown>, timeoutMs?: number) => {
      seen.push({ path, body, timeout: timeoutMs === 60_000 });
      return door.post(path, session, body, timeoutMs);
    } };
    const r = await runSave(wrapped as typeof door, SESSION, 'coach_day', form({ start: '2026-11-16', view_day: '2026-11-16' }), '2026-11-16', 'day');
    expect(r.ok).toBe(true);
    expect(seen).toEqual([{ path: '/coach/start', body: { kind: 'day', start: '2026-11-16', end: '2026-11-16', view: 'day', view_day: '2026-11-16' }, timeout: true }]);
  });
});

// Deploy 105: Library's Foods tab (POST /food/catalogue/<action>): ids and values as numbers, only the values sent, ticks as true or
// false, never a key, and the page's view for the fresh Catalogue and box. The look-up and its yes are Today's saves, asked for it.
describe('the Catalogue (Library)', () => {
  const VIEW = { view_q: 'oat', view_f: 'drinks', view_s: 'name', view_food: '3' };
  const fresh = { view: 'catalogue', view_q: 'oat', view_f: 'drinks', view_s: 'name', view_food: 3 };

  it('sends only the values typed, as numbers (a comma too), past as true or false, confirmed only on Yes, and never a key', () => {
    expect(bodyFor('catalogue_values', form({ id: '2', kcal: '70', protein: '11,5', past: '1', key: KEY, ...VIEW }), undefined, undefined, 'catalogue')).toEqual({
      id: 2, kcal: 70, protein: 11.5, past: true, ...fresh,
    });
    expect(bodyFor('catalogue_values', form({ id: '2', kcal: '70', confirmed: '1' }), undefined, undefined, 'catalogue')).toEqual({ id: 2, kcal: 70, past: false, confirmed: true, view: 'catalogue' });
    // something that is not a number goes as typed: the door's 400 says so
    expect(bodyFor('catalogue_values', form({ id: '2', fat: 'lots' }), undefined, undefined, 'catalogue')).toMatchObject({ fat: 'lots' });
  });

  it('builds the words, barcode, basics, unit and reviewed bodies as the door takes them', () => {
    const b = (n: Parameters<typeof bodyFor>[0], f: Record<string, string>) => bodyFor(n, form(f), undefined, undefined, 'catalogue');
    expect(b('catalogue_words', { id: '1', act: 'add', word: ' Porridge ' })).toEqual({ id: 1, act: 'add', word: 'Porridge', view: 'catalogue' });
    expect(b('catalogue_barcode', { id: '1', barcode: '4000 0000' })).toEqual({ id: 1, barcode: '4000 0000', view: 'catalogue' });
    expect(b('catalogue_basics', { id: '6', name: 'Apple', hide: '1' })).toEqual({ id: 6, name: 'Apple', drink: false, hide: true, view: 'catalogue' });
    expect(b('catalogue_unit', { id: '5', unit: 'slice', grams: '35' })).toEqual({ id: 5, unit: 'slice', grams: 35, view: 'catalogue' });
    expect(b('catalogue_unit', { id: '5', unit: 'slice', grams: '' })).toEqual({ id: 5, unit: 'slice', grams: null, view: 'catalogue' });
    expect(b('catalogue_reviewed', { id: '5' })).toEqual({ id: 5, view: 'catalogue' });
  });

  it('asks the look-up and its answer for the Catalogue, and leaves out a view that is not one', () => {
    expect(bodyFor('lookup', form({ text: 'crispbread', ...VIEW }), undefined, undefined, 'catalogue')).toEqual({ text: 'crispbread', ...fresh });
    expect(bodyFor('answer', form({ question_id: 'p1', reply: 'yes', view_food: 'N12' }), undefined, undefined, 'catalogue')).toEqual({ question_id: 'p1', reply: 'yes', view: 'catalogue', view_food: 12 });
    expect(bodyFor('answer', form({ question_id: 'p1', reply: 'no', view_f: 'odd', view_s: 'best', view_food: 'x1' }), undefined, undefined, 'catalogue')).toEqual({ question_id: 'p1', reply: 'no', view: 'catalogue' });
  });

  it('takes no key for any of the six and keeps them off Today', () => {
    const six = ['catalogue_values', 'catalogue_words', 'catalogue_barcode', 'catalogue_basics', 'catalogue_unit', 'catalogue_reviewed'] as const;
    for (const n of six) {
      expect(SAVES[n].keyed, n).toBe(false);
      expect(SAVES[n].path).toBe(`/food/catalogue/${n.slice('catalogue_'.length)}`);
      expect(TODAY_SAVES).not.toContain(n);
    }
    expect(CATALOGUE_SAVES).toEqual([...six, 'lookup', 'answer', 'undo']);
    expect(TODAY_SAVES).toContain('lookup');
    expect(TODAY_SAVES).toContain('answer');
    expect(LIBRARY_HABITS_SAVES).toEqual(['habits_manage']);
  });

  it('goes to /food/catalogue/values once, without a key', async () => {
    const { door, seen } = net(200, { v: 1, outcome: 'needs_confirmation', head: 'Nothing saved yet: please confirm.', catalogue: {}, food_item: null });
    const r = await runSave(door, SESSION, 'catalogue_values', form({ id: '2', kcal: '70', ...VIEW }), undefined, 'catalogue');
    expect(r.ok).toBe(true);
    expect(seen).toEqual([{ path: '/api/v1/food/catalogue/values', body: { id: 2, kcal: 70, past: false, ...fresh }, timeout: true }]);
  });
});

// Deploy 106: Medical's forms (POST /labs/value, /labs/report, /labs/med): the id as a number, only the fields sent (a cleared one null),
// dates as dates, never a key, confirmed only on Yes, and the page's view for the fresh read. A new course is Today's `log` and `answer`.
describe('Medical (the Medical Space)', () => {
  const b = (n: Parameters<typeof bodyFor>[0], f: Record<string, string>, view: Parameters<typeof bodyFor>[4] = 'labs') => bodyFor(n, form(f), undefined, undefined, view);

  it('a value: only the fields typed over, the cleared one as null, confirmed only on Yes, never a key, the open report asked for', () => {
    expect(b('labs_value', { id: '10', value: ' 12.9 ', key: KEY, view_open: 'R4' })).toEqual({ id: 10, value: '12.9', view: 'labs', view_open: 'R4' });
    expect(b('labs_value', { id: '10', value: '', unit: 'mmol/L', ref: '' })).toEqual({ id: 10, value: null, unit: 'mmol/L', ref: null, view: 'labs' });
    expect(b('labs_value', { id: '10', value: '12.9', confirmed: '1', view_open: 'r4' })).toEqual({ id: 10, value: '12.9', confirmed: true, view: 'labs', view_open: 'R4' });
    // nothing typed over: only the id (the door says "Nothing changed.")
    expect(b('labs_value', { id: '10' })).toEqual({ id: 10, view: 'labs' });
    // a view_open that is no report is left out
    expect(b('labs_value', { id: '10', view_open: 'x1' })).toEqual({ id: 10, view: 'labs' });
  });

  it('a report: the date as a date (anything else null: the door asks for it), the texts as typed, a cleared one null', () => {
    expect(b('labs_report', { id: '4', collected: '2026-10-06', title: 'Check-up', provider: '', notes: 'Fasting.' })).toEqual({
      id: 4, collected: '2026-10-06', title: 'Check-up', provider: null, notes: 'Fasting.', view: 'labs',
    });
    expect(b('labs_report', { id: '4', collected: '' })).toEqual({ id: 4, collected: null, view: 'labs' });
    expect(b('labs_report', { id: '4', collected: '6.10.2026' })).toEqual({ id: 4, collected: null, view: 'labs' });
    expect(b('labs_report', { id: '4', title: 'Check-up', confirmed: '1' })).toEqual({ id: 4, title: 'Check-up', confirmed: true, view: 'labs' });
  });

  it('a course: save with its fields (an empty stop null = running), End with none; the Medication read asked for', () => {
    expect(b('labs_med', { id: '1', act: 'save', dose: '2000 IU', frequency: '', indication: 'low vitamin D', start: '2026-09-01', stop: '' }, 'labs_meds')).toEqual({
      id: 1, act: 'save', dose: '2000 IU', frequency: null, indication: 'low vitamin D', start: '2026-09-01', stop: null, view: 'labs_meds',
    });
    expect(b('labs_med', { id: '1', act: 'end', dose: 'ignored', key: KEY }, 'labs_meds')).toEqual({ id: 1, act: 'end', view: 'labs_meds' });
    expect(b('labs_med', { id: '1', act: 'end', confirmed: '1' }, 'labs_meds')).toEqual({ id: 1, act: 'end', confirmed: true, view: 'labs_meds' });
    expect(b('labs_med', { id: '1', dose: '1 mg' }, 'labs_meds')).toMatchObject({ act: 'save', dose: '1 mg' });
  });

  it('asks the Tests read for its search and test (digits only), the Medication read for nothing more', () => {
    expect(b('answer', { question_id: 'p1', reply: 'yes', view_q: 'vit', view_t: '21' }, 'labs_tests')).toEqual({ question_id: 'p1', reply: 'yes', view: 'labs_tests', view_q: 'vit', view_t: '21' });
    expect(b('answer', { question_id: 'p1', reply: 'yes', view_t: 'a21' }, 'labs_tests')).toEqual({ question_id: 'p1', reply: 'yes', view: 'labs_tests' });
    expect(b('log', { text: 'started vitamin D 1000 IU daily', key: KEY }, 'labs_meds')).toEqual({ text: 'started vitamin D 1000 IU daily', key: KEY, view: 'labs_meds' });
    expect(b('answer', { question_id: 'p1', reply: 'yes' }, 'labs_meds')).toEqual({ question_id: 'p1', reply: 'yes', view: 'labs_meds' });
  });

  it('takes no key for any of the three, goes to /labs/<form>, and stays off Today', () => {
    for (const n of ['labs_value', 'labs_report', 'labs_med'] as const) {
      expect(SAVES[n].keyed, n).toBe(false);
      expect(SAVES[n].path).toBe(`/labs/${n.slice('labs_'.length)}`);
      expect(TODAY_SAVES).not.toContain(n);
    }
    expect(MEDICAL_REPORTS_SAVES).toEqual(['labs_value', 'labs_report']);
    expect(MEDICAL_MEDS_SAVES).toEqual(['labs_med', 'log', 'answer', 'undo']);
    expect(TODAY_SAVES).toContain('log');
  });

  it('goes to /labs/value once, without a key', async () => {
    const { door, seen } = net(200, { v: 1, outcome: 'needs_confirmation', head: 'Nothing saved yet: please confirm.', labs: {} });
    const r = await runSave(door, SESSION, 'labs_value', form({ id: '10', value: '12.9', view_open: 'R4' }), undefined, 'labs');
    expect(r.ok).toBe(true);
    expect(seen).toEqual([{ path: '/api/v1/labs/value', body: { id: 10, value: '12.9', view: 'labs', view_open: 'R4' }, timeout: true }]);
  });

  it('the typed course goes to /log with its key, 60 s for the AI, and asks for the Medication read', async () => {
    const { door, seen } = net(200, { v: 1, outcome: 'needs_confirmation', head: 'Nothing saved yet: please confirm.', labs_meds: {} });
    await runSave(door, SESSION, 'log', form({ text: 'started vitamin D 1000 IU daily', key: KEY }), undefined, 'labs_meds');
    expect(seen).toEqual([{ path: '/api/v1/log', body: { text: 'started vitamin D 1000 IU daily', key: KEY, view: 'labs_meds' }, timeout: true }]);
  });
});

// Deploy 111: Settings' tabs (POST /settings/<tab>, /push/off, /push/test): numbers as numbers, the Today page's group in its order,
// the coach's parts only when the form had them, the nudges' switches as true or false; never a key, never in Today's actions, never
// sent again by the page; each tab's fresh read asked for.
describe('Settings', () => {
  const NAMES = ['settings_targets', 'settings_today', 'settings_today_reset', 'settings_height', 'settings_body', 'settings_coach', 'settings_device', 'settings_others', 'settings_nudges', 'push_off', 'push_test', 'push_subscribe'] as const;

  it('are on their tabs\' form actions only, take no key and are never sent again by the page', () => {
    expect([...SETTINGS_TARGETS_SAVES, ...SETTINGS_TODAY_SAVES, ...SETTINGS_BODY_SAVES, ...SETTINGS_COACH_SAVES, ...SETTINGS_DEVICES_SAVES, ...SETTINGS_NOTIFY_SAVES].sort()).toEqual([...NAMES].sort());
    for (const n of NAMES) {
      expect(TODAY_SAVES).not.toContain(n);
      expect(FOOD_SAVES).not.toContain(n);
      expect(SAVES[n].keyed).toBe(false);
      expect(mayResend(n)).toBe(false);
      expect(bodyFor(n, form({ key: KEY }), undefined, () => KEY, 'settings_targets')).not.toHaveProperty('key');
    }
    expect(SETTINGS_ONLY).not.toContain('undo');
    expect(TODAY_SAVES).toContain('undo');
  });

  it('go to the door\'s routes', () => {
    expect(NAMES.map((n) => SAVES[n].path)).toEqual(['/settings/targets', '/settings/today', '/settings/today_reset', '/settings/height', '/settings/body', '/settings/coach', '/settings/device', '/settings/others', '/settings/nudges', '/push/off', '/push/test', '/push/subscribe']);
  });

  it('food targets: the date, the nine as numbers (a comma too), an empty one as null (no target), the note left out when empty', () => {
    const body = bodyFor('settings_targets', form({ valid_from: '2026-11-17', kcal: '2000', protein: '150,5', fat: '', sat_fat: '-5', note: ' new plan ' }), undefined, undefined, 'settings_targets');
    expect(body).toEqual({
      valid_from: '2026-11-17', kcal: 2000, protein: 150.5, fat: null, sat_fat: -5, carbs: null, fibre: null, sugar_added: null, sodium_mg: null, water_ml: null,
      note: 'new plan', view: 'settings_targets',
    });
    expect(bodyFor('settings_targets', form({ valid_from: '17.11.2026', kcal: 'lots' }), undefined, undefined, 'settings_targets')).toMatchObject({ kcal: 'lots' });
    expect(bodyFor('settings_targets', form({ valid_from: '17.11.2026' }), undefined, undefined, 'settings_targets')).not.toHaveProperty('valid_from');
  });

  it('the Today page: one group, its ids in the order sent, each shown or not; an unknown group sends none', () => {
    const body = bodyFor('settings_today', form({ group: 'health', id: ['wake', 'bed', 'weight'], shown: ['1', '0', '1'] }), undefined, undefined, 'settings_today');
    expect(body).toEqual({ groups: { health: [{ id: 'wake', shown: true }, { id: 'bed', shown: false }, { id: 'weight', shown: true }] }, view: 'settings_today' });
    expect(bodyFor('settings_today', form({ group: 'drinks', id: 'x', shown: '1' }), undefined, undefined, 'settings_today')).toEqual({ groups: {}, view: 'settings_today' });
    expect(bodyFor('settings_today_reset', form({ confirmed: '1' }), undefined, undefined, 'settings_today')).toEqual({ view: 'settings_today' });
  });

  it('body: the height as a number, the measures shown always sent (none: the door\'s "Keep at least one measure.")', () => {
    expect(bodyFor('settings_height', form({ valid_from: '2026-11-17', height: '177,5' }), undefined, undefined, 'settings_body')).toEqual({ valid_from: '2026-11-17', height: 177.5, view: 'settings_body' });
    expect(bodyFor('settings_body', form({ interval: '28', show: ['waist', 'hips'] }), undefined, undefined, 'settings_body')).toEqual({ interval: 28, show: ['waist', 'hips'], view: 'settings_body' });
    expect(bodyFor('settings_body', form({ interval: '28' }), undefined, undefined, 'settings_body')).toEqual({ interval: 28, show: [], view: 'settings_body' });
  });

  it('coach: the texts as typed (up to 2000), the parts switched on only when the form had the switches', () => {
    const body = bodyFor('settings_coach', form({ goals: 'Walk every day.', style: '', parts: '1', day: ['went_well', 'gaps'] }), undefined, undefined, 'settings_coach');
    expect(body).toEqual({ goals: 'Walk every day.', style: '', parts: { day: ['went_well', 'gaps'], week: [] }, view: 'settings_coach' });
    expect(bodyFor('settings_coach', form({ goals: 'x'.repeat(2500) }), undefined, undefined, 'settings_coach')).toEqual({ goals: 'x'.repeat(2000), view: 'settings_coach' });
  });

  it('devices and notifications: the id, the nudges\' switches as true or false and their hours as numbers (not a number: left out)', () => {
    expect(bodyFor('settings_device', form({ id: '0920104a-d56c-44ca-9187-f6b801c9e336' }), undefined, undefined, 'settings_devices')).toEqual({ id: '0920104a-d56c-44ca-9187-f6b801c9e336', view: 'settings_devices' });
    expect(bodyFor('settings_others', form({ confirmed: '1' }), undefined, undefined, 'settings_devices')).toEqual({ view: 'settings_devices' });
    expect(bodyFor('push_off', form({ id: '54' }), undefined, undefined, 'settings_notify')).toEqual({ id: 54, view: 'settings_notify' });
    expect(bodyFor('push_test', form({}), undefined, undefined, 'settings_notify')).toEqual({ view: 'settings_notify' });
    const body = bodyFor('settings_nudges', form({ on: '1', weight: '1', habits: '0', idle: '0', weight_after: '2,5', idle_hours: 'soon', gratitude_after: '13' }), undefined, undefined, 'settings_notify');
    expect(body).toEqual({ on: true, weight: true, habits: false, idle: false, weight_after: 2.5, gratitude_after: 13, view: 'settings_notify' });
  });

  // deploy 112: "This device" turned on
  it('notifications on this device: the subscription with the browser\'s User-Agent (up to 300), checked before the door is asked', async () => {
    expect(bodyFor('push_subscribe', form(SUB), undefined, undefined, 'settings_notify', { userAgent: 'Mozilla/5.0 (iPhone) Safari/604.1' })).toEqual({
      endpoint: SUB.endpoint, keys: { p256dh: SUB.p256dh, auth: SUB.auth }, user_agent: 'Mozilla/5.0 (iPhone) Safari/604.1', view: 'settings_notify',
    });
    expect((bodyFor('push_subscribe', form(SUB), undefined, undefined, 'settings_notify', { userAgent: 'x'.repeat(400) }).user_agent as string).length).toBe(300);
    expect(bodyFor('push_subscribe', form(SUB), undefined, undefined, 'settings_notify')).not.toHaveProperty('user_agent');
    const n = net();
    const r = await runSave(n.door, SESSION, 'push_subscribe', form(SUB), undefined, 'settings_notify', { userAgent: 'Mozilla/5.0 (X11; Linux x86_64) Chrome/140' });
    expect(r.ok).toBe(true);
    expect(n.seen).toEqual([{ path: '/api/v1/push/subscribe', body: { endpoint: SUB.endpoint, keys: { p256dh: SUB.p256dh, auth: SUB.auth }, user_agent: 'Mozilla/5.0 (X11; Linux x86_64) Chrome/140', view: 'settings_notify' }, timeout: true }]);
    for (const bad of [
      { ...SUB, endpoint: 'http://fcm.googleapis.com/fcm/send/x' },
      { ...SUB, endpoint: 'https://' + 'a'.repeat(1000) },
      { ...SUB, endpoint: 'not an address' },
      { ...SUB, p256dh: 'B'.repeat(201) },
      { ...SUB, p256dh: 'has spaces in it' },
      { ...SUB, auth: 'C'.repeat(101) },
      { endpoint: SUB.endpoint, p256dh: SUB.p256dh },
    ]) {
      const m = net();
      const out = await runSave(m.door, SESSION, 'push_subscribe', form(bad), undefined, 'settings_notify');
      expect(out).toMatchObject({ ok: false, status: 400, signedOut: false });
      expect(m.seen, JSON.stringify(bad)).toEqual([]);
    }
  });
});

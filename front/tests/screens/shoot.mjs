// Page tests and screenshots of the running front end, at phone (390 px) and PC (1280 px) width, dark and light.
// Runs in the pinned Playwright container (tools/front-screens), against a front end that talks to the stand-in door
// (tests/standin/door.mjs: password "test", code "123456"; GET /day answers with tests/samples/day.json, a real door answer).
// Step C: the taps save in place: each save changes the page without a reload, a new row gets a blue edge, the answer bar shows
// the head and Undo, a read-back is confirmed, and a tap that met a gone session is sent again after the sign-in.
// Step D: the logging box: a line is "being read" (a blue row), then saved with a new row and Undo, asks a question (Correct it
// puts the words back in the box), is read back first, answers a look-up, is held under Needs you, or is "Saved privately."
// and nothing else; a line that met a gone session is sent again after the sign-in, one kept too long comes back into the box.
// Step E: the Food day: from the Energy card's link, the four tiles and the rows by meal against the food sample, a row opened
// and changed (amount, unit, time), a note added and removed, an odd amount read back and confirmed, a row deleted and brought
// back by Undo, an unknown food refused, the day switch, a food row on Today opening its row, and "+ Add food" leading to the box.
// Step F: plain messages when the core is down or the door is off (the stand-in plays both): a tap says "Not saved." with why
// (and links to app. when the door is off), Today, the Food day and the sign-in page say it instead of the page, "Try again"
// brings the page back with the session kept; after a sign-in the page you were on comes back (`next`); and every page at a
// tablet width (800 px) too, with no sideways scroll and tap targets of 44 px on phones and tablets.
// Deploy 87: the Usual meals page (/food/usual) from the Food day's "Usual meals": the cards against the usual sample, a meal
// opened (beside the list on the PC, its own screen on phones and tablets), an amount changed with +, a food swapped and one
// added through the search, renamed, saved in place with Undo (and undone), a name another meal has refused with the edits kept,
// a meal deleted and brought back, a new usual drink; on the Food day "Save as usual meal" on each meal but the drinks (a used
// name refused, then saved); and Today's "Edit" by the usual chips.
// Deploy 90: the scan sheet from the logging box's Scan (no camera in the test browser: the digits are typed, the photos are tiny
// images made here): a known food logged with its amount and time, then undone; an unknown code looked up on Open Food Facts
// (a miss, then a hit) and added from the form; label photos added (up to three), removed, a failed read keeping them, two read
// together and added with an amount; "Look it up" on a food question read back and answered Yes; the microphone absent without
// speech support, and with a stand-in one its words in the box. The sheet covers the whole phone and nothing covers it.
// Deploy 92: the Health page (/health) from Today's Health card: every chart drawn with the sample's number of points, the stat
// lines, the sleep times, the range switch (7 days), the entries (rows that open on phones and tablets, the table on the PC),
// a day changed and saved in place, Undo, an odd weight read back and confirmed, a value cleared with its yes, "Show all"; the
// body card: the form saved, a jump read back and confirmed, Now opening an older session, a measure's chart by its chip; and
// on Today "Body measurements due" with Measure (the form open) and "Not today".
// Deploy 94: the Habits page (/habits) from Today's Habits card and from the Health page: today's ticks with "n of N done" (a tick
// and its Undo), the strip of 30 squares against the sample's states (squares that are not buttons), a habit's calendar in weeks
// (Monday first, cells of 44 px, "1/2" for a twice-a-day habit, a day ticked and unticked with Undo, a tap blocked while its save
// is on the way, a read-only one with its line), the filter with counts, an edit kept after a refusal, a new habit, a delete with
// its question, Track, Retire and Bring back, and the settings line; one column on phones and tablets, two from 1100 px.
// Every check throws on a failure, so the script ends with an error.
// Usage: node tests/screens/shoot.mjs <base url> <out dir> <stand-in url>
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync } from 'node:fs';
import { chromium } from 'playwright-core';

const [base = 'http://localhost:3000', out = 'tests/screens/out', standin = 'http://localhost:8099'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const day = JSON.parse(readFileSync(new URL('../samples/day.json', import.meta.url), 'utf8')).day;
const FOOD = JSON.parse(readFileSync(new URL('../samples/food.json', import.meta.url), 'utf8'));
const foodDay = FOOD.food_day.food_day;
const foodBefore = FOOD.before.food_day;
const USUAL = JSON.parse(readFileSync(new URL('../samples/usual.json', import.meta.url), 'utf8')).usual.usual;
const SCAN = JSON.parse(readFileSync(new URL('../samples/scan.json', import.meta.url), 'utf8'));
const HEALTH = JSON.parse(readFileSync(new URL('../samples/health.json', import.meta.url), 'utf8'));
const HABITS = JSON.parse(readFileSync(new URL('../samples/habits.json', import.meta.url), 'utf8'));

// What the page must show, worked out here from the sample on its own (not with the page's code).
const even = (x) => {
  const low = Math.floor(x);
  const rest = x - low;
  return rest > 0.5 ? low + 1 : rest < 0.5 ? low : low % 2 === 0 ? low : low + 1;
};
const grouped = (x) => even(x).toLocaleString('en-US');
const left = day.energy.targets.kcal - day.energy.totals.kcal;
const want = {
  kcalLeft: grouped(Math.abs(left)),
  // the stand-in's day has the health sample's "Body measurements due" (deploy 92), which counts as one
  needs: String(day.needs.questions.length + day.needs.not_read.length + day.needs.review.length + (day.needs.checkin ? 1 : 0) + (HEALTH.day_body_due ? 1 : 0)),
  water: `${grouped(day.water.ml)} / ${grouped(day.water.target_ml)} ml`,
  mealLabels: day.energy.meals.map((m) => m.label.toUpperCase()),
  foodRefs: day.rows.filter((r) => r.kind === 'food').map((r) => r.ref),
  hiddenRefs: day.rows.filter((r) => r.kind !== 'food' && ['bed', 'wake', 'weight', 'blood_sugar', 'bp'].includes(r.type)).map((r) => r.ref),
  health: day.health.map((h) => h.row),
  gratitude: `${day.gratitude.count}/${day.gratitude.goal}`,
  kcalEaten: grouped(day.energy.totals.kcal),
  shares: (() => {
    const t = day.energy.totals;
    const k = { Protein: t.protein * 4, Fat: t.fat * 9, Carbs: t.carbs * 4 };
    const whole = k.Protein + k.Fat + k.Carbs;
    return ['Protein', 'Fat', 'Carbs'].map((m) => `${even((k[m] / whole) * 100)}%`);
  })(),
};
const macros = (x) => `P ${grouped(x.protein)} · F ${grouped(x.fat)} · C ${grouped(x.carbs)} g`;

async function checkToday(page, name) {
  assert.equal((await page.locator('[data-kcal-left]').textContent())?.trim(), want.kcalLeft, 'kcal left');
  assert.equal((await page.locator('[data-count]').textContent())?.trim(), want.needs, 'Needs you count');
  assert.equal((await page.locator('[data-water]').textContent())?.replace(/\s+/g, ' ').trim(), want.water, 'water');
  const labels = (await page.locator('[data-meal-label] span:first-child').allTextContents()).map((x) => x.trim().toUpperCase());
  for (const l of want.mealLabels) assert.ok(labels.includes(l), `meal label ${l}`);
  for (const ref of want.foodRefs) assert.equal(await page.locator(`[data-row="${ref}"]`).count(), 1, `food row ${ref}`);
  for (const ref of want.hiddenRefs) assert.equal(await page.locator(`[data-row="${ref}"]`).count(), 0, `Health entry ${ref} not in the timeline`);
  assert.deepEqual(await page.locator('[data-health]').evaluateAll((els) => els.map((e) => e.getAttribute('data-health'))), want.health, 'Health card rows');
  const grat = page.locator('[data-card="gratitude"]');
  assert.match((await grat.getAttribute('href')) ?? '', /\/web\/gratitude$/, 'Gratitude opens app.');
  assert.ok((await grat.textContent())?.includes(want.gratitude), 'Gratitude count');
  assert.match((await page.locator('[data-header]').textContent()) ?? '', /^\w{3} \d\d\.\d\d\. · hour \d+ of your day · woke \d\d:\d\d$/, 'header line');
  const sideways = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(sideways <= 0, `no sideways scroll (${sideways} px too wide)`);
  const needs = await page.locator('[data-card="needs"]').boundingBox();
  const timeline = await page.locator('[data-card="timeline"]').boundingBox();
  const chips = await page.locator('[data-card="chips"]').boundingBox();
  assert.ok(needs && timeline && chips);
  if (name === 'pc') assert.ok(timeline.x < needs.x && Math.abs(chips.y - needs.y) < 2, 'PC: the day left, Needs you right, both at the top');
  // all the macros on the Energy card; on the PC the day starts at the rail and takes the room the right column leaves
  assert.deepEqual(await page.locator('[data-macro]').evaluateAll((els) => els.map((e) => e.getAttribute('data-macro'))), ['Eaten', 'Protein', 'Fat', 'Carbs'], 'macro lines');
  // the pie of the day's kcal from protein, carbs and fat, and each macro's share on its bar (deploy 88)
  assert.deepEqual(await page.locator('[data-pie] [data-slice]').evaluateAll((els) => els.map((e) => e.getAttribute('data-slice'))), ['protein', 'carbs', 'fat'], 'pie slices');
  assert.equal((await page.locator('[data-pie] b').textContent())?.trim(), want.kcalEaten, 'the pie: the day\'s kcal in the middle');
  assert.deepEqual(await page.locator('[data-share]').allTextContents().then((x) => x.map((t) => t.replace(/[·\s]/g, ''))), want.shares, 'the shares of the macros');
  const pie = await page.locator('[data-pie]').boundingBox();
  const energy = await page.locator('[data-card="energy"]').boundingBox();
  assert.ok(pie.x + pie.width <= energy.x + energy.width && pie.x > energy.x + energy.width / 2, 'the pie sits on the right of the Energy card');
  // each food row's macros and each meal's under its label
  for (const r of day.rows.filter((x) => x.kind === 'food'))
    assert.equal((await page.locator(`[data-row="${r.ref}"] [data-row-macros]`).textContent())?.trim(), macros(r.nutrients), `macros of ${r.ref}`);
  const mealMacros = await page.locator('[data-meal-macros]').allTextContents();
  for (const m of day.energy.meals) assert.ok(mealMacros.map((x) => x.trim()).includes(macros(m.nutrients)), `macros of ${m.label}`);
  // two habits per row
  const habits = await page.locator('[data-habit]').evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => ({ x: r.x, y: r.y })));
  if (habits.length >= 2) assert.ok(Math.abs(habits[0].y - habits[1].y) < 2 && habits[1].x > habits[0].x + 40, 'two habits per row');
  if (name === 'pc') {
    assert.ok(timeline.x < 260 && timeline.width > 600, `PC: the day is wide and starts at the rail (x ${timeline.x}, ${timeline.width} px)`);
    assert.ok(Math.abs(needs.width - 340) < 2, 'PC: the right column is 340 px');
  }
  else assert.ok(needs.y < timeline.y && Math.abs(needs.x - timeline.x) < 2, 'phone: one column, Needs you first');
}

const text = async (loc) => (await loc.textContent())?.replace(/\s+/g, ' ').trim();
const standinPost = async (path) => assert.equal((await fetch(`${standin}${path}`, { method: 'POST' })).status, 200, path);

async function signIn(page) {
  await page.fill('#password', 'test');
  await page.fill('#code', '123 456');
  await page.click('button[type=submit]');
  await page.getByRole('heading', { name: 'Today', exact: true }).waitFor();
}

/** Step C: every kind of tap, each checked on the page without a reload (a mark on window would be gone after one). */
async function checkSaves(page, name, theme) {
  await page.evaluate(() => (window.__noReload = true));
  const bar = page.locator('[data-bar]');
  const count = page.locator('[data-count]');

  // water: the glass goes on the bar, the drink is a new row with a blue edge, the answer bar has the head and Undo
  await page.getByRole('button', { name: `+ ${day.water.glass_ml} ml` }).click();
  await page.locator('[data-water]').getByText(`${grouped(day.water.ml + day.water.glass_ml)} / ${grouped(day.water.target_ml)} ml`).waitFor();
  assert.equal(await page.locator('[data-fresh]').count(), 1, 'water: one new row, with a blue edge');
  assert.equal(await text(bar.locator('[data-bar-head]')), 'Saved.', 'water: the head');
  await bar.getByRole('button', { name: 'Undo' }).waitFor();

  // an Again chip: a new row with a blue edge (the water row loses its edge)
  const chip = day.chips.again[0];
  await page.locator('[data-card="chips"] button', { hasText: chip.name }).first().click();
  await page.locator('[data-fresh]', { hasText: chip.name }).waitFor();
  assert.equal(await page.locator('[data-fresh]').count(), 1, 'Again: only the newest row has the blue edge');
  assert.notEqual(await text(page.locator('[data-kcal-left]')), want.kcalLeft, 'Again: kcal left moved');
  await page.screenshot({ path: `${out}/today-saved-${name}-${theme}.png`, fullPage: name === 'phone' });

  // a habit: the tick flips
  const open = day.habits.find((h) => !h.complete);
  await page.locator(`[data-habit="${open.name}"]`).click();
  await page.locator(`[data-habit="${open.name}"][aria-pressed="true"]`).waitFor();

  // what needs you: the check-in, all items to review, a question's button, a message not read yet deleted
  const needs = Number(want.needs);
  await page.getByRole('button', { name: `Mood 4, ${day.needs.checkin.scale.mood[3]}` }).click();
  await page.getByText(`Mood 4 · ${day.needs.checkin.scale.mood[3]}`).waitFor();
  await page.getByRole('button', { name: `All ${day.needs.review.length} look right` }).click();
  await page.getByText('To review').waitFor({ state: 'detached' });
  const yesNo = day.needs.questions.find((q) => q.answers.length > 1);
  await page.getByText(yesNo.text).locator('..').getByRole('button', { name: yesNo.answers[0].label }).click();
  await page.getByText(yesNo.text).waitFor({ state: 'detached' });
  await page.locator('[data-card="needs"]').getByRole('button', { name: 'Delete' }).click();
  await page.getByText('Not read yet').waitFor({ state: 'detached' });
  assert.equal(await text(count), String(needs - day.needs.review.length - 1 - day.needs.not_read.length), 'Needs you count after the taps');

  // the Health card: an odd weight is read back first; "Yes, save it" saves it; Undo puts it back
  const weight = day.health.find((h) => h.row === 'weight');
  await page.locator('[data-health="weight"]').click();
  await page.locator('[data-health-form="weight"] input[name=v1]').fill('400');
  await page.locator('[data-health-form="weight"]').getByRole('button', { name: 'Change' }).click();
  await page.locator('[data-bar="warning"]').getByRole('button', { name: 'Yes, save it' }).waitFor();
  await page.locator('[data-health="weight"]').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${out}/today-confirm-${name}-${theme}.png` });
  await checkWidth(page, 'today, a read-back to confirm');
  await page.locator('[data-bar="warning"]').getByRole('button', { name: 'Yes, save it' }).click();
  await page.locator('[data-health="weight"]').getByText('400 kg').waitFor();
  if (name === 'phone') await page.screenshot({ path: `${out}/today-health-${name}-${theme}.png` });
  await bar.getByRole('button', { name: 'Undo' }).click();
  await page.locator('[data-health="weight"]').getByText(`${weight.v1} kg`).waitFor();
  assert.equal(await text(bar.locator('[data-bar-head]')), 'Undone.', 'Undo: the head');

  // the Undo bar comes back after a reload (GET /day's undo) once there is one again
  await page.getByRole('button', { name: `+ ${day.water.glass_ml} ml` }).click();
  await bar.getByRole('button', { name: 'Undo' }).waitFor();
  assert.ok(await page.evaluate(() => window.__noReload === true), 'no reload during the taps');
  if (name !== 'pc') {
    // step F: scrolled to the end, the logging box and its answer bar cover nothing (the page leaves room for both)
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const last = await page.getByText('Trends, Library and More are').boundingBox();
    const dock = await page.locator('[data-logbox]').boundingBox();
    assert.ok(last.y + last.height <= dock.y + 1, `the logging box covers nothing at the end (${last.y + last.height} > ${dock.y})`);
  }
  await page.reload();
  await page.locator('[data-bar]').getByRole('button', { name: 'Undo' }).waitFor();

  // signed out mid-save: the tap is kept, the sign-in page opens, and after the sign-in the tap is sent again, once
  const before = await text(page.locator('[data-water]'));
  await standinPost('/standin/drop-sessions');
  await page.getByRole('button', { name: `+ ${day.water.glass_ml} ml` }).click();
  await page.getByRole('button', { name: 'Sign in' }).waitFor();
  await signIn(page);
  const ml = Number(before.replace(/,/g, '').split(' ')[0]) + day.water.glass_ml;
  await page.locator('[data-water]').getByText(`${grouped(ml)} / ${grouped(day.water.target_ml)} ml`).waitFor();
  await page.reload();
  await page.locator('[data-water]').getByText(`${grouped(ml)} / ${grouped(day.water.target_ml)} ml`).waitFor();
}

/** Step D: the logging box, every outcome of a typed line. */
async function checkLogBox(page, name, theme) {
  await page.evaluate(() => (window.__noReload = true));
  const box = page.locator('#log-text');
  const bar = page.locator('[data-bar]');
  const head = bar.locator('[data-bar-head]');
  const needs = page.locator('[data-card="needs"]');
  const send = async (line) => {
    await box.fill(line);
    await box.press('Enter');
  };
  const read = async () => page.locator('[data-reading]').first().waitFor({ state: 'detached' });

  // where it sits: above the tab bar on phones, at the top on the PC
  const form = await page.locator('[data-logbox] form').boundingBox();
  if (name !== 'pc') {
    const nav = await page.locator('nav[aria-label="Places"]').boundingBox();
    assert.ok(Math.abs(form.y + form.height - nav.y) < 2, 'phone: the box sits right above the tab bar');
  } else {
    const card = await page.locator('[data-card="chips"]').boundingBox();
    assert.ok(form.y + form.height < card.y, 'PC: the box is above the cards');
  }
  assert.equal(await page.getByRole('link', { name: 'Barcode and label: full app' }).count(), 0, 'no link to the full app any more (deploy 90)');
  const rest = await box.boundingBox();
  assert.ok(rest.height >= 43 && rest.height <= 46, `the box is one line tall at rest (${rest.height} px)`);
  // it grows by itself when the words do not fit one line, and is one line again when sent or emptied
  await box.fill('one\ntwo\nthree');
  const grown = await box.boundingBox();
  assert.ok(grown.height > rest.height + 30, `the box grows with its lines (${grown.height} px)`);
  await box.fill('');
  assert.ok(Math.abs((await box.boundingBox()).height - rest.height) < 2, 'the box is one line again when emptied');
  // Shift+Enter is a new line, not a send
  await box.fill('40 g radishes');
  await box.press('Shift+Enter');
  assert.equal(await box.inputValue(), '40 g radishes\n', 'Shift+Enter: a new line');
  assert.equal(await page.locator('[data-reading]').count(), 0, 'Shift+Enter sends nothing');

  // a food line: "being read" (a blue row, the box empty again), then saved: a new row with a blue edge, the receipt, Undo
  await send('40 g radishes');
  await page.locator('[data-reading]', { hasText: '40 g radishes' }).waitFor();
  assert.equal(await box.inputValue(), '', 'the box is empty while the line is read');
  await page.screenshot({ path: `${out}/today-reading-${name}-${theme}.png` });
  await read();
  await page.locator('[data-fresh]', { hasText: 'Radishes' }).waitFor();
  assert.equal(await text(head), 'Saved.', 'line: the head');
  assert.match(await text(bar), /\+ f\d+ Radishes 40 g/, 'line: the receipt');
  await page.screenshot({ path: `${out}/today-logged-${name}-${theme}.png` });
  await bar.getByRole('button', { name: 'Undo' }).click();
  await page.locator('[data-row]', { hasText: 'Radishes' }).waitFor({ state: 'detached' });
  assert.equal(await text(head), 'Undone.', 'line: undone');

  // the same words again: a question under Needs you; Correct it puts the words in the box, changed and sent again they save
  await send('40 g radishes');
  await read();
  assert.equal(await text(head), 'Nothing saved yet: please confirm.', 'question: the head');
  assert.ok((await text(bar)).includes('The question is under Needs you.'), 'question: where it is');
  const q = needs.getByText('Log it again?').locator('..');
  await q.getByRole('button', { name: 'Correct it' }).click();
  assert.equal(await box.inputValue(), '40 g radishes', 'Correct it: the words in the box');
  assert.ok(await box.evaluate((el) => el === document.activeElement), 'Correct it: the box has the cursor');
  await page.screenshot({ path: `${out}/today-correct-${name}-${theme}.png` });
  await send('60 g radishes');
  await read();
  await page.locator('[data-fresh]', { hasText: 'Radishes' }).getByText('60 g').waitFor();
  await q.getByRole('button', { name: 'No' }).click();
  await needs.getByText('Log it again?').waitFor({ state: 'detached' });

  // a change: read back first, as a question with its read-back; Yes answers it
  await send('the radishes were 50 g');
  await read();
  await needs.getByText('Make this change?').waitFor();
  assert.ok((await text(needs)).includes('OK changed: radishes were 50 g'), 'change: the read-back on its card');
  await needs.getByText('Make this change?').locator('..').getByRole('button', { name: 'Yes' }).click();
  await needs.getByText('Make this change?').waitFor({ state: 'detached' });

  // a look-up: its answer in the bar
  await send('what did I eat today');
  await read();
  assert.equal(await text(head), 'Found.', 'look-up: the head');
  assert.ok((await text(bar)).includes('Radishes 60 g'), 'look-up: the answer');

  // a private line: never its words on the page, "Saved privately." and nothing else (no lines, no Undo)
  const words = 'an invented note';
  await send(`private: ${words}`);
  await page.locator('[data-reading]', { hasText: 'Private line' }).waitFor();
  assert.ok(!(await page.locator('body').innerText()).includes(words), 'private: the words are not on the page while read');
  await read();
  assert.equal(await text(head), 'Saved privately.', 'private: the head');
  assert.equal(await bar.locator('p').count(), 0, 'private: nothing else');
  assert.equal(await bar.getByRole('button', { name: 'Undo' }).count(), 0, 'private: no Undo');
  assert.ok(!(await page.locator('body').innerText()).includes(words), 'private: the words are not on the page');

  // the AI does not answer: held under Needs you, with Try again
  await standinPost('/standin/ai-down');
  await send('200 g invented soup');
  await read();
  assert.equal(await text(head), 'Not read yet, but kept.', 'held: the head');
  await needs.getByText('200 g invented soup').waitFor();
  await page.screenshot({ path: `${out}/today-held-${name}-${theme}.png` });
  await standinPost('/standin/ai-up');
  await needs.getByText('200 g invented soup').locator('..').locator('..').getByRole('button', { name: 'Try again' }).click();
  await needs.getByText('200 g invented soup').waitFor({ state: 'detached' });
  assert.ok(await page.evaluate(() => window.__noReload === true), 'no reload while logging');

  // signed out mid-save: the line and its key are kept, and sent again after the sign-in (once)
  await standinPost('/standin/drop-sessions');
  await send('30 g walnuts');
  await page.getByRole('button', { name: 'Sign in' }).waitFor();
  await signIn(page);
  await page.locator('[data-row]', { hasText: 'Walnuts' }).waitFor();
  await page.reload();
  await page.locator('[data-row]', { hasText: 'Walnuts' }).first().waitFor();
  assert.equal(await page.locator('[data-row]', { hasText: 'Walnuts' }).count(), 1, 'the line was saved once');

  // a line kept too long (over 10 minutes) is not sent again: its words come back into the box
  await page.evaluate(() =>
    sessionStorage.setItem('logger-resend', JSON.stringify({ action: 'log', fields: { text: '20 g old words', key: 'an-old-line-key-01' }, at: 0 })),
  );
  await page.reload();
  await page.getByText('Your words are back in the box.').waitFor();
  assert.equal(await box.inputValue(), '20 g old words', 'an old line: its words in the box');
  assert.equal(await page.locator('[data-row]', { hasText: 'Old words' }).count(), 0, 'an old line: not sent');
  await box.fill('');
}

/** Step E: the Food day, on a fresh stand-in day (the sample's). */
async function checkFood(page, name, theme) {
  await standinPost('/standin/reset');
  await page.goto(`${base}/`);
  await page.getByRole('link', { name: 'Food day' }).click();
  await page.getByRole('heading', { name: 'Food', exact: true }).waitFor();
  await page.evaluate(() => (window.__noReload = true));
  const bar = page.locator('[data-bar]');
  const head = bar.locator('[data-bar-head]');
  const row = (ref) => page.locator(`[data-row="${ref}"]`);
  const editor = (ref) => page.locator(`[data-food-editor="${ref}"]`);
  const tile = async (key) => text(page.locator(`[data-tile="${key}"] [data-tile-value]`));
  const kcal = async (ref) => text(row(ref).locator('[data-kcal]'));
  /** Waits until the row's kcal reads so (the save's answer is in). */
  const kcalIs = async (ref, want) => {
    for (let i = 0; i < 100 && (await kcal(ref)) !== want; i++) await page.waitForTimeout(100);
    assert.equal(await kcal(ref), want, `${ref}: kcal`);
  };
  const num = (s) => Number(s.replace(/,/g, ''));
  const open = async (ref) => {
    await row(ref).locator('button[aria-expanded]').first().click();
    await editor(ref).waitFor();
  };

  // what it shows: the tiles against the sample's totals, the meals newest first and the drinks last, every row, a note
  for (const k of ['kcal', 'protein', 'fat', 'carbs']) assert.equal(await tile(k), grouped(foodDay.totals[k]), `tile ${k}`);
  const labels = (await page.locator('[data-meal-label] span:first-child').allTextContents()).map((x) => x.trim().toUpperCase());
  assert.deepEqual(labels, ['MEAL 2', 'MEAL 1', 'DRINKS'], 'meal labels, newest first');
  for (const r of foodDay.rows) assert.equal(await row(r.ref).count(), 1, `food row ${r.ref}`);
  const noted = foodDay.rows.find((r) => r.note);
  assert.equal(await text(row(noted.ref).locator('[data-note]')), `Note: ${noted.note}`, 'a row shows its note');
  assert.match(await text(page.locator('[data-day]')), / · today$/, 'the day is today');
  assert.equal(await page.locator('[data-day-after]').count(), 0, 'no day after today');
  const sideways = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(sideways <= 0, `no sideways scroll (${sideways} px too wide)`);
  const tiles = await page.locator('[data-tile]').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().y));
  assert.equal(new Set(tiles.map(Math.round)).size, name === 'pc' ? 1 : 2, 'tiles: one row on the PC, two by two on the phone');
  if (name === 'pc') {
    const rows = await page.locator('[data-card="food-rows"]').boundingBox();
    assert.ok(rows.x < 260 && rows.width > 900, `PC: the rows start at the rail and use the width (x ${rows.x}, ${rows.width} px)`);
  }
  await page.screenshot({ path: `${out}/food-${name}-${theme}.png`, fullPage: true });
  await checkWidth(page, 'food');

  // a row opened: its amount, the food's other unit (from GET /food/entry), what it becomes; − and + move it
  const bread = FOOD.entry.entry;
  const amount = editor(bread.ref).locator('input[name=amount]');
  await open(bread.ref);
  assert.equal(await amount.inputValue(), String(bread.amount), 'the amount to change');
  await editor(bread.ref).locator('select[name=unit] option[value=slice]').waitFor({ state: 'attached' });
  const before = foodDay.rows.find((r) => r.ref === bread.ref);
  const becomes = editor(bread.ref).locator('[data-becomes]');
  assert.equal(await text(becomes), `${grouped(before.nutrients.kcal)} kcal · ${grouped(before.nutrients.protein)} g protein`, 'what it becomes');
  await editor(bread.ref).getByRole('button', { name: 'More' }).click();
  assert.equal(await amount.inputValue(), String(bread.amount + 5), '+ adds 5 g');
  await editor(bread.ref).scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${out}/food-edit-${name}-${theme}.png` });
  await checkWidth(page, 'food, a row open');

  // changed: amount and time; saved in place, the row with a blue edge, the tiles moved, Undo in the bar, the row closed
  await amount.fill('120');
  await editor(bread.ref).locator('input[name=time]').fill('13:20');
  await editor(bread.ref).getByRole('button', { name: 'Save', exact: true }).click();
  await page.locator(`[data-row="${bread.ref}"][data-fresh]`).waitFor();
  const per = before.nutrients.kcal / before.amount;
  await kcalIs(bread.ref, `${grouped(per * 120)} kcal`);
  assert.equal(await text(head), `Changed ${bread.food}.`, 'change: the head');
  await bar.getByRole('button', { name: 'Undo' }).waitFor();
  assert.equal(await editor(bread.ref).count(), 0, 'the row closed after the change');
  assert.ok(Math.abs(num(await tile('kcal')) - (foodDay.totals.kcal + per * 40)) <= 1, 'the tiles moved');
  assert.match(await text(row(bread.ref)), /13:20/, 'the new time');

  // in another unit: 4 slices of 40 g
  await open(bread.ref);
  await editor(bread.ref).locator('select[name=unit]').selectOption('slice');
  assert.equal(await amount.inputValue(), '3', '120 g are 3 slices');
  await amount.fill('4');
  await editor(bread.ref).getByRole('button', { name: 'Save', exact: true }).click();
  await kcalIs(bread.ref, `${grouped(per * 160)} kcal`);

  // a note, then removed
  await open(bread.ref);
  await editor(bread.ref).locator('input[name=note]').fill('with butter');
  await editor(bread.ref).getByRole('button', { name: 'Save note' }).click();
  await row(bread.ref).locator('[data-note]').getByText('Note: with butter').waitFor();
  assert.equal(await text(head), 'Note saved.', 'note: the head');
  await open(bread.ref);
  await editor(bread.ref).getByRole('button', { name: 'Remove' }).click();
  await row(bread.ref).locator('[data-note]').waitFor({ state: 'detached' });
  assert.equal(await text(head), 'Note removed.', 'note removed: the head');

  // an odd amount is read back first; "Yes, change" makes it
  await open(bread.ref);
  await amount.fill('2500');
  await editor(bread.ref).getByRole('button', { name: 'Save', exact: true }).click();
  const confirm = page.locator('[data-bar="warning"]').getByRole('button', { name: 'Yes, change' });
  await confirm.waitFor();
  await page.screenshot({ path: `${out}/food-confirm-${name}-${theme}.png` });
  await confirm.click();
  await kcalIs(bread.ref, `${grouped(per * 2500)} kcal`);

  // an unknown food is refused, and the row stays open
  const bar5 = foodDay.rows.find((r) => r.food === 'Fruit bar');
  await open(bar5.ref);
  await editor(bar5.ref).locator('input[id^=food-]').fill('Nothing like it');
  await editor(bar5.ref).getByText('Another food from your catalogue, by its exact name.').waitFor();
  await editor(bar5.ref).getByRole('button', { name: 'Save', exact: true }).click();
  await page.locator('[data-bar="warning"]').getByText('No food called', { exact: false }).waitFor();
  assert.equal(await editor(bar5.ref).count(), 1, 'refused: the row stays open');
  await editor(bar5.ref).getByRole('button', { name: 'Cancel' }).click();

  // deleted, then back with Undo
  await open(noted.ref);
  await editor(noted.ref).getByRole('button', { name: 'Delete' }).click();
  await row(noted.ref).waitFor({ state: 'detached' });
  assert.equal(await text(head), `Deleted ${noted.food}.`, 'delete: the head');
  await page.screenshot({ path: `${out}/food-deleted-${name}-${theme}.png` });
  if (name !== 'pc') {
    // step F: scrolled to the end, the bar covers nothing (the page leaves room for it)
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const last = await page.getByRole('link', { name: 'Usual meals', exact: true }).boundingBox();
    const shown = await bar.boundingBox();
    assert.ok(last.y + last.height <= shown.y + 1, `the answer bar covers nothing at the end (${last.y + last.height} > ${shown.y})`);
  }
  await bar.getByRole('button', { name: 'Undo' }).click();
  await page.locator(`[data-row="${noted.ref}"][data-fresh]`).waitFor();
  assert.equal(await text(head), 'Undone.', 'Undo: the head');
  assert.ok(await page.evaluate(() => window.__noReload === true), 'no reload during the saves');

  // the day switch: the day before (the sample's), then back to today
  await page.getByRole('link', { name: 'The day before' }).click();
  await page.locator('[data-day]').filter({ hasNotText: 'today' }).waitFor();
  for (const r of foodBefore.rows) await row(r.ref).waitFor();
  assert.equal(await tile('kcal'), grouped(foodBefore.totals.kcal), 'the day before: its total');
  if (name === 'phone') await page.screenshot({ path: `${out}/food-before-${name}-${theme}.png`, fullPage: true });
  await page.getByRole('link', { name: 'The day after' }).click();
  await page.locator('[data-day]').getByText('today', { exact: false }).waitFor();

  // a food row on Today opens its row on the Food day
  await page.getByRole('link', { name: '‹ Today' }).click();
  await page.getByRole('heading', { name: 'Today', exact: true }).waitFor();
  const apple = foodDay.rows.find((r) => r.food.startsWith('Apple'));
  await page.locator(`a[data-row="${apple.ref}"]`).click();
  await editor(apple.ref).waitFor();
  assert.match(page.url(), new RegExp(`/food\\?open=${apple.ref}$`), 'the row opened from Today');

  // "+ Add food": back to Today, the cursor in the logging box
  await page.getByRole('link', { name: '+ Add food' }).click();
  await page.getByRole('heading', { name: 'Today', exact: true }).waitFor();
  await page.waitForFunction(() => document.activeElement?.id === 'log-text');
}

/** Deploy 87: the Usual meals page, "Save as usual meal" on the Food day, and Today's "Edit" link. */
async function checkUsual(page, name, theme) {
  await standinPost('/standin/reset');
  await page.goto(`${base}/food`);
  await page.getByRole('link', { name: 'Usual meals', exact: true }).click();
  await page.getByRole('heading', { name: 'Usual meals', exact: true }).waitFor();
  await page.evaluate(() => (window.__noReload = true));
  const pc = name === 'pc';
  const bar = page.locator('[data-bar]');
  const head = bar.locator('[data-bar-head]');
  const card = (id) => page.locator(`[data-usual="${id}"]`);
  const ed = page.locator('[data-usual-editor]');
  const row = (id) => (id === 'added' ? ed.locator('[data-usual-row^="n"]').last() : ed.locator(`[data-usual-row="${id}"]`));
  const shot = (what, fullPage = false) => page.screenshot({ path: `${out}/${what}-${name}-${theme}.png`, fullPage });
  const breakfast = USUAL.find((u) => u.name === 'Usual breakfast');
  const cocoa = USUAL.find((u) => u.name === 'Cocoa');
  const [oats, skyr] = breakfast.items;
  const items = (u) => u.items.map((i) => `${i.food} ${grouped(i.amount)} ${i.unit}`).join(' · ');
  const total = (kcal, protein) => `${grouped(kcal)} kcal · ${grouped(protein)} g protein`;
  const openCard = async (u) => {
    await card(u.meal_id).click();
    await page.locator(`[data-usual-editor="${u.meal_id}"]`).waitFor();
  };
  const pick = async (words, id) => {
    await ed.locator('#usual-q').fill(words);
    await ed.locator(`[data-hit="${id}"]`).click();
    await ed.locator('[data-usual-search]').waitFor({ state: 'detached' });
  };

  // the list: every sample meal with its foods, kcal and protein (worked out here from the sample), by name
  for (const u of USUAL) {
    assert.equal(await text(card(u.meal_id).locator('[data-usual-name]')), u.name, `${u.name}: name`);
    assert.equal(await text(card(u.meal_id).locator('[data-usual-items]')), items(u), `${u.name}: foods`);
    assert.equal(await text(card(u.meal_id).locator('[data-usual-kcal]')), `${grouped(u.nutrients.kcal)} kcal`, `${u.name}: kcal`);
    assert.equal(await text(card(u.meal_id).locator('[data-usual-protein]')), `${grouped(u.nutrients.protein)} g P`, `${u.name}: protein`);
  }
  const names = await page.locator('[data-usual-name]').allTextContents();
  assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' })), 'cards by name');
  assert.equal(await page.locator('[data-count]').count(), 1, 'the count line');
  // the PC: the first meal open beside the list; phones and tablets: the list alone
  assert.equal(await ed.count(), pc ? 1 : 0, pc ? 'PC: a meal open beside the list' : 'phone: the list alone');
  await shot('usual', true);
  await checkWidth(page, 'usual meals');

  // a meal opened: its total as saved; + on oats, Skyr swapped, rye bread added, renamed; each change shows
  await openCard(breakfast);
  if (pc) {
    const list = await page.locator('[data-card="usual-list"]').boundingBox();
    const box = await ed.boundingBox();
    assert.ok(box.x > list.x + list.width, 'PC: the open meal right of the list');
  } else assert.ok(!(await page.locator('[data-card="usual-list"]').isVisible()), 'phone: the open meal is its own screen');
  assert.equal(await text(ed.locator('[data-usual-total]')), total(breakfast.nutrients.kcal, breakfast.nutrients.protein), 'the total as saved');
  await row(`i${oats.item_id}`).getByRole('button', { name: `More ${oats.food}` }).click();
  assert.equal(await row(`i${oats.item_id}`).locator('[data-row-amount]').inputValue(), String(oats.amount + 5), '+ adds 5 g');
  assert.equal(await text(row(`i${oats.item_id}`).locator('[data-status]')), `Changed · was ${oats.amount} g`, 'the changed row says so');
  await row(`i${skyr.item_id}`).getByRole('button', { name: `Swap ${skyr.food}` }).click();
  await ed.getByText(`Swap ${skyr.food} for`).waitFor();
  await page.waitForFunction(() => document.activeElement?.id === 'usual-q');
  await ed.locator('#usual-q').fill('oats');
  await ed.locator('[data-hit]').first().waitFor();
  await checkWidth(page, 'usual meals, the search');
  await pick('oats with', 2);
  assert.equal(await text(row(`i${skyr.item_id}`).locator('[data-row-food]')), 'Oats with milk and banana', 'swapped');
  assert.equal(await text(row(`i${skyr.item_id}`).locator('[data-status]')), `Swapped · was ${skyr.food}`, 'the swapped row says so');
  await ed.locator('[data-add-food]').click();
  await pick('rye', 7);
  await row('added').waitFor();
  assert.equal(await text(row('added').locator('[data-status]')), 'New', 'the added row says so');
  await ed.locator('#usual-name').fill('Big breakfast');
  assert.match(await text(ed.locator('[data-usual-changes]')), /^4 changes, not saved yet/, 'four changes counted');
  await ed.locator('[data-usual-was]').waitFor();
  await ed.scrollIntoViewIfNeeded();
  await shot('usual-edit', !pc);
  await checkWidth(page, 'usual meals, a meal open');

  // saved in place: the card renamed with a blue edge, Undo in the bar; then undone
  await ed.locator('[data-usual-save]').click();
  await card(breakfast.meal_id).locator('[data-usual-name]').getByText('Big breakfast').waitFor();
  assert.equal(await text(head), 'Changed the usual meal "Big breakfast".', 'save: the head');
  await bar.getByRole('button', { name: 'Undo' }).waitFor();
  assert.equal(await page.locator(`[data-usual="${breakfast.meal_id}"][data-fresh]`).count(), 1, 'the saved card has a blue edge');
  assert.equal(await text(card(breakfast.meal_id).locator('[data-usual-items]')), `${oats.food} ${oats.amount + 5} g · Oats with milk and banana ${skyr.amount} g · Rye bread 100 g`, 'the saved foods');
  assert.equal(await ed.count(), pc ? 1 : 0, pc ? 'PC: the saved meal stays open' : 'phone: back to the list');
  await shot('usual-saved');
  await bar.getByRole('button', { name: 'Undo' }).click();
  await card(breakfast.meal_id).locator('[data-usual-name]').getByText('Usual breakfast').waitFor();
  assert.equal(await text(head), 'Undone.', 'Undo: the head');
  assert.equal(await text(card(breakfast.meal_id).locator('[data-usual-items]')), items(breakfast), 'Undo: the foods as before');

  // a name another meal has: refused next to Save, in plain words, every edit kept
  await openCard(breakfast);
  await ed.locator('#usual-name').fill('cocoa');
  await row(`i${oats.item_id}`).getByRole('button', { name: `Less ${oats.food}` }).click();
  await ed.locator('[data-usual-save]').click();
  await ed.locator('[data-usual-err]').getByText('There is already a usual meal called "Cocoa". Pick another name.').waitFor();
  assert.equal(await ed.locator('#usual-name').inputValue(), 'cocoa', 'refused: the name kept');
  assert.equal(await row(`i${oats.item_id}`).locator('[data-row-amount]').inputValue(), String(oats.amount - 5), 'refused: the amount kept');
  assert.equal(await page.locator('[data-bar="warning"]').count(), 0, 'refused: said next to Save, not in the bar');
  await shot('usual-refused', !pc);
  await ed.getByRole('button', { name: 'Cancel' }).click();

  // the only food removed: Save says to use Delete; Put back; then Delete, and Undo brings it back
  await openCard(cocoa);
  const milk = cocoa.items[0];
  await row(`i${milk.item_id}`).getByRole('button', { name: `Remove ${milk.food}` }).click();
  assert.equal(await text(row(`i${milk.item_id}`).locator('[data-status]')), 'Removed', 'the removed row says so');
  await ed.locator('[data-usual-save]').click();
  await ed.locator('[data-usual-err]').getByText('use Delete', { exact: false }).waitFor();
  await row(`i${milk.item_id}`).getByRole('button', { name: 'Put back' }).click();
  await ed.locator('[data-usual-delete]').click();
  await card(cocoa.meal_id).waitFor({ state: 'detached' });
  assert.equal(await text(head), 'Deleted the usual meal "Cocoa". Past meals keep their values.', 'delete: the head');
  await bar.getByRole('button', { name: 'Undo' }).click();
  await card(cocoa.meal_id).waitFor();

  // a new usual drink: name, Drink, a food from the search (200 ml), + to 225 ml; saved with Undo
  await page.locator('[data-new-usual]:visible').click();
  await page.locator('[data-usual-editor="new"]').waitFor();
  await ed.locator('#usual-name').fill('Protein shake');
  await ed.getByRole('button', { name: 'Drink', exact: true }).click();
  await ed.locator('[data-add-food]').click();
  await pick('milk', milk.food_id);
  await row('added').getByRole('button', { name: `More ${milk.food}` }).click();
  assert.equal(await row('added').locator('[data-row-amount]').inputValue(), '225', 'a drink starts at 200 ml');
  await shot('usual-new', !pc);
  await checkWidth(page, 'usual meals, a new one');
  await ed.locator('[data-usual-save]').click();
  await page.locator('[data-usual-name]').getByText('Protein shake').waitFor();
  assert.match(await text(head), /^Saved "Protein shake" as a usual drink \(1 item\)/, 'new: the head');
  await bar.getByRole('button', { name: 'Undo' }).waitFor();
  assert.ok(await page.evaluate(() => window.__noReload === true), 'no reload during the saves');

  // the Food day: "Save as usual meal" on each meal but the drinks; a used name refused (the name kept), then saved
  await page.getByRole('link', { name: '‹ Food day' }).click();
  await page.getByRole('heading', { name: 'Food', exact: true }).waitFor();
  const meals = [...new Set(foodDay.rows.map((r) => r.meal))].filter((m) => m !== 0);
  assert.equal(await page.locator('[data-save-usual]').count(), meals.length, 'Save as usual meal on each meal, not the drinks');
  const meal = Math.max(...meals);
  await page.locator(`[data-save-usual="${meal}"]`).click();
  const naming = page.locator(`[data-name-usual="${meal}"]`);
  await naming.locator('input[name=name]').fill('Lunch box');
  await naming.getByRole('button', { name: 'Save', exact: true }).click();
  await naming.locator('[data-usual-err]').getByText('There is already a usual meal called "Lunch box".', { exact: false }).waitFor();
  assert.equal(await naming.locator('input[name=name]').inputValue(), 'Lunch box', 'refused: the name kept');
  await naming.locator('input[name=name]').fill('Lunch at work');
  await shot('food-usual');
  await checkWidth(page, 'food, save as usual meal');
  await naming.getByRole('button', { name: 'Save', exact: true }).click();
  await naming.waitFor({ state: 'detached' });
  const n = foodDay.rows.filter((r) => r.meal === meal).length;
  assert.match(await text(head), new RegExp(`^Saved "Lunch at work" as a usual meal \\(${n} items\\)`), 'from a meal: the head');
  await bar.getByRole('button', { name: 'Undo' }).waitFor();
  await page.getByRole('link', { name: 'Usual meals', exact: true }).click();
  await page.locator('[data-usual-name]').getByText('Lunch at work').waitFor();

  // Today: "Edit" by the usual chips leads here
  await page.goto(`${base}/`);
  await page.locator('[data-usual-edit]').click();
  await page.getByRole('heading', { name: 'Usual meals', exact: true }).waitFor();
}

/** Step F: the core down, the door off, and the way back; the sign-in page in both; `next` after a sign-in. */
async function checkProblems(page, name, theme) {
  const bar = page.locator('[data-bar]');
  const card = page.locator('[data-problem]');
  const water = page.getByRole('button', { name: `+ ${day.water.glass_ml} ml` });
  const shot = (what, fullPage = false) => page.screenshot({ path: `${out}/${what}-${name}-${theme}.png`, fullPage });
  await page.goto(`${base}/`);
  await page.locator('[data-kcal-left]').waitFor();

  // a tap while the core is down: "Not saved." and why, no link to app. (the same core)
  await standinPost('/standin/core-down');
  await water.click();
  await bar.getByText('Not saved.').waitFor();
  assert.match(await text(bar), /not answering right now.*Nothing was saved/, 'core down: the tap says why');
  assert.equal(await bar.locator('[data-bar-link]').count(), 0, 'core down: no link to app.');
  await shot('problem-save-core-down');
  // the door off: the same, with a link to app.
  await standinPost('/standin/door-off');
  await water.click();
  await bar.getByText('switched off', { exact: false }).waitFor();
  assert.match((await bar.locator('[data-bar-link]').getAttribute('href')) ?? '', /\/web\/$/, 'door off: the bar links to app.');
  await shot('problem-save-door-off');

  // the pages say it instead of the day; the session cookie stays (no sign-in page)
  await page.reload();
  await page.locator('[data-problem="door_off"]').waitFor();
  assert.equal(await page.locator('#log-text').count(), 0, 'door off: no logging box without the day');
  assert.match((await card.getByRole('link', { name: 'Open the full app' }).getAttribute('href')) ?? '', /\/web\/$/, 'door off: Today links to app.');
  await checkWidth(page, 'today, door off');
  await shot('today-door-off');
  await page.goto(`${base}/food`);
  await page.locator('[data-problem="door_off"]').waitFor();
  assert.match((await card.getByRole('link', { name: 'Open the full app' }).getAttribute('href')) ?? '', /\/web\/food$/, 'door off: Food links to app.');
  await standinPost('/standin/core-down');
  await card.getByRole('link', { name: 'Try again' }).click();
  await page.locator('[data-problem="core_down"]').waitFor();
  assert.equal(await card.getByRole('link', { name: 'Open the full app' }).count(), 0, 'core down: no link to app.');
  await checkWidth(page, 'food, core down');
  await shot('food-core-down');
  // back up: "Try again" shows the day, still signed in
  await standinPost('/standin/up');
  await card.getByRole('link', { name: 'Try again' }).click();
  await page.locator('[data-tile]').first().waitFor();
  assert.equal(await card.count(), 0, 'up again: no message');

  // the sign-in page: the door off and the core down, before typing and at the sign-in
  await page.goto(`${base}/`);
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.getByRole('button', { name: 'Sign in' }).waitFor();
  await standinPost('/standin/door-off');
  await page.reload();
  await page.locator('[data-problem="door_off"]').getByRole('link', { name: 'Open the full app' }).waitFor();
  await shot('signin-door-off');
  await standinPost('/standin/core-down');
  await page.reload();
  await page.locator('[data-problem="core_down"]').waitFor();
  await page.fill('#password', 'test');
  await page.fill('#code', '123456');
  await page.click('button[type=submit]');
  await page.getByRole('button', { name: 'Sign in' }).waitFor();
  await page.locator('[data-problem="core_down"]').waitFor();
  assert.equal(await text(page.locator('#login-message')), '', 'core down at the sign-in: said once, in the card');
  await checkWidth(page, 'sign-in, core down');
  await shot('signin-core-down');
  await standinPost('/standin/up');

  // after the sign-in, back to the page you were on: the Food day of the day before
  await page.goto(`${base}/food?day=${foodBefore.day}`);
  await page.getByRole('button', { name: 'Sign in' }).waitFor();
  assert.equal(await card.count(), 0, 'up: no message on the sign-in page');
  assert.match(page.url(), /\/login\?next=%2Ffood%3Fday%3D/, 'the sign-in page knows where you were');
  await page.fill('#password', 'test');
  await page.fill('#code', '123456');
  await page.click('button[type=submit]');
  await page.getByRole('heading', { name: 'Food', exact: true }).waitFor();
  assert.ok(page.url().endsWith(`/food?day=${foodBefore.day}`), `back on the page you were on (${page.url()})`);
  for (const r of foodBefore.rows) await page.locator(`[data-row="${r.ref}"]`).waitFor();
  // and a "next" to another site is not followed
  await page.getByRole('link', { name: '‹ Today' }).click();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.goto(`${base}/login?next=${encodeURIComponent('//example.com/')}`);
  await signIn(page);
  assert.equal(new URL(page.url()).origin, new URL(base).origin, 'a next to another site is not followed');
}

/** A tiny picture made in the browser (there is no camera in the test browser): a label photo to upload. */
async function tinyImage(page, colour) {
  const url = await page.evaluate((c) => {
    const k = document.createElement('canvas');
    [k.width, k.height] = [48, 32];
    const g = k.getContext('2d');
    g.fillStyle = c;
    g.fillRect(0, 0, 48, 32);
    g.fillStyle = '#fff';
    g.fillRect(6, 6, 20, 4);
    return k.toDataURL('image/png');
  }, colour);
  return { name: `label-${colour.slice(1)}.png`, mimeType: 'image/png', buffer: Buffer.from(url.split(',')[1], 'base64') };
}

/** Deploy 90: the scan sheet, "Look it up" on a question, the microphone. */
async function checkScan(page, name, theme) {
  await standinPost('/standin/reset');
  const res = await page.goto(`${base}/`);
  await page.locator('[data-kcal-left]').waitFor();
  const h = res.headers();
  assert.equal(h['permissions-policy'], 'camera=(self), microphone=(self)', 'the camera and the microphone for this origin only');
  assert.match(h['content-security-policy'], /img-src 'self' data: blob:/, 'the thumbnails (blob:) are allowed');
  assert.match(h['content-security-policy'], /script-src 'self'/, 'scripts stay this app\'s own');
  await page.evaluate(() => (window.__noReload = true));
  const bar = page.locator('[data-bar]');
  const head = bar.locator('[data-bar-head]');
  const sheet = page.locator('dialog[data-scan]');
  const msg = sheet.locator('[data-scan-msg]');
  const shot = (what) => page.screenshot({ path: `${out}/${what}-${name}-${theme}.png` });
  const scan = async (code) => {
    if (!(await sheet.isVisible())) {
      await page.getByRole('button', { name: 'Scan', exact: true }).click();
      await sheet.waitFor();
    }
    await sheet.locator('#scan-code').fill(code);
    await sheet.getByRole('button', { name: 'Find' }).click();
  };
  // the sheet covers the phone, sits above the tab bar and the box, and its main button is not covered by anything
  const onTop = async (what, button) => {
    const box = await sheet.boundingBox();
    const vp = page.viewportSize();
    if (vp.width < 760) assert.ok(box.y <= 0.5 && Math.abs(box.height - vp.height) < 2, `${what}: the sheet is full height on phones`);
    else assert.ok(box.y >= 0 && box.y + box.height <= vp.height, `${what}: the sheet fits the screen`);
    await button.scrollIntoViewIfNeeded();
    const b = await button.boundingBox();
    const hit = await page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest('dialog[data-scan]'), [b.x + b.width / 2, b.y + b.height / 2]);
    assert.ok(hit, `${what}: nothing covers the sheet's button`);
    await checkWidth(page, `scan sheet, ${what}`);
  };

  // no microphone without speech support (the test contexts take it away); the link to the full app is gone
  assert.equal(await page.locator('[data-mic]').count(), 0, 'no microphone without speech support');
  assert.equal(await page.getByRole('link', { name: 'Barcode and label: full app' }).count(), 0, 'no link to the full app');

  // a known food by its digits (wrong digits first): its name and last amount, − and +, a time, Log -> the row, then Undo
  await scan('12');
  await msg.getByText('A barcode is 8 to 14 digits.').waitFor();
  assert.ok(/camera|type the digits|8 to 14/.test(await text(msg)), 'no camera here: the sheet says to type');
  await scan(SCAN.barcode.code);
  const found = sheet.locator('[data-scan-found]');
  await found.getByText(SCAN.barcode.food.name).waitFor();
  const amount = found.locator('#scan-amount');
  assert.equal(await amount.inputValue(), String(SCAN.barcode.food.amount), 'the last amount');
  await found.getByRole('button', { name: 'More' }).click();
  assert.equal(await amount.inputValue(), String(SCAN.barcode.food.amount + 25), '+');
  await found.getByRole('button', { name: 'Less' }).click();
  assert.equal(await amount.inputValue(), String(SCAN.barcode.food.amount), '−');
  await amount.fill('45');
  await found.locator('#scan-time').fill('08:30');
  await onTop('a known food', found.getByRole('button', { name: 'Log' }));
  await shot('scan-found');
  await found.getByRole('button', { name: 'Log' }).click();
  await sheet.waitFor({ state: 'hidden' });
  await page.locator('[data-fresh]', { hasText: SCAN.barcode.food.name }).getByText('45 g').waitFor();
  assert.equal(await text(head), 'Saved.', 'scanned food: saved');
  await bar.getByRole('button', { name: 'Undo' }).click();
  await page.locator('[data-row]', { hasText: SCAN.barcode.food.name }).filter({ hasText: '45 g' }).waitFor({ state: 'detached' });

  // an unknown code that Open Food Facts does not know: why, and the label photo next
  await scan(SCAN.barcode_none.code);
  const unknown = sheet.locator('[data-scan-unknown]');
  await unknown.getByText('Not in your catalogue yet.').waitFor();
  await onTop('an unknown code', unknown.getByRole('button', { name: 'Look it up on Open Food Facts' }));
  await shot('scan-unknown');
  await unknown.getByRole('button', { name: 'Look it up on Open Food Facts' }).click();
  await msg.getByText(SCAN.off_none.reason, { exact: false }).waitFor();
  await unknown.getByText('Photo of the label').waitFor();

  // an unknown code that it knows: the form, filled; Add to my foods (no amount) adds it, and scanned again it is found
  const offCode = '4012345678901';
  await scan(offCode);
  await sheet.getByRole('button', { name: 'Look it up on Open Food Facts' }).click();
  const lform = sheet.locator('[data-label-form]');
  await lform.waitFor();
  const offName = `${SCAN.off.name} (${SCAN.off.brand})`;
  assert.equal(await lform.locator('[name=name]').inputValue(), offName, 'OFF: the name with the brand');
  assert.equal(await lform.locator('[name=basis]').inputValue(), SCAN.off.basis, 'OFF: per 100 ml');
  for (const [k, v] of Object.entries(SCAN.off.values)) assert.equal(await lform.locator(`[name=${k}]`).inputValue(), v === null ? '' : String(v), `OFF: ${k}`);
  assert.ok((await text(lform.locator('[data-label-note]'))).startsWith(SCAN.off.note), 'OFF: its note');
  await onTop('the Open Food Facts form', lform.getByRole('button', { name: 'Add to my foods' }));
  await shot('scan-off-form');
  await lform.getByRole('button', { name: 'Add to my foods' }).click();
  await sheet.waitFor({ state: 'hidden' });
  assert.match(await text(head), new RegExp(`^Added ${offName.replace(/[()]/g, '\\$&')} to your catalogue\\. Scan it again`), 'OFF: added, not logged');
  await scan(offCode);
  await sheet.locator('[data-scan-found]').getByText(offName).waitFor();
  await sheet.getByRole('button', { name: 'Close' }).click();
  await sheet.waitFor({ state: 'hidden' });

  // label photos: one, a second, a third (no more), one removed; a failed read keeps them; two read together, added with an amount
  await page.getByRole('button', { name: 'Scan', exact: true }).click();
  await sheet.locator('[data-photo-pick] input').first().setInputFiles(await tinyImage(page, '#2a6f97'));
  const photos = sheet.locator('[data-scan-photos]');
  await photos.locator('[data-photo]').first().waitFor();
  if (name === 'phone' && theme === 'dark') {
    // one photo only: the table, without the name (the stand-in's rule): the form says so, the name is typed
    await photos.getByRole('button', { name: 'Read the label' }).click();
    await lform.waitFor();
    assert.equal(await lform.locator('[name=name]').inputValue(), '', 'one photo: no name');
    await lform.getByText('The name is not on this photo').waitFor();
    await sheet.getByRole('button', { name: 'Close' }).click();
    await page.getByRole('button', { name: 'Scan', exact: true }).click();
    await sheet.locator('[data-photo-pick] input').first().setInputFiles(await tinyImage(page, '#2a6f97'));
  }
  if (name === 'phone' && theme === 'dark') {
    // too large: a photo the browser cannot make smaller (not a picture) is sent as it is; over 8 MB it is refused at once, and
    // three of 5 MB are refused by this app's server (over BODY_SIZE_LIMIT, 13 MB), both in plain words, the photos kept
    const junk = (mb, n) => ({ name: `big-${n}.jpg`, mimeType: 'image/jpeg', buffer: Buffer.alloc(mb * 1024 * 1024, n) });
    await photos.locator('[data-photo-pick] input').setInputFiles(junk(9, 1));
    await msg.getByText('This photo is too large').waitFor();
    assert.equal(await photos.locator('[data-photo]').count(), 1, 'a photo over 8 MB is not added');
    await photos.getByRole('button', { name: 'Remove photo 1' }).click();
    await page.getByRole('button', { name: 'Scan', exact: true }).waitFor();
    await sheet.locator('[data-photo-pick] input').first().setInputFiles([junk(5, 2), junk(5, 3), junk(5, 4)]);
    await photos.locator('[data-photo]').nth(2).waitFor();
    await photos.getByRole('button', { name: 'Read the label' }).click();
    await photos.locator('[data-scan-problem]').getByText('too large together', { exact: false }).waitFor();
    assert.equal(await photos.locator('[data-photo]').count(), 3, 'too large together: the photos are kept');
    await shot('scan-too-large');
    for (const k of [3, 2, 1]) await photos.getByRole('button', { name: `Remove photo ${k}` }).click();
    await sheet.locator('[data-photo-pick] input').first().setInputFiles(await tinyImage(page, '#2a6f97'));
    await photos.locator('[data-photo]').first().waitFor();
  }
  await photos.locator('[data-photo-pick] input').setInputFiles(await tinyImage(page, '#97502a'));
  await photos.locator('[data-photo]').nth(1).waitFor();
  await photos.locator('[data-photo-pick] input').setInputFiles(await tinyImage(page, '#4a972a'));
  await photos.locator('[data-photo]').nth(2).waitFor();
  assert.equal(await photos.locator('[data-photo-pick]').count(), 0, 'three photos: no "+ Add a photo"');
  await photos.getByRole('button', { name: 'Remove photo 3' }).click();
  assert.equal(await photos.locator('[data-photo]').count(), 2, 'a photo removed');
  assert.ok(await photos.locator('img').first().evaluate((i) => i.complete && i.naturalWidth > 0 && i.src.startsWith('blob:')), 'the thumbnail shows (blob:)');
  await onTop('two photos', photos.getByRole('button', { name: 'Read the label' }));
  await shot('scan-photos');
  await standinPost('/standin/label-unreadable');
  await photos.getByRole('button', { name: 'Read the label' }).click();
  await photos.locator('[data-scan-problem]').getByText(SCAN.label_unreadable.reason, { exact: false }).waitFor();
  assert.equal(await photos.locator('[data-photo]').count(), 2, 'a failed read keeps the photos');
  await onTop('a failed read', photos.getByRole('button', { name: 'Read the label' }));
  await shot('scan-read-failed');
  await photos.getByRole('button', { name: 'Read the label' }).click();
  await lform.waitFor();
  const labelName = `${SCAN.label.name} (${SCAN.label.brand})`;
  assert.equal(await lform.locator('[name=name]').inputValue(), labelName, 'label: the name with the brand');
  for (const [k, v] of Object.entries(SCAN.label.values)) assert.equal(await lform.locator(`[name=${k}]`).inputValue(), String(v), `label: ${k}`);
  await lform.locator('[name=amount]').fill('45');
  await lform.locator('[name=time]').fill('08:30');
  await onTop('the label form', lform.getByRole('button', { name: 'Add to my foods' }));
  await shot('scan-label-form');
  await lform.getByRole('button', { name: 'Add to my foods' }).click();
  await sheet.waitFor({ state: 'hidden' });
  await page.locator('[data-fresh]', { hasText: labelName }).getByText('45 g').waitFor();
  assert.equal(await text(head), `Added ${labelName} to your catalogue. Logged it.`, 'label: added and logged');
  await bar.getByRole('button', { name: 'Undo' }).waitFor();
  await shot('scan-added');

  // "Look it up" on a food question of a typed line: the food found is read back as a question; Yes answers it
  const box = page.locator('#log-text');
  await box.fill('100 g mystery bar');
  await box.press('Enter');
  await page.locator('[data-reading]').first().waitFor({ state: 'detached' });
  const needs = page.locator('[data-card="needs"]');
  const q = needs.getByText('Which food is "mystery bar"?').locator('..');
  await q.getByRole('button', { name: 'Look it up' }).click();
  const read = SCAN.saves.lookup.questions[0];
  await needs.getByText(read.text).waitFor();
  assert.ok((await text(needs)).includes(read.read_back), 'look-up: the read-back on its card');
  assert.equal(await text(head), SCAN.saves.lookup.head, 'look-up: the head');
  await needs.getByText(read.text).scrollIntoViewIfNeeded();
  await checkWidth(page, 'look it up, read back');
  await shot('lookup-readback');
  await needs.getByText(read.text).locator('..').getByRole('button', { name: 'Yes' }).click();
  await needs.getByText(read.text).waitFor({ state: 'detached' });
  assert.equal(await text(head), 'Saved.', 'look-up: Yes saved');
  assert.ok(await page.evaluate(() => window.__noReload === true), 'no reload while scanning');

  // the microphone where the browser can (a stand-in recogniser): its words land in the box, after what is there
  await page.evaluate(() => sessionStorage.setItem('test-speech', '1'));
  await page.reload();
  await page.locator('[data-mic]').waitFor();
  await checkWidth(page, 'today, with the microphone');
  if (name === 'phone') await shot('today-mic');
  await box.fill('coffee and');
  await page.locator('[data-mic]').click();
  await page.waitForFunction(() => document.querySelector('#log-text').value === 'coffee and 40 g radishes');
  await box.fill('');
}

/** No sideways scroll, and on phones and tablets every button, field and link that stands alone at least 44 px tall. */
async function checkHealth(page, name, theme) {
  await standinPost('/standin/reset');
  const h = HEALTH.health.health;
  const pc = name === 'pc';
  const bar = page.locator('[data-bar]');
  const headIs = async (want) => {
    await page.locator('[data-bar-head]', { hasText: want }).waitFor();
    assert.equal(await text(page.locator('[data-bar-head]')), want, 'the answer bar');
  };

  // Today: "Body measurements due" with the last session, in the Needs you count; Measure opens the body form on the Health page
  await page.goto(`${base}/`);
  const due = page.locator('[data-body-due]');
  const d = HEALTH.day_body_due;
  assert.equal(await text(due), `Body measurements due Last ${d.last.slice(8, 10)}.${d.last.slice(5, 7)}. · ${d.days} days ago · takes about 3 minutes Measure Not today`, 'the due line');
  assert.equal(await text(page.locator('[data-count]')), want.needs, 'Needs you count with the due line');
  if (name === 'phone') await due.screenshot({ path: `${out}/today-body-due-${name}-${theme}.png` });
  await due.getByRole('link', { name: 'Measure' }).click();
  await page.locator('[data-body-form]').waitFor();
  assert.match(page.url(), /\/health\?measure=1#body$/, 'Measure: the Health page, the form open');
  await page.goto(`${base}/`);
  // "Not today": the line goes, the count is one less
  await due.getByRole('button', { name: 'Not today' }).click();
  await due.waitFor({ state: 'detached' });
  assert.equal(await text(page.locator('[data-count]')), String(Number(want.needs) - 1), 'Needs you count after Not today');
  await headIs(HEALTH.saves.body_skip.head);

  // the "Health" link on Today's Health card
  await page.locator('[data-health-link]').click();
  await page.waitForURL(/\/health$/);
  await page.locator('[data-charts]').waitFor();
  await page.evaluate(() => (window.__noReload = true));

  // every chart: as many marks as the sample has points, its stat line; the sleep times: a band per sleep, a tick per lone wake-up
  const marks = async (id) => page.locator(`[data-chart="${id}"] [data-mark]`).evaluateAll((els) => els.map((e) => e.getAttribute('data-mark')));
  const checkCharts = async (charts, times) => {
    for (const c of charts) {
      const got = await marks(c.id);
      for (const m of ['dot', 'ring', 'bar']) {
        assert.equal(got.filter((x) => x === m).length, c.chart.series.filter((s) => s.mark === m).reduce((a, s) => a + s.pts.length, 0), `${c.id}: ${m}s`);
      }
      assert.equal(got.filter((x) => x === 'line').length, c.chart.series.filter((s) => s.mark === 'line' && s.pts.length > 1).length, `${c.id}: lines`);
    }
    assert.equal(await page.locator('[data-clock="times"] [data-band]').count(), times.rows.reduce((a, r) => a + r.bands.length, 0), 'sleep times: bands');
    assert.equal(await page.locator('[data-clock="times"] [data-tick]').count(), times.rows.reduce((a, r) => a + r.ticks.length, 0), 'sleep times: ticks');
  };
  await checkCharts(h.charts, h.times);
  for (const c of h.charts) assert.equal(await text(page.locator(`[data-chart-card="${c.id}"] [data-stat]`)), c.stat.map((p) => p.text).join('').replace(/\s+/g, ' ').trim(), `${c.id}: stat`);
  // one column on phones, two from the tablet width
  const [w, bp] = [await page.locator('[data-chart-card="weight"]').boundingBox(), await page.locator('[data-chart-card="bp"]').boundingBox()];
  if (name === 'phone') assert.ok(bp.y > w.y + w.height - 1 && Math.abs(bp.x - w.x) < 2, 'phone: one column of charts');
  else assert.ok(Math.abs(bp.y - w.y) < 2 && bp.x > w.x + w.width - 1, `${name}: two columns of charts`);
  // a tap on a point shows its text
  const dot = page.locator('[data-chart="sugar"] [data-mark="dot"]').nth(1);
  await dot.click({ force: true });
  assert.equal(await text(page.locator('[data-chart="sugar"] [data-tip]')), h.charts.find((c) => c.id === 'sugar').chart.series[0].pts[1][2], 'a tap shows the point\'s text');
  await page.screenshot({ path: `${out}/health-${name}-${theme}.png`, fullPage: true });
  await checkWidth(page, 'health');

  // the range switch: 7 days, the charts cut to the last week (the stand-in), then 30 again
  await page.getByRole('link', { name: '7 days' }).click();
  await page.locator('[data-range] [aria-current="page"]', { hasText: '7 days' }).waitFor();
  const cut = (c) => ({ ...c, chart: { ...c.chart, series: c.chart.series.map((s) => ({ ...s, pts: s.pts.filter((p) => p[0] >= h.days_in_range - 7) })) } });
  await checkCharts(h.charts.map(cut), { rows: h.times.rows.slice(-7) });
  if (name === 'phone') await page.locator('[data-charts]').screenshot({ path: `${out}/health-7-days-${name}-${theme}.png` });
  await page.getByRole('link', { name: '30 days' }).click();
  await page.locator('[data-range] [aria-current="page"]', { hasText: '30 days' }).waitFor();
  await page.evaluate(() => (window.__noReload = true));

  // the entries: the last 14 days, newest first; the table on the PC, rows elsewhere
  const rows = pc ? '[data-table-day]' : '[data-day]';
  assert.deepEqual(await page.locator(rows).evaluateAll((els, a) => els.map((e) => e.getAttribute(a)), pc ? 'data-table-day' : 'data-day'), h.days.map((x) => x.day), 'the days, newest first');
  const [d16, d15] = [h.days[0].day, h.days[1].day];
  /** A day's fields to change: the open row on phones and tablets (opened here), the table's row on the PC. */
  const fields = async (day) => {
    if (pc) return page.locator(`[data-table-day="${day}"]`);
    const ed = page.locator(`[data-day-editor="${day}"]`);
    if (!(await ed.count())) await page.locator(`[data-day="${day}"] > button`).click();
    await ed.waitFor();
    return ed;
  };
  const shows = async (day, want, yes = true) => {
    const has = async () => (pc ? (await page.locator(`[data-table-day="${day}"] input[name="weight"]`).inputValue()) === want.replace(/^Weight | kg$/g, '') : (await text(page.locator(`[data-day="${day}"] [data-day-values]`))).includes(want));
    for (let i = 0; i < 50 && (await has()) !== yes; i++) await page.waitForTimeout(100);
    assert.equal(await has(), yes, `${day}: ${yes ? '' : 'not '}${want}`);
  };
  // a day changed: a weight changed, a blood pressure added; saved in place with a blue edge; then undone
  let f = await fields(d15);
  await f.locator('input[name="weight"]').fill('81.2');
  await f.locator('input[name="bp_morning_1"]').fill('121');
  await f.locator('input[name="bp_morning_2"]').fill('79');
  if (!pc) {
    await page.locator(`[data-day="${d15}"]`).scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${out}/health-day-open-${name}-${theme}.png` });
    await checkWidth(page, 'health, a day open');
  }
  await f.getByRole('button', { name: 'Save' }).click();
  await headIs('Saved for Sun 15.11.: Weight 81.8 → 81.2, BP morning 121/79 added.');
  await shows(d15, 'Weight 81.2 kg');
  if (!pc) await shows(d15, 'BP morning 121/79');
  await page.locator(`${pc ? '[data-table-day' : '[data-day'}="${d15}"][data-fresh]`).waitFor();
  if (pc) await page.screenshot({ path: `${out}/health-saved-${name}-${theme}.png` });
  await bar.getByRole('button', { name: 'Undo' }).click();
  await headIs('Undone.');
  await shows(d15, 'Weight 81.8 kg');

  // an odd weight: read back first ("Yes, save it"), saved on the yes; Undo
  f = await fields(d16);
  await f.locator('input[name="weight"]').fill('400');
  await f.getByRole('button', { name: 'Save' }).click();
  await page.locator('[data-bar="warning"]').getByText(HEALTH.saves.health_day_read_back.read_back).waitFor();
  if (name === 'phone') await page.screenshot({ path: `${out}/health-read-back-${name}-${theme}.png` });
  if (!pc) await shows(d16, 'Weight 400 kg', false); // nothing saved yet (on the PC the field holds what was typed)
  await page.locator('[data-bar="warning"]').getByRole('button', { name: 'Yes, save it' }).click();
  await headIs('Saved for Mon 16.11.: Weight 81.6 → 400.');
  await shows(d16, 'Weight 400 kg');
  await bar.getByRole('button', { name: 'Undo' }).click();
  await headIs('Undone.');
  await shows(d16, 'Weight 81.6 kg');

  // a value cleared: asked once ("Yes, delete"), then gone
  f = await fields(d16);
  await f.locator('input[name="sugar"]').fill('');
  await f.getByRole('button', { name: 'Save' }).click();
  await page.locator('[data-bar="warning"]').getByText('Delete on Mon 16.11.: Sugar 88?').waitFor();
  await page.locator('[data-bar="warning"]').getByRole('button', { name: 'Yes, delete' }).click();
  await headIs('Saved for Mon 16.11.: Sugar 88 deleted.');
  if (pc) assert.equal(await page.locator(`[data-table-day="${d16}"] input[name="sugar"]`).inputValue(), '', 'the sugar cleared');
  else await shows(d16, 'Sugar 88', false);
  await page.locator('[data-bar] button[aria-label="Close"]').click();

  // "Show all": every day of the range, and back
  await page.locator('[data-show-all]').click();
  await page.locator('[data-show-all]', { hasText: `Show the last ${h.shown_days} days` }).waitFor();
  assert.equal(await page.locator(rows).count(), h.days_in_range, 'Show all: every day of the range');
  await page.locator('[data-show-all]').click();
  await page.locator('[data-show-all]', { hasText: `Show all ${h.days_in_range} days` }).waitFor();
  await page.evaluate(() => (window.__noReload = true));

  // the body card: Measure, two values (the last as the placeholder), saved; the table shows them
  const body = page.locator('[data-card="body"]');
  const B = HEALTH.body.body;
  assert.equal(await text(body.locator('[data-body-sub]')), `Last measured ${B.last_measured.slice(8, 10)}.${B.last_measured.slice(5, 7)}.${B.last_measured.slice(0, 4)} · ${B.due_text}`, 'body: last measured and due');
  await body.locator('[data-measure]').click();
  const form = body.locator('[data-body-form]');
  assert.equal(await form.locator('input[name="waist"]').getAttribute('placeholder'), B.form[0].last_cm.toFixed(1), 'the last value as the placeholder');
  await form.locator('input[name="waist"]').fill('91.8');
  await form.locator('input[name="hips"]').fill('101.5');
  await body.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${out}/health-body-form-${name}-${theme}.png`, fullPage: name !== 'pc' ? false : true });
  if (name === 'phone') await body.screenshot({ path: `${out}/health-body-card-${name}-${theme}.png` });
  await checkWidth(page, 'health, the body form');
  await form.getByRole('button', { name: 'Save' }).click();
  await headIs(HEALTH.saves.body.head);
  await form.waitFor({ state: 'detached' });
  assert.equal(await text(body.locator('[data-now="waist"]')), '91.8', 'the table: the new waist');
  // a jump of 4 cm or more is read back ("Yes, save"), saved on the yes
  await body.locator('[data-measure]').click();
  await form.locator('input[name="thigh"]').fill('52.5');
  await form.getByRole('button', { name: 'Save' }).click();
  await page.locator('[data-bar="warning"]').getByText(HEALTH.saves.body_read_back.read_back).waitFor();
  await page.locator('[data-bar="warning"]').getByRole('button', { name: 'Yes, save' }).click();
  await headIs('Saved for Mon 16.11.: Thigh 52.5 added.');
  assert.equal(await text(body.locator('[data-now="thigh"]')), '52.5', 'the table: the new thigh');
  // Now opens that session to change it (the chest of the sample's last session)
  const chest = B.table.find((t) => t.key === 'chest');
  await body.locator('[data-now="chest"]').click();
  await body.locator(`[data-body-form="${chest.day}"]`).waitFor();
  assert.equal(await form.locator('input[name="chest"]').inputValue(), chest.cm.toFixed(1), 'the session\'s value to change');
  assert.match(await text(body.locator('[data-body-session]')), /^Changing the session of \d\d\.\d\d\.\d{4}\./, 'which session');
  await body.getByRole('button', { name: 'Close' }).click();
  await form.waitFor({ state: 'detached' });
  // a measure's chart by its chip
  await body.locator('[data-chip="hips"]').click();
  await body.locator('[data-chart="body-hips"] [data-mark="dot"]').first().waitFor();
  await checkWidth(page, 'health, after the saves');
}

async function checkHabits(page, name, theme) {
  await standinPost('/standin/reset');
  const hb = HABITS.habits.habits;
  const all = HABITS.habits_all.habits;
  const pc = name === 'pc';
  const bar = page.locator('[data-bar]');
  const headIs = async (want) => {
    await page.locator('[data-bar-head]', { hasText: want }).waitFor();
    assert.equal(await text(page.locator('[data-bar-head]')), want, 'the answer bar');
  };
  const rows = async () => page.locator('[data-habit-row]').evaluateAll((els) => els.map((e) => e.getAttribute('data-habit-row')));
  const sample = (list, key) => list.list.flatMap((g) => g.habits).filter((h) => h.state === key).map((h) => h.name);
  const doneLine = page.locator('[data-ticks-done]');
  const full = (n) => text(page.locator(`[data-cal="${n}"] [data-full]`));
  const sq = (n) => page.locator(`[data-cal="${n}"] [data-sq]`).evaluateAll((els) => els.map((e) => e.getAttribute('data-sq')));

  // from Today's Habits card: its "Habits" link
  await page.goto(`${base}/`);
  await page.locator('[data-habits-link]').click();
  await page.waitForURL(/\/habits$/);
  await page.locator('[data-card="ticks"]').waitFor();
  await page.evaluate(() => (window.__noReload = true));
  assert.equal(await text(page.locator('h1')), 'Habits');

  // today's ticks: the same buttons as Today's card (two per row), "n of N done"
  assert.equal(await text(doneLine), '2 of 4 done', 'n of N done from the sample');
  assert.deepEqual(
    await page.locator('[data-card="ticks"] [data-habit]').evaluateAll((els) => els.map((e) => e.getAttribute('data-habit'))),
    hb.checklist.habits.map((h) => h.name),
    "today's ticks",
  );
  const spots = await page.locator('[data-card="ticks"] [data-habit]').evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => ({ x: r.x, y: r.y })));
  assert.ok(Math.abs(spots[0].y - spots[1].y) < 2 && spots[1].x > spots[0].x + 40, 'two ticks per row');
  assert.equal(await page.locator('[data-card="ticks"] [data-habit="sample_reading"]').getAttribute('aria-pressed'), 'true');
  assert.match(await text(page.locator('[data-card="ticks"] [data-habit="sample_reading"]')), /2\/2/, 'a twice-a-day habit shows 2/2');
  assert.match(await text(page.locator('[data-card="ticks"] [data-habit="sample_soft_drink"]')), /avoid/, 'an avoid mark');

  // the strip: the sample's states, squares that are not buttons, "full/30" (or "n/30 without")
  for (const c of hb.calendar) {
    assert.deepEqual(await sq(c.name), c.days.map((d) => d.state), `${c.name}: the strip's squares`);
    assert.equal(await full(c.name), `${c.full}/30${c.avoid ? ' without' : ''}`, `${c.name}: full/30`);
    assert.equal(await text(page.locator(`[data-cal-row="${c.name}"] > span`).first()), `${c.label}${c.avoid ? ' avoid' : ''} ${c.full}/30${c.avoid ? ' without' : ''} ›`.replace(/\s+/g, ' '), `${c.name}: the row's words`);
  }
  const squares = await page.locator('[data-sq]').evaluateAll((els) => els.map((e) => ({ tag: e.tagName, button: !!e.closest('a, form') || e.getAttribute('role') === 'button', h: e.getBoundingClientRect().height })));
  assert.ok(squares.length === 30 * hb.calendar.length && squares.every((x) => x.tag === 'SPAN' && !x.button && x.h < 20), 'the squares are small spans, not buttons');
  assert.equal(await page.locator('[data-strip]').first().getAttribute('aria-hidden'), 'true');
  assert.equal(await text(page.locator('[data-legend]')), 'done partly a habit to avoid, logged nothing', 'the legend');

  // the page: one column on phones and tablets, the ticks and the 30 days left and "Your habits" right from 1100 px
  const [tk, th, li] = await Promise.all(['ticks', 'thirty', 'list'].map((c) => page.locator(`[data-card="${c}"]`).boundingBox()));
  if (pc) assert.ok(li.x > th.x + th.width - 1 && Math.abs(li.y - tk.y) < 2 && th.y > tk.y + tk.height - 1, 'pc: the ticks and the 30 days left, Your habits right');
  else assert.ok(th.y > tk.y + tk.height - 1 && li.y > th.y + th.height - 1 && Math.abs(li.x - th.x) < 2, `${name}: one column`);
  await page.screenshot({ path: `${out}/habits-${name}-${theme}.png`, fullPage: true });
  await checkWidth(page, 'habits');

  // a tick: Today's button with the habits read; the strip's last square follows; Undo takes it back
  await page.locator('[data-card="ticks"] [data-habit="meds"]').click();
  await page.locator('[data-card="ticks"] [data-habit="meds"][aria-pressed="true"]').waitFor();
  assert.equal(await text(doneLine), '3 of 4 done');
  await headIs('Medication ticked.');
  assert.equal((await sq('meds')).at(-1), 'done', "the strip's last square");
  await bar.getByRole('button', { name: 'Undo' }).click();
  await page.locator('[data-card="ticks"] [data-habit="meds"][aria-pressed="false"]').waitFor();
  await headIs('Undone.');
  assert.equal(await text(doneLine), '2 of 4 done');
  // a done habit is unticked by a tap
  await page.locator('[data-card="ticks"] [data-habit="sample_stretching"]').click();
  await page.locator('[data-card="ticks"] [data-habit="sample_stretching"][aria-pressed="false"]').waitFor();
  assert.equal(await text(doneLine), '1 of 4 done');
  await bar.getByRole('button', { name: 'Undo' }).click();
  await page.locator('[data-card="ticks"] [data-habit="sample_stretching"][aria-pressed="true"]').waitFor();

  // the calendar of a twice-a-day habit: weeks, Monday first, cells of 44 px
  const reading = hb.calendar.find((c) => c.name === 'sample_reading');
  const cal = page.locator('[data-calendar="sample_reading"]');
  await page.locator('[data-cal-row="sample_reading"]').click();
  await cal.waitFor();
  assert.equal(await page.locator('[data-cal-row="sample_reading"]').getAttribute('aria-expanded'), 'true');
  assert.deepEqual(await cal.locator('[data-day]').evaluateAll((els) => els.map((e) => e.getAttribute('data-day'))), reading.days.map((d) => d.day), 'the calendar has the 30 days');
  assert.deepEqual(await cal.locator('[data-day]').evaluateAll((els) => els.map((e) => e.getAttribute('data-state'))), reading.days.map((d) => d.state), 'their states');
  const box = async (d) => cal.locator(`[data-day="${d}"]`).boundingBox();
  const [mon9, mon16, sun15, sun18] = [await box('2026-11-09'), await box('2026-11-16'), await box('2026-11-15'), await box('2026-10-18')];
  assert.ok(Math.abs(mon9.x - mon16.x) < 1 && mon16.y > mon9.y + mon9.height - 1, 'Monday first: two Mondays in one column, a week apart');
  assert.ok(sun15.x > mon16.x + 4 * mon16.width && sun15.y < mon16.y && Math.abs(sun18.x - sun15.x) < 1, 'a Sunday is the last column');
  assert.deepEqual(await cal.locator('div[aria-hidden="true"] span').allTextContents(), ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], 'the weekdays');
  const cells = await cal.locator('[data-day]').evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => ({ w: r.width, h: r.height })));
  assert.ok(cells.every((c) => c.w >= 44 && c.h >= 44), `cells of at least 44 px (smallest ${Math.min(...cells.map((c) => Math.min(c.w, c.h)))})`);
  assert.equal(await text(cal.locator('[data-day="2026-11-15"] [data-mark]')), '1/2', 'a twice-a-day cell shows 1/2');
  assert.equal(await text(cal.locator('[data-day="2026-11-16"] [data-mark]')), '2/2');
  assert.equal(await text(cal.locator('[data-day="2026-11-16"] span').first()), '16');
  assert.equal(await text(cal.locator('[data-day="2026-10-18"] span').first()), '18 Oct', 'the first cell has its month');
  assert.equal(await text(cal.locator('[data-day="2026-11-01"] span').first()), '1 Nov', 'the 1st has its month');
  assert.equal(await page.locator('[data-calendar]').count(), 1, 'one calendar open');
  await checkWidth(page, 'habits, a calendar');

  // a day ticked: none -> 1/2 -> 2/2 (done), and a done day is taken off; Undo in the bar
  const none = reading.days.find((d) => d.state === 'none' && d.day !== '2026-11-16').day;
  const dm = `${none.slice(8, 10)}.${none.slice(5, 7)}.${none.slice(0, 4)}`;
  const cell = cal.locator(`[data-day="${none}"]`);
  await cell.click();
  await cell.locator('[data-mark]', { hasText: '1/2' }).waitFor();
  assert.equal(await cell.getAttribute('data-state'), 'partly');
  await headIs('Saved.');
  await bar.getByRole('button', { name: 'Undo' }).waitFor();
  assert.equal(await full('sample_reading'), `${reading.full}/30`, 'a partly day is not full yet');
  assert.equal((await sq('sample_reading'))[reading.days.findIndex((d) => d.day === none)], 'partly', "the strip's square");
  if (name === 'phone') await page.locator('[data-cal="sample_reading"]').screenshot({ path: `${out}/habits-calendar-${name}-${theme}.png` });
  await cell.click();
  await cell.locator('[data-mark]', { hasText: '2/2' }).waitFor();
  assert.equal(await cell.getAttribute('data-state'), 'done');
  assert.equal(await full('sample_reading'), `${reading.full + 1}/30`);
  await cell.click();
  await page.locator(`[data-calendar="sample_reading"] [data-day="${none}"][data-state="none"]`).waitFor();
  await headIs(`Removed 2 ticks of Reading on ${dm}.`);
  await bar.getByRole('button', { name: 'Undo' }).click();
  await headIs('Undone.');
  await page.locator(`[data-calendar="sample_reading"] [data-day="${none}"][data-state="done"]`).waitFor();
  await cell.click(); // none again
  await page.locator(`[data-calendar="sample_reading"] [data-day="${none}"][data-state="none"]`).waitFor();

  // a button is blocked while its save is on the way: a double tap sends one tick, it never ticks and unticks
  await standinPost('/standin/slow');
  const stretching = hb.calendar.find((c) => c.name === 'sample_stretching');
  const open2 = stretching.days.find((d) => d.state === 'none').day;
  await page.locator('[data-cal-row="sample_stretching"]').click();
  const c2 = page.locator(`[data-calendar="sample_stretching"] [data-day="${open2}"]`);
  await c2.dblclick();
  await c2.locator('[data-mark]', { hasText: '✓' }).waitFor();
  await page.waitForTimeout(1200);
  assert.equal(await c2.getAttribute('data-state'), 'done', 'two taps made one tick');
  assert.equal(await full('sample_stretching'), `${stretching.full + 1}/30`);
  await headIs('Saved.');
  // and taking it off
  await standinPost('/standin/reset');
  await page.reload();
  await page.locator('[data-cal-row="sample_stretching"]').click();
  const done = stretching.days.find((d) => d.state === 'done' && d.day !== '2026-11-16').day;
  await page.locator(`[data-calendar="sample_stretching"] [data-day="${done}"]`).click();
  await page.locator(`[data-calendar="sample_stretching"] [data-day="${done}"][data-state="none"]`).waitFor();
  await headIs(`Removed 1 tick of Stretching on ${done.slice(8, 10)}.${done.slice(5, 7)}.${done.slice(0, 4)}.`);
  assert.equal(await full('sample_stretching'), `${stretching.full - 1}/30`);
  // a habit to avoid: a cross on a day it happened
  await page.locator('[data-cal-row="sample_soft_drink"]').click();
  const drink = hb.calendar.find((c) => c.name === 'sample_soft_drink');
  const logged = drink.days.find((d) => d.state === 'logged').day;
  assert.equal(await text(page.locator(`[data-calendar="sample_soft_drink"] [data-day="${logged}"] [data-mark]`)), '✕');
  assert.equal(await page.locator('[data-calendar]').count(), 1, 'opening another closes the first');
  await page.screenshot({ path: `${out}/habits-calendar-open-${name}-${theme}.png`, fullPage: true });
  await checkWidth(page, 'habits, after day taps');

  // a habit the read marks as not editable opens read-only, with one line why
  await standinPost('/standin/reset');
  await standinPost('/standin/locked');
  await page.reload();
  await page.locator('[data-cal-row="meds"]').click();
  assert.equal(await text(page.locator('[data-readonly]')), 'Its days cannot be changed here: this is a time, not a habit to tick.');
  assert.equal(await page.locator('[data-calendar="meds"] button').count(), 0, 'read-only: no buttons');
  assert.equal(await page.locator('[data-calendar="meds"] [data-day]').count(), 30);
  await standinPost('/standin/reset');
  await page.reload();
  await page.locator('[data-card="list"]').waitFor();
  await page.evaluate(() => (window.__noReload = true));

  // Your habits: the filter with its counts, the habits by group, the stats line, the actions as the read allows
  assert.deepEqual(await page.locator('[data-chips] a').allTextContents(), ['Tracked · 5', 'Not tracked · 27', 'Retired · 2', 'All · 34'], 'the filter with counts');
  assert.deepEqual(await rows(), sample(hb, 'tracked'), 'tracked habits');
  assert.deepEqual(await page.locator('[data-group] h3').allTextContents(), hb.list.map((g) => `${g.label} · ${g.habits.length}`), 'groups');
  const reads = page.locator('[data-habit-row="sample_reading"]');
  assert.equal(await text(reads.locator('[data-row-line]')), 'Learning · 2 times a day');
  assert.equal(await text(reads.locator('[data-row-stats]')), '20 of the last 30 days · last 16.11.');
  assert.deepEqual(await reads.locator('[data-act]').evaluateAll((els) => els.map((e) => e.getAttribute('data-act'))), ['untrack', 'edit', 'retire'], 'a habit with history: no Delete');
  assert.deepEqual(await page.locator('[data-habit-row="meds"] [data-act]').evaluateAll((els) => els.map((e) => e.getAttribute('data-act'))), ['untrack', 'edit', 'retire', 'delete']);
  assert.equal(await text(page.locator('[data-habit-row="sample_soft_drink"] [data-avoid]')), 'avoid');
  assert.equal(await text(page.locator('[data-help]')), hb.help);
  await page.locator('[data-show="untracked"]').click();
  await page.waitForURL(/\/habits\?show=untracked$/);
  await page.locator('[data-habit-row="surya_kriya"]').waitFor();
  assert.deepEqual(await rows(), sample(all, 'untracked'), 'not tracked habits');
  assert.equal(await page.evaluate(() => window.__noReload), true, 'the filter switched without a reload');
  assert.deepEqual(await page.locator('[data-habit-row="surya_kriya"] [data-act]').evaluateAll((els) => els.map((e) => e.getAttribute('data-act'))), ['track', 'edit', 'retire', 'delete']);
  await page.locator('[data-show="retired"]').click();
  await page.waitForURL(/show=retired$/);
  await page.locator('[data-habit-row="sample_piano"]').waitFor();
  assert.deepEqual(await rows(), sample(all, 'retired'));
  assert.deepEqual(await page.locator('[data-habit-row="sample_piano"] [data-act]').evaluateAll((els) => els.map((e) => e.getAttribute('data-act'))), ['edit', 'restore'], 'a retired habit: Bring back, no Track');
  await page.locator('[data-show="all"]').click();
  await page.waitForURL(/show=all$/);
  await page.locator('[data-habit-row="ayurveda"]').waitFor();
  assert.equal((await rows()).length, 34, 'all habits');
  assert.equal((await page.locator('[data-chips] a[aria-current="page"]').allTextContents()).join(), 'All · 34');
  if (name === 'phone') await page.locator('[data-card="list"]').screenshot({ path: `${out}/habits-list-all-${name}-${theme}.png` });
  await checkWidth(page, 'habits, all');
  await page.locator('[data-show="tracked"]').click();
  await page.waitForURL(/\/habits$/);
  await page.locator('[data-habit-row="meds"]').waitFor();

  // Edit: the form opens with the habit's own values; a duplicate label is refused next to the form and keeps the words
  await reads.getByRole('button', { name: 'Edit' }).click();
  const edit = page.locator('[data-edit-form="sample_reading"]');
  assert.equal(await edit.locator('input[name=label]').inputValue(), 'Reading');
  assert.equal(await edit.locator('input[name=target]').inputValue(), '2');
  assert.equal(await edit.locator('input[name=order]').inputValue(), '802');
  assert.equal(await edit.locator('select[name=aim]').inputValue(), 'do');
  await edit.locator('input[name=label]').fill('Stretching');
  await edit.locator('input[name=target]').fill('3');
  await edit.getByRole('button', { name: 'Save' }).click();
  await edit.locator('[data-refusal]').waitFor();
  assert.equal(await text(edit.locator('[data-refusal]')), 'There is already a log type called Stretching.');
  assert.equal(await edit.locator('input[name=label]').inputValue(), 'Stretching', 'the words stay');
  assert.equal(await edit.locator('input[name=target]').inputValue(), '3');
  assert.equal(await bar.count(), 0, 'a refusal is next to the form, not in the bar');
  if (name === 'phone') await reads.screenshot({ path: `${out}/habits-edit-refused-${name}-${theme}.png` });
  // a check before sending: times a day out of range
  await edit.locator('input[name=label]').fill('Reading time');
  await edit.locator('input[name=target]').fill('11');
  await edit.getByRole('button', { name: 'Save' }).click();
  assert.equal(await text(edit.locator('[data-refusal]')), 'Times a day: a whole number from 1 to 10.');
  // saved: the label and the times a day change everywhere, the row has a blue edge, and no Undo is offered
  await edit.locator('input[name=target]').fill('3');
  await edit.locator('select[name=aim]').selectOption('avoid');
  if (name === 'phone') await reads.screenshot({ path: `${out}/habits-edit-${name}-${theme}.png` });
  await edit.getByRole('button', { name: 'Save' }).click();
  await headIs('Saved the habit Reading time.');
  await edit.waitFor({ state: 'detached' });
  assert.equal(await bar.getByRole('button', { name: 'Undo' }).count(), 0, 'the list has no Undo');
  assert.equal(await text(reads.locator('[data-row-label]')), 'Reading time');
  assert.equal(await text(reads.locator('[data-row-line]')), 'Learning · 3 times a day');
  assert.equal(await reads.locator('[data-avoid]').count(), 1, 'the avoid mark');
  assert.equal(await reads.getAttribute('data-changed'), '', 'a blue edge on the changed row');
  assert.equal(await page.locator('[data-card="ticks"] [data-habit="sample_reading"]').count(), 1);
  assert.match(await text(page.locator('[data-card="ticks"] [data-habit="sample_reading"]')), /^Reading time 2\/3 avoid$/, "the ticks follow the edit");
  assert.equal(await text(doneLine), '1 of 3 done', 'a habit to avoid is not counted');
  await reads.getByRole('button', { name: 'Edit' }).click();
  await edit.locator('input[name=label]').fill('Reading');
  await edit.locator('input[name=target]').fill('2');
  await edit.locator('select[name=aim]').selectOption('do');
  await edit.getByRole('button', { name: 'Save' }).click();
  await headIs('Saved the habit Reading.');
  assert.equal(await text(doneLine), '2 of 4 done');

  // a new habit: the form with the read's group list and limits; a used name is refused and keeps the words; then it is added
  await page.locator('[data-new-habit]').click();
  const form = page.locator('[data-new-form]');
  assert.equal(await form.locator('select[name=group]').inputValue(), 'practice', 'the read\'s default group');
  assert.deepEqual(await form.locator('select[name=group] option').allTextContents(), hb.groups.map((g) => g.label));
  assert.equal(await form.locator('input[name=label]').getAttribute('maxlength'), '40');
  assert.equal(await form.locator('[data-track-now]').getAttribute('aria-checked'), 'true');
  await form.locator('input[name=label]').fill('stretching');
  await form.getByRole('button', { name: 'Add' }).click();
  await form.locator('[data-refusal]').waitFor();
  assert.equal(await text(form.locator('[data-refusal]')), 'There is already a log type called stretching.');
  assert.equal(await form.locator('input[name=label]').inputValue(), 'stretching', 'the words stay');
  if (name === 'phone') await page.screenshot({ path: `${out}/habits-new-refused-${name}-${theme}.png` });
  await form.locator('input[name=label]').fill('Evening walk');
  await form.locator('select[name=group]').selectOption('daily');
  await form.locator('input[name=target]').fill('2');
  if (name === 'phone') await page.locator('[data-card="list"]').screenshot({ path: `${out}/habits-new-${name}-${theme}.png` });
  await form.getByRole('button', { name: 'Add' }).click();
  await headIs('Added the habit Evening walk. It is tracked: tick it above or log it by its name.');
  await form.waitFor({ state: 'detached' });
  assert.equal(await bar.getByRole('button', { name: 'Undo' }).count(), 0, 'a new habit has no Undo');
  const walk = page.locator('[data-habit-row="evening_walk"]');
  assert.equal(await text(walk.locator('[data-row-line]')), 'Daily routine · 2 times a day');
  assert.equal(await walk.getAttribute('data-changed'), '');
  assert.equal(await text(walk.locator('[data-row-stats]')), 'Never ticked');
  assert.equal(await page.locator('[data-card="ticks"] [data-habit="evening_walk"]').count(), 1, 'it is on the ticks');
  assert.equal(await page.locator('[data-cal="evening_walk"]').count(), 1, 'and in the 30 days');
  assert.equal(await text(doneLine), '2 of 5 done');
  assert.deepEqual(await page.locator('[data-chips] a').allTextContents(), ['Tracked · 6', 'Not tracked · 27', 'Retired · 2', 'All · 35']);

  // Delete asks once, then sends confirmed
  await walk.getByRole('button', { name: 'Delete' }).click();
  const ask = page.locator('[data-delete-ask="evening_walk"]');
  assert.equal(await text(ask), 'Delete Evening walk? It was never ticked, so nothing is lost. This cannot be undone. Yes, delete Keep it');
  if (name === 'phone') await walk.screenshot({ path: `${out}/habits-delete-${name}-${theme}.png` });
  await ask.getByRole('button', { name: 'Keep it' }).click();
  await ask.waitFor({ state: 'detached' });
  assert.equal(await walk.count(), 1, 'Keep it keeps it');
  await walk.getByRole('button', { name: 'Delete' }).click();
  await ask.getByRole('button', { name: 'Yes, delete' }).click();
  await headIs('Deleted the habit Evening walk.');
  await walk.waitFor({ state: 'detached' });
  assert.equal(await page.locator('[data-card="ticks"] [data-habit="evening_walk"]').count(), 0);
  assert.equal(await text(doneLine), '2 of 4 done');

  // Track, Retire, Bring back
  await page.locator('[data-show="untracked"]').click();
  await page.waitForURL(/show=untracked$/);
  const cold = page.locator('[data-habit-row="sample_cold_shower"]');
  await cold.getByRole('button', { name: 'Track', exact: true }).click();
  await headIs('Now tracking Cold shower. It shows on Today and in the calendar.');
  await cold.waitFor({ state: 'detached' });
  assert.deepEqual(await page.locator('[data-chips] a').allTextContents(), ['Tracked · 6', 'Not tracked · 26', 'Retired · 2', 'All · 34']);
  assert.equal(await page.locator('[data-card="ticks"] [data-habit="sample_cold_shower"]').count(), 1);
  assert.equal(await page.locator('[data-cal="sample_cold_shower"]').count(), 1);
  await page.locator('[data-show="tracked"]').click();
  await page.waitForURL(/\/habits$/);
  const cold2 = page.locator('[data-habit-row="sample_cold_shower"]');
  await cold2.getByRole('button', { name: 'Retire' }).click();
  await headIs('Retired Cold shower. Its history stays; it is hidden everywhere. Find it under Retired to bring it back.');
  await cold2.waitFor({ state: 'detached' });
  await page.locator('[data-show="retired"]').click();
  await page.waitForURL(/show=retired$/);
  const cold3 = page.locator('[data-habit-row="sample_cold_shower"]');
  await cold3.getByRole('button', { name: 'Bring back' }).click();
  await headIs('Brought back Cold shower (tracked again).');
  await cold3.waitFor({ state: 'detached' });
  await page.locator('[data-show="tracked"]').click();
  await page.waitForURL(/\/habits$/);
  await page.locator('[data-habit-row="meds"]').getByRole('button', { name: 'Untrack' }).click();
  await headIs('Stopped tracking Medication. Its history stays and you can still log it in the chat.');
  await page.locator('[data-habit-row="meds"]').waitFor({ state: 'detached' });
  assert.equal(await page.evaluate(() => window.__noReload), true, 'the saves changed the page in place');
  await checkWidth(page, 'habits, after the list saves');

  // the settings line, and the links back: Today and the Health page's last line
  assert.equal(await text(page.locator('[data-settings-line]')), "Hiding habits on Today, their order and the reminders stay in app.'s Settings.");
  assert.match(await page.locator('[data-settings-line] a').getAttribute('href'), /\/web\/settings\?tab=today$/);
  await page.goto(`${base}/health`);
  await page.locator('[data-charts]').waitFor();
  await page.locator('[data-habits-link]').click();
  await page.waitForURL(/\/habits$/);
  await page.locator('[data-card="ticks"]').waitFor();
  await page.getByRole('link', { name: '‹ Today' }).click();
  await page.waitForURL(`${base}/`);
  await standinPost('/standin/reset');
}

async function checkWidth(page, what) {
  const sideways = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(sideways <= 0, `${what}: no sideways scroll (${sideways} px too wide)`);
  if (page.viewportSize().width >= 1100) return;
  const small = await page.evaluate(() =>
    [...document.querySelectorAll('button, input:not([type=hidden]), select, textarea, a')]
      .filter((e) => {
        const r = e.getBoundingClientRect();
        if (!r.width || !r.height || e.closest('[aria-hidden=true], .sr-only') || getComputedStyle(e).visibility === 'hidden') return false;
        // a link inside a sentence is a word of the text, not a target of its own
        if (e.tagName === 'A' && e.parentElement && e.parentElement.tagName === 'P' && e.parentElement.textContent.trim() !== e.textContent.trim()) return false;
        return r.height < 43.5;
      })
      .map((e) => `${e.tagName.toLowerCase()} "${(e.textContent || e.getAttribute('aria-label') || e.getAttribute('name') || '').trim().slice(0, 30)}" ${Math.round(e.getBoundingClientRect().height)} px`),
  );
  for (const x of small) smallTargets.add(`${page.viewportSize().width} px, ${what}: ${x}`);
}
// Collected over the whole run and checked at the end, so one run lists them all.
const smallTargets = new Set();
// SHOOT_ONLY=habits runs only that page's checks (a shortcut while building; the full run has no filter).
const only = (k) => !process.env.SHOOT_ONLY || process.env.SHOOT_ONLY === k;

const browser = await chromium.launch();
const sizes = { phone: { width: 390, height: 844 }, tablet: { width: 800, height: 1100 }, pc: { width: 1280, height: 800 } };

for (const theme of ['dark', 'light']) {
  for (const [name, viewport] of Object.entries(sizes)) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: name === 'phone' ? 2 : 1 });
    // no speech recognition unless a check asks for a stand-in one (deploy 90): the microphone button shows only where it is
    await context.addInitScript(() => {
      delete window.SpeechRecognition;
      delete window.webkitSpeechRecognition;
      try {
        if (sessionStorage.getItem('test-speech') !== '1') return;
      } catch {
        return; // about:blank has no storage
      }
      window.SpeechRecognition = class {
        start() {
          setTimeout(() => {
            this.onresult?.({ results: [[{ transcript: '40 g radishes' }]] });
            this.onend?.();
          }, 50);
        }
        stop() {
          this.onend?.();
        }
      };
    });
    if (theme === 'light') await context.addInitScript(() => localStorage.setItem('logger-theme', 'light'));
    const page = await context.newPage();
    await standinPost('/standin/reset');
    await page.goto(`${base}/`);
    await page.screenshot({ path: `${out}/signin-${name}-${theme}.png` });
    await checkWidth(page, 'sign-in');
    await page.fill('#password', 'nope');
    await page.fill('#code', '000000');
    await page.click('button[type=submit]');
    await page.getByText('Wrong password or code.').waitFor();
    if (name === 'phone') await page.screenshot({ path: `${out}/signin-wrong-${name}-${theme}.png` });
    await signIn(page);
    await page.screenshot({ path: `${out}/today-${name}-${theme}.png`, fullPage: true });
    if (only('today')) await checkToday(page, name);
    await checkWidth(page, 'today');
    if (only('saves')) {
      await checkSaves(page, name, theme);
      console.log(`saves ${name} ${theme}: checks passed`);
    }
    if (only('logbox')) {
      await checkLogBox(page, name, theme);
      console.log(`logging box ${name} ${theme}: checks passed`);
    }
    if (only('food')) {
      await checkFood(page, name, theme);
      console.log(`food day ${name} ${theme}: checks passed`);
    }
    if (only('usual')) {
      await checkUsual(page, name, theme);
      console.log(`usual meals ${name} ${theme}: checks passed`);
    }
    if (only('scan')) {
      await checkScan(page, name, theme);
      console.log(`scan sheet, look it up, microphone ${name} ${theme}: checks passed`);
    }
    if (only('health')) {
      await checkHealth(page, name, theme);
      console.log(`health page, body measurements ${name} ${theme}: checks passed`);
    }
    if (only('habits')) {
      await checkHabits(page, name, theme);
      console.log(`habits page ${name} ${theme}: checks passed`);
    }
    if (only('problems')) {
      await checkProblems(page, name, theme);
      console.log(`core down, door off, next ${name} ${theme}: checks passed`);
    }
    if (name === 'phone' && theme === 'dark') {
      await page.getByRole('button', { name: 'Sign out' }).click();
      await page.getByRole('button', { name: 'Sign in' }).waitFor();
      console.log('sign-out: back on the sign-in page');
    }
    await context.close();
    console.log(`today ${name} ${theme}: checks passed`);
  }
}
await browser.close();
assert.deepEqual([...smallTargets], [], 'tap targets under 44 px on phones and tablets');
console.log(`screenshots in ${out}`);

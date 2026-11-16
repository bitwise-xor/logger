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
  needs: String(day.needs.questions.length + day.needs.not_read.length + day.needs.review.length + (day.needs.checkin ? 1 : 0)),
  water: `${grouped(day.water.ml)} / ${grouped(day.water.target_ml)} ml`,
  mealLabels: day.energy.meals.map((m) => m.label.toUpperCase()),
  foodRefs: day.rows.filter((r) => r.kind === 'food').map((r) => r.ref),
  hiddenRefs: day.rows.filter((r) => r.kind !== 'food' && ['bed', 'wake', 'weight', 'blood_sugar', 'bp'].includes(r.type)).map((r) => r.ref),
  health: day.health.map((h) => h.row),
  gratitude: `${day.gratitude.count}/${day.gratitude.goal}`,
};

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
  assert.equal(await page.getByRole('link', { name: 'Barcode and label: full app' }).count(), 1, 'the link to the full app');
  const rest = await box.boundingBox();
  assert.ok(rest.height >= 66 && rest.height <= 72, `the box is two lines tall at rest (${rest.height} px)`);
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
    const last = await page.getByRole('link', { name: 'Usual meals: full app' }).boundingBox();
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

/** No sideways scroll, and on phones and tablets every button, field and link that stands alone at least 44 px tall. */
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

const browser = await chromium.launch();
const sizes = { phone: { width: 390, height: 844 }, tablet: { width: 800, height: 1100 }, pc: { width: 1280, height: 800 } };

for (const theme of ['dark', 'light']) {
  for (const [name, viewport] of Object.entries(sizes)) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: name === 'phone' ? 2 : 1 });
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
    await checkToday(page, name);
    await checkWidth(page, 'today');
    await checkSaves(page, name, theme);
    console.log(`saves ${name} ${theme}: checks passed`);
    await checkLogBox(page, name, theme);
    console.log(`logging box ${name} ${theme}: checks passed`);
    await checkFood(page, name, theme);
    console.log(`food day ${name} ${theme}: checks passed`);
    await checkProblems(page, name, theme);
    console.log(`core down, door off, next ${name} ${theme}: checks passed`);
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

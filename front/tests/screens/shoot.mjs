// Page tests and screenshots of the running front end, at phone (390 px) and PC (1280 px) width, dark and light.
// Runs in the pinned Playwright container (tools/front-screens), against a front end that talks to the stand-in door
// (tests/standin/door.mjs: password "test", code "123456"; GET /day answers with tests/samples/day.json, a real door answer).
// Step C: the taps save in place: each save changes the page without a reload, a new row gets a blue edge, the answer bar shows
// the head and Undo, a read-back is confirmed, and a tap that met a gone session is sent again after the sign-in.
// Step D: the logging box: a line is "being read" (a blue row), then saved with a new row and Undo, asks a question (Correct it
// puts the words back in the box), is read back first, answers a look-up, is held under Needs you, or is "Saved privately."
// and nothing else; a line that met a gone session is sent again after the sign-in, one kept too long comes back into the box.
// Every check throws on a failure, so the script ends with an error.
// Usage: node tests/screens/shoot.mjs <base url> <out dir> <stand-in url>
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync } from 'node:fs';
import { chromium } from 'playwright-core';

const [base = 'http://localhost:3000', out = 'tests/screens/out', standin = 'http://localhost:8099'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const day = JSON.parse(readFileSync(new URL('../samples/day.json', import.meta.url), 'utf8')).day;

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
  if (name === 'phone') {
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

const browser = await chromium.launch();
const sizes = { phone: { width: 390, height: 844 }, pc: { width: 1280, height: 800 } };

for (const theme of ['dark', 'light']) {
  for (const [name, viewport] of Object.entries(sizes)) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: name === 'phone' ? 2 : 1 });
    if (theme === 'light') await context.addInitScript(() => localStorage.setItem('logger-theme', 'light'));
    const page = await context.newPage();
    await standinPost('/standin/reset');
    await page.goto(`${base}/`);
    await page.screenshot({ path: `${out}/signin-${name}-${theme}.png` });
    await page.fill('#password', 'nope');
    await page.fill('#code', '000000');
    await page.click('button[type=submit]');
    await page.getByText('Wrong password or code.').waitFor();
    if (name === 'phone') await page.screenshot({ path: `${out}/signin-wrong-${name}-${theme}.png` });
    await signIn(page);
    await page.screenshot({ path: `${out}/today-${name}-${theme}.png`, fullPage: true });
    await checkToday(page, name);
    await checkSaves(page, name, theme);
    console.log(`saves ${name} ${theme}: checks passed`);
    await checkLogBox(page, name, theme);
    console.log(`logging box ${name} ${theme}: checks passed`);
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
console.log(`screenshots in ${out}`);

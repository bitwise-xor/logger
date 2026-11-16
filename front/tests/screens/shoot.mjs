// Page tests and screenshots of the running front end, at phone (390 px) and PC (1280 px) width, dark and light.
// Runs in the pinned Playwright container (tools/front-screens), against a front end that talks to the stand-in door
// (tests/standin/door.mjs: password "test", code "123456"; GET /day answers with tests/samples/day.json, a real door answer).
// Every check throws on a failure, so the script ends with an error. Usage: node tests/screens/shoot.mjs <base url> <out dir>
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync } from 'node:fs';
import { chromium } from 'playwright-core';

const [base = 'http://localhost:3000', out = 'tests/screens/out'] = process.argv.slice(2);
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

const browser = await chromium.launch();
const sizes = { phone: { width: 390, height: 844 }, pc: { width: 1280, height: 800 } };

for (const theme of ['dark', 'light']) {
  for (const [name, viewport] of Object.entries(sizes)) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: name === 'phone' ? 2 : 1 });
    if (theme === 'light') await context.addInitScript(() => localStorage.setItem('logger-theme', 'light'));
    const page = await context.newPage();
    await page.goto(`${base}/`);
    await page.screenshot({ path: `${out}/signin-${name}-${theme}.png` });
    await page.fill('#password', 'nope');
    await page.fill('#code', '000000');
    await page.click('button[type=submit]');
    await page.getByText('Wrong password or code.').waitFor();
    if (name === 'phone') await page.screenshot({ path: `${out}/signin-wrong-${name}-${theme}.png` });
    await page.fill('#password', 'test');
    await page.fill('#code', '123 456');
    await page.click('button[type=submit]');
    await page.getByRole('heading', { name: 'Today', exact: true }).waitFor();
    await page.screenshot({ path: `${out}/today-${name}-${theme}.png`, fullPage: true });
    await checkToday(page, name);
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

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
// back by Undo, an unknown food refused, the day switch, and "+ Add food" leading to the box.
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
// Deploy 96: the Gym's Workout page, Today's Gym card and the Spaces menu (checkGym says what), and on the Habits page the open
// calendar not covered by the answer bar after a tick, and the line under the filter worded for this page.
// Deploy 97: the Gym's other five parts, Plan, Exercises, Progress, Activity and History (checkGymParts says what).
// Deploy 99: Home's Now and Pick pages with the timer, Today's Home card and Home in the Spaces menu (checkHome says what).
// Deploy 102: Trends' Week tab with the Week review and the Trends tab live (checkTrends says what), and on the Habits page the open
// calendar's last week reachable above the answer bar at every width.
// Deploy 105: Library at logger. (checkLibrary and checkLibraryTabs say what): the Library tab live, Foods (search, chips, the order,
// a food opened under its row or beside the list, values read back and confirmed, refusals next to their form, words, a unit, Looks
// right, Hide, a new food through the look-up), Usual meals moved under Library (/food/usual redirects), Habits and Exercises tabs.
// Deploy 106: Medical at logger. (checkMedicalPlace, checkMedicalReports, checkMedicalTests and checkMedicalMeds say what): Medical a live
// Space (rail, /more, the More tab lit), Reports, Tests over time and Medication with their saves in place; Medical no longer in the footer.
// Deploy 108: More's own page and Search, Recent and Usage (checkMoreHome, checkSearch, checkRecent and checkUsage say what): the field, the rows
// (Coach and Settings still at app.), the Words, Sign out; Search's five groups and where each row leads (also an older workout by the door's w);
// Recent with a private entry showing no words, the not-read line, Use again into Today's box and Open day; Usage's three ranges, the stacked
// bars, By kind and the costly messages; More lit under every one of them.
// Deploy 109: More's Coach page and Today's Coach card (checkCoach and checkCoachToday say what): the list and its chips, a day and a week
// coaching open with their parts, "Coach a day" in its four states and its date field, the press sent once and never again by itself,
// a refusal in the answer bar, Today's card in its states and absent when the door says null, Trends' links; More's Coach row opens it.
// Deploy 111: Settings at logger. (checkSettings and checkSettingsLinks say what): the seven tabs read and saved in place (a save and a
// refusal on each, the Today page's switch, arrows and reset, a device signed out and all others, a device's notifications off with the
// "twice" line, the test, the nudges, the export's ZIP and its headers), the links that left app. (More, Habits, Library, Health, Your
// goals, the sign-in line), no footer line anywhere, and Today following the To review and Gratitude switches.
// Deploy 112: the home-screen app and "This device" (checkThisDevice says what): the manifest, icons and worker served signed out with
// their types, the head tags, the manifest read by the browser and the real /sw.js registered under the real CSP, no worker before a
// press; the card with the browser's parts stubbed: off, Turn on (in order), on with "this device" and the twice line, Turn off; blocked;
// the iPhone hint; the door's refusal leaving the device off and the subscription ended; the server without a key.
// Deploy 117: Today (checkTodayParts says what): a food is one line with its numbers under its meal's totals, a food row opens in place with
// the Food day's editor (a change, a read-back confirmed, a delete with Undo), an Again chip's amount and a usual meal's "…" open their
// boxes (logged with another amount and time, or only some foods), the logging box's food suggestions after two letters (arrows, Enter,
// a click, Escape; none when they cannot be read), and the order of the cards on phones and the PC.
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
const GYM = JSON.parse(readFileSync(new URL('../samples/gym.json', import.meta.url), 'utf8'));
const HOME = JSON.parse(readFileSync(new URL('../samples/home.json', import.meta.url), 'utf8'));
const WEEK = JSON.parse(readFileSync(new URL('../samples/week.json', import.meta.url), 'utf8'));
const FOODTRENDS = JSON.parse(readFileSync(new URL('../samples/food_trends.json', import.meta.url), 'utf8'));
const INSIGHTS = JSON.parse(readFileSync(new URL('../samples/insights.json', import.meta.url), 'utf8')).insights.insights;
const CAT = JSON.parse(readFileSync(new URL('../samples/catalogue.json', import.meta.url), 'utf8'));
const LABS = JSON.parse(readFileSync(new URL('../samples/labs.json', import.meta.url), 'utf8'));
const SETTINGS = JSON.parse(readFileSync(new URL('../samples/settings.json', import.meta.url), 'utf8'));

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
// deploy 117: a meal's totals in four columns with their letters; a food's as plain numbers in the same columns
const mealCols = (x) => [`P ${grouped(x.protein)}`, `F ${grouped(x.fat)}`, `C ${grouped(x.carbs)}`, `${grouped(x.kcal)} kcal`];
const rowCols = (x) => [grouped(x.protein), grouped(x.fat), grouped(x.carbs), grouped(x.kcal)];

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
  // deploy 117: each food one line (a button that opens it), its numbers in the four columns under its meal's totals
  const cells = async (loc) => loc.locator(':scope > span').evaluateAll((els) => els.map((e) => e.firstChild?.textContent?.trim() ?? ''));
  for (const r of day.rows.filter((x) => x.kind === 'food')) {
    const row = page.locator(`[data-row="${r.ref}"]`);
    assert.deepEqual(await cells(row.locator('[data-row-cols]')), rowCols(r.nutrients), `numbers of ${r.ref}`);
    assert.equal(await row.locator('button[aria-expanded="false"]').count(), 1, `${r.ref}: a button that opens it`);
    assert.equal(await row.locator('a').count(), 0, `${r.ref}: no link to the Food day any more`);
  }
  const mealCells = await page.locator('[data-meal-cols]').evaluateAll((els) => els.map((e) => [...e.children].map((c) => c.textContent.trim())));
  for (const m of day.energy.meals) assert.ok(mealCells.some((c) => JSON.stringify(c) === JSON.stringify(mealCols(m.nutrients))), `totals of ${m.label}`);
  // the columns stand under the meal's: each number's right edge where its total's is
  const edges = await page.evaluate(() => {
    const right = (el) => [...el.children].map((c) => Math.round(c.getBoundingClientRect().right));
    return { meal: right(document.querySelector('[data-meal-cols]')), rows: [...document.querySelectorAll('[data-row-cols]')].map(right) };
  });
  for (const r of edges.rows) r.forEach((x, i) => assert.ok(Math.abs(x - edges.meal[i]) <= 1, `column ${i} lines up (${x} / ${edges.meal[i]})`));
  // the card order (the owner, 17.11.2026)
  const cards = ['needs', 'energy', 'chips', 'timeline', 'habits', 'health', 'gym', 'home', 'coach', 'gratitude'];
  const at = {};
  for (const c of cards) at[c] = await page.locator(`[data-card="${c}"]`).first().boundingBox();
  for (const c of cards) assert.ok(at[c], `card ${c} shown`);
  if (name === 'pc') {
    const right = ['needs', 'energy', 'habits', 'health', 'gym', 'home', 'coach', 'gratitude'];
    for (let i = 1; i < right.length; i++) assert.ok(at[right[i]].y > at[right[i - 1]].y && Math.abs(at[right[i]].x - at.needs.x) < 2, `PC: ${right[i]} under ${right[i - 1]} on the right`);
    assert.ok(Math.abs(at.chips.x - at.timeline.x) < 2 && at.timeline.y > at.chips.y && at.chips.x < at.needs.x, 'PC: the chips and the day on the left');
  } else {
    for (let i = 1; i < cards.length; i++) assert.ok(at[cards[i]].y > at[cards[i - 1]].y, `phone: ${cards[i]} after ${cards[i - 1]}`);
  }
  // two habits per row
  const habits = await page.locator('[data-habit]').evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => ({ x: r.x, y: r.y })));
  if (habits.length >= 2) assert.ok(Math.abs(habits[0].y - habits[1].y) < 2 && habits[1].x > habits[0].x + 40, 'two habits per row');
  if (name === 'pc') {
    assert.ok(timeline.x < 260 && timeline.width > 600, `PC: the day is wide and starts at the rail (x ${timeline.x}, ${timeline.width} px)`);
    assert.ok(Math.abs(needs.width - 340) < 2, 'PC: the right column is 340 px');
  }
  else assert.ok(needs.y < timeline.y && Math.abs(needs.x - timeline.x) < 2, 'phone: one column, Needs you first');
}

/**
 * Deploy 117: Today's food rows open in place (the Food day's editor: a change with the blue edge, a read-back confirmed, the note from
 * the entry, a delete and its Undo), the chips' boxes (an Again chip's amount, a usual meal's "…"), the logging box's suggestions.
 */
async function checkTodayParts(page, name, theme) {
  await standinPost('/standin/reset');
  await page.goto(`${base}/`);
  await page.getByRole('heading', { name: 'Today', exact: true }).waitFor();
  await page.evaluate(() => (window.__noReload = true));
  const bar = page.locator('[data-bar]');
  const head = bar.locator('[data-bar-head]');
  const row = (ref) => page.locator(`[data-row="${ref}"]`);
  const line = (ref) => row(ref).locator('button[aria-expanded]').first();
  const editor = (ref) => page.locator(`[data-food-editor="${ref}"]`);
  const kcal = async (ref) => row(ref).locator('[data-kcal]').evaluate((e) => e.firstChild.textContent.trim()); // without its sr-only " kcal"

  // a food row opens in place (a button, aria-expanded), one at a time; a second tap closes it
  const soup = day.rows.find((r) => r.food === 'Lentil soup');
  const noted = foodDay.rows.find((r) => r.note);
  await line(soup.ref).click();
  await editor(soup.ref).waitFor();
  assert.equal(await line(soup.ref).getAttribute('aria-expanded'), 'true', 'the row says it is open');
  assert.equal(page.url(), `${base}/`, 'it opens on Today');
  // Today's rows carry no note: it comes with the entry
  if (noted.ref === soup.ref) {
    await page.waitForFunction((ref) => document.querySelector(`[data-food-editor="${ref}"] input[name=note]`)?.value !== '', soup.ref);
    assert.equal(await editor(soup.ref).locator('input[name=note]').inputValue(), noted.note, 'the note from the entry');
    await editor(soup.ref).getByRole('button', { name: 'Remove' }).waitFor();
  }
  await editor(soup.ref).scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${out}/today-row-open-${name}-${theme}.png` });
  await checkWidth(page, 'today, a food row open');
  const bread = day.rows.find((r) => r.food === 'Rye bread');
  await line(bread.ref).click();
  await editor(bread.ref).waitFor();
  assert.equal(await editor(soup.ref).count(), 0, 'one row open at a time');
  await line(bread.ref).click();
  await editor(bread.ref).waitFor({ state: 'detached' });

  // changed: saved in place, the row closed with a blue edge, its numbers moved, Undo in the bar
  await line(soup.ref).click();
  await editor(soup.ref).locator('input[name=amount]').fill(String(soup.amount / 2));
  await editor(soup.ref).getByRole('button', { name: 'Save', exact: true }).click();
  await page.locator(`[data-row="${soup.ref}"][data-fresh]`).waitFor();
  assert.equal(await text(head), `Changed ${soup.food}.`, 'Today: the change\'s head');
  await bar.getByRole('button', { name: 'Undo' }).waitFor();
  assert.equal(await editor(soup.ref).count(), 0, 'the row closed after the change');
  assert.equal(await kcal(soup.ref), grouped(soup.nutrients.kcal / 2), 'its kcal halved');
  // an odd amount is read back in Today's answer bar; Yes makes it
  await line(soup.ref).click();
  await editor(soup.ref).locator('input[name=amount]').fill('2500');
  await editor(soup.ref).getByRole('button', { name: 'Save', exact: true }).click();
  const yes = page.locator('[data-bar="warning"]').getByRole('button', { name: 'Yes, change' });
  await yes.waitFor();
  await yes.click();
  await head.getByText(`Changed ${soup.food}.`).waitFor();
  const big = Number((await kcal(soup.ref)).replace(/,/g, ''));
  assert.ok(Math.abs(big - (soup.nutrients.kcal / soup.amount) * 2500) <= 2, `the confirmed amount (${big} kcal)`);
  // deleted, then back with Undo
  const fruit = day.rows.find((r) => r.food === 'Fruit bar');
  await line(fruit.ref).click();
  await editor(fruit.ref).getByRole('button', { name: 'Delete' }).click();
  await row(fruit.ref).waitFor({ state: 'detached' });
  assert.equal(await text(head), `Deleted ${fruit.food}.`, 'Today: the delete\'s head');
  await bar.getByRole('button', { name: 'Undo' }).click();
  await page.locator(`[data-row="${fruit.ref}"][data-fresh]`).waitFor();

  // an Again chip: its name logs at once (checkSaves), its amount opens a box with − and +, a time, Log and Cancel
  const chip = day.chips.again.find((c) => c.name === 'Rye bread');
  const amountPart = page.locator(`[data-chip="a${chip.food_id}"] [data-chip-amount]`);
  assert.equal(await amountPart.getAttribute('aria-label'), `Change the amount of ${chip.name}`);
  const sizes = await page.locator(`[data-chip="a${chip.food_id}"] button`).evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => [r.width, r.height]));
  if (name !== 'pc') assert.ok(sizes.every(([, h]) => h >= 43.5) && sizes[1][0] >= 43.5, `the chip's two parts are 44 px targets (${JSON.stringify(sizes)})`);
  await amountPart.click();
  const again = page.locator('[data-chip-box="again"]');
  await again.waitFor();
  assert.equal(await amountPart.getAttribute('aria-expanded'), 'true');
  assert.equal(await again.locator('input[name=amount]').inputValue(), String(chip.amount), 'the amount eaten last');
  await again.getByRole('button', { name: 'More' }).click();
  assert.equal(await again.locator('input[name=amount]').inputValue(), String(chip.amount + 5), '+ adds 5 g');
  await again.locator('input[name=time]').fill('07:15');
  await again.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${out}/today-again-box-${name}-${theme}.png` });
  await checkWidth(page, 'today, an Again box open');
  // one box at a time: the usual meal's opens in its place
  const usual = day.chips.usual[0];
  await page.locator(`[data-chip="u${usual.meal_id}"] [data-chip-more]`).click();
  await page.locator('[data-chip-box="usual"]').waitFor();
  assert.equal(await again.count(), 0, 'one box at a time');
  await page.locator(`[data-chip="u${usual.meal_id}"] [data-chip-more]`).click();
  await page.locator('[data-chip-box="usual"]').waitFor({ state: 'detached' });
  await amountPart.click();
  await again.getByRole('button', { name: 'More' }).click();
  await again.locator('input[name=time]').fill('07:15');
  await again.getByRole('button', { name: 'Log' }).click();
  await again.waitFor({ state: 'detached' });
  const logged = page.locator('[data-fresh]', { hasText: chip.name });
  await logged.waitFor();
  assert.match(await text(logged), new RegExp(`^07:15 ${chip.name} ${chip.amount + 5} g`), 'logged with the amount and time of the box');

  // a usual meal's "…": every food ticked with its amount, what the ticked ones become, Log only with something to log
  const more = page.locator(`[data-chip="u${usual.meal_id}"] [data-chip-more]`);
  await more.click();
  const ub = page.locator('[data-chip-box="usual"]');
  await ub.waitFor();
  const [first, second] = usual.items;
  const item = (i) => ub.locator(`[data-chip-item="${i.item_id}"]`);
  const sum = (xs) => xs.reduce((a, x) => ({ kcal: a.kcal + x.kcal, protein: a.protein + x.protein, fat: a.fat + x.fat, carbs: a.carbs + x.carbs }), { kcal: 0, protein: 0, fat: 0, carbs: 0 });
  const said = (x) => `${grouped(x.kcal)} kcal · P ${grouped(x.protein)} · F ${grouped(x.fat)} · C ${grouped(x.carbs)} g`;
  assert.equal(await text(ub.locator('[data-chip-becomes]')), said(sum(usual.items.map((i) => i.nutrients))), 'the whole meal');
  await item(second).locator('input[type=checkbox]').uncheck();
  assert.ok(await item(second).locator('input[name=amount]').isDisabled(), 'an unticked food: its amount is off');
  await item(first).locator('input[name=amount]').fill(String(first.amount * 1.5));
  const k = 1.5;
  assert.equal(await text(ub.locator('[data-chip-becomes]')), said({ kcal: first.nutrients.kcal * k, protein: first.nutrients.protein * k, fat: first.nutrients.fat * k, carbs: first.nutrients.carbs * k }), 'scaled, the unticked left out');
  await item(first).locator('input[type=checkbox]').uncheck();
  assert.ok(await ub.getByRole('button', { name: 'Log' }).isDisabled(), 'nothing ticked: Log is off');
  await item(first).locator('input[type=checkbox]').check();
  await item(first).locator('input[name=amount]').fill('0');
  assert.ok(await ub.getByRole('button', { name: 'Log' }).isDisabled(), 'an amount of 0: Log is off');
  await item(first).locator('input[name=amount]').fill(String(first.amount * 1.5));
  await ub.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${out}/today-usual-box-${name}-${theme}.png` });
  await checkWidth(page, 'today, a usual meal box open');
  const freshBefore = await page.locator('[data-row]').count();
  await ub.getByRole('button', { name: 'Log' }).click();
  await ub.waitFor({ state: 'detached' });
  await page.locator('[data-fresh]', { hasText: first.food }).waitFor();
  assert.equal(await page.locator('[data-fresh]').count(), 1, 'only the ticked food was logged');
  assert.equal(await page.locator('[data-row]').count(), freshBefore + 1);
  assert.match(await text(page.locator('[data-fresh]')), new RegExp(`${first.food} ${first.amount * 1.5} g`), 'at its new amount');

  // the logging box's suggestions: after two letters of the part typed, a listbox (above the box on phones, under it on the PC)
  const box = page.locator('#log-text');
  const list = page.locator('[data-suggest]');
  await box.click();
  await page.waitForTimeout(300); // the foods are read on the first focus
  await box.pressSequentially('o');
  await page.waitForTimeout(200);
  assert.equal(await list.count(), 0, 'one letter: no suggestions');
  await box.pressSequentially('a');
  await list.waitFor();
  assert.equal(await box.getAttribute('aria-expanded'), 'true');
  const options = list.locator('[role=option]');
  assert.ok((await options.count()) >= 2 && (await options.count()) <= 6, 'up to 6');
  const names = (await options.locator('b').allTextContents()).map((x) => x.toLowerCase());
  assert.ok(names.every((x) => x.split(/[\s,()/-]+/).some((w) => w.startsWith('oa')) || x.includes('oa')), 'each has the letters');
  const listBox = await list.boundingBox();
  const boxBox = await box.boundingBox();
  if (name === 'pc') assert.ok(listBox.y >= boxBox.y + boxBox.height - 1, 'PC: under the box');
  else {
    assert.ok(listBox.y + listBox.height <= (await page.locator('[data-logbox]').boundingBox()).y + 1 && listBox.y >= 0, 'phone: above the box, in view');
  }
  await page.screenshot({ path: `${out}/today-suggest-${name}-${theme}.png` });
  await checkWidth(page, 'today, suggestions');
  // the arrows mark one, Enter picks it: its name and the amount eaten last, the cursor after it
  await box.press('ArrowDown');
  assert.equal(await options.first().getAttribute('aria-selected'), 'true');
  assert.equal(await box.getAttribute('aria-activedescendant'), 'log-suggest-0');
  const want0 = `${(await text(options.first().locator('b')))} ${await text(options.first().locator('span').last())}`.trim();
  await box.press('Enter');
  await list.waitFor({ state: 'detached' });
  assert.equal(await box.inputValue(), want0, 'Enter picks the marked one');
  assert.equal(await page.evaluate(() => document.getElementById('log-text').selectionStart), want0.length, 'the cursor after it');
  // after a comma the next part; a click picks without the box losing the focus; Escape closes
  await box.pressSequentially(', 150 g sk');
  await list.waitFor();
  const want1 = `${(await text(options.first().locator('b')))} ${await text(options.first().locator('span').last())}`.trim();
  await options.first().click();
  assert.equal(await box.inputValue(), `${want0}, ${want1}`, 'a click replaces the part typed, its amount too');
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'log-text', 'the box keeps the focus');
  await box.pressSequentially(' and ry');
  await list.waitFor();
  await box.press('Escape');
  await list.waitFor({ state: 'detached' });
  // Enter with none marked sends the line as before (and closes the list)
  await box.fill('');
  await box.pressSequentially('40 g radishes, ap');
  await list.waitFor();
  await box.press('Enter');
  await list.waitFor({ state: 'detached' });
  await page.locator('[data-reading]').first().waitFor({ state: 'detached' });
  assert.equal(await box.inputValue(), '', 'sent');

  // the foods cannot be read: no suggestions, nothing said
  await standinPost('/standin/suggest-off');
  await page.reload();
  await box.click();
  await page.waitForTimeout(300);
  await box.pressSequentially('oa');
  await page.waitForTimeout(300);
  assert.equal(await list.count(), 0, 'no suggestions when they cannot be read');
  assert.equal(await page.locator('[data-bar="warning"]').count(), 0, 'and nothing said');
  await box.fill('');
  await standinPost('/standin/reset');
  await page.goto(`${base}/`);
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
    const last = await page.locator('main').last().boundingBox(); // deploy 111: the page's last part (no footer line any more)
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

  // a row opened by its address (?open=, as a To review row's Change leads here)
  const apple = foodDay.rows.find((r) => r.food.startsWith('Apple'));
  await page.goto(`${base}/food?open=${apple.ref}`);
  await editor(apple.ref).waitFor();

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
  await page.waitForURL(/\/library\/usual$/); // deploy 105: under Library
  await page.locator('[data-tab="usual"][aria-current="page"]').waitFor();
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
  await page.goto(`${base}/food`); // deploy 105: the usual meals are under Library, with no back link to the Food day
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
  await page.waitForURL(/\/library\/usual$/);
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
  if (!pc) {
    // deploy 96: the calendar's last week just above the tab bar, so the answer bar of the tick would cover its lower weeks
    await cal.evaluate((e) => window.scrollBy(0, e.getBoundingClientRect().bottom - (window.innerHeight - 60)));
  }
  await cell.click();
  await cell.locator('[data-mark]', { hasText: '1/2' }).waitFor();
  if (!pc) {
    await bar.waitFor();
    await page.waitForFunction(() => {
      const c = document.querySelector('[data-calendar="sample_reading"]').getBoundingClientRect();
      const b = document.querySelector('[data-bar]').getBoundingClientRect();
      return c.bottom <= b.top + 1 && c.top >= 0;
    }, null, { timeout: 3000 });
    await page.screenshot({ path: `${out}/habits-calendar-tick-${name}-${theme}.png` });
  }
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
  // deploy 102: with the answer bar showing, the open calendar's last week can always be scrolled clear of it (the page leaves room
  // for the bar at every width: --dock on phones and tablets, a spacer on the PC)
  await bar.waitFor();
  for (const at of ['end', 'calendar']) {
    await page.evaluate((a) => {
      if (a === 'end') window.scrollTo(0, document.documentElement.scrollHeight);
      else {
        const cells = [...document.querySelectorAll('[data-calendar] [data-day]')];
        const r = cells.at(-1).getBoundingClientRect();
        const b = document.querySelector('[data-bar]').getBoundingClientRect();
        window.scrollBy(0, r.bottom - b.top + 8); // the last week as low as it can be while above the bar
      }
    }, at);
    await page.waitForTimeout(200);
    const reach = await page.evaluate(() => {
      const cells = [...document.querySelectorAll('[data-calendar] [data-day]')];
      const r = cells.at(-1).getBoundingClientRect();
      const b = document.querySelector('[data-bar]').getBoundingClientRect();
      return { ok: r.right <= b.left || r.left >= b.right || r.bottom <= b.top + 1, row: Math.round(r.bottom), bar: Math.round(b.top) };
    });
    assert.ok(reach.ok, `${name}: the calendar's last week is not under the answer bar (${at}: row ends ${reach.row}, bar at ${reach.bar})`);
  }
  if (name === 'phone') await page.screenshot({ path: `${out}/habits-calendar-reach-${name}-${theme}.png` });
  assert.equal(await page.evaluate(() => /calendar below/.test(document.body.innerText)), false, 'no "in the calendar below" on this page');

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
  // deploy 96: app.'s "in the calendar below" worded for this page, where the calendar is the Last 30 days card
  assert.equal(await text(page.locator('[data-help]')), hb.help.replace('in the calendar below', 'in Last 30 days'));
  assert.ok(!(await text(page.locator('[data-help]'))).includes('below'), 'no "below" in the line');
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
  assert.equal(await text(page.locator('[data-settings-line]')), 'Hiding habits on Today and their order are in Settings; the reminders too (Notifications).');
  assert.equal(await page.locator('[data-settings-line] a').getAttribute('href'), '/settings/today', 'deploy 111: Settings is here');
  await page.goto(`${base}/health`);
  await page.locator('[data-charts]').waitFor();
  await page.locator('[data-habits-link]').click();
  await page.waitForURL(/\/habits$/);
  await page.locator('[data-card="ticks"]').waitFor();
  await page.getByRole('link', { name: '‹ Today' }).click();
  await page.waitForURL(`${base}/`);
  await standinPost('/standin/reset');
}

/**
 * Deploy 96: the Gym's Workout page (/gym) from Today's Gym card: the read against the gym sample (title, status, chips, why, the
 * rows in order with their numbers, "+5 kg", the Last lines, Other exercises folded, This week's split, the last 4 weeks), one tap
 * logging a row (blue edge, the count up) and its Undo, a row opened (+ and −, typing, Log), "Add another row", a logged row removed
 * and a done circle taking an exercise off (the last one ends the workout), a refusal in plain words (the page's check and the
 * door's), "+ Add exercise", another day and Free workout swapping the list, a tap blocked while its save is on the way, no re-send
 * after a sign-in; the Spaces menu: the PC rail's group with the Space highlighted, /more on phones and tablets with the More tab
 * highlighted on /gym, /health and /habits.
 */
async function checkGym(page, name, theme) {
  await standinPost('/standin/reset');
  const W = GYM.gym.gym;
  const plan = GYM.plan.gym_plan;
  const pc = name === 'pc';
  const bar = page.locator('[data-bar]');
  const headIs = async (want) => {
    await page.locator('[data-bar-head]', { hasText: want }).waitFor();
    assert.equal(await text(page.locator('[data-bar-head]')), want, 'the answer bar');
  };
  const gx = (id) => page.locator(`[data-gx="${id}"]`);
  const names = (list) => page.locator(`[data-list="${list}"] [data-gx-name] span span:first-child`).allTextContents().then((x) => x.map((t) => t.trim()));
  const status = () => text(page.locator('[data-status]'));

  // Today's Gym card, from the day sample's gym: placed under Health (deploy 117), its lines, the 14 squares
  await page.goto(`${base}/`);
  const g = day.gym;
  const gc = page.locator('[data-card="gym"]');
  await gc.waitFor();
  assert.equal(await text(gc.locator('[data-gym-day]')), `Today: ${g.day_label}`);
  const wd = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' });
  assert.equal(await text(gc.locator('[data-gym-last]')), `Last workout ${wd(g.last_workout)} ${g.last_workout.slice(8, 10)}.${g.last_workout.slice(5, 7)}.`);
  assert.deepEqual(await gc.locator('[data-sq]').evaluateAll((els) => els.map((e) => e.getAttribute('data-sq'))), g.days.map((d) => (d.on ? 'on' : 'off')), 'the 14 squares');
  assert.equal(await gc.locator('[data-gym-days]').getAttribute('aria-label'), `Last 14 days: ${g.n14} workouts`);
  assert.equal(await text(gc.locator('[data-gym-weeks]')), `Last week ${g.last_week} · this week ${g.this_week}`);
  // deploy 117: the Gym card right under Health (phones: after Your day, Habits and Health; the PC: in the right column)
  const [hc, gb] = await Promise.all(['health', 'gym'].map((c) => page.locator(`[data-card="${c}"]`).boundingBox()));
  assert.ok(gb.y > hc.y + hc.height - 1 && gb.y - (hc.y + hc.height) < 24 && Math.abs(gb.x - hc.x) < 2, `${name}: the Gym card right under Health`);
  if (name === 'phone') await gc.screenshot({ path: `${out}/today-gym-card-${name}-${theme}.png` });
  await gc.locator('[data-gym-open]').click();
  await page.waitForURL(/\/gym$/);
  await page.locator('[data-card="workout"]').waitFor();
  await page.evaluate(() => (window.__noReload = true));

  // the read, against the sample
  assert.equal(await text(page.locator('h1')), 'Gym');
  assert.deepEqual(await page.locator('[data-part]').evaluateAll((els) => els.map((e) => e.getAttribute('data-part'))), ['workout', 'plan', 'progress', 'history', 'exercises', 'activity']);
  assert.equal(await page.locator('[data-part="workout"]').getAttribute('aria-current'), 'page');
  // deploy 97: every part is a page of this app, no "full app" mark
  assert.deepEqual(await page.locator('[data-part]').evaluateAll((els) => els.map((e) => e.getAttribute('href'))), ['/gym', '/gym/plan', '/gym/progress', '/gym/history', '/gym/exercises', '/gym/activity']);
  assert.equal(await page.locator('[data-part][title]').count(), 0);
  assert.equal(await page.locator('[data-parts]').getByText('↗').count(), 0, 'no full-app arrows');
  assert.equal(await page.locator('[data-split-edit]').getAttribute('href'), '/gym/plan', "Edit by This week's split goes to the Plan part");
  assert.equal(await text(page.locator('[data-title]')), W.title);
  assert.equal(await status(), W.status);
  assert.deepEqual(await page.locator('[data-chip]').allTextContents().then((x) => x.map((t) => t.trim())), W.chips.map((c) => c.label), 'the chips');
  assert.equal(await page.locator('[data-chip="1"]').getAttribute('aria-pressed'), 'true');
  assert.equal(await text(page.locator('[data-why]')), W.why);
  assert.deepEqual(await names('exercises'), W.exercises.map((r) => r.name), "the day's exercises in the plan's order");
  for (const r of W.exercises) {
    assert.equal(await text(gx(r.exercise_id).locator('[data-gx-text]')), r.text, `${r.name}: its numbers`);
    assert.equal(await text(gx(r.exercise_id).locator('[data-last]')), r.last_text, `${r.name}: the Last line`);
    assert.equal(await gx(r.exercise_id).locator('[data-circle]').getAttribute('aria-pressed'), String(r.logged.length > 0), `${r.name}: the circle`);
    assert.equal(await gx(r.exercise_id).locator('[data-up]').count(), r.up_kg === null ? 0 : 1);
  }
  assert.equal(await text(gx(1).locator('[data-up]')), '+5 kg');
  assert.equal(await text(page.locator('[data-other]')), `Other exercises (${W.other.length}) ›`);
  assert.equal(await page.locator('[data-list="other"]').count(), 0, 'Other exercises folded');
  assert.deepEqual(await page.locator('[data-split]').evaluateAll((els) => els.map((e) => e.getAttribute('data-split'))), W.week_split.map((x) => String(x.day_id)));
  assert.equal(await text(page.locator('[data-split="1"] [data-split-note]')), 'Today');
  assert.equal(await text(page.locator('[data-good]')), `${W.weeks.good} of 4 weeks with 2+ workouts`);
  assert.deepEqual(await page.locator('[data-week-n]').allTextContents(), W.weeks.weeks.map((w) => String(w.n)));
  assert.deepEqual(await page.locator('[data-card="weeks"] [data-sq]').evaluateAll((els) => els.map((e) => e.getAttribute('data-sq'))), W.weeks.weeks.flatMap((w) => w.days.map((d) => (d.on ? 'on' : d.later ? 'later' : 'off'))));
  // one column on phones and tablets; from 1100 px the exercises left, the split and the weeks right in 340 px
  const [wk, sp, w4] = await Promise.all(['workout', 'split', 'weeks'].map((c) => page.locator(`[data-card="${c}"]`).boundingBox()));
  if (pc) assert.ok(sp.x > wk.x + wk.width - 1 && Math.abs(sp.y - wk.y) < 2 && Math.abs(sp.width - 340) < 2 && w4.y > sp.y + sp.height - 1, 'pc: the exercises left, the split and the weeks right (340 px)');
  else assert.ok(sp.y > wk.y + wk.height - 1 && w4.y > sp.y + sp.height - 1 && Math.abs(sp.x - wk.x) < 2, `${name}: one column`);
  // the parts row scrolls inside itself, never the page
  const parts = await page.locator('[data-parts]').evaluate((e) => ({ overflow: getComputedStyle(e).overflowX, right: e.getBoundingClientRect().right }));
  assert.ok(parts.overflow === 'auto' && parts.right <= page.viewportSize().width + 1, 'the parts row scrolls in itself');
  await page.screenshot({ path: `${out}/gym-${name}-${theme}.png`, fullPage: true });
  await checkWidth(page, 'gym');

  // the places: on the PC the rail's Spaces group with Gym highlighted; on phones and tablets the More tab
  if (pc) {
    assert.ok(await page.locator('[data-rail-group]').isVisible(), 'the rail has the Spaces group');
    assert.deepEqual(await page.locator('[data-rail-space]').allTextContents().then((x) => x.map((t) => t.trim())), ['Gym', 'Health', 'Habits', 'Home', 'Medical']);
    assert.equal(await page.locator('[data-rail-space="gym"]').getAttribute('aria-current'), 'page');
    assert.equal(await page.locator('[data-place="today"]').getAttribute('aria-current'), null);
    const order = await page.locator('[data-places] > a, [data-places] > span').evaluateAll((els) => els.filter((e) => e.offsetParent && e.textContent.trim()).map((e) => e.textContent.trim()));
    assert.deepEqual(order, ['Logger', 'Today', 'Trends', 'Library', 'Spaces', 'Gym', 'Health', 'Habits', 'Home', 'Medical', 'More'], 'the rail');
  } else {
    assert.equal(await page.locator('[data-rail-group]').isVisible(), false);
    assert.equal(await page.locator('[data-place="more"]').getAttribute('aria-current'), 'true', 'the More tab is highlighted on /gym');
  }

  // one tap logs the read's numbers: the circle fills, the blue edge, "n done" goes up; Undo takes it back
  const press = W.exercises.find((r) => r.name === 'Shoulder press');
  await gx(press.exercise_id).locator('[data-circle]').click();
  await gx(press.exercise_id).locator('[data-circle][aria-pressed="true"]').waitFor();
  await headIs(`Saved: Shoulder press ${press.text}`);
  assert.match(await status(), new RegExp(`· ${W.done + 1} done$`), 'the count goes up');
  assert.match(await gx(press.exercise_id).getAttribute('class'), /border-blue/, 'the blue edge');
  if (pc) await page.screenshot({ path: `${out}/gym-logged-${name}-${theme}.png` });
  await bar.getByRole('button', { name: 'Undo' }).click();
  await headIs("Undone: the exercise is off today's workout.");
  await gx(press.exercise_id).locator('[data-circle][aria-pressed="false"]').waitFor();
  assert.equal(await status(), W.status);

  // a row opened: − and + with the read's steps, typing, Log
  await gx(press.exercise_id).locator('[data-gx-name]').click();
  const ed = page.locator(`[data-gx-editor="${press.exercise_id}"]`);
  await ed.waitFor();
  assert.equal(await gx(press.exercise_id).locator('[data-gx-name]').getAttribute('aria-expanded'), 'true');
  assert.equal(await ed.locator('[data-field="kg"]').inputValue(), String(press.values.kg));
  await ed.locator('[data-more="kg"]').click();
  assert.equal(await ed.locator('[data-field="kg"]').inputValue(), String(press.values.kg + 2.5), '+ adds 2.5 kg');
  await ed.locator('[data-less="kg"]').click();
  await ed.locator('[data-less="kg"]').click();
  assert.equal(await ed.locator('[data-field="kg"]').inputValue(), String(press.values.kg - 2.5), '− takes 2.5 kg off');
  await ed.locator('[data-more="reps"]').click();
  await ed.locator('[data-field="sets"]').fill('4');
  const typed = `4 × ${press.values.reps + 1} at ${press.values.kg - 2.5} kg`;
  assert.equal(await text(ed.locator('[data-draft-text]')), typed);
  assert.equal(await text(ed.locator('[data-log]')), 'Log');
  if (name === 'phone') await gx(press.exercise_id).screenshot({ path: `${out}/gym-row-open-${name}-${theme}.png` });
  await checkWidth(page, 'gym, a row open');
  await ed.locator('[data-log]').click();
  await headIs(`Saved: Shoulder press ${typed}`);
  await gx(press.exercise_id).locator('[data-circle][aria-pressed="true"]').waitFor();
  assert.equal(await text(gx(press.exercise_id).locator('[data-gx-text]')), typed);
  assert.equal(await ed.count(), 0, 'the row closes after Log');
  assert.match(await status(), new RegExp(`· ${W.done + 1} done$`));

  // "Add another row" when it is logged already; then each logged row has its own remove
  await gx(press.exercise_id).locator('[data-gx-name]').click();
  assert.equal(await text(ed.locator('[data-log]')), 'Add another row');
  assert.equal(await ed.locator('[data-field="sets"]').inputValue(), '4', "it opens with today's last row");
  await ed.locator('[data-log]').click();
  await gx(press.exercise_id).locator('[data-gx-text]', { hasText: `${typed}, ${typed}` }).waitFor();
  await headIs(`Saved: Shoulder press ${typed}`);
  assert.equal(await text(gx(press.exercise_id).locator('[data-gx-text]')), `${typed}, ${typed}`, 'a second row');
  assert.match(await status(), new RegExp(`· ${W.done + 1} done$`), 'a second row is not another exercise');
  await gx(press.exercise_id).locator('[data-gx-name]').click();
  const sets = ed.locator('[data-remove]');
  assert.equal(await sets.count(), 2);
  await sets.first().click();
  await headIs(`Removed: Shoulder press ${typed}`);
  await page.locator(`[data-gx-editor="${press.exercise_id}"] [data-remove]`).nth(1).waitFor({ state: 'detached' });
  assert.equal(await text(gx(press.exercise_id).locator('[data-gx-text]')), typed);
  await bar.getByRole('button', { name: 'Undo' }).click();
  await headIs("Undone: it is back in today's workout.");
  assert.equal(await text(gx(press.exercise_id).locator('[data-gx-text]')), `${typed}, ${typed}`);

  // a refusal in plain words: the page's check (kg cleared) and nothing is sent
  if (await ed.count() === 0) await gx(press.exercise_id).locator('[data-gx-name]').click();
  await ed.locator('[data-field="kg"]').fill('');
  await ed.locator('[data-log]').click();
  await headIs('Nothing saved.');
  assert.equal(await bar.getAttribute('data-bar'), 'warning');
  assert.equal(await text(bar.locator('p').first()), 'Give the weight in kg.');
  await ed.locator('[data-field="kg"]').fill('2000');
  await ed.locator('[data-log]').click();
  await page.locator('[data-bar] p', { hasText: 'Numbers only' }).waitFor();
  assert.equal(await text(bar.locator('p').first()), W.numbers);
  assert.equal(await text(gx(press.exercise_id).locator('[data-gx-text]')), `${typed}, ${typed}`, 'nothing logged');

  // a done circle takes the exercise off (all its rows); the last one ends the workout ("not started")
  for (const r of [press, ...W.exercises.filter((x) => x.logged.length)]) {
    await gx(r.exercise_id).locator('[data-circle][aria-pressed="true"]').click();
    await gx(r.exercise_id).locator('[data-circle][aria-pressed="false"]').waitFor();
    await page.locator('[data-bar-head]', { hasText: `Removed: ${r.name}` }).waitFor();
  }
  assert.equal(await status(), 'not started: the first tick starts it', 'the last remove empties the workout');
  assert.equal(await text(page.locator('[data-why]')), 'Your 1st workout this week: the first day not done yet. Tap another day to switch.');
  await bar.getByRole('button', { name: 'Undo' }).click();
  await page.locator('[data-status]', { hasText: /^started / }).waitFor();

  // a tap is blocked while its save is on the way: a double tap logs one row
  await standinPost('/standin/reset');
  await page.reload();
  await page.locator('[data-card="workout"]').waitFor();
  await standinPost('/standin/slow');
  const pushup = W.exercises.find((r) => r.name === 'Push-up');
  await gx(pushup.exercise_id).locator('[data-circle]').dblclick();
  await gx(pushup.exercise_id).locator('[data-circle][aria-pressed="true"]').waitFor();
  await page.waitForTimeout(1200);
  assert.equal(await text(gx(pushup.exercise_id).locator('[data-gx-text]')), pushup.text, 'two taps made one row');
  assert.equal(await gx(pushup.exercise_id).locator('[data-circle]').getAttribute('aria-pressed'), 'true');
  await standinPost('/standin/reset');
  await page.reload();
  await page.locator('[data-card="workout"]').waitFor();
  await page.evaluate(() => (window.__noReload = true));

  // Other exercises (folded) open; a ready one there logs too
  await page.locator('[data-other]').click();
  assert.deepEqual(await names('other'), W.other.map((r) => r.name));
  await page.locator('[data-other]').click();

  // + Add exercise: the door's refusal next to the form (the words stay), then a new one on today's day, opened by its circle
  await page.locator('[data-add]').click();
  const add = page.locator('[data-add-form]');
  await add.locator('input[name="name"]').fill('Bench press');
  await add.getByRole('button', { name: 'Add', exact: true }).click();
  assert.equal(await text(page.locator('[data-add-err]', { hasText: 'already' })), 'Bench press is already in your list.');
  assert.equal(await add.locator('input[name="name"]').inputValue(), 'Bench press', 'the words stay');
  await add.locator('input[name="name"]').fill('Cable fly');
  await add.getByText('Machine cardio').click();
  await add.getByText('Weights').click();
  await add.getByRole('button', { name: 'Add', exact: true }).click();
  await headIs(`Added Cable fly (weights). It is on today’s ${W.day.name} now.`);
  assert.equal(await page.locator('[data-add-form]').count(), 0, 'the form closes');
  assert.deepEqual(await names('exercises'), [...W.exercises.map((r) => r.name), 'Cable fly'], "on today's day");
  const fly = page.locator('[data-gx]', { has: page.getByText('Cable fly', { exact: true }) });
  assert.match(await fly.getAttribute('class'), /border-blue/);
  assert.equal(await fly.locator('[data-circle]').getAttribute('data-circle'), 'off', 'a weight not set yet: the circle is off');
  assert.equal(await text(fly.locator('[data-gx-text]')), 'first time: set the numbers');
  assert.equal(await text(fly.locator('[data-last]')), 'Not done before');
  await fly.locator('[data-circle]').click();
  await fly.locator('[data-gx-editor]').waitFor();
  assert.equal(await fly.locator('[data-field="kg"]').inputValue(), '', 'the row opens instead');
  await fly.locator('[data-field="kg"]').fill('20');
  await fly.locator('[data-log]').click();
  await headIs('Saved: Cable fly 3 × 8 at 20 kg');

  // another day of the split: its list; Free workout: every exercise
  await standinPost('/standin/reset');
  await page.reload();
  await page.locator('[data-card="workout"]').waitFor();
  await page.evaluate(() => (window.__noReload = true));
  const pull = W.chips.find((c) => c.day_id === 2);
  const doneToday = W.exercises.filter((r) => r.logged.length).map((r) => r.exercise_id);
  const pullIds = plan.days.find((d) => d.day_id === 2).items.map((i) => i.exercise_id);
  const nameOf = new Map([...W.exercises, ...W.other].map((r) => [r.exercise_id, r.name]));
  await page.locator('[data-chip="2"]').click();
  await headIs(`Today: ${pull.label}.`);
  assert.equal(await text(page.locator('[data-title]')), pull.label);
  assert.equal(await page.locator('[data-chip="2"]').getAttribute('aria-pressed'), 'true');
  assert.equal(await text(page.locator('[data-why]')), `Picked by you instead of ${W.day.label}.`);
  assert.deepEqual(await names('exercises'), [...pullIds, ...doneToday.filter((i) => !pullIds.includes(i))].map((i) => nameOf.get(i)), 'the list swaps');
  assert.equal(await bar.getByRole('button', { name: 'Undo' }).count(), 0, 'a pick has no Undo');
  await page.locator('[data-chip="free"]').click();
  await headIs('Today: Free workout.');
  assert.equal(await text(page.locator('[data-title]')), 'Free workout');
  assert.equal(await text(page.locator('[data-why]')), 'Free workout: all your exercises.');
  assert.equal(await page.locator('[data-list="exercises"] [data-gx]').count(), W.exercises.length + W.other.length, 'every active exercise');
  assert.equal(await page.locator('[data-other]').count(), 0);
  await checkWidth(page, 'gym, free workout');
  await standinPost('/standin/reset');

  // never sent again: a tick that met a gone session is not logged after the sign-in
  await page.reload();
  await page.locator('[data-card="workout"]').waitFor();
  await standinPost('/standin/drop-sessions');
  await gx(press.exercise_id).locator('[data-circle]').click();
  await page.getByRole('button', { name: 'Sign in' }).waitFor();
  await page.fill('#password', 'test');
  await page.fill('#code', '123 456');
  await page.click('button[type=submit]');
  await page.waitForURL(/\/gym$/);
  await page.locator('[data-card="workout"]').waitFor();
  await page.waitForTimeout(500);
  assert.equal(await gx(press.exercise_id).locator('[data-circle]').getAttribute('aria-pressed'), 'false', 'not sent again after the sign-in');
  assert.equal(await status(), W.status);

  // the Spaces menu: /more on phones and tablets (More highlighted there and on every Space); the rail on the PC
  if (!pc) {
    await page.locator('[data-place="more"]').click();
    await page.waitForURL(/\/more$/);
    assert.equal(await page.locator('[data-place="more"]').getAttribute('aria-current'), 'page');
    assert.deepEqual(await page.locator('[data-space]').evaluateAll((els) => els.map((e) => [e.getAttribute('data-space'), e.tagName, e.hasAttribute('data-soon')])), [
      ['gym', 'A', false], ['health', 'A', false], ['habits', 'A', false], ['home', 'A', false], ['medical', 'A', false],
    ]);
    assert.equal(await page.locator('[data-space="medical"]').getAttribute('href'), '/medical', 'deploy 106: Medical is a live Space');
    assert.equal(await page.locator('[data-space="home"]').getAttribute('href'), '/home', 'deploy 99: Home is a live Space');
    assert.equal(await page.locator('[data-rest]').count(), 0, 'deploy 108: the dashed "Settings and the rest" box is gone');
    assert.equal(await page.getByText('Settings and the rest are').count(), 0, 'deploy 111: no footer line sends you to app.');
    if (name === 'phone') await page.screenshot({ path: `${out}/more-${name}-${theme}.png` });
    await checkWidth(page, 'more');
    for (const sp of ['health', 'habits', 'gym']) {
      await page.goto(`${base}/more`);
      await page.locator(`[data-space="${sp}"]`).click();
      await page.waitForURL(new RegExp(`/${sp}$`));
      await page.locator('h1').waitFor();
      assert.equal(await page.locator('[data-place="more"]').getAttribute('aria-current'), 'true', `More highlighted on /${sp}`);
      assert.match(await page.locator('[data-place="more"]').getAttribute('class'), /text-blue/);
      assert.equal(await page.locator('[data-place="today"]').getAttribute('aria-current'), null);
    }
    assert.deepEqual(await page.locator('[data-places] > *').evaluateAll((els) => els.filter((e) => e.offsetParent).map((e) => e.textContent.trim())), ['Today', 'Trends', 'Library', 'More'], 'four tabs');
  } else {
    for (const sp of ['health', 'habits']) {
      await page.locator(`[data-rail-space="${sp}"]`).click();
      await page.waitForURL(new RegExp(`/${sp}$`));
      await page.locator('h1').waitFor();
      assert.equal(await page.locator(`[data-rail-space="${sp}"]`).getAttribute('aria-current'), 'page');
      assert.equal(await page.locator('[data-rail-space="gym"]').getAttribute('aria-current'), null);
    }
    await page.locator('[data-place="more"]').click();
    await page.waitForURL(/\/more$/);
    assert.equal(await page.locator('[data-place="more"]').getAttribute('aria-current'), 'page');
    assert.equal(await page.locator('[data-space]').count(), 5);
  }
  await page.goto(`${base}/`);
  assert.equal(await page.locator('[data-place="today"]').getAttribute('aria-current'), 'page');
  await standinPost('/standin/reset');
}

/**
 * Deploy 97: the Gym's other five parts, each opened from the parts row (the one you are in highlighted, no full-app marks), against
 * the gym sample.
 * Plan: how the day is picked with the week's done days, a card per day (two columns from 1100 px), sets and reps saved (and cleared),
 * the page's refusals next to the form with the typed words kept, up and down, take off with Undo (the only Undo of these parts), "+ Add
 * exercise", Rename or remove, "Removed days" and Bring back, "+ New workout day" and a duplicate refused; a button blocked while its
 * save is on the way; no save sent again after a sign-in. Exercises: the list, Rename (and a refusal), Retire and Bring back, "+ New
 * exercise", open while the list is empty. Progress: the chips, the number and its change, the chart drawn with the sample's points, the
 * bars of Workouts per week, another chip; Activity: with data (tiles, night, the watch's workout, the charts, the day links) and without
 * (the guide); History: the cards and a link that jumps to one.
 */
async function checkGymParts(page, name, theme) {
  await standinPost('/standin/reset');
  const G = GYM;
  const PL = G.plan.gym_plan;
  const EX = G.exercises.gym_exercises;
  const PR = G.progress.gym_progress;
  const HI = G.history.gym_history.workouts;
  const AC = G.activity.gym_activity;
  const pc = name === 'pc';
  const bar = page.locator('[data-bar]');
  const headIs = async (want) => {
    await page.locator('[data-bar-head]', { hasText: want }).waitFor();
    assert.equal(await text(page.locator('[data-bar-head]')), want, 'the answer bar');
  };
  const noUndo = async (why) => assert.equal(await bar.getByRole('button', { name: 'Undo' }).count(), 0, `no Undo: ${why}`);
  const texts = (loc) => loc.allTextContents().then((x) => x.map((t) => t.replace(/\s+/g, ' ').trim()));
  const parts = ['workout', 'plan', 'progress', 'history', 'exercises', 'activity'];
  const open = async (key, path) => {
    await page.locator(`[data-part="${key}"]`).click();
    await page.waitForURL(new RegExp(`${path}$`));
    await page.locator('h1').waitFor();
    await page.locator(`[data-part="${key}"][aria-current="page"]`).waitFor();
    for (const other of parts.filter((k) => k !== key)) assert.equal(await page.locator(`[data-part="${other}"]`).getAttribute('aria-current'), null, `${key}: only it is highlighted`);
    assert.equal(await text(page.locator('h1')), 'Gym');
    assert.equal(await page.locator('[data-part][title]').count(), 0, 'no full-app marks');
    assert.equal(await page.locator('[data-part="workout"]').getAttribute('href'), '/gym');
  };
  const items = (day) => texts(page.locator(`[data-day="${day}"] [data-pi-name] span:first-child`));
  const labels = () => texts(page.locator('[data-day-label]'));

  // ---- Plan, from the Workout page's parts row and from "This week's split" Edit
  await page.goto(`${base}/gym`);
  await page.locator('[data-card="workout"]').waitFor();
  await page.locator('[data-split-edit]').click();
  await page.waitForURL(/\/gym\/plan$/);
  await page.locator('[data-card="how"]').waitFor();
  await page.locator('[data-part="plan"][aria-current="page"]').waitFor();
  await page.goto(`${base}/gym`);
  await open('plan', '/gym/plan');
  await page.locator('[data-card="how"]').waitFor();
  await page.evaluate(() => (window.__noReload = true));
  assert.equal(await text(page.locator('[data-how]')), PL.how);
  assert.equal(await text(page.locator('[data-week]')), PL.week);
  assert.equal(await page.locator('[data-done]').count(), 0, 'no day done this week in the sample');
  assert.deepEqual(await labels(), PL.days.map((d) => d.label));
  assert.deepEqual(await texts(page.locator('[data-day-tag]')), ['Today', '3 exercises', '3 exercises']);
  for (const d of PL.days) {
    assert.deepEqual(await items(d.day_id), d.items.map((i) => i.name), `${d.label}: its exercises in order`);
    assert.deepEqual(await texts(page.locator(`[data-day="${d.day_id}"] [data-pi-text]`)), d.items.map((i) => i.text), `${d.label}: kind and plan numbers`);
  }
  assert.deepEqual(await texts(page.locator('[data-removed]')), ['Arms Bring back']);
  const [d1, d2, d3] = await Promise.all([1, 2, 3].map((i) => page.locator(`[data-day="${i}"]`).boundingBox()));
  if (pc) assert.ok(Math.abs(d1.y - d2.y) < 2 && d2.x > d1.x + d1.width - 1 && d3.y > d1.y + d1.height - 1, 'pc: the day cards in two columns');
  else assert.ok(d2.y > d1.y + d1.height - 1 && Math.abs(d2.x - d1.x) < 2, `${name}: one column`);
  await page.screenshot({ path: `${out}/gym-plan-${name}-${theme}.png`, fullPage: true });
  await checkWidth(page, 'gym plan');

  // sets and reps: the form opens with the plan's numbers, saved in place, no Undo
  await page.locator('[data-pi-name="1"]').click();
  const form = page.locator('[data-pi-editor="1"]');
  assert.equal(await form.locator('[data-field="sets"]').inputValue(), '3');
  assert.equal(await form.locator('[data-field="reps"]').inputValue(), '8');
  await form.locator('[data-field="sets"]').fill('4');
  await form.locator('[data-field="reps"]').fill('6');
  if (name === 'phone') await page.locator('[data-pi="1"]').screenshot({ path: `${out}/gym-plan-numbers-${name}-${theme}.png` });
  await checkWidth(page, 'gym plan, numbers open');
  await form.locator('[data-save]').click();
  await headIs('Bench press: plan 4 × 6.');
  assert.equal(await text(page.locator('[data-pi="1"] [data-pi-text]')), 'Weights · plan 4 × 6');
  assert.equal(await page.locator('[data-pi-editor="1"]').count(), 0, 'the form closes');
  assert.match(await page.locator('[data-pi="1"]').getAttribute('class'), /border-blue/, 'the blue edge');
  await noUndo('sets and reps');

  // the page's refusals next to the form, which keeps what was typed; then both cleared: no plan numbers
  await page.locator('[data-pi-name="2"]').click();
  const f2 = page.locator('[data-pi-editor="2"]');
  await f2.locator('[data-field="sets"]').fill('');
  await f2.locator('[data-save]').click();
  assert.equal(await text(f2.locator('[data-err]')), 'Give both sets and reps, or neither.');
  assert.equal(await f2.locator('[data-field="reps"]').inputValue(), '10', 'the words stay');
  assert.equal(await bar.getByText('Give both').count(), 0, 'a refusal is not in the answer bar');
  await f2.locator('[data-field="sets"]').fill('99');
  await f2.locator('[data-save]').click();
  assert.equal(await text(f2.locator('[data-err]')), PL.limits ? 'Numbers only: sets 1 to 50, reps 1 to 500.' : '');
  assert.equal(await f2.locator('[data-field="sets"]').inputValue(), '99');
  await f2.locator('[data-field="sets"]').fill('');
  await f2.locator('[data-field="reps"]').fill('');
  await f2.locator('[data-save]').click();
  await headIs('Shoulder press: plan without numbers.');
  assert.equal(await text(page.locator('[data-pi="2"] [data-pi-text]')), 'Weights');

  // cardio has no numbers: its note
  await page.locator('[data-pi-name="4"]').click();
  assert.equal(await text(page.locator('[data-pi-editor="4"] [data-cardio]')), 'Cardio: you set the minutes when you log it.');
  assert.equal(await page.locator('[data-pi-editor="4"] [data-field]').count(), 0);
  await page.locator('[data-pi-name="4"]').click();

  // up and down: the first has no Up, the last no Down; no Undo
  assert.equal(await page.locator('[data-up="1"]').isDisabled(), true);
  assert.equal(await page.locator('[data-down="4"]').isDisabled(), true);
  assert.equal(await page.locator('[data-down="1"]').getAttribute('aria-label'), 'Move down: Bench press');
  await page.locator('[data-down="2"]').click();
  await headIs('Moved Shoulder press down.');
  assert.deepEqual(await items(1), ['Bench press', 'Push-up', 'Shoulder press', 'Exercise bike']);
  assert.match(await page.locator('[data-pi="2"]').getAttribute('class'), /border-blue/);
  await noUndo('a move');
  await page.locator('[data-up="2"]').click();
  await page.locator('[data-bar-head]', { hasText: 'Moved Shoulder press up.' }).waitFor();
  assert.deepEqual(await items(1), PL.days[0].items.map((i) => i.name));

  // take off: Undo is in the bar, and it puts the exercise back where it was (same id)
  await page.locator('[data-remove="3"]').click();
  await headIs('Took Push-up off Push.');
  assert.equal(await page.locator('[data-pi="3"]').count(), 0);
  assert.deepEqual(await items(1), ['Bench press', 'Shoulder press', 'Exercise bike']);
  assert.equal(await text(page.locator('[data-day="1"] [data-day-tag]')), 'Today');
  if (name === 'phone') await page.screenshot({ path: `${out}/gym-plan-undo-${name}-${theme}.png` });
  await bar.getByRole('button', { name: 'Undo' }).click();
  await headIs('Undone: Push-up is back on Push.');
  assert.deepEqual(await items(1), ['Bench press', 'Shoulder press', 'Push-up', 'Exercise bike']);
  assert.equal(await text(page.locator('[data-pi="3"] [data-pi-text]')), 'Bodyweight');

  // + Add exercise: a choice of the exercises the read allows, optional numbers; a refusal keeps the words
  await page.locator('[data-add="1"]').click();
  const add = page.locator('[data-add-form="1"]');
  assert.deepEqual(await texts(add.locator('option')), PL.days[0].can_add.map((x) => x.name));
  await add.locator('[data-add-go]').click(); // the first exercise, no numbers
  await headIs('Added Seated row to Push.');
  assert.deepEqual(await items(1), ['Bench press', 'Shoulder press', 'Push-up', 'Exercise bike', 'Seated row']);
  assert.equal(await text(page.locator('[data-day="1"] [data-pi]:last-child [data-pi-text]')), 'Weights');
  assert.equal(await page.locator('[data-add-form="1"]').count(), 0, 'the form closes');
  assert.match(await page.locator('[data-day="1"] [data-pi]:last-child').getAttribute('class'), /border-blue/);
  await page.locator('[data-add="1"]').click();
  await add.locator('[data-add-exercise]').selectOption({ label: 'Leg press' });
  await add.locator('[data-add-sets]').fill('3');
  await add.locator('[data-add-go]').click();
  assert.equal(await text(add.locator('[data-err]')), 'Give both sets and reps, or neither.');
  assert.equal(await add.locator('[data-add-sets]').inputValue(), '3', 'the words stay');
  await add.locator('[data-add-reps]').fill('12');
  await add.locator('[data-add-go]').click();
  await headIs('Added Leg press to Push.');
  assert.equal(await text(page.locator('[data-day="1"] [data-pi]:last-child [data-pi-text]')), 'Weights · plan 3 × 12');
  await noUndo('an added exercise');
  await checkWidth(page, 'gym plan, exercises added');

  // Rename or remove: the name, kept after a refusal; the label follows
  await page.locator('[data-edit="1"]').click();
  const edit = page.locator('[data-edit-panel="1"]');
  assert.equal(await edit.locator('[data-edit-name]').inputValue(), 'Push');
  await edit.locator('[data-edit-name]').fill('   ');
  await edit.locator('[data-rename]').click();
  assert.equal(await text(edit.locator('[data-err]')), "Type the day's name.");
  await edit.locator('[data-edit-name]').fill('Chest');
  if (name === 'phone') await edit.screenshot({ path: `${out}/gym-plan-rename-${name}-${theme}.png` });
  await edit.locator('[data-rename]').click();
  await headIs('Renamed to Chest.');
  assert.deepEqual(await labels(), ['Day 1 · Chest', 'Day 2 · Pull', 'Day 3 · Legs']);
  assert.match(await page.locator('[data-day="1"]').getAttribute('class'), /border-blue/);
  await noUndo('a rename');

  // remove a day: it moves to Removed days; Bring back puts it at the end; the days are numbered again
  await page.locator('[data-edit="3"]').click();
  await page.locator('[data-remove-day="3"]').click();
  await page.locator('[data-bar-head]', { hasText: 'Removed Legs from your split.' }).waitFor();
  assert.equal(await page.locator('[data-day="3"]').count(), 0);
  assert.deepEqual(await texts(page.locator('[data-removed]')), ['Legs Bring back', 'Arms Bring back']);
  await noUndo('a removed day');
  await page.locator('[data-bring="4"]').click();
  await headIs('Arms is back in your split.');
  assert.deepEqual(await labels(), ['Day 1 · Chest', 'Day 2 · Pull', 'Day 3 · Arms']);
  assert.deepEqual(await texts(page.locator('[data-removed]')), ['Legs Bring back']);
  assert.equal(await text(page.locator('[data-day="4"] [data-empty]')), 'No exercises yet.');

  // + New workout day: a new day at the end; the same name again is refused next to the form, which keeps the words
  await page.locator('[data-newday]').click();
  await page.locator('[data-newday-name]').fill('Core');
  await page.locator('[data-newday-go]').click();
  await headIs('Added Day 4 · Core. Add its exercises below.');
  assert.deepEqual(await labels(), ['Day 1 · Chest', 'Day 2 · Pull', 'Day 3 · Arms', 'Day 4 · Core']);
  assert.equal(await text(page.locator('[data-day="101"] [data-day-tag]')), '0 exercises');
  assert.match(await page.locator('[data-day="101"]').getAttribute('class'), /border-blue/);
  assert.equal(await page.locator('[data-newday-form]').count(), 0, 'the form closes');
  await page.locator('[data-newday]').click();
  await page.locator('[data-newday-name]').fill('core');
  await page.locator('[data-newday-go]').click();
  assert.equal(await text(page.locator('[data-newday-form] [data-err]')), 'core is already a day of your split.');
  assert.equal(await page.locator('[data-newday-name]').inputValue(), 'core', 'the words stay');
  assert.equal(await bar.getByText('already a day').count(), 0, 'not in the answer bar');
  if (name === 'phone') await page.screenshot({ path: `${out}/gym-plan-refused-${name}-${theme}.png`, fullPage: true });
  await checkWidth(page, 'gym plan, a refused day');
  await page.getByRole('button', { name: 'Cancel' }).click();

  // the Workout page follows the plan (its chips are the days)
  await page.goto(`${base}/gym`);
  await page.locator('[data-card="workout"]').waitFor();
  assert.deepEqual(await texts(page.locator('[data-chip]')), ['Day 1 · Chest', 'Day 2 · Pull', 'Day 3 · Arms', 'Day 4 · Core', 'Free workout']);

  // a button is blocked while its save is on the way: a double tap moves once
  await standinPost('/standin/reset');
  await page.goto(`${base}/gym/plan`);
  await page.locator('[data-card="how"]').waitFor();
  await standinPost('/standin/slow');
  await page.locator('[data-down="1"]').dblclick();
  await page.locator('[data-bar-head]', { hasText: 'Moved Bench press down.' }).waitFor();
  await page.waitForTimeout(1000);
  assert.deepEqual(await items(1), ['Shoulder press', 'Bench press', 'Push-up', 'Exercise bike'], 'two taps moved once');
  await standinPost('/standin/reset');

  // never sent again: a move that met a gone session is not made after the sign-in
  await page.goto(`${base}/gym/plan`);
  await page.locator('[data-card="how"]').waitFor();
  await standinPost('/standin/drop-sessions');
  await page.locator('[data-down="1"]').click();
  await page.getByRole('button', { name: 'Sign in' }).waitFor();
  await page.fill('#password', 'test');
  await page.fill('#code', '123 456');
  await page.click('button[type=submit]');
  await page.waitForURL(/\/gym\/plan$/);
  await page.locator('[data-card="how"]').waitFor();
  await page.waitForTimeout(500);
  assert.deepEqual(await items(1), PL.days[0].items.map((i) => i.name), 'not sent again after the sign-in');
  await standinPost('/standin/reset');

  // this week's done days
  await standinPost('/standin/week-done');
  await page.reload();
  await page.locator('[data-card="how"]').waitFor();
  assert.deepEqual(await texts(page.locator('[data-done-day]')), ['Day 1 · Push · done Mon 16.11.']);
  assert.equal(await text(page.locator('[data-week]')), 'This week: Day 1 · Push on Mon done. Today: Day 1 · Push.');
  await standinPost('/standin/reset');

  // ---- Exercises
  await page.goto(`${base}/gym`);
  await open('exercises', '/gym/exercises');
  await page.locator('[data-card="exercises"]').waitFor();
  assert.equal(await text(page.locator('[data-count]')), '8 active');
  assert.deepEqual(await texts(page.locator('[data-ex-name]')), EX.exercises.map((x) => x.name));
  assert.deepEqual(await texts(page.locator('[data-ex-meta]')), EX.exercises.map((x) => x.meta), 'kind, also: words, use');
  assert.equal(await page.locator('[data-ex="9"]').getAttribute('data-active'), 'false');
  assert.equal(await text(page.locator('[data-active-btn="9"]')), 'Bring back');
  assert.equal(await text(page.locator('[data-active-btn="1"]')), 'Retire');
  assert.match(await text(page.locator('[data-ex="7"] [data-ex-meta]')), /not done yet$/);
  if (pc) {
    const [a, b] = await Promise.all([1, 2].map((i) => page.locator(`[data-ex="${i}"]`).boundingBox()));
    assert.ok(Math.abs(a.y - b.y) < 2 && b.x > a.x + a.width - 1, 'pc: two columns');
  }
  await page.screenshot({ path: `${out}/gym-exercises-${name}-${theme}.png`, fullPage: true });
  await checkWidth(page, 'gym exercises');

  // Rename: refusals next to the form (the name stays), then the new name; the old one becomes one of its words
  await page.locator('[data-rename="1"]').click();
  const rn = page.locator('[data-rename-form="1"]');
  assert.equal(await rn.locator('[data-rename-name]').inputValue(), 'Bench press');
  await rn.locator('[data-rename-go]').click();
  assert.equal(await text(rn.locator('[data-err]')), 'It is called Bench press already.');
  await rn.locator('[data-rename-name]').fill('Seated row');
  await rn.locator('[data-rename-go]').click();
  assert.equal(await text(rn.locator('[data-err]')), 'Seated row is already in your list.');
  await rn.locator('[data-rename-name]').fill('biceps curl');
  await rn.locator('[data-rename-go]').click();
  assert.equal(await text(rn.locator('[data-err]')), 'A retired exercise is called Biceps curl.');
  assert.equal(await rn.locator('[data-rename-name]').inputValue(), 'biceps curl', 'the words stay');
  assert.equal(await bar.count(), 0, 'a refusal is not in the answer bar');
  await rn.locator('[data-rename-name]').fill('Flat bench press');
  if (name === 'phone') await page.locator('[data-ex="1"]').screenshot({ path: `${out}/gym-exercises-rename-${name}-${theme}.png` });
  await checkWidth(page, 'gym exercises, rename open');
  await rn.locator('[data-rename-go]').click();
  await headIs('Renamed Bench press to Flat bench press. Its history moved with it.');
  assert.equal(await text(page.locator('[data-ex="1"] [data-ex-name]')), 'Flat bench press');
  assert.equal(await text(page.locator('[data-ex="1"] [data-ex-meta]')), 'Weights · also: flat bench, Bench press · 8 workouts, last 16.11.');
  assert.match(await page.locator('[data-ex="1"]').getAttribute('class'), /border-blue/);
  await noUndo('a rename');

  // Retire and Bring back: the row greys, the count follows
  await page.locator('[data-active-btn="2"]').click();
  await headIs('Retired Shoulder press. Its history stays.');
  assert.equal(await page.locator('[data-ex="2"]').getAttribute('data-active'), 'false');
  assert.equal(await text(page.locator('[data-active-btn="2"]')), 'Bring back');
  assert.equal(await text(page.locator('[data-count]')), '7 active');
  await noUndo('Retire');
  await page.locator('[data-active-btn="2"]').click();
  await headIs('Shoulder press is back in your list.');
  assert.equal(await text(page.locator('[data-count]')), '8 active');
  await page.locator('[data-active-btn="9"]').click();
  await headIs('Biceps curl is back in your list.');
  assert.equal(await text(page.locator('[data-count]')), '9 active');

  // + New exercise: not put on a day; a refusal keeps the words; the other words are listed under the name
  await page.locator('[data-new]').click();
  const nw = page.locator('[data-new-form]');
  await nw.locator('[data-new-name]').fill('Seated row');
  await nw.locator('[data-new-go]').click();
  assert.equal(await text(nw.locator('[data-err]')), 'Seated row is already in your list.');
  assert.equal(await nw.locator('[data-new-name]').inputValue(), 'Seated row', 'the words stay');
  await nw.locator('[data-new-name]').fill('Rowing machine');
  await nw.getByText('Machine cardio').click();
  await nw.locator('[data-new-words]').fill('rower, erg');
  if (name === 'phone') await nw.screenshot({ path: `${out}/gym-exercises-new-${name}-${theme}.png` });
  await checkWidth(page, 'gym exercises, new form open');
  await nw.locator('[data-new-go]').click();
  await headIs('Added Rowing machine (machine cardio).');
  assert.equal(await page.locator('[data-new-form]').count(), 0, 'the form closes');
  assert.equal(await text(page.locator('[data-ex="10"] [data-ex-meta]')), 'Machine cardio · also: rower, erg · not done yet');
  assert.match(await page.locator('[data-ex="10"]').getAttribute('class'), /border-blue/);
  assert.equal(await text(page.locator('[data-count]')), '10 active');
  await noUndo('a new exercise');
  await page.goto(`${base}/gym/plan`);
  await page.locator('[data-card="how"]').waitFor();
  await page.locator('[data-add="1"]').click();
  assert.ok((await texts(page.locator('[data-add-form="1"] option'))).includes('Rowing machine'), 'the plan can use the new exercise');
  assert.ok(!(await items(1)).includes('Rowing machine'), 'it is not on any day');
  await standinPost('/standin/reset');

  // the list is empty: "+ New exercise" starts open
  await standinPost('/standin/gym-empty');
  await page.goto(`${base}/gym/exercises`);
  await page.locator('[data-card="exercises"]').waitFor();
  assert.equal(await text(page.locator('[data-empty]')), 'No exercises yet.');
  assert.equal(await page.locator('[data-new-form]').count(), 1, '+ New exercise is open');
  assert.equal(await text(page.locator('[data-count]')), '0 active');
  await checkWidth(page, 'gym exercises, empty');
  await page.locator('[data-new-name]').fill('Bench press');
  await page.locator('[data-new-go]').click();
  await headIs('Added Bench press (weights).');
  assert.equal(await page.locator('[data-ex]').count(), 1);
  await standinPost('/standin/reset');

  // ---- Progress
  await page.goto(`${base}/gym`);
  await open('progress', '/gym/progress');
  await page.locator('[data-card="progress"]').waitFor();
  assert.deepEqual(await texts(page.locator('[data-chip]')), PR.exercises.map((c) => c.name), 'the chips in the read’s order');
  assert.equal(await page.locator('[data-chip="1"]').getAttribute('aria-current'), 'page');
  assert.equal(await text(page.locator('[data-title]')), 'Bench press: top weight');
  assert.equal(await text(page.locator('[data-top]')), PR.top_text);
  assert.equal(await text(page.locator('[data-change]')), PR.change);
  assert.deepEqual(await texts(page.locator('[data-sub] li')), ['Top set 70 kg × 6', 'Estimated 1-rep max ≈ 84 kg']);
  assert.equal(await text(page.locator('[data-sub-part="orm"]')), `Estimated 1-rep max ≈ ${PR.one_rep_max} kg`);
  const pts = PR.chart.series[0].pts;
  assert.equal(await page.locator('[data-chart="gym"] [data-mark="dot"]').count(), pts.length, 'the chart: a dot per session');
  assert.equal(await page.locator('[data-chart="gym"] [data-mark="line"]').count(), 1);
  assert.equal(await page.locator('[data-chart="gym"] [data-mark="dot"]').last().locator('title').textContent(), pts.at(-1)[2], 'the last point’s text');
  const rows = await texts(page.locator('[data-recent] tr'));
  assert.deepEqual(rows, PR.recent.map((r) => `${new Date(`${r.day}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' })} ${r.day.slice(8, 10)}.${r.day.slice(5, 7)}.${r.text}`), 'the last 6 sessions');
  const per = PR.per_week.weeks;
  assert.deepEqual(await page.locator('[data-bar]').evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-bar')))), per.map((w) => w.n), 'the bars');
  assert.deepEqual(await page.locator('[data-bar]').evaluateAll((els) => els.map((e) => Number(e.getAttribute('height')))), per.map((w) => Math.round((w.n / PR.per_week.top) * 56 * 10) / 10), 'bar heights');
  assert.equal(await page.locator('[data-bar][data-now]').count(), 1);
  assert.equal(await page.locator('[data-bars] text').count(), per.length * 2, 'a count and a Monday per bar');
  assert.equal(await text(page.locator('[data-good]')), `${PR.per_week.good} of 8 weeks with 2+`);
  assert.match(await page.locator('[data-bars]').getAttribute('aria-label'), /^Workouts per week: week of 28\.09\.: 3, /);
  const [cc, wc, rc] = await Promise.all(['progress', 'per-week', 'recent'].map((c) => page.locator(`[data-card="${c}"]`).boundingBox()));
  if (pc) assert.ok(wc.x > cc.x + cc.width - 1 && Math.abs(wc.y - cc.y) < 2 && rc.y > wc.y + wc.height - 1, 'pc: the chart left, the bars and the sessions right');
  else assert.ok(wc.y > cc.y + cc.height - 1 && rc.y > wc.y + wc.height - 1 && Math.abs(wc.x - cc.x) < 2, `${name}: one column`);
  const svg = await page.locator('[data-chart="gym"] svg').boundingBox();
  assert.ok(svg.x >= 0 && svg.x + svg.width <= page.viewportSize().width + 1, 'the chart fits');
  await page.screenshot({ path: `${out}/gym-progress-${name}-${theme}.png`, fullPage: true });
  await checkWidth(page, 'gym progress');
  // a tap on a point shows its text
  await page.locator('[data-chart="gym"] [data-mark="dot"]').nth(2).click({ force: true });
  assert.equal(await text(page.locator('[data-chart="gym"] [data-tip]')), pts[2][2], 'a tap shows the point’s text');

  // another chip: the bike's longest session, no 1-rep max
  await page.locator('[data-chip="8"]').click();
  await page.waitForURL(/\/gym\/progress\?x=8$/);
  await page.locator('[data-chip="8"][aria-current="page"]').waitFor();
  assert.equal(await page.locator('[data-chip="1"]').getAttribute('aria-current'), null);
  assert.equal(await text(page.locator('[data-title]')), 'Exercise bike: longest session');
  assert.match(await text(page.locator('[data-top]')), /^\d+ min$/);
  assert.equal(await page.locator('[data-sub-part="orm"]').count(), 0, 'no 1-rep max for cardio');
  assert.equal(await page.locator('[data-chart="gym"] [data-mark="dot"]').count(), 6);
  assert.equal(await page.locator('[data-recent] tr').count(), 6);
  assert.equal(await text(page.locator('[data-good]')), `${PR.per_week.good} of 8 weeks with 2+`, 'the weeks do not depend on the exercise');
  if (name === 'phone') await page.screenshot({ path: `${out}/gym-progress-bike-${name}-${theme}.png`, fullPage: true });
  await checkWidth(page, 'gym progress, another exercise');
  // a question that is not an id is left out: the most recent exercise
  await page.goto(`${base}/gym/progress?x=abc`);
  await page.locator('[data-chip="1"][aria-current="page"]').waitFor();

  // nothing logged yet
  await standinPost('/standin/gym-empty');
  await page.goto(`${base}/gym/progress`);
  await page.locator('[data-card="empty"]').waitFor();
  assert.match(await text(page.locator('[data-empty]')), /^Nothing to show yet: tick exercises on the Workout part/);
  assert.equal(await page.locator('[data-bar]').count(), 8);
  await checkWidth(page, 'gym progress, empty');
  await standinPost('/standin/reset');

  // ---- Activity
  await page.goto(`${base}/gym`);
  await open('activity', '/gym/activity');
  await page.locator('[data-tiles]').waitFor();
  assert.equal(await text(page.locator('[data-day-title]')), 'Today 16.11.2026');
  assert.equal(await page.locator('[data-prev]').getAttribute('href'), '/gym/activity?day=2026-11-15');
  assert.equal(await page.locator('[data-next]').count(), 0, 'no day after today');
  assert.equal(await page.locator('[data-next-off]').count(), 1);
  assert.deepEqual(await texts(page.locator('[data-tile]')), AC.tiles.map((t) => `${t.label} ${t.text} ${t.sub ?? ''}`.replace(/\s+/g, ' ').trim()), 'the tiles');
  assert.equal(await text(page.locator('[data-sleep]')), AC.sleep.text);
  assert.equal(await text(page.locator('[data-in-bed]')), AC.sleep.in_bed);
  assert.equal(await text(page.locator('[data-stages]')), AC.sleep.stages_text);
  assert.equal(await text(page.locator('[data-typed]')), AC.sleep.typed_text);
  assert.equal(await page.locator('[data-watch]').count(), 1);
  assert.match(await text(page.locator('[data-watch]')), /^Traditional Strength Training 65 min · 310 kcal · avg 118 bpm Matches Day 1 · Push in the Logger 18:15–19:20$/);
  assert.equal(await text(page.locator('[data-match]')), 'Matches Day 1 · Push in the Logger');
  assert.deepEqual(await page.locator('[data-chart-card]').evaluateAll((els) => els.map((e) => e.getAttribute('data-chart-card'))), ['steps', 'sleep', 'rhr']);
  assert.deepEqual(await texts(page.locator('[data-chart-card] h2')), ['Steps', 'Sleep', 'Resting heart rate']);
  assert.equal(await page.locator('[data-chart="steps"] [data-mark="bar"]').count(), 7);
  assert.equal(await page.locator('[data-chart="sleep"] [data-mark="bar"]').count(), 7);
  assert.equal(await page.locator('[data-chart="rhr"] [data-mark="dot"]').count(), 7);
  assert.equal(await page.locator('[data-chart="rhr"] [data-mark="line"]').count(), 1);
  const [tl, ch] = await Promise.all([page.locator('[data-tiles]').boundingBox(), page.locator('[data-chart-card="steps"]').boundingBox()]);
  if (pc) assert.ok(ch.x > tl.x + tl.width - 1 && Math.abs(ch.y - tl.y) < 2, 'pc: the charts on the right');
  else assert.ok(ch.y > tl.y + tl.height - 1 && Math.abs(ch.x - tl.x) < 2, `${name}: one column`);
  const tiles4 = await page.locator('[data-tile]').evaluateAll((els) => new Set(els.map((e) => Math.round(e.getBoundingClientRect().y))).size);
  assert.equal(tiles4, name === 'phone' ? 4 : 2, `${name}: ${name === 'phone' ? 'two' : 'four'} tiles a row`);
  await page.screenshot({ path: `${out}/gym-activity-${name}-${theme}.png`, fullPage: true });
  await checkWidth(page, 'gym activity');
  // the day before, and back
  await page.locator('[data-prev]').click();
  await page.waitForURL(/\/gym\/activity\?day=2026-11-15$/);
  await page.locator('[data-day-title]', { hasText: 'Yesterday' }).waitFor();
  assert.equal(await text(page.locator('[data-day-title]')), 'Yesterday 15.11.2026');
  assert.equal(await page.locator('[data-watch]').count(), 0);
  assert.equal(await text(page.locator('[data-no-watch]')), 'None on this day.');
  assert.equal(await page.locator('[data-next]').getAttribute('href'), '/gym/activity', "today's own link has no day");
  assert.equal(await page.locator('[data-prev]').getAttribute('href'), '/gym/activity?day=2026-11-14');
  await page.locator('[data-prev]').click();
  await page.locator('[data-day-title]', { hasText: 'Sat 14.11.' }).waitFor();
  assert.equal(await text(page.locator('[data-day-title]')), 'Sat 14.11. 14.11.2026');
  await page.locator('[data-next]').click();
  await page.locator('[data-day-title]', { hasText: 'Yesterday' }).waitFor();
  await page.locator('[data-next]').click();
  await page.locator('[data-day-title]', { hasText: 'Today' }).waitFor();
  await page.goto(`${base}/gym/activity?day=nonsense`);
  await page.locator('[data-day-title]', { hasText: 'Today' }).waitFor();

  // the watch has sent nothing: the guide's words from the read; Activity stays in the parts row
  await standinPost('/standin/watch-none');
  await page.goto(`${base}/gym/progress`);
  await open('activity', '/gym/activity');
  const NONE = G.activity_none.gym_activity.setup;
  await page.locator('[data-card="setup"]').waitFor();
  assert.equal(await text(page.locator('[data-setup-title]')), NONE.title);
  assert.equal(await text(page.locator('[data-setup-intro]')), NONE.intro);
  assert.deepEqual(await texts(page.locator('[data-setup-steps] li')), NONE.steps.map((st) => st.map((x) => x.text).join('').replace(/\s+/g, ' ').trim()));
  assert.deepEqual(await texts(page.locator('[data-setup-steps] code')), NONE.steps.flat().filter((x) => x.code).map((x) => x.text), 'the code parts');
  assert.equal(await text(page.locator('[data-setup-note]')), NONE.note);
  assert.equal(await page.locator('[data-tiles]').count(), 0);
  assert.equal(await page.locator('[data-part="activity"][aria-current="page"]').count(), 1, 'Activity stays in the parts row');
  assert.equal(await page.locator('[data-part]').count(), 6);
  await page.screenshot({ path: `${out}/gym-activity-guide-${name}-${theme}.png`, fullPage: true });
  await checkWidth(page, 'gym activity, the guide');
  await standinPost('/standin/reset');

  // ---- History
  await page.goto(`${base}/gym`);
  await open('history', '/gym/history');
  await page.locator('[data-history]').waitFor();
  assert.deepEqual(await page.locator('[data-workout]').evaluateAll((els) => els.map((e) => e.id)), HI.map((w) => w.anchor), 'newest first, each with its anchor');
  const dm = (iso) => `${new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' })} ${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
  assert.deepEqual(await texts(page.locator('[data-date]')), HI.map((w) => dm(w.day)));
  assert.deepEqual(await texts(page.locator('[data-sub]')), HI.map((w) => `${w.split} · ${w.when}`));
  for (const w of [HI[0], HI[1], HI.at(-1)]) {
    const card = page.locator(`#${w.anchor}`);
    assert.deepEqual(await texts(card.locator('[data-line]')), w.exercises.map((x) => `${x.name} ${x.text}`), `${w.anchor}: its exercises with their sets`);
  }
  assert.equal(await text(page.locator('#w21 [data-sub]')), 'Push · 18:21–19:21');
  assert.equal(await text(page.locator('#w20 [data-sub]')), 'Arms · 20:01');
  const [h1, h2] = await Promise.all([page.locator('#w21').boundingBox(), page.locator('#w19').boundingBox()]);
  if (pc) assert.ok(Math.abs(h1.y - h2.y) < 2 && h2.x > h1.x + h1.width - 1, 'pc: two columns');
  else assert.ok(h2.y > h1.y + h1.height - 1 && Math.abs(h2.x - h1.x) < 2, `${name}: one column`);
  await page.screenshot({ path: `${out}/gym-history-${name}-${theme}.png`, fullPage: true });
  await checkWidth(page, 'gym history');
  // a link with an anchor jumps to the card, which is marked
  await page.goto(`${base}/gym/history#w13`);
  await page.locator('#w13').waitFor();
  await page.waitForTimeout(300);
  const at = await page.locator('#w13').boundingBox();
  assert.ok((await page.evaluate(() => window.scrollY)) > 100, 'the page scrolled to the card');
  assert.ok(at.y >= -1 && at.y < page.viewportSize().height / 2, `the card is in view (top at ${Math.round(at.y)} px)`);
  const edge = (id) => page.locator(id).evaluate((e) => getComputedStyle(e).borderTopColor);
  assert.notEqual(await edge('#w13'), await edge('#w12'), 'the card jumped to is marked');
  if (name === 'phone') await page.screenshot({ path: `${out}/gym-history-anchor-${name}-${theme}.png` });
  await checkWidth(page, 'gym history, an anchor');
  await standinPost('/standin/gym-empty');
  await page.goto(`${base}/gym/history`);
  await page.locator('[data-empty]').waitFor();
  assert.equal(await text(page.locator('[data-empty]')), 'No workouts yet.');
  await standinPost('/standin/reset');
  await page.goto(`${base}/`);
}

/**
 * Deploy 99: Home's first pages against the home sample. Today's Home card (its lines, after Habits, its buttons). Now: the tabs (Zones
 * and History at app.), the chips, This week, the six rows in the door's words, "Show all", Recently done; one column on phones and
 * tablets, the side column from 1100 px; Home in the rail and under More. A tick fills at once with the blue edge while its button is
 * blocked, the answer bar with Undo, the row kept in its place, a second tap takes it back, Undo; a tick that met a gone session is not
 * sent after the sign-in. Pick: the job card, the clock, Not today and Done it earlier? with Undo staying on Pick, Start timer counting
 * down without a reload, Pause and Resume, Done next job, Stop timer, a timer reaching zero (Time is up, Pause and next gone, Finished),
 * a refusal next to its button, Done ending on Now with the answer bar and Undo. Now's timer card counting; a paused timer; no chores.
 */
async function checkHome(page, name, theme) {
  await standinPost('/standin/reset');
  const N = HOME.home.home;
  const P = HOME.pick.home_pick;
  const pc = name === 'pc';
  const bar = page.locator('[data-bar]');
  const headIs = async (want) => {
    await page.locator('[data-bar-head]', { hasText: want }).first().waitFor();
    assert.equal(await text(page.locator('[data-bar-head]')), want, 'the answer bar');
  };
  const undoBtn = () => bar.getByRole('button', { name: 'Undo' });
  const row = (c, z) => page.locator(`[data-hrow="${c}:${z}"]`);
  const labels = () => page.locator('[data-list="rows"] [data-hlabel]').allTextContents().then((x) => x.map((t) => t.trim()));
  const clock = () => text(page.locator('[data-clock]'));
  const buttons = () => page.locator('[data-buttons] [data-btn]').evaluateAll((els) => els.map((e) => e.getAttribute('data-btn')));

  // Today's Home card, from the stand-in's day: its lines, after Habits, its buttons
  await page.goto(`${base}/`);
  const c = day.home;
  const hc = page.locator('[data-card="home"]');
  await hc.waitFor();
  assert.equal(await text(hc.locator('[data-home-week]')), c.text);
  assert.equal(await text(hc.locator('[data-home-label]')), c.waiting.label);
  assert.equal(await text(hc.locator('[data-home-meta]')), `${c.waiting.age_text} · ${c.waiting.interval_text}`);
  assert.equal(await hc.locator('[data-home-hidden]').count(), 0);
  assert.equal(await hc.locator('[data-home-15]').getAttribute('href'), '/home/pick?min=15');
  assert.equal(await text(hc.locator('[data-home-15]')), '15 minutes');
  assert.equal(await hc.locator('[data-home-open]').getAttribute('href'), '/home');
  const [hab, hom] = await Promise.all(['habits', 'home'].map((k) => page.locator(`[data-card="${k}"]`).boundingBox()));
  assert.ok(hom.y > hab.y + hab.height - 1 && Math.abs(hom.x - hab.x) < 2, `${name}: the Home card under Habits (deploy 117: Health and Gym between)`);
  if (name === 'phone') await hc.screenshot({ path: `${out}/today-home-card-${name}-${theme}.png` });
  await hc.locator('[data-home-open]').click();
  await page.waitForURL(/\/home$/);
  await page.locator('[data-card="rows"]').waitFor();
  await page.evaluate(() => (window.__noReload = true));

  // Now, against the sample
  assert.equal(await text(page.locator('h1')), 'Home');
  assert.deepEqual(await page.locator('[data-tab]').evaluateAll((els) => els.map((e) => [e.getAttribute('data-tab'), e.getAttribute('href').replace(/^https?:\/\/[^/]+/, ''), e.getAttribute('aria-current')])), [
    ['now', '/home', 'page'], ['zones', '/home/zones', null], ['history', '/home/history', null],
  ]);
  assert.equal(await page.locator('[data-tab] >> text=↗').count() + (await page.locator('[data-tabs]').getByText('full app').count()), 0, 'no full-app marks on the tabs (deploy 100)');
  assert.deepEqual(await page.locator('[data-chip]').evaluateAll((els) => els.map((e) => [e.textContent.trim(), e.getAttribute('href'), e.getAttribute('aria-current')])),
    N.minutes_options.map((o) => [o.label, `/home?min=${o.minutes}`, o.minutes === N.minutes ? 'true' : null]));
  assert.equal(await page.locator('[data-pick]').getAttribute('href'), `/home/pick?min=${N.minutes}`);
  assert.equal(await page.locator('[data-card="timer"]').count(), 0, 'no timer card without a timer');
  assert.equal(await text(page.locator('[data-week-count]')), `${N.week.this} of ${N.week.goal} sessions`);
  assert.deepEqual(await page.locator('[data-seg]').evaluateAll((els) => els.map((e) => e.getAttribute('data-seg'))), Array.from({ length: N.week.goal }, (_, i) => (i < N.week.this ? 'on' : 'off')));
  assert.equal(await text(page.locator('[data-weeks]')), `Last 4 weeks: ${N.week.weeks.join(' · ')}`);
  assert.equal(await text(page.locator('[data-count]')), `${N.count} chores`);
  assert.deepEqual(await labels(), N.rows.slice(0, 6).map((r) => r.label), 'six rows, waiting longest first');
  for (const r of N.rows.slice(0, 6)) {
    assert.equal(await text(row(r.chore_id, r.zone_id).locator('[data-hmeta]')), `${r.age_text} · ${r.interval_text}`);
    assert.equal(await text(row(r.chore_id, r.zone_id).locator('[data-hmin]')), `${r.minutes} min`);
    assert.equal(await row(r.chore_id, r.zone_id).locator('[data-tick]').getAttribute('aria-pressed'), String(r.done_today));
    assert.equal(await row(r.chore_id, r.zone_id).locator('[data-hlink]').getAttribute('href'), `/home/chore?id=${r.chore_id}`, 'a chore opens its page here, not at app.');
  }
  assert.equal(await text(page.locator('[data-show-all]')), `Show all ${N.count} chores`, 'no arrow');
  assert.equal(await page.locator('[data-show-all]').getAttribute('href'), '/home/zones');
  assert.equal(await page.locator('[data-hidden]').count(), 0);
  assert.deepEqual(await page.locator('[data-recent]').evaluateAll((els) => els.map((e) => e.textContent.replace(/\s+/g, ' ').trim())), N.recent.map((e) => `${e.label} ${e.when}`));
  const [tm, wk, rw, rc] = await Promise.all(['time', 'week', 'rows', 'recent'].map((k) => page.locator(`[data-card="${k}"]`).boundingBox()));
  if (pc) assert.ok(wk.x > tm.x + tm.width - 1 && Math.abs(wk.y - tm.y) < 2 && Math.abs(wk.width - 340) < 2 && rc.y > wk.y + wk.height - 1 && rw.y > tm.y + tm.height - 1, 'pc: time and list in the middle, This week and Recently done right (340 px)');
  else assert.ok(wk.y > tm.y + tm.height - 1 && rw.y > wk.y + wk.height - 1 && rc.y > rw.y + rw.height - 1 && Math.abs(wk.x - tm.x) < 2, `${name}: one column in app.'s order`);
  await page.screenshot({ path: `${out}/home-now-${name}-${theme}.png`, fullPage: true });
  await checkWidth(page, 'home now');

  // the places: Home in the rail on the PC (highlighted), the More tab on phones and tablets; and under More, not greyed
  if (pc) {
    assert.equal(await page.locator('[data-rail-space="home"]').getAttribute('aria-current'), 'page');
    assert.equal(await page.locator('[data-rail-space="home"]').getAttribute('href'), '/home');
  } else assert.equal(await page.locator('[data-place="more"]').getAttribute('aria-current'), 'true', 'the More tab is highlighted on /home');

  // a tick: filled at once with the blue edge while its button is blocked, then the answer bar with Undo; the row keeps its place
  const fridge = N.rows.find((r) => r.chore_id === 4);
  const tick = row(4, 1).locator('[data-tick]');
  await standinPost('/standin/slow');
  await tick.click();
  assert.equal(await tick.getAttribute('aria-pressed'), 'true', 'filled at once');
  assert.ok(await tick.isDisabled(), 'blocked while its save is on the way');
  assert.equal(await row(4, 1).locator('[data-ring]').getAttribute('data-ring'), 'fresh', 'the blue edge');
  await headIs(`Saved: ${fridge.label}`);
  assert.equal(await undoBtn().count(), 1);
  assert.equal(await tick.getAttribute('aria-pressed'), 'true');
  assert.equal(await text(row(4, 1).locator('[data-hmeta]')), `today · ${fridge.interval_text}`);
  assert.deepEqual(await labels(), N.rows.slice(0, 6).map((r) => r.label), 'the ticked row stays in its place');
  assert.match(await row(4, 1).locator('[data-ring]').getAttribute('class'), /border-blue/);
  await page.screenshot({ path: `${out}/home-now-ticked-${name}-${theme}.png` });
  await checkWidth(page, 'home now ticked');
  // a second tap takes the tick back
  await tick.click();
  await headIs(`Ticked off: ${fridge.label}`);
  assert.equal(await tick.getAttribute('aria-pressed'), 'false');
  assert.equal(await text(row(4, 1).locator('[data-hmeta]')), `${fridge.age_text} · ${fridge.interval_text}`);
  // tick again, then Undo
  await tick.click();
  await headIs(`Saved: ${fridge.label}`);
  await undoBtn().click();
  await headIs('Undone: the tick is gone.');
  assert.equal(await tick.getAttribute('aria-pressed'), 'false');
  assert.ok(await page.evaluate(() => window.__noReload), 'no reload');
  await standinPost('/standin/reset');

  // never sent again: a tick that met a gone session is not saved after the sign-in
  await page.goto(`${base}/home`);
  await page.locator('[data-card="rows"]').waitFor();
  await standinPost('/standin/drop-sessions');
  await row(4, 1).locator('[data-tick]').click();
  await page.getByRole('button', { name: 'Sign in' }).waitFor();
  await page.fill('#password', 'test');
  await page.fill('#code', '123 456');
  await page.click('button[type=submit]');
  await page.waitForURL(/\/home$/);
  await page.locator('[data-card="rows"]').waitFor();
  await page.waitForTimeout(500);
  assert.equal(await row(4, 1).locator('[data-tick]').getAttribute('aria-pressed'), 'false', 'not sent again after the sign-in');

  // Pick, without a timer
  await page.locator('[data-pick]').click();
  await page.waitForURL(/\/home\/pick\?min=15$/);
  await page.locator('[data-card="job"]').waitFor();
  await page.evaluate(() => (window.__noReload = true));
  assert.equal(await page.locator('[data-back]').getAttribute('href'), '/home');
  assert.equal(await text(page.locator('[data-title]')), P.title);
  assert.equal(await text(page.locator('[data-pill="zone"]')), P.job.zone);
  assert.equal(await text(page.locator('[data-pill="age"]')), P.job.age_text);
  assert.equal(await text(page.locator('[data-of]')), `Job ${P.n + 1} of ${P.count}`);
  assert.equal(await text(page.locator('[data-job]')), P.job.title);
  assert.equal(await clock(), '15:00');
  assert.equal(await page.locator('[data-card="clock"]').getAttribute('data-state'), 'none');
  assert.equal(await text(page.locator('[data-btn="start"]')), 'Start timer');
  assert.deepEqual(await buttons(), ['done', 'another', 'skip']);
  assert.equal(await page.locator('[data-btn="another"]').getAttribute('href'), '/home/pick?min=15&n=1');
  assert.deepEqual(await page.locator('[data-also]').evaluateAll((els) => els.map((e) => [e.textContent.trim(), e.getAttribute('href')])), P.also.map((a) => [a.title, `/home/pick?min=15&n=${a.n}`]));
  assert.equal(await text(page.locator('[data-card="also"] h2')), 'Also fits in 15 minutes');
  assert.equal(await page.locator('[data-earlier]').count(), 0, 'Done it earlier? folded');
  await page.screenshot({ path: `${out}/home-pick-${name}-${theme}.png`, fullPage: true });
  await checkWidth(page, 'home pick');

  // Not today: the next job, the answer bar with Undo, on Pick; Undo brings the job back
  await page.locator('[data-btn="skip"]').click();
  await headIs(`Not today: ${P.job.title} · ${P.job.zone}`);
  assert.equal(await text(page.locator('[data-job]')), P.also[0].title, 'the next job');
  assert.match(page.url(), /\/home\/pick/);
  await undoBtn().click();
  await headIs('Undone: the job is back in the list.');
  assert.equal(await text(page.locator('[data-job]')), P.job.title);

  // Done it earlier?: Yesterday, then a date, each with Undo, on Pick
  await page.locator('[data-earlier-open]').click();
  assert.deepEqual(await page.locator('[data-when]').allTextContents().then((x) => x.map((t) => t.trim())), P.earlier.map((e) => e.label));
  assert.equal(await page.locator('[data-earlier-date]').getAttribute('max'), '2026-11-15');
  await checkWidth(page, 'home pick, done earlier open');
  await page.locator('[data-when="1"]').click();
  await headIs(`Saved: ${P.job.title} · ${P.job.zone} on 15.11.`);
  assert.equal(await undoBtn().count(), 1);
  assert.match(page.url(), /\/home\/pick/);
  await undoBtn().click();
  await headIs('Undone: the tick is gone.');
  await page.locator('[data-earlier-open]').click();
  await page.locator('[data-earlier-date]').fill('2026-11-02');
  await page.locator('[data-earlier-save]').click();
  await headIs(`Saved: ${P.job.title} · ${P.job.zone} on 02.11.`);
  await undoBtn().click();
  await headIs('Undone: the tick is gone.');

  // Start timer: the clock counts down in the browser, without a reload
  await page.locator('[data-btn="start"]').click();
  await headIs('Timer started: 15 minutes.');
  assert.equal(await undoBtn().count(), 0, 'no Undo for a timer');
  await page.locator('[data-card="clock"][data-state="running"]').waitFor();
  const c1 = await clock();
  await page.waitForTimeout(1300);
  const c2 = await clock();
  assert.match(c1, /^1[45]:\d\d$/);
  assert.ok(c2 < c1, `the clock counts down (${c1} -> ${c2})`);
  assert.deepEqual(await buttons(), ['done', 'next', 'stop']);
  assert.equal(await text(page.locator('[data-btn="stop"]')), 'Stop timer');
  assert.equal(await text(page.locator('[data-btn="pause"]')), 'Pause');
  assert.match(await page.locator('[data-btn="done"]').getAttribute('class'), /bg-text/, 'Done is the main button');
  // deploy 100: no label of the three buttons wraps (at 390 px "Stop timer" has a row of its own), each 44 px tall on phones and tablets
  const lines = await page.locator('[data-buttons] [data-btn]').evaluateAll((els) =>
    els.map((e) => {
      const r = document.createRange();
      r.selectNodeContents(e);
      return [e.getAttribute('data-btn'), r.getClientRects().length, Math.round(e.getBoundingClientRect().height)];
    }),
  );
  for (const [b, n, h] of lines) {
    assert.equal(n, 1, `${name}: the label of ${b} is on one line`);
    if (!pc) assert.ok(h >= 44, `${name}: ${b} is 44 px tall (${h})`);
  }
  if (name === 'phone') {
    const [bd, bn, bs] = await Promise.all(['done', 'next', 'stop'].map((k) => page.locator(`[data-btn="${k}"]`).boundingBox()));
    assert.ok(Math.abs(bd.y - bn.y) < 2 && bs.y > bd.y + bd.height - 1 && Math.abs(bs.width - (bd.width + bn.width + 8)) < 2, 'phone: Done and Done, next job side by side, Stop timer on its own row');
  }
  assert.equal(await page.locator('[data-card="earlier"]').count(), 0);
  assert.equal(await page.locator('[data-card="also"]').count(), 0);
  await page.screenshot({ path: `${out}/home-pick-running-${name}-${theme}.png`, fullPage: true });
  await checkWidth(page, 'home pick running');
  // Pause and Resume
  await page.locator('[data-btn="pause"]').click();
  await headIs('Timer paused.');
  await page.locator('[data-card="clock"][data-state="paused"]').waitFor();
  assert.equal(await text(page.locator('[data-line]')), 'Paused.');
  const p1 = await clock();
  await page.waitForTimeout(1100);
  assert.equal(await clock(), p1, 'a paused clock stands');
  assert.deepEqual(await buttons(), ['done', 'stop']);
  await page.locator('[data-btn="resume"]').click();
  await headIs('Timer running again.');
  await page.locator('[data-card="clock"][data-state="running"]').waitFor();
  // Done, next job: ticked, the timer goes on with the next job, Undo; the page stays
  await page.locator('[data-btn="next"]').click();
  await headIs(`Saved: ${P.job.title} · ${P.job.zone}. Next: ${P.also[0].title}`);
  assert.equal(await undoBtn().count(), 1);
  assert.equal(await text(page.locator('[data-job]')), P.also[0].title);
  await page.locator('[data-card="clock"][data-state="running"]').waitFor();
  // Stop timer
  await page.locator('[data-btn="stop"]').click();
  await headIs('Timer closed.');
  await page.locator('[data-card="clock"][data-state="none"]').waitFor();
  assert.ok(await page.evaluate(() => window.__noReload), 'no reload on Pick');
  await standinPost('/standin/reset');

  // a refusal next to its button: the timer closed elsewhere, then Pause
  await standinPost('/standin/home-running');
  await page.goto(`${base}/home/pick`);
  await page.locator('[data-card="clock"][data-state="running"]').waitFor();
  await standinPost('/standin/home-closed');
  await page.locator('[data-btn="pause"]').click();
  await page.locator('[data-card="clock"] [data-err]').waitFor();
  assert.equal(await text(page.locator('[data-card="clock"] [data-err]')), 'That timer is not running.');
  assert.equal(await page.locator('[data-bar]').count(), 0, 'said next to the button, not in the bar');
  await standinPost('/standin/reset');

  // a timer reaching zero, without a reload: Time is up, Pause and next gone, Finished
  await standinPost('/standin/home-ending');
  await page.goto(`${base}/home/pick`);
  await page.locator('[data-card="clock"][data-state="running"]').waitFor();
  await page.evaluate(() => (window.__noReload = true));
  assert.deepEqual(await buttons(), ['done', 'stop'], 'under 3 minutes left: no Done, next job');
  await page.locator('[data-card="clock"][data-state="over"]').waitFor({ timeout: 10000 });
  assert.equal(await clock(), '00:00');
  assert.equal(await text(page.locator('[data-line]')), 'Time is up · well done');
  assert.equal(await page.locator('[data-btn="pause"]').count(), 0);
  assert.deepEqual(await buttons(), ['done', 'stop']);
  assert.equal(await text(page.locator('[data-btn="stop"]')), 'Finished');
  assert.ok(await page.evaluate(() => window.__noReload), 'zero without a reload');
  await page.screenshot({ path: `${out}/home-pick-over-${name}-${theme}.png`, fullPage: true });
  await page.locator('[data-btn="stop"]').click();
  await headIs('Timer closed.');
  await standinPost('/standin/reset');

  // Done: the job ticked, the page ends on Now with the answer bar and Undo there
  await page.goto(`${base}/home/pick?min=15`);
  await page.locator('[data-card="job"]').waitFor();
  await page.locator('[data-btn="done"]').click();
  await page.waitForURL(/\/home$/);
  await headIs(`Saved: ${P.job.title} · ${P.job.zone}`);
  assert.equal(await undoBtn().count(), 1, 'Undo on Now');
  await undoBtn().click();
  await headIs('Undone: the tick is gone.');
  await standinPost('/standin/reset');

  // Now with a running timer: the Timer card counting (the mockup's screen 9 on the PC); a paused one
  await standinPost('/standin/home-running');
  await page.goto(`${base}/home`);
  const tc = page.locator('[data-card="timer"]');
  await tc.waitFor();
  assert.equal(await text(tc.locator('[data-timer-title]')), P.job.title);
  assert.equal(await tc.locator('[data-open-timer]').getAttribute('href'), '/home/pick');
  const l1 = await text(tc.locator('[data-left]'));
  await page.waitForTimeout(1300);
  const l2 = await text(tc.locator('[data-left]'));
  assert.match(l1, /^1[45]:\d\d left$/);
  assert.notEqual(l1, l2, 'the card counts each second');
  const [tt, tm2] = await Promise.all(['timer', 'time'].map((k) => page.locator(`[data-card="${k}"]`).boundingBox()));
  assert.ok(tm2.y > tt.y + tt.height - 1, 'the timer card first');
  if (pc) await page.screenshot({ path: `${out}/home-now-timer-${name}-${theme}.png` });
  await checkWidth(page, 'home now with a timer');
  await standinPost('/standin/reset');
  await standinPost('/standin/home-paused');
  await page.reload();
  await tc.waitFor();
  assert.equal(await text(tc.locator('[data-left]')), '7:05 left (paused)');
  await page.goto(`${base}/home/pick`);
  await page.locator('[data-card="clock"][data-state="paused"]').waitFor();
  assert.equal(await clock(), '07:05');
  assert.equal(await text(page.locator('[data-btn="resume"]')), 'Resume');
  await standinPost('/standin/reset');

  // no zones or chores: Now's and Pick's empty cards, no card on Today
  await standinPost('/standin/home-empty');
  await page.goto(`${base}/home`);
  assert.equal(await text(page.locator('[data-empty]')), 'No zones or chores yet.');
  await page.goto(`${base}/home/pick`);
  assert.equal(await text(page.locator('[data-empty]')), 'No zones or chores yet.');
  await page.goto(`${base}/`);
  await page.locator('[data-card="habits"]').waitFor();
  assert.equal(await page.locator('[data-card="home"]').count(), 0, 'no Home card without chores');
  await standinPost('/standin/reset');
  await page.goto(`${base}/`);
}

/**
 * Home's other four pages (deploy 100): Zones (starting points, Whole flat with its tiles and All done, a card per zone, the ticks), History
 * (×, + Add one done earlier, Show more, nothing ticked), a chore's page (a zone chore, a whole-flat chore, an unknown one) and Edit zones
 * (the goal, the chore and zone forms, Per zone, Retire and Bring back, the new chore and zone, the refusals next to their forms, no Undo),
 * all against the stand-in, which changes the data as the core would.
 */
async function checkHomeParts(page, name, theme) {
  await standinPost('/standin/reset');
  const Z = HOME.zones.home_zones;
  const HI = HOME.history.home_history;
  const E = HOME.edit.home_edit;
  const pc = name === 'pc';
  const bar = page.locator('[data-bar]');
  const headIs = async (want) => {
    await page.locator('[data-bar-head]', { hasText: want }).first().waitFor();
    assert.equal(await text(page.locator('[data-bar-head]')), want, 'the answer bar');
  };
  const undoBtn = () => bar.getByRole('button', { name: 'Undo' });
  const tabOn = async (tab) => assert.equal(await page.locator('[data-tab][aria-current="page"]').getAttribute('data-tab'), tab, `the ${tab} tab is lit`);
  const fold = (id) => page.locator(`[data-zone="${id}"]`);
  const tile = (c, z) => page.locator(`[data-tile="${c}:${z}"]`);
  const ticked = (c, z) => page.locator(`[data-zone] [data-hrow="${c}:${z}"]`).first().getAttribute('data-done');
  const shot = (n) => page.screenshot({ path: `${out}/homeparts-${n}-${name}-${theme}.png`, fullPage: true });

  // ---- Zones, against the sample -----------------------------------------------------------------------------------------------
  await page.goto(`${base}/home`);
  await page.locator('[data-card="rows"]').waitFor();
  await page.locator('[data-tab="zones"]').click();
  await page.waitForURL(/\/home\/zones$/);
  await page.locator('[data-card="flat"]').waitFor();
  await page.evaluate(() => (window.__noReload = true));
  await tabOn('zones');
  assert.equal(await page.locator('[data-edit-link]').getAttribute('href'), '/home/edit');
  assert.equal(await text(page.locator('[data-edit-link]')), 'Edit zones');
  const start = page.locator('[data-card="start"]');
  assert.equal(await text(start.locator('h2')), 'When did you last do these?');
  assert.deepEqual(await start.locator('[data-start-title]').allTextContents(), Z.start.jobs.map((j) => `${j.name} · ${j.where}`));
  for (const j of Z.start.jobs) {
    const row = page.locator(`[data-start="${j.pairs.map(([c, z]) => `${c}-${z}`).join(',')}"]`);
    assert.equal(await text(row), `${j.name} · ${j.where} ${j.interval_text} ${Z.start.answers.map((a) => a.label).join('')}`);
    assert.deepEqual(await row.locator('[data-chip]').evaluateAll((els) => els.map((e) => [e.getAttribute('data-chip'), e.textContent.trim()])), Z.start.answers.map((a) => [a.ago, a.label]));
  }
  assert.equal(await page.locator('[data-more]').count(), 0, 'no "more jobs" line when the door says none');
  assert.match(await text(start), /A rough answer is enough: it gives the job a starting point\. It is not a session and not under Recently done\./);
  assert.equal(await text(page.locator('[data-card="flat"] h2')), 'Whole flat');
  for (const f of Z.flat) {
    const card = page.locator(`[data-flat="${f.chore_id}"]`);
    assert.equal(await text(card.locator('[data-flat-link]')), f.name);
    assert.equal(await card.locator('[data-flat-link]').getAttribute('href'), `/home/chore?id=${f.chore_id}`);
    assert.equal(await text(card.locator('[data-flat-line]')), `· ${f.per_zone.text}`);
    assert.equal(await text(card.locator('[data-alldone]')), f.all_done_today ? 'All done ✓' : 'All done');
    assert.deepEqual(await card.locator('[data-tile]').evaluateAll((els) => els.map((e) => [e.getAttribute('data-tile'), e.querySelector('[data-tile-short]').textContent.trim(), e.querySelector('[data-tile-age]').textContent.trim(), e.getAttribute('data-tinted')])),
      f.tiles.map((t) => [`${t.chore_id}:${t.zone_id}`, t.short, t.age_short, String(t.tinted)]));
  }
  assert.deepEqual(await page.locator('[data-zone] [data-zone-name]').allTextContents(), Z.zones.map((z) => z.name));
  for (const z of Z.zones) {
    assert.equal(await text(fold(z.zone_id).locator('[data-zone-summary]')), `${z.count} chores · oldest ${z.oldest_text}`);
    assert.equal(await fold(z.zone_id).getAttribute('data-open'), String(z.open), 'open or folded as the door says');
    assert.deepEqual(await fold(z.zone_id).locator('[data-hrow]').evaluateAll((els) => els.map((e) => e.getAttribute('data-hrow'))), z.chores.map((r) => `${r.chore_id}:${r.zone_id}`));
    for (const r of z.chores) {
      const row = fold(z.zone_id).locator(`[data-hrow="${r.chore_id}:${r.zone_id}"]`);
      assert.equal(await text(row.locator('[data-hlabel]')), r.name);
      assert.equal(await text(row.locator('[data-hmeta]')), `${r.interval_text} · ${r.age_text}`);
      assert.equal(await text(row.locator('[data-hmin]')), `${r.minutes} min`);
      assert.equal(await row.locator('[data-hlink]').getAttribute('href'), `/home/chore?id=${r.chore_id}`);
    }
  }
  assert.equal(await page.locator('[data-todoist]').count(), 0);
  const bad = await page.evaluate(() => /overdue/i.test(document.body.innerText));
  assert.equal(bad, false, 'no "overdue" anywhere');
  const [mid, zn] = await Promise.all(['[data-col="middle"]', '[data-col="zones"]'].map((q) => page.locator(q).boundingBox()));
  if (pc) assert.ok(zn.x > mid.x + mid.width - 1 && Math.abs(zn.y - mid.y) < 2 && Math.abs(zn.width - mid.width) < 2, 'pc: starting points and Whole flat in the middle, the zone cards beside them');
  else assert.ok(zn.y > mid.y + mid.height - 1 && Math.abs(zn.x - mid.x) < 2, `${name}: one column`);
  assert.equal(await page.locator('[data-tile]').first().evaluate((e) => getComputedStyle(e).color !== '' && e.getBoundingClientRect().height >= 44), true, 'a tile is 44 px tall');
  if (!pc) {
    const w = await page.locator('[data-tiles]').first().evaluate((e) => [...e.children].map((c) => Math.round(c.getBoundingClientRect().y)));
    assert.equal(new Set(w.slice(0, 4)).size, 1, 'four tiles in a row');
  }
  await shot('zones');
  await checkWidth(page, 'home zones');

  // a starting point: the row leaves at once, Undo brings the job back
  await page.locator(`[data-start="7-2"] [data-chip="week"]`).click();
  assert.equal(await page.locator(`[data-start="7-2"]`).count(), 0, 'the row left at once');
  await headIs('Starting point: Fresh towels · Bathroom');
  assert.equal(await undoBtn().count(), 1);
  assert.deepEqual(await start.locator('[data-start-title]').allTextContents(), ['Vacuum · 2 zones', 'Dust · Kitchen']);
  await undoBtn().click();
  await headIs('Undone: the tick is gone.');
  assert.deepEqual(await start.locator('[data-start-title]').allTextContents(), Z.start.jobs.map((j) => `${j.name} · ${j.where}`));
  await page.locator(`[data-start="2-2,2-3"] [data-chip="unknown"]`).click();
  await headIs('Left as not logged yet: Vacuum · 2 zones');
  assert.deepEqual(await start.locator('[data-start-title]').allTextContents(), ['Fresh towels · Bathroom', 'Dust · Kitchen']);
  await undoBtn().click();
  await headIs('Undone: the job is back on the card.');
  await page.locator(`[data-start="7-2"] [data-chip="month"]`).click();
  await headIs('Starting point: Fresh towels · Bathroom');
  await page.locator(`[data-start="1-1"] [data-chip="longer"]`).click();
  await headIs('Starting point: Dust · Kitchen');
  await page.locator(`[data-start="2-2,2-3"] [data-chip="week"]`).click();
  await headIs('Starting point: Vacuum · 2 zones');
  assert.equal(await page.locator('[data-card="start"]').count(), 0, 'no card when no job is left');
  assert.equal(await text(tile(2, 2).locator('[data-tile-age]')), '3 days', 'the starting point shows on the tile');

  // All done: the label and the tiles at once, a second tap takes it back, each with Undo
  await page.locator('[data-alldone="2"]').click();
  assert.equal(await text(page.locator('[data-alldone="2"]')), 'All done ✓');
  await headIs('Saved: Vacuum · whole flat');
  assert.equal(await undoBtn().count(), 1);
  assert.equal(await page.locator('[data-alldone="2"]').getAttribute('aria-pressed'), 'true');
  for (const z of [1, 2, 3]) {
    assert.equal(await text(tile(2, z).locator('[data-tile-age]')), 'today');
    assert.equal(await tile(2, z).getAttribute('data-tinted'), 'true');
  }
  assert.equal(await ticked(2, 1), 'true', 'the same pair in its zone card is ticked');
  await shot('zones-acted');
  await page.locator('[data-alldone="2"]').click();
  await headIs('Ticked off: Vacuum · whole flat');
  assert.equal(await text(page.locator('[data-alldone="2"]')), 'All done');
  assert.equal(await ticked(2, 1), 'false');
  await undoBtn().click();
  await headIs('Undone: Vacuum · whole flat is done again.');
  assert.equal(await text(page.locator('[data-alldone="2"]')), 'All done ✓');
  // a tile: ticks that zone (the row of its card too), a second tap takes it back, Undo
  await tile(1, 1).click();
  assert.equal(await tile(1, 1).getAttribute('data-tinted'), 'true', 'tinted at once');
  await headIs('Saved: Dust · Kitchen');
  assert.equal(await ticked(1, 1), 'true');
  assert.equal(await page.locator('[data-zone="1"] [data-hrow="1:1"] [data-ring]').getAttribute('data-ring'), 'fresh', 'the blue edge');
  await tile(1, 1).click();
  await headIs('Ticked off: Dust · Kitchen');
  assert.equal(await ticked(1, 1), 'false');
  await undoBtn().click();
  await headIs('Undone: Dust · Kitchen is done again.');
  // a row's circle in a zone card; folding a card keeps its place across a save
  await fold(2).locator('[data-fold]').click();
  assert.equal(await fold(2).getAttribute('data-open'), 'false');
  await fold(1).locator('[data-hrow="3:1"] [data-tick]').click();
  await headIs('Saved: Wipe the stove · Kitchen');
  assert.equal(await fold(2).getAttribute('data-open'), 'false', 'a folded card stays folded after a save');
  assert.equal(await fold(1).getAttribute('data-open'), 'true');
  assert.equal(await tile(3, 1).count(), 0);
  assert.ok(await page.evaluate(() => window.__noReload), 'no reload on Zones');
  await fold(2).locator('[data-fold]').click();
  assert.equal(await fold(2).getAttribute('data-open'), 'true');
  await page.screenshot({ path: `${out}/homeparts-zones-end-${name}-${theme}.png`, fullPage: true });
  await standinPost('/standin/reset');

  // ---- History -----------------------------------------------------------------------------------------------------------------
  await page.goto(`${base}/home/zones`);
  await page.locator('[data-tab="history"]').click();
  await page.waitForURL(/\/home\/history$/);
  await page.locator('[data-card="history"]').waitFor();
  await tabOn('history');
  assert.equal(await text(page.locator('[data-card="history"] h2')), 'Ticked lately');
  assert.equal(await text(page.locator('[data-count]')), `last ${HI.count}`);
  assert.deepEqual(await page.locator('[data-day]').allTextContents(), HI.days.map((d) => d.label));
  for (const d of HI.days) {
    for (const e of d.rows) {
      const row = page.locator(`[data-hist="${e.ids.join(',')}"]`);
      assert.equal(await text(row.locator('[data-time]')), e.dated ? '' : e.time, 'a dated row has no time');
      assert.equal(await text(row.locator('[data-label]')), e.label);
      assert.equal(await text(row.locator('[data-how]')), e.how);
      assert.equal(await row.locator('[data-remove]').getAttribute('aria-label'), `Remove ${e.label}`);
    }
  }
  assert.equal(await page.locator('[data-more]').count(), 0, 'no Show more while the door says none');
  await shot('history');
  await checkWidth(page, 'home history');
  // + Add one done earlier
  await page.locator('[data-earlier-open]').click();
  assert.deepEqual(await page.locator('[data-earlier-job] option').allTextContents(), HI.jobs.map((j) => j.label));
  assert.equal(await text(page.locator('[data-earlier-form]')), `Job ${HI.jobs.map((j) => j.label).join('')} Done on Save It gets 12:00 on that day.`);
  assert.equal(await page.locator('[data-earlier-date]').getAttribute('max'), '2026-11-15');
  assert.equal(await page.locator('[data-earlier-date]').getAttribute('min'), '2025-11-16');
  await page.locator('[data-earlier-date]').fill('2026-11-16');
  await page.locator('[data-earlier-save]').click();
  await page.locator('[data-earlier-form] [data-err]').waitFor();
  assert.equal(await text(page.locator('[data-earlier-form] [data-err]')), 'Pick a day before today, in the last year.');
  assert.equal(await page.locator('[data-earlier-date]').inputValue(), '2026-11-16', 'what was typed stays');
  assert.equal(await bar.count(), 0, 'said next to the form, not in the bar');
  await page.locator('[data-earlier-date]').fill('2026-11-02');
  await page.locator('[data-earlier-save]').click();
  await headIs('Saved: Clean the fridge · Kitchen on 02.11.');
  assert.equal(await undoBtn().count(), 1);
  assert.equal(await page.locator('[data-earlier-form]').count(), 0, 'the form closes');
  const added = page.locator('[data-day="2026-11-02"] + [data-day-rows] [data-hist]');
  assert.equal(await text(added.locator('[data-label]')), 'Clean the fridge · Kitchen');
  assert.equal(await text(added.locator('[data-how]')), 'earlier');
  assert.equal(await text(added.locator('[data-time]')), '');
  assert.equal(await text(page.locator('[data-count]')), `last ${HI.count + 1}`);
  await shot('history-earlier');
  await undoBtn().click();
  await headIs('Undone: the tick is gone.');
  assert.equal(await page.locator('[data-day="2026-11-02"]').count(), 0);
  // × : the row leaves at once, Undo puts it back
  const sink = HI.days[0].rows[0];
  await page.locator(`[data-remove="${sink.ids.join(',')}"]`).click();
  assert.equal(await page.locator(`[data-hist="${sink.ids.join(',')}"]`).count(), 0, 'the row left at once');
  await headIs(`Removed: ${sink.label}`);
  assert.equal(await undoBtn().count(), 1);
  assert.equal(await text(page.locator('[data-count]')), `last ${HI.count - 1}`);
  assert.equal(await page.locator('[data-day="2026-11-16"]').count(), 0, 'a day without rows has no heading');
  await shot('history-removed');
  await undoBtn().click();
  await headIs(`Undone: ${sink.label} is back in the history.`);
  assert.equal(await text(page.locator(`[data-hist="${sink.ids.join(',')}"] [data-label]`)), sink.label);
  assert.equal(await text(page.locator('[data-count]')), `last ${HI.count}`);
  // Show more while the door says there is more; nothing ticked yet
  await standinPost('/standin/home-many');
  await page.goto(`${base}/home/history`);
  await page.locator('[data-card="history"]').waitFor();
  assert.equal(await text(page.locator('[data-count]')), 'last 60');
  assert.equal(await page.locator('[data-more]').getAttribute('href'), '/home/history?n=120');
  await page.locator('[data-more]').click();
  await page.waitForURL(/\/home\/history\?n=120$/);
  await page.locator('[data-count]', { hasText: 'last 78' }).waitFor();
  assert.equal(await page.locator('[data-more]').count(), 0);
  await page.locator(`[data-remove]`).first().click();
  await page.locator('[data-count]', { hasText: 'last 77' }).waitFor();
  assert.match(page.url(), /n=120/, 'the page keeps its limit');
  await standinPost('/standin/reset');
  await standinPost('/standin/home-nohistory');
  await page.goto(`${base}/home/history`);
  assert.equal(await text(page.locator('[data-empty]')), 'Nothing ticked yet.');
  assert.equal(await page.locator('[data-earlier-open]').count(), 1, 'the + Add one done earlier is still there');
  await standinPost('/standin/reset');

  // ---- a chore's page ----------------------------------------------------------------------------------------------------------
  const C = HOME.chore.home_chore;
  await page.goto(`${base}/home/zones`);
  await page.locator('[data-flat-link]').first().waitFor();
  await page.locator('[data-zone="1"] [data-hlink]').nth(1).click();
  await page.waitForURL(/\/home\/chore\?id=3$/);
  await page.locator('[data-card="chore"]').waitFor();
  assert.equal(await text(page.locator('[data-back]')), '‹ Zones');
  assert.equal(await page.locator('[data-back]').getAttribute('href'), '/home/zones');
  assert.equal(await text(page.locator('[data-name]')), C.name);
  assert.equal(await text(page.locator('[data-meta]')), C.meta);
  assert.deepEqual(await page.locator('[data-steps] li').allTextContents(), C.steps);
  assert.equal(await page.locator('[data-howto]').count(), 0);
  assert.equal(await page.locator('[data-edit]').getAttribute('href'), '/home/edit#chore-3');
  assert.equal(await text(page.locator('[data-card="last"] h2')), 'Last done');
  assert.equal(await text(page.locator('[data-dates]')), C.last_text);
  assert.equal(await text(page.locator('[data-usually]')), C.usually);
  assert.equal(await page.locator('[data-zones]').count(), 0);
  await shot('chore');
  await checkWidth(page, 'home chore');
  // a whole-flat chore: per zone
  const F = HOME.chore_flat.home_chore;
  await page.goto(`${base}/home/chore?id=2`);
  await page.locator('[data-card="chore"]').waitFor();
  assert.equal(await text(page.locator('[data-meta]')), F.meta);
  assert.equal(await page.locator('[data-steps]').count(), 0);
  assert.deepEqual(await page.locator('[data-zone]').evaluateAll((els) => els.map((e) => [e.querySelector('[data-zone-name]').textContent.trim(), e.querySelector('[data-zone-extra]').textContent.trim(), e.querySelector('[data-zone-dates]').textContent.trim()])),
    F.zones.map((z) => [z.zone, [z.text, z.usually].filter(Boolean).join(' · '), z.last_text]));
  await shot('chore-flat');
  await checkWidth(page, 'home chore whole flat');
  // Edit leads to Edit zones with this chore's form open
  await page.locator('[data-edit]').click();
  await page.waitForURL(/\/home\/edit#chore-2$/);
  await page.locator('[data-chore-form="c:2"]').waitFor();
  assert.equal(await page.locator('[data-chore-form="c:2"] [data-f="name"]').inputValue(), 'Vacuum');
  // an unknown chore says so on the page, not as an error page
  for (const q of ['?id=99', '', '?id=abc']) {
    const r = await page.goto(`${base}/home/chore${q}`);
    assert.equal(r.status(), 200, `a chore that is not there: ${q}`);
    await page.locator('[data-card="gone"]').waitFor();
    assert.equal(await text(page.locator('[data-empty]')), 'That chore is not in the list.');
    assert.equal(await text(page.locator('[data-back]')), '‹ Zones');
  }
  await shot('chore-gone');
  await checkWidth(page, 'home chore gone');

  // ---- Edit zones --------------------------------------------------------------------------------------------------------------
  await page.goto(`${base}/home/zones`);
  await page.locator('[data-edit-link]').click();
  await page.waitForURL(/\/home\/edit$/);
  await page.locator('[data-card="goal"]').waitFor();
  await tabOn('zones');
  assert.equal(await text(page.locator('[data-back]')), '‹ Zones');
  assert.equal(await page.locator('[data-goal]').inputValue(), String(E.goal));
  assert.equal(await text(page.locator('[data-card="goal"]')), 'Weekly goal Sessions a week Save A session is a day with a job done or a timer run out.');
  assert.equal(await text(page.locator('[data-card="flat"] h2')), 'Whole flat');
  assert.deepEqual(await page.locator('[data-card="flat"] [data-echore-name]').allTextContents(), E.flat.map((c) => c.name));
  assert.deepEqual(await page.locator('[data-ezone-title]').allTextContents(), E.zones.map((z) => (z.active ? z.name : `${z.name} · retired`)));
  assert.deepEqual(await page.locator('[data-ezone-count]').allTextContents(), E.zones.map((z) => `${z.count} chore${z.count === 1 ? '' : 's'}`));
  for (const c of [...E.flat, ...E.zones.flatMap((z) => z.chores)]) {
    const row = page.locator(`[data-echore="${c.chore_id}"]`);
    assert.equal(await text(row.locator('[data-echore-meta]')), c.meta);
    assert.equal(await text(row.locator('[data-active-btn]')), c.active ? 'Retire' : 'Bring back');
    assert.equal(await row.getAttribute('data-active'), String(c.active));
    assert.equal(await row.locator('[data-echore-name]').evaluate((e) => (e.closest('button').className.includes('opacity-60') ? 'grey' : 'full')), c.active ? 'full' : 'grey', 'a retired chore is greyed');
  }
  assert.match(await text(page.locator('[data-ezone="4"]')), /Attic · retired/);
  assert.equal(await text(page.locator('[data-active-btn="z:4"]')), 'Bring back');
  assert.equal(await text(page.locator('[data-active-btn="z:1"]')), 'Retire this zone');
  assert.match(await text(page.locator('[data-ezone="1"]')), /History stays\./);
  assert.equal(await page.locator('[data-chore-form]').count(), 0, 'every form is closed');
  await shot('edit');
  await checkWidth(page, 'home edit');
  // a chore's form (the Wipe the stove) and the Per zone table (Vacuum)
  const stove = E.zones[0].chores[0];
  await page.locator('[data-toggle="c:3"]').click();
  const cf = page.locator('[data-chore-form="c:3"]');
  assert.equal(await cf.locator('[data-f="name"]').inputValue(), stove.name);
  assert.equal(await cf.locator('[data-f="zone"]').inputValue(), '1');
  assert.deepEqual(await cf.locator('[data-f="zone"] option').allTextContents(), ['Whole flat (each zone on its own)', 'Kitchen', 'Bathroom', 'Hallway']);
  assert.equal(await cf.locator('[data-f="days"]').inputValue(), String(stove.interval));
  assert.equal(await cf.locator('[data-f="minutes"]').inputValue(), String(stove.minutes));
  assert.equal(await cf.locator('[data-f="steps"]').inputValue(), stove.steps.join('\n'));
  assert.equal(await cf.locator('[data-f="howto"]').inputValue(), '');
  assert.equal(await page.locator('[data-pz-toggle="3"]').count(), 0, 'no Per zone for a chore of one zone');
  await page.locator('[data-toggle="c:2"]').click();
  await page.locator('[data-pz-toggle="2"]').click();
  const pz = page.locator('[data-pz-form="2"]');
  assert.deepEqual(await pz.locator('[data-pz-row]').evaluateAll((els) => els.map((e) => [e.querySelector('[data-pz-on]').checked, e.querySelector('[data-pz-days]').value, e.querySelector('[data-pz-min]').value, e.querySelector('[data-pz-days]').placeholder, e.querySelector('[data-pz-min]').placeholder])),
    E.flat[1].per_zone.map((z) => [z.on, z.days === null ? '' : String(z.days), z.minutes === null ? '' : String(z.minutes), '7', '10']));
  assert.match(await text(pz), /Blank = the chore’s \(weekly, 10 min\)\. Untick a zone where it is not done\./);
  await shot('edit-forms');
  await checkWidth(page, 'home edit, forms open');
  // the goal: Save (no Undo); a refusal next to it, the typed number stays
  await page.locator('[data-goal]').fill('5');
  await page.locator('[data-goal-save]').click();
  await headIs('Weekly goal: 5 sessions.');
  assert.equal(await undoBtn().count(), 0, 'no Undo on Edit zones');
  assert.equal(await page.locator('[data-chore-form="c:3"]').count(), 1, 'a save of another form leaves the open ones');
  await page.locator('[data-goal]').fill('9');
  await page.locator('[data-goal-save]').click();
  await page.locator('[data-card="goal"] [data-err]').waitFor();
  assert.equal(await text(page.locator('[data-card="goal"] [data-err]')), 'The weekly goal is 1 to 7 sessions.');
  assert.equal(await page.locator('[data-goal]').inputValue(), '9');
  // a chore's form: a refusal (days out of range) next to it, what was typed stays; then saved
  await cf.locator('[data-f="days"]').fill('800');
  await cf.locator('[data-f="name"]').fill('Wipe the stove and hob');
  await cf.locator('[data-save]').click();
  await cf.locator('[data-err]').waitFor();
  assert.equal(await text(cf.locator('[data-err]')), 'The interval is 1 to 730 days and the time 1 to 240 minutes.');
  assert.equal(await cf.locator('[data-f="days"]').inputValue(), '800');
  assert.equal(await cf.locator('[data-f="name"]').inputValue(), 'Wipe the stove and hob', 'what was typed stays');
  await page.screenshot({ path: `${out}/homeparts-edit-refusal-${name}-${theme}.png`, fullPage: true });
  await checkWidth(page, 'home edit, a refusal');
  await cf.locator('[data-f="days"]').fill('14');
  await cf.locator('[data-save]').click();
  await headIs('Saved Wipe the stove and hob (every 2 weeks).');
  assert.equal(await page.locator('[data-chore-form="c:3"]').count(), 0, 'the form closes once saved');
  assert.equal(await text(page.locator('[data-echore="3"] [data-echore-name]')), 'Wipe the stove and hob');
  assert.equal(await text(page.locator('[data-echore="3"] [data-echore-meta]')), 'every 2 weeks · 15 min');
  assert.equal(await undoBtn().count(), 0);
  // not whole numbers: said by the page in the door's words (the door would answer 400)
  await page.locator('[data-toggle="c:3"]').click();
  await cf.locator('[data-f="days"]').fill('');
  await cf.locator('[data-save]').click();
  assert.equal(await text(cf.locator('[data-err]')), 'Give the interval in whole days and the minutes as a whole number.');
  await page.locator('[data-toggle="c:3"]').click();
  // Retire and Bring back a chore: said in the bar, greyed, the button turns
  await page.locator('[data-active-btn="c:3"]').click();
  await headIs('Wipe the stove and hob is retired; its history stays.');
  assert.equal(await text(page.locator('[data-echore="3"] [data-active-btn]')), 'Bring back');
  assert.match(await text(page.locator('[data-echore="3"] [data-echore-meta]')), /retired$/);
  await page.locator('[data-active-btn="c:3"]').click();
  await headIs('Wipe the stove and hob is back.');
  assert.equal(await text(page.locator('[data-echore="3"] [data-active-btn]')), 'Retire');
  // Per zone: all off is refused next to the table; then Hallway off, Bathroom every 4 days
  assert.equal(await pz.count(), 1, 'Vacuum’s Per zone table is still open');
  for (const z of [1, 2, 3]) await page.locator(`[data-pz-form="2"] [data-pz-on="${z}"]`).evaluate((e) => e.click());
  await pz.locator('[data-save]').click();
  await pz.locator('[data-err]').waitFor();
  assert.equal(await text(pz.locator('[data-err]')), 'Vacuum needs at least one zone. Retire it instead.');
  await page.locator('[data-pz-form="2"] [data-pz-on="1"]').evaluate((e) => e.click());
  await page.locator('[data-pz-form="2"] [data-pz-on="2"]').evaluate((e) => e.click());
  await page.locator('[data-pz-form="2"] [data-pz-days="2"]').fill('4');
  await pz.locator('[data-save]').click();
  await headIs('Saved Vacuum per zone.');
  assert.equal(await page.locator('[data-pz-form]').count(), 0);
  // a zone: a name already in use is refused next to its form, then renamed; Retire this zone and Bring back
  await page.locator('[data-toggle="z:4"]').click();
  const zf = page.locator('[data-zone-form="z:4"]');
  assert.equal(await zf.locator('[data-f="name"]').inputValue(), 'Attic');
  assert.equal(await zf.locator('[data-f="short"]').inputValue(), 'Attic');
  await zf.locator('[data-f="name"]').fill('kitchen');
  await zf.locator('[data-save]').click();
  await zf.locator('[data-err]').waitFor();
  assert.equal(await text(zf.locator('[data-err]')), 'Another zone has that name.');
  assert.equal(await zf.locator('[data-f="name"]').inputValue(), 'kitchen', 'what was typed stays');
  await zf.locator('[data-f="name"]').fill('Loft');
  await zf.locator('[data-save]').click();
  await headIs('Saved the zone Loft.');
  assert.equal(await text(page.locator('[data-ezone="4"] [data-ezone-title]')), 'Loft · retired');
  await page.locator('[data-active-btn="z:3"]').click();
  await headIs('Hallway is retired; its history stays.');
  assert.equal(await text(page.locator('[data-ezone="3"] [data-ezone-title]')), 'Hallway · retired');
  assert.equal(await text(page.locator('[data-active-btn="z:3"]')), 'Bring back');
  await page.locator('[data-active-btn="z:3"]').click();
  await headIs('Hallway is back.');
  assert.equal(await text(page.locator('[data-ezone="3"] [data-ezone-title]')), 'Hallway');
  // + New chore: the door's refusal (no name) next to the form, then added to a zone; + New zone: in use, brought back, new
  await page.locator('[data-new-chore]').click();
  const nf = page.locator('[data-chore-form="newchore"]');
  assert.equal(await nf.locator('[data-f="minutes"]').inputValue(), '15');
  assert.equal(await nf.locator('[data-f="zone"]').inputValue(), 'flat');
  assert.deepEqual(await nf.locator('[data-f="zone"] option').allTextContents(), ['Whole flat (each zone on its own)', 'Kitchen', 'Bathroom', 'Hallway'], 'a retired zone is not offered for a new chore');
  await nf.locator('[data-f="days"]').fill('90');
  await nf.locator('[data-save]').click();
  await nf.locator('[data-err]').waitFor();
  assert.equal(await text(nf.locator('[data-err]')), "Type the chore's name.");
  await nf.locator('[data-f="name"]').fill('Clean the oven');
  await nf.locator('[data-f="zone"]').selectOption('1');
  await nf.locator('[data-f="steps"]').fill('Racks\nGlass');
  await nf.locator('[data-f="words"]').fill('oven, stove');
  await nf.locator('[data-save]').click();
  await headIs('Added Clean the oven (every 3 months).');
  assert.equal(await page.locator('[data-chore-form="newchore"]').count(), 0);
  assert.equal(await text(page.locator('[data-ezone="1"] [data-echore="9"] [data-echore-meta]')), 'every 3 months · 15 min');
  assert.equal(await text(page.locator('[data-ezone="1"] [data-ezone-count]')), '3 chores');
  await page.locator('[data-new-zone]').click();
  const nz = page.locator('[data-zone-form="newzone"]');
  assert.match(await text(nz), /A retired zone of the same name comes back with its history\./);
  await nz.locator('[data-f="name"]').fill('kitchen');
  await nz.locator('[data-save]').click();
  await nz.locator('[data-err]').waitFor();
  assert.equal(await text(nz.locator('[data-err]')), 'Kitchen is already in your list.');
  await nz.locator('[data-f="name"]').fill('Loft');
  await nz.locator('[data-save]').click();
  await headIs('Loft is back in your list.');
  assert.equal(await text(page.locator('[data-ezone="4"] [data-ezone-title]')), 'Loft');
  await page.locator('[data-new-zone]').click();
  await nz.locator('[data-f="name"]').fill('Storage');
  await nz.locator('[data-f="spots"]').fill('Boxes\nShelves');
  await nz.locator('[data-save]').click();
  await headIs('Added the zone Storage.');
  assert.equal(await text(page.locator('[data-ezone="5"] [data-ezone-title]')), 'Storage');
  assert.equal(await undoBtn().count(), 0, 'no Undo anywhere on Edit zones');
  await page.screenshot({ path: `${out}/homeparts-edit-end-${name}-${theme}.png`, fullPage: true });
  await checkWidth(page, 'home edit, after the saves');
  // the changes are on Zones: the per-zone line, the new chore in Kitchen, the Storage zone with its link to app., Loft with no chores
  await page.goto(`${base}/home/zones`);
  await page.locator('[data-card="flat"]').waitFor();
  assert.equal(await text(page.locator('[data-flat="2"] [data-flat-line]')), '· weekly; Kit every 3 days; Bath every 4 days; not in Hall');
  assert.equal(await text(page.locator('[data-flat="2"] [data-alldone]')), 'All done');
  assert.equal(await page.locator('[data-zone="1"] [data-hrow="9:1"]').count(), 1, 'the new chore is in its zone card');
  assert.equal(await text(page.locator('[data-zone="1"] [data-zone-summary]')), '5 chores · oldest not yet');
  // a new zone gets the whole-flat chores (as the core does): Storage, folded, with its link to the sorting jobs in Todoist (at app.)
  assert.equal(await text(page.locator('[data-zone="5"] [data-zone-summary]')), '2 chores · oldest not yet');
  assert.equal(await fold(5).getAttribute('data-open'), 'false');
  await fold(5).locator('[data-fold]').click();
  assert.match(await fold(5).locator('[data-todoist]').getAttribute('href'), /\/web\/ideas\/todoist$/);
  assert.equal(await text(fold(5).locator('[data-todoist]')), 'sorting jobs in Todoist ›');
  assert.equal(await text(page.locator('[data-zone="4"] [data-zone-summary]')), '2 chores · oldest not yet');
  await shot('zones-after-edit');
  await checkWidth(page, 'home zones after the edits');
  await standinPost('/standin/reset');
  // a zone with no chore at all says so; the Storage zone with none opens app.'s sorting jobs (the one link of Home that still leaves)
  await standinPost('/standin/home-bare');
  await page.goto(`${base}/home/zones`);
  await page.locator('[data-card="flat"]').waitFor();
  assert.equal(await text(page.locator('[data-zone="5"]')), 'Balcony, no recurring chores');
  assert.equal(await page.locator('[data-zone="5"] [data-hrow]').count(), 0);
  assert.equal(await text(page.locator('[data-zone="6"]')), 'Storage, sorting jobs in Todoist ›');
  assert.match(await page.locator('[data-zone="6"]').getAttribute('href'), /\/web\/ideas\/todoist$/);
  await shot('zones-bare');
  await checkWidth(page, 'home zones, zones without chores');
  await standinPost('/standin/reset');
  // a chore's page opens Edit at its chore with the form open (the hash), also on arriving fresh
  await page.goto(`${base}/home/edit#chore-4`);
  await page.locator('[data-chore-form="c:4"]').waitFor();
  assert.equal(await page.locator('[data-chore-form="c:4"] [data-f="name"]').inputValue(), 'Clean the fridge');
  assert.equal(await page.locator('[data-chore-form]').count(), 1, 'only that chore’s form is open');
  await standinPost('/standin/reset');
  await page.goto(`${base}/`);
}

async function checkTrends(page, name, theme) {
  await standinPost('/standin/reset');
  const pc = name === 'pc';
  const wk = (k) => WEEK[k].week;
  const week = (q) => standinPost(`/standin/week?${q}`);
  const starts = async () => (await (await fetch(`${standin}/standin/week-starts`)).json()).starts;
  const card = page.locator('[data-card="review"]');
  const shot = (n, full = true) => page.screenshot({ path: `${out}/trends-${n}-${name}-${theme}.png`, fullPage: full });
  const headLine = (w) => [w.dates_text, w.days_text, w.left_out].filter(Boolean).join(' · ');
  const checkWeek = async (w) => {
    assert.deepEqual(await page.locator('[data-period]').evaluateAll((els) => els.map((e) => [e.getAttribute('data-period'), e.textContent.trim(), e.getAttribute('aria-current')])),
      w.periods.map((x) => [x.p, x.label, x.current ? 'page' : null]), 'the four periods, the current one marked');
    assert.equal(await text(page.locator('[data-head-line]')), headLine(w));
    assert.equal(await text(page.locator('[data-meter-hint]')), w.meter_hint);
    for (const t of w.food) {
      const tile = page.locator(`[data-tile="${t.key}"]`);
      assert.equal(await text(tile.locator('[data-tile-avg]')), t.average_text);
      assert.equal(await text(tile.locator('[data-tile-target]')), `average per day · target ${t.target_text} ${t.unit}`);
      assert.equal(await text(tile.locator('[data-tile-pct]')), `${even(t.pct)}%`);
      const amber = await tile.locator('[data-meter-fill]').evaluate((e) => e.className.includes('bg-amber'));
      assert.equal(amber, t.level === 'warn', `${t.key}: amber only for warn (${t.level})`);
      const fill = await tile.locator('[data-meter-fill]').evaluate((e) => parseFloat(e.style.width));
      assert.ok(Math.abs(fill - Math.min(100, t.pct * 0.8)) < 0.1, `${t.key}: the bar is ${fill}%`);
    }
    assert.deepEqual(await page.locator('[data-hrow]').evaluateAll((els) => els.map((e) => e.textContent.replace(/\s+/g, ' ').trim())),
      w.health.map((h) => [h.label, h.value, h.detail].filter(Boolean).join(' ')), 'Health and habits, in the door\'s order');
    for (const [key, list] of [['kcal', w.foods.by_kcal], ['count', w.foods.by_count]]) {
      assert.deepEqual(await page.locator(`[data-foods="${key}"] [data-food]`).evaluateAll((els) => els.map((e) => [e.querySelector('[data-food-name]').textContent.trim(), e.querySelector('[data-food-text]').textContent.trim()])),
        list.slice(0, 5).map((f) => [f.name, f.text]));
    }
    const rows = w.days.slice(0, 7);
    assert.deepEqual(await page.locator('[data-day]').evaluateAll((els) => els.map((e) => e.getAttribute('data-day'))), rows.map((d) => d.day), 'The days, newest first');
    assert.equal(await page.locator('[data-chart], svg[data-chart], [data-card="charts"]').count(), 0, 'no food charts on the Week tab');
  };

  // ---- the tab bar: Trends is live and lit on /trends (Library is a link since deploy 105) ---------------------------------------
  await page.goto(`${base}/`);
  await page.locator('[data-place="trends"]').click();
  await page.waitForURL(/\/trends$/);
  await page.locator('[data-card="food"]').waitFor();
  const trendsTab = page.locator('[data-place="trends"]');
  assert.equal(await trendsTab.evaluate((e) => e.tagName), 'A');
  assert.equal(await trendsTab.getAttribute('href'), '/trends');
  assert.equal(await trendsTab.getAttribute('aria-current'), 'page');
  assert.match(await trendsTab.getAttribute('class'), /text-blue/);
  assert.equal(await page.locator('[data-place="today"]').getAttribute('aria-current'), null);
  assert.equal(await page.locator('[data-place="more"]').getAttribute('aria-current'), null);
  assert.equal(await page.locator('[data-place="library"]').getAttribute('aria-current'), null);
  assert.equal(await page.locator('[data-place="library"]').evaluate((e) => e.tagName), 'A');
  assert.equal(await page.getByText('Settings and the rest are').count(), 0, 'deploy 111: no footer line sends you to app.');
  assert.equal(await page.getByText('Trends, Library and the rest').count(), 0);
  // the tabs: all three are pages of this app since deploy 103 (no mark for the full app)
  assert.deepEqual(await page.locator('[data-tab]').evaluateAll((els) => els.map((e) => [e.getAttribute('data-tab'), e.getAttribute('aria-current')])), [['week', 'page'], ['charts', null], ['insights', null]]);
  assert.deepEqual(await page.locator('[data-tab]').evaluateAll((els) => els.map((e) => e.getAttribute('href'))), ['/trends', '/trends/charts', '/trends/insights']);
  assert.equal(await page.locator('[data-tabs]').getByText('↗').count(), 0, 'no mark for the full app on the tabs');
  await page.evaluate(() => (window.__noReload = true));

  // ---- 7 days: the not-offered review card --------------------------------------------------------------------------------------
  await checkWeek(wk('7'));
  const r7 = wk('7').review;
  assert.equal(await card.getAttribute('data-state'), 'not-offered');
  assert.equal(await text(card.locator('h2')), r7.title);
  assert.equal(await text(card.locator('[data-review-small]')), r7.small);
  assert.equal(await text(card.locator('[data-review-blurb]')), r7.blurb);
  assert.deepEqual(await card.locator('[data-review-week]').evaluateAll((els) => els.map((e) => [e.textContent.trim(), e.getAttribute('href')])), [['Last week', '/trends?p=last'], ['This week so far', '/trends?p=this']]);
  assert.equal(await card.locator('[data-review-latest]').count(), 0);
  assert.equal(await card.locator('[data-review-button]').count(), 0);
  // the PC: Food, Health and habits and The days in the middle; the review and the foods on the right. Phones and tablets: one column,
  // the review first
  const [food, health, days, rev, foods] = await Promise.all(['food', 'health', 'days', 'review', 'foods'].map((k) => page.locator(`[data-card="${k}"]`).boundingBox()));
  if (pc) {
    assert.ok(rev.x > food.x + food.width - 1 && Math.abs(rev.y - food.y) < 2, 'pc: the review beside Food');
    assert.ok(Math.abs(foods.x - rev.x) < 1 && foods.y > rev.y, 'pc: the foods under the review');
    assert.ok(Math.abs(health.x - food.x) < 1 && Math.abs(days.x - food.x) < 1 && days.y > health.y && health.y > food.y, 'pc: the middle column');
    assert.ok(Math.abs(rev.width - 380) < 2, `pc: a side column of 380 px (${rev.width})`);
  } else {
    const ys = [rev, food, health, foods, days].map((b) => b.y);
    assert.deepEqual([...ys].sort((a, b) => a - b), ys, `${name}: the review, Food, Health and habits, the foods, The days`);
    assert.ok([rev, food, health, foods, days].every((b) => Math.abs(b.x - food.x) < 1 && Math.abs(b.width - food.width) < 1), `${name}: one column`);
  }
  await shot('week-7');
  await checkWidth(page, 'trends, 7 days');
  await card.locator('[data-review-week="last"]').click();
  await page.waitForURL(/\/trends\?p=last$/);
  await card.locator('[data-review-button]').waitFor();
  assert.equal(await page.locator('[data-place="trends"]').getAttribute('aria-current'), 'page', 'Trends lit on /trends?p=last');
  // the latest review's line
  await week('latest=1');
  await page.goto(`${base}/trends`);
  assert.equal(await text(card.locator('[data-review-latest]')), wk('7_latest').review.latest.text);
  // a period that is not one of the four: the 7 days
  await page.goto(`${base}/trends?p=90`);
  assert.equal(await page.locator('[data-period="7"]').getAttribute('aria-current'), 'page');

  // ---- last week, none: press the button; disabled at once, working, then done without a reload -------------------------------
  await week('polls=1');
  await page.goto(`${base}/trends?p=last`);
  await page.evaluate(() => (window.__noReload = true));
  await checkWeek(wk('last_none'));
  const rn = wk('last_none').review;
  assert.equal(await card.getAttribute('data-state'), 'none');
  assert.equal(await text(card.locator('[data-review-intro]')), rn.intro);
  assert.equal(await text(card.locator('[data-review-cost]')), rn.cost);
  assert.equal(await text(card.locator('[data-review-button]')), rn.button);
  await shot('review-none');
  await checkWidth(page, 'trends, review none');
  const before = await starts();
  await card.locator('[data-review-button]').dblclick();
  assert.equal(await card.locator('[data-review-button]').isDisabled().catch(() => true), true, 'the button is disabled from the first press');
  await card.locator('[data-review-wait]').waitFor();
  assert.equal(await card.getAttribute('data-state'), 'working');
  assert.equal(await text(card.locator('[data-review-wait-head]')), wk('this_working').review.wait);
  assert.equal(await text(card.locator('[data-review-said] span').first()), WEEK.saves.start.head);
  await page.waitForTimeout(300);
  assert.equal(await starts(), before + 1, 'a double press started one review');
  if (pc || name === 'phone') await shot(`week-working`, false);
  await checkWidth(page, 'trends, review working');
  // the poll (every 5 s): done, read again in place
  await card.locator('[data-review-parts]').waitFor({ timeout: 15000 });
  assert.equal(await card.getAttribute('data-state'), 'done');
  assert.ok(await page.evaluate(() => window.__noReload === true), 'no reload while the review was read');
  assert.equal(await starts(), before + 1, 'nothing was started again');
  const rd = wk('last_done').review;
  assert.deepEqual(await card.locator('[data-part]').evaluateAll((els) => els.map((e) => e.getAttribute('data-part'))), rd.parts.map((x) => x.key), 'the parts in the door\'s order');
  for (const part of rd.parts) {
    const el = card.locator(`[data-part="${part.key}"]`);
    if (part.style === 'note') assert.equal(await text(el), part.text);
    else {
      assert.equal(await text(el.locator('h3')), part.title);
      assert.equal(await el.locator(part.style === 'numbered' ? 'ol' : 'ul').count(), 1, `${part.key}: ${part.style}`);
      assert.deepEqual(await el.locator('li').allTextContents(), part.items);
    }
  }
  assert.equal(await text(card.locator('[data-review-meta]')), rd.meta.text);
  assert.equal(await text(card.locator('[data-review-button]')), rd.button);
  // All coachings is the Coach page here since deploy 109; Your goals Settings' Coach tab here since deploy 111
  assert.deepEqual(await card.locator('[data-review-link]').evaluateAll((els) => els.map((e) => [e.textContent.trim(), new URL(e.href).pathname + new URL(e.href).search])), rd.links.map((l) => [l.label, l.href === '/web/coach' ? '/coach' : l.href === '/web/settings?tab=coach' ? '/settings/coach' : l.href]));
  assert.equal(await text(card.locator('[data-review-caution]')), rd.caution);
  assert.equal(await card.locator('[data-review-said]').count(), 0, 'the start\'s words go once the review is there');
  await shot('week-last-done');
  await checkWidth(page, 'trends, review done');

  // ---- a refusal: the daily limit, in the door's words next to the card; "already on it" ---------------------------------------
  await week('limit=1');
  const n0 = await starts();
  await card.locator('[data-review-button]').click(); // Review again
  await card.locator('[data-review-said="warning"]').waitFor();
  assert.deepEqual(await card.locator('[data-review-said] span').allTextContents(), [WEEK.saves.limit.head, WEEK.saves.limit.reason]);
  assert.equal(await card.getAttribute('data-state'), 'done', 'the card stays as it was');
  assert.equal(await card.locator('[data-review-button]').isDisabled(), false, 'the owner may press again');
  assert.equal(await starts(), n0 + 1);
  await checkWidth(page, 'trends, a refusal');
  if (name === 'phone') await card.screenshot({ path: `${out}/trends-review-limit-${name}-${theme}.png` });
  await standinPost('/standin/reset');
  await page.goto(`${base}/trends?p=last`);
  await card.locator('[data-review-button]').waitFor();
  await week('last=working'); // started elsewhere (another tab) while this page still shows the button
  await card.locator('[data-review-button]').click();
  await card.locator('[data-review-wait]').waitFor();
  assert.equal(await text(card.locator('[data-review-said] span').first()), WEEK.saves.on_it.head);

  // ---- failed: the door's words and the button to try again ---------------------------------------------------------------------
  await standinPost('/standin/reset');
  await week('last=failed');
  await page.goto(`${base}/trends?p=last`);
  assert.equal(await card.getAttribute('data-state'), 'failed');
  assert.equal(await text(card.locator('[data-review-failed]')), wk('last_failed').review.failed);
  assert.equal(await text(card.locator('[data-review-button]')), wk('last_failed').review.button);
  await checkWidth(page, 'trends, review failed');

  // ---- this week so far: working on arrival, done by the poll; taking longer after 5 minutes ----------------------------------
  await standinPost('/standin/reset');
  await week('this=none');
  await page.goto(`${base}/trends?p=this`);
  await checkWeek(wk('this_working'));
  await page.evaluate(() => (window.__noReload = true));
  await week('polls=1');
  await card.locator('[data-review-button]').click();
  await card.locator('[data-review-wait]').waitFor();
  await card.locator('[data-review-parts]').waitFor({ timeout: 15000 });
  assert.ok(await page.evaluate(() => window.__noReload === true), 'no reload');
  // 5 minutes without an end (the stand-in's coaching 3 stays working): the clock jumps, the page stops asking and says so
  await standinPost('/standin/reset');
  await week('this=working');
  const slow = await page.context().newPage();
  await slow.clock.install();
  await slow.goto(`${base}/trends?p=this`);
  await slow.locator('[data-card="review"] [data-review-wait]').waitFor();
  await slow.clock.fastForward('05:01');
  await slow.locator('[data-review-slow]').waitFor();
  assert.equal(await text(slow.locator('[data-review-slow]')), 'Taking longer than usual: look again in a few minutes. Look again');
  assert.equal(await slow.locator('[data-card="review"]').getAttribute('data-state'), 'working');
  await checkWidth(slow, 'trends, taking longer');
  await slow.locator('[data-look-again]').click();
  await slow.locator('[data-review-slow]').waitFor({ state: 'detached' });
  await slow.close();

  // ---- the empty Monday ----------------------------------------------------------------------------------------------------------
  await standinPost('/standin/reset');
  await week('monday=1');
  await page.goto(`${base}/trends?p=this`);
  assert.equal(await text(page.locator('[data-empty]')), wk('this_monday').empty_text);
  assert.equal(await page.locator('[data-card="review"], [data-card="food"], [data-card="days"]').count(), 0);
  assert.equal(await page.locator('[data-period="this"]').getAttribute('aria-current'), 'page');
  await checkWidth(page, 'trends, empty');

  // ---- 30 days: Show all of the foods (eight, POST foods=8) and of the days; the partly marks ---------------------------------
  await standinPost('/standin/reset');
  await week('foods=8');
  await page.goto(`${base}/trends?p=30`);
  const w30 = wk('30');
  assert.equal(await text(page.locator('[data-head-line]')), headLine(w30));
  assert.equal(await page.locator('[data-foods="kcal"] [data-food]').count(), 5);
  assert.equal(await text(page.locator('[data-foods-all]')), 'Show all 8');
  await page.locator('[data-foods-all]').click();
  assert.equal(await page.locator('[data-foods="kcal"] [data-food]').count(), 8);
  assert.equal(await page.locator('[data-foods="count"] [data-food]').count(), 8);
  assert.equal(await text(page.locator('[data-foods-all]')), 'Show fewer');
  assert.equal(await page.locator('[data-day]').count(), 7);
  assert.equal(await text(page.locator('[data-days-all]')), `Show all ${w30.days.length}`);
  await page.locator('[data-days-all]').click();
  assert.deepEqual(await page.locator('[data-day]').evaluateAll((els) => els.map((e) => e.getAttribute('data-day'))), w30.days.map((d) => d.day));
  assert.deepEqual(await page.locator('[data-day][data-partly="true"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-day'))), w30.days.filter((d) => d.partly).map((d) => d.day));
  assert.equal(await page.locator('[data-partly-mark]').count(), w30.days.filter((d) => d.partly).length);
  const d0 = w30.days.find((d) => d.kg !== null);
  assert.equal(await text(page.locator(`[data-day="${d0.day}"] td`).last()), d0.kg.toFixed(1));
  await shot('week-30-all');
  await checkWidth(page, 'trends, 30 days, all');

  // ---- the core down: the plain message ----------------------------------------------------------------------------------------
  await standinPost('/standin/core-down');
  await page.goto(`${base}/trends?p=last`);
  await page.locator('[data-problem="core_down"]').waitFor();
  await standinPost('/standin/up');
  await standinPost('/standin/reset');
  await page.goto(`${base}/`);
}

/** Trends' Charts and Insights tabs (deploy 103): the tabs, the range switch, the four sections, a failing read, the insight bars. */
async function checkTrendsTabs(page, name, theme) {
  await standinPost('/standin/reset');
  const pc = name === 'pc';
  const shot = (n, full = true) => page.screenshot({ path: `${out}/trends-${n}-${name}-${theme}.png`, fullPage: full });
  const FT = (r) => FOODTRENDS[String(r)].trends;
  const bars = (c) => c.chart.series.find((x) => x.mark === 'bar').pts;
  const stat = (c) => c.stat.map((x) => x.text).join('');
  const sections = () => page.locator('[data-section]').evaluateAll((els) => els.map((e) => e.getAttribute('data-section')));
  const markCount = (id, mark) => page.locator(`[data-chart="${id}"] [data-mark="${mark}"]`).count();

  // ---- the tabs open this app's pages: Week > Charts > Insights > Week ---------------------------------------------------------
  await page.goto(`${base}/trends`);
  await page.locator('[data-tab="charts"]').click();
  await page.waitForURL(/\/trends\/charts$/);
  await page.locator('[data-section="food"]').waitFor();
  assert.deepEqual(await page.locator('[data-tab]').evaluateAll((els) => els.map((e) => [e.getAttribute('data-tab'), e.getAttribute('aria-current')])), [['week', null], ['charts', 'page'], ['insights', null]]);
  assert.equal(await page.locator('[data-place="trends"]').getAttribute('aria-current'), 'true', 'Trends lit on /trends/charts');
  assert.equal(await page.locator('[data-tabs] a[href^="http"]').count(), 0, 'no tab leaves this app');
  assert.deepEqual(await sections(), ['food', 'health', 'body', 'gym'], 'the four sections in order');

  // ---- Food: the door's four cards as they are --------------------------------------------------------------------------------
  const f30 = FT(30);
  assert.equal(await text(page.locator('[data-head-line]')), `${f30.title}, ${f30.small}`, 'the door\'s header words');
  assert.deepEqual(await page.locator('[data-range]').evaluateAll((els) => els.map((e) => [e.textContent.trim(), e.getAttribute('href'), e.getAttribute('aria-current')])),
    [['7 days', '/trends/charts?range=7', null], ['30 days', '/trends/charts', 'page'], ['90 days', '/trends/charts?range=90', null]]);
  const foodIds = await page.locator('[data-food-charts] [data-chart-card]').evaluateAll((els) => els.map((e) => e.getAttribute('data-chart-card')));
  assert.deepEqual(foodIds, f30.charts.map((c) => c.id), 'Calories, Protein, Fat, Carbs');
  for (const c of f30.charts) {
    const card = page.locator(`[data-food-charts] [data-chart-card="${c.id}"]`);
    assert.equal(await text(card.locator('h2')), [c.title, c.small].filter(Boolean).join(' '));
    assert.equal(await text(card.locator('[data-stat]')), stat(c).replace(/\s+/g, ' ').trim(), `${c.id}: the stat line`);
    assert.equal(await markCount(c.id, 'bar'), bars(c).length, `${c.id}: a bar per day with food`);
    assert.equal(await markCount(c.id, 'line'), 1, `${c.id}: the 7-day average`);
    assert.ok(await page.locator(`[data-chart="${c.id}"] line, [data-chart="${c.id}"] path`).count() > 0, `${c.id}: the target and the axes`);
    assert.ok((await text(card.locator('.legend'))).includes(c.legend[0].text), `${c.id}: the legend`);
  }
  assert.equal(await page.locator('[data-chart="kcal"] [data-mark="bar"][class*="a"]').count() > 0, true);
  // a tap on a bar shows its tip
  const kcal = bars(f30.charts[0]);
  await page.locator('[data-chart="kcal"] [data-mark="bar"]').nth(2).click({ force: true });
  assert.equal(await text(page.locator('[data-chart="kcal"] [data-tip]')), kcal[2][2], 'a tap shows the bar\'s text');
  await page.locator('[data-chart="kcal"] [data-mark="bar"]').nth(2).click({ force: true }); // the same bar again hides it
  assert.equal(await page.locator('[data-chart="kcal"] [data-tip]').count(), 0, 'a second tap on the bar hides the box');

  // ---- Health, as on /health: five charts and the sleep times ------------------------------------------------------------------
  const h = HEALTH.health.health;
  assert.deepEqual(await page.locator('[data-section="health"] [data-chart-card]').evaluateAll((els) => els.map((e) => e.getAttribute('data-chart-card'))), [...h.charts.map((c) => c.id), 'times']);
  for (const c of h.charts) assert.equal(await text(page.locator(`[data-section="health"] [data-chart-card="${c.id}"] [data-stat]`)), stat(c).replace(/\s+/g, ' ').trim(), `${c.id}: the stat line`);
  assert.equal(await text(page.locator('[data-chart-card="times"] h2')), [h.times.title, h.times.small].filter(Boolean).join(' '));

  // ---- Body: a chart per measure ------------------------------------------------------------------------------------------------
  const B = HEALTH.body.body;
  assert.deepEqual(await page.locator('[data-body-chart]').evaluateAll((els) => els.map((e) => e.getAttribute('data-body-chart'))), B.charts.map((c) => c.key));
  for (const c of B.charts) assert.equal(await text(page.locator(`[data-body-chart="${c.key}"] h3`)), c.label);

  // ---- Gym: workouts per week and one exercise, always the last 8 weeks --------------------------------------------------------
  const P = GYM.progress.gym_progress;
  assert.equal(await text(page.locator('[data-section="gym"] [data-title]')), `${P.exercise.name}: ${P.title}`);
  assert.equal(await page.locator('[data-section="gym"] [data-bars] rect').count(), P.per_week.weeks.length, 'workouts per week: a bar per week');
  assert.equal(await text(page.locator('[data-gym-note]')), `The last ${P.weeks} weeks, whatever the range above says.`);
  const chips = await page.locator('[data-chip]').evaluateAll((els) => els.map((e) => [e.getAttribute('data-chip'), e.getAttribute('href')]));
  assert.ok(chips.length >= 2, 'the exercise chips');
  assert.deepEqual(chips.map((c) => c[1]), chips.map((c) => `/trends/charts?range=30&x=${c[0]}`), 'a chip stays on this page and keeps the range');

  // the layout: one column on phones and tablets, the cards in two columns from 1100 px
  const k = await page.locator('[data-food-charts] [data-chart-card]').evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => ({ x: r.x, y: r.y, w: r.width })));
  const hc = await page.locator('[data-section="health"] [data-chart-card]').evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => ({ x: r.x, y: r.y, w: r.width })));
  const gc = await page.locator('[data-section="gym"] [data-card]').evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => ({ x: r.x, y: r.y, w: r.width })));
  if (pc) {
    assert.ok(Math.abs(k[0].y - k[1].y) < 2 && k[1].x > k[0].x + k[0].w - 1 && Math.abs(k[2].x - k[0].x) < 1 && k[2].y > k[0].y, 'pc: Food in two columns');
    assert.ok(Math.abs(hc[0].y - hc[1].y) < 2 && hc[1].x > hc[0].x + hc[0].w - 1, 'pc: Health in two columns');
    assert.ok(Math.abs(gc[0].y - gc[1].y) < 2 && gc[1].x > gc[0].x + gc[0].w - 1, 'pc: Gym in two columns');
  } else {
    assert.ok(k.every((r) => Math.abs(r.x - k[0].x) < 1 && Math.abs(r.w - k[0].w) < 1) && k[1].y > k[0].y, `${name}: Food in one column`);
    assert.ok(hc.every((r) => Math.abs(r.x - hc[0].x) < 1) && hc[1].y > hc[0].y, `${name}: Health in one column`);
    assert.ok(gc[1].y > gc[0].y && Math.abs(gc[1].x - gc[0].x) < 1, `${name}: Gym in one column`);
  }
  // charts take the card's width
  const wide = await page.locator('[data-chart-card] [data-chart] svg').evaluateAll((els) => els.map((e) => {
    const c = e.closest('[data-chart-card]').getBoundingClientRect();
    const r = e.getBoundingClientRect();
    return r.right <= c.right + 0.5 && r.left >= c.left - 0.5;
  }));
  assert.ok(wide.every(Boolean), 'every chart stays inside its card');
  await shot('charts-30');
  if (name === 'phone' && theme === 'dark') await page.screenshot({ path: `${out}/trends-charts-30-top-${name}-${theme}.png` });
  await checkWidth(page, 'trends charts, 30 days');

  // ---- the range switch redraws Food, Health and Body, keeps x; the gym chart stays --------------------------------------------
  const gymBefore = await markCount('gym', 'dot');
  await page.evaluate(() => (window.__noReload = true));
  await page.locator('[data-range="7"]').click();
  await page.waitForURL(/\/trends\/charts\?range=7$/);
  const f7 = FT(7);
  await page.waitForFunction((t) => document.querySelector('[data-head-line]')?.textContent?.includes(t), f7.small);
  assert.equal(await text(page.locator('[data-head-line]')), `${f7.title}, ${f7.small}`);
  assert.equal(await page.locator('[data-range="7"]').getAttribute('aria-current'), 'page');
  for (const c of f7.charts) {
    assert.equal(await markCount(c.id, 'bar'), bars(c).length, `7 days, ${c.id}: the bars`);
    assert.equal(await text(page.locator(`[data-food-charts] [data-chart-card="${c.id}"] [data-stat]`)), stat(c).replace(/\s+/g, ' ').trim());
  }
  assert.ok((await markCount('kcal', 'bar')) < bars(f30.charts[0]).length, 'fewer bars than in 30 days');
  const sleep7 = await markCount('sleep', 'bar');
  assert.ok(sleep7 > 0 && sleep7 <= 7, `Health follows the switch (sleep: ${sleep7} bars)`);
  assert.equal(await markCount('gym', 'dot'), gymBefore, 'the gym chart does not follow the switch');
  assert.ok(await page.evaluate(() => window.__noReload === true), 'the switch does not reload the page');
  await checkWidth(page, 'trends charts, 7 days');
  // a chip keeps the range and the chart changes; the range switch then keeps the exercise
  const second = chips[1];
  await page.locator(`[data-chip="${second[0]}"]`).click();
  await page.waitForURL(new RegExp(`/trends/charts\\?range=7&x=${second[0]}$`));
  await page.locator(`[data-chip="${second[0]}"][aria-current="page"]`).waitFor();
  assert.match(await text(page.locator('[data-section="gym"] [data-title]')), /^.+: /);
  assert.equal(await text(page.locator('[data-head-line]')), `${f7.title}, ${f7.small}`, 'the range stays');
  await page.locator('[data-range="90"]').click();
  await page.waitForURL(new RegExp(`/trends/charts\\?range=90&x=${second[0]}$`));
  await page.locator(`[data-chip="${second[0]}"][aria-current="page"]`).waitFor();
  const f90 = FT(90);
  await page.waitForFunction((t) => document.querySelector('[data-head-line]')?.textContent?.includes(t), f90.small);
  for (const c of f90.charts) assert.equal(await markCount(c.id, 'bar'), bars(c).length, `90 days, ${c.id}: the bars`);
  assert.deepEqual(await page.locator('[data-range]').evaluateAll((els) => els.map((e) => e.getAttribute('href'))), [7, 30, 90].map((r) => `/trends/charts?range=${r}&x=${second[0]}`));
  if (name === 'phone' || pc) await shot('charts-90');
  await checkWidth(page, 'trends charts, 90 days');

  // ---- a bad range or x: as /health and /gym/progress (30 days; the door's choice of exercise) ------------------------------------
  await page.goto(`${base}/trends/charts?range=45&x=abc`);
  await page.locator('[data-section="food"] [data-chart-card]').first().waitFor();
  assert.equal(await page.locator('[data-range="30"]').getAttribute('aria-current'), 'page');
  assert.equal(await text(page.locator('[data-head-line]')), `${f30.title}, ${f30.small}`);
  assert.equal(await page.locator('[data-chip][aria-current="page"]').count(), 1);
  assert.equal(await page.locator('[data-problem]').count(), 0);
  await page.goto(`${base}/trends/charts?range=7&x=99999`);
  await page.locator('[data-section="gym"] [data-chip]').first().waitFor();
  assert.equal(await page.locator('[data-problem]').count(), 0, 'an exercise that was never done: the door\'s pick');

  // ---- one failing read does not blank the page ---------------------------------------------------------------------------------
  await standinPost('/standin/trends?fail=food,body');
  await page.goto(`${base}/trends/charts`);
  await page.locator('[data-section="health"] [data-chart-card]').first().waitFor();
  assert.equal(await page.locator('[data-section="food"] [data-problem="trouble"]').count(), 1, 'Food says it could not be read');
  assert.equal(await page.locator('[data-section="body"] [data-problem="trouble"]').count(), 1, 'Body says it could not be read');
  assert.equal(await page.locator('[data-section="health"] [data-problem]').count() + await page.locator('[data-section="gym"] [data-problem]').count(), 0);
  assert.ok(await page.locator('[data-section="gym"] [data-card="progress"]').count() === 1, 'Gym drawn');
  assert.equal(await page.locator('[data-head-line]').count(), 0, 'no header words without the food read');
  await checkWidth(page, 'trends charts, two reads failed');
  await standinPost('/standin/trends?fail=gym,health');
  await page.goto(`${base}/trends/charts?range=90`);
  await page.locator('[data-section="food"] [data-chart-card]').first().waitFor();
  assert.equal(await page.locator('[data-section="gym"] [data-problem]').count() + await page.locator('[data-section="health"] [data-problem]').count(), 2);
  assert.equal(await page.locator('[data-section="body"] [data-body-chart]').count(), B.charts.length);
  await standinPost('/standin/reset');
  await standinPost('/standin/core-down');
  await page.goto(`${base}/trends/charts`);
  await page.locator('[data-problem="core_down"]').waitFor();
  assert.equal(await page.locator('[data-problem]').count(), 1, 'all four down: one message');
  await standinPost('/standin/up');
  // the door's words for no body session, and no gym exercise
  await standinPost('/standin/reset');
  await standinPost('/standin/body-none');
  await standinPost('/standin/gym-empty');
  await page.goto(`${base}/trends/charts`);
  await page.locator('[data-no-body]').waitFor();
  assert.equal(await text(page.locator('[data-no-body]')), 'No measurements yet. Measure on the Health page.');
  await page.locator('[data-section="gym"] [data-empty]').waitFor();
  assert.equal(await page.locator('[data-section="gym"] [data-bars] rect').count(), P.per_week.weeks.length);
  await checkWidth(page, 'trends charts, no body, no gym');
  await standinPost('/standin/reset');

  // ---- Insights ---------------------------------------------------------------------------------------------------------------------
  await page.goto(`${base}/trends/charts`);
  await page.locator('[data-tab="insights"]').click();
  await page.waitForURL(/\/trends\/insights$/);
  await page.locator('[data-insights]').waitFor();
  assert.deepEqual(await page.locator('[data-tab]').evaluateAll((els) => els.map((e) => [e.getAttribute('data-tab'), e.getAttribute('aria-current')])), [['week', null], ['charts', null], ['insights', 'page']]);
  assert.equal(await page.locator('[data-place="trends"]').getAttribute('aria-current'), 'true', 'Trends lit on /trends/insights');
  assert.equal(await text(page.locator('[data-head-line]')), INSIGHTS.small);
  assert.deepEqual(await page.locator('[data-insight]').evaluateAll((els) => els.map((e) => e.getAttribute('data-insight'))), INSIGHTS.cards.map((c) => c.key), 'the cards in the door\'s order');
  for (const c of INSIGHTS.cards) {
    const el = page.locator(`[data-insight="${c.key}"]`);
    assert.equal(await text(el.locator('h2')), c.title);
    if (c.waiting) {
      assert.equal(await el.getAttribute('data-waiting'), 'true');
      assert.equal(await el.evaluate((e) => getComputedStyle(e).borderStyle), 'dashed', 'a waiting card is dashed');
      assert.equal(await page.locator(`[data-insight="${c.key}"] [data-bar-fill]`).count(), 0, 'no bars while waiting');
      assert.equal(`${await text(el.locator('[data-wait]'))} ${await text(el.locator('[data-counts]'))}`, c.wait_text);
      assert.ok((await text(el.locator('[data-wait]'))).startsWith('Not enough days yet'));
      assert.ok((await text(el.locator('[data-counts]'))).includes(c.needs));
      continue;
    }
    assert.equal(await el.getAttribute('data-waiting'), null);
    assert.equal(await text(el.locator('[data-chip]')), c.chip, 'the corner chip');
    assert.equal(await text(el.locator('[data-say]')), c.say.map((x) => x.text).join('').replace(/\s+/g, ' ').trim(), 'the door\'s sentence');
    assert.deepEqual(await el.locator('[data-say] b').allTextContents(), c.say.filter((x) => x.bold).map((x) => x.text), 'the two averages bold');
    assert.deepEqual(await el.locator('[data-bar-label]').allTextContents(), c.groups.map((g) => `${g.label} · ${g.n} days`));
    assert.deepEqual(await el.locator('[data-bar-value]').allTextContents(), c.groups.map((g) => g.text));
    const fills = await el.locator('[data-bar-fill]').evaluateAll((els) => els.map((e) => {
      const t = e.parentElement.getBoundingClientRect();
      const r = e.getBoundingClientRect();
      return { cls: e.getAttribute('data-bar-fill'), left: ((r.left - t.left) / t.width) * 100, width: (r.width / t.width) * 100, bg: e.style.background, inside: r.right <= t.right + 0.5 };
    }));
    c.groups.forEach((g, i) => {
      assert.equal(fills[i].cls, g.cls);
      assert.match(fills[i].bg, new RegExp(`--chart-${g.cls}`), 'first bar --chart-a, second --chart-b');
      assert.ok(Math.abs(fills[i].left - g.left) < 0.5 && Math.abs(fills[i].width - g.width) < 0.5, `${c.key}: bar ${i} is ${fills[i].width.toFixed(1)}% from ${fills[i].left.toFixed(1)}%`);
      assert.ok(fills[i].inside, 'the bar stays on its track');
    });
  }
  assert.equal(await text(page.locator('[data-note]')), INSIGHTS.note, 'the door\'s footer note');
  const ic = await page.locator('[data-insight]').evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => ({ x: r.x, y: r.y, w: r.width })));
  if (pc) assert.ok(Math.abs(ic[0].y - ic[1].y) < 2 && ic[1].x > ic[0].x + ic[0].w - 1 && ic[2].y > ic[0].y, 'pc: two columns');
  else assert.ok(ic.every((r) => Math.abs(r.x - ic[0].x) < 1 && Math.abs(r.w - ic[0].w) < 1) && ic[1].y > ic[0].y && ic[2].y > ic[1].y, `${name}: one column`);
  await shot('insights');
  await checkWidth(page, 'trends insights');
  await page.goto(`${base}/trends/insights`);
  await standinPost('/standin/trends?fail=insights');
  await page.goto(`${base}/trends/insights`);
  await page.locator('[data-problem="trouble"]').waitFor();
  await checkWidth(page, 'trends insights, failed');
  await standinPost('/standin/reset');
  // the Week tab from here
  await page.goto(`${base}/trends/insights`);
  await page.locator('[data-tab="week"]').click();
  await page.waitForURL(/\/trends$/);
  await page.locator('[data-card="food"]').waitFor();
  await page.goto(`${base}/`);
}

/** Deploy 105: Library's Foods tab (the Library tab live; the catalogue against the samples; every form saving in place). */
async function checkLibrary(page, name, theme) {
  await standinPost('/standin/reset');
  const pc = name === 'pc';
  const phone = name === 'phone';
  const shot = (n, full = false) => page.screenshot({ path: `${out}/library-${n}-${name}-${theme}.png`, fullPage: full });
  const bar = page.locator('[data-bar]');
  const headIs = async (want) => {
    await page.locator('[data-bar-head]', { hasText: want }).waitFor();
    assert.equal(await text(page.locator('[data-bar-head]')), want, 'the answer bar');
  };
  const refs = () => page.locator('[data-food-row]').evaluateAll((els) => els.map((e) => e.querySelector('[data-food-ref]').textContent.trim()));
  const row = (id) => page.locator(`[data-food-row="${id}"]`);
  const box = (id) => page.locator(`[data-box="${id}"]`);
  const macros = (id) => text(row(id).locator(name === 'phone' ? '[data-food-macros]' : '[data-food-macros-wide]'));
  const macroOf = (r) => `${r.per_100_text.kcal} kcal · P ${r.per_100_text.protein} · F ${r.per_100_text.fat} · C ${r.per_100_text.carbs} per 100 ${r.basis}`;
  const openFood = async (id) => {
    await row(id).click();
    await page.waitForURL(new RegExp(`food=N${id}`));
    await box(id).waitFor();
  };
  const ALL = CAT.all.catalogue;

  // ---- the Library tab is live, lit on /library; the footer no longer names it -----------------------------------------------------
  await page.goto(`${base}/`);
  await page.locator('[data-place="library"]').click();
  await page.waitForURL(/\/library$/);
  await page.locator('[data-list]').waitFor();
  const tab = page.locator('[data-place="library"]');
  assert.equal(await tab.evaluate((e) => e.tagName), 'A');
  assert.equal(await tab.getAttribute('href'), '/library');
  assert.equal(await tab.getAttribute('aria-current'), 'page');
  assert.match(await tab.getAttribute('class'), /text-blue/);
  for (const other of ['today', 'trends', 'more']) assert.equal(await page.locator(`[data-place="${other}"]`).getAttribute('aria-current'), null, other);
  assert.equal(await page.getByText('Settings and the rest are').count(), 0, 'deploy 111: no footer line sends you to app.');
  assert.equal(await page.getByText('Library and the rest').count(), 0);
  assert.deepEqual(await page.locator('[data-tab]').evaluateAll((els) => els.map((e) => [e.getAttribute('data-tab'), e.textContent.trim(), e.getAttribute('href'), e.getAttribute('aria-current')])), [
    ['foods', 'Foods', '/library', 'page'], ['usual', 'Usual meals', '/library/usual', null], ['habits', 'Habits', '/library/habits', null], ['exercises', 'Exercises', '/library/exercises', null]]);
  await page.evaluate(() => (window.__noReload = true));

  // ---- the list against the sample: rows, pills, words, numbers, the count, the door's chips and orders --------------------------
  assert.deepEqual(await refs(), ALL.rows.map((r) => r.ref), 'the rows in the door\'s order');
  for (const r of ALL.rows) {
    assert.equal(await text(row(r.id).locator('[data-food-name]')), r.name);
    assert.equal(await macros(r.id), macroOf(r), `${r.ref}: kcal · P · F · C`);
    assert.deepEqual(await row(r.id).locator('[data-pill]').allTextContents(), [r.review ? 'review' : null, r.drink ? 'drink' : null].filter(Boolean), `${r.ref}: pills`);
    assert.equal(await row(r.id).locator('[data-food-words]').count() ? await text(row(r.id).locator('[data-food-words]')) : '', r.aliases.join(', '));
    if (!phone) assert.equal(await text(row(r.id).locator('[data-food-stats]')), `Eaten ${r.eaten}× · Last ${r.last_text} · Added ${r.added_text}`);
    else assert.equal(await row(r.id).locator('[data-food-stats]').isVisible(), false, 'phones: no stats column');
  }
  assert.equal(await text(page.locator('[data-count]')), '13 foods');
  assert.equal(await page.locator('[data-search]').getAttribute('placeholder'), ALL.placeholder);
  assert.deepEqual(await page.locator('[data-filter]').evaluateAll((els) => els.map((e) => [e.textContent.trim(), e.getAttribute('aria-current')])), ALL.filters.map((f) => [f.label, f.on ? 'page' : null]));
  assert.deepEqual(await page.locator('[data-sort] option').allTextContents(), ALL.sorts.map((x) => x.label));
  assert.equal(await page.locator('[data-sort]').inputValue(), 'eaten');
  if (pc) assert.equal(await text(page.locator('[data-side-hint]')), 'Pick a food Its values, words, units and barcode open here.');
  await shot('foods', !pc);
  await checkWidth(page, 'library foods');

  // ---- the search: a pause in typing asks (the focus stays); Enter asks at once; nothing found --------------------------------------
  await page.locator('[data-search]').pressSequentially('oat', { delay: 40 });
  await page.waitForURL(/\/library\?q=oat$/);
  await page.waitForFunction(() => document.querySelectorAll('[data-food-row]').length === 2);
  assert.deepEqual(await refs(), ['N1', 'N3'], 'oat: Oat flakes and Oat drink');
  assert.equal(await page.evaluate(() => document.activeElement?.hasAttribute('data-search')), true, 'the search box keeps the focus');
  assert.equal(await page.locator('[data-search]').inputValue(), 'oat');
  await page.locator('[data-search]').fill('zzqq');
  await page.locator('[data-search]').press('Enter');
  await page.waitForURL(/q=zzqq/);
  await page.locator('[data-empty]').waitFor();
  assert.equal(await text(page.locator('[data-empty]')), CAT.none.catalogue.empty);
  assert.equal(await text(page.locator('[data-count]')), '0 foods');
  await checkWidth(page, 'library foods, nothing found');
  await page.locator('[data-search]').fill('');
  await page.locator('[data-search]').press('Enter');
  await page.waitForURL(/\/library$/);
  await page.waitForFunction(() => document.querySelectorAll('[data-food-row]').length === 13);

  // ---- a chip and the order --------------------------------------------------------------------------------------------------
  await page.locator('[data-filter="drinks"]').click();
  await page.waitForURL(/f=drinks/);
  await page.waitForFunction(() => document.querySelectorAll('[data-food-row]').length === 3);
  assert.deepEqual(await refs(), CAT.drinks.catalogue.rows.map((r) => r.ref));
  assert.equal(await page.locator('[data-filter="drinks"]').getAttribute('aria-current'), 'page');
  await page.locator('[data-filter="review"]').click();
  await page.waitForURL(/f=review/);
  await page.waitForFunction(() => document.querySelectorAll('[data-food-row]').length === 2);
  await page.locator('[data-sort]').selectOption('name');
  await page.waitForURL(/f=review&s=name/);
  await page.waitForFunction(() => /s=name/.test(document.querySelector('[data-filter="new"]')?.getAttribute('href') ?? ''));
  assert.deepEqual(await refs(), CAT.review.catalogue.rows.map((r) => r.ref));
  await page.locator('[data-filter="new"]').click();
  await page.waitForURL(/f=new&s=name/);
  await page.locator('[data-sort]').selectOption('added');
  await page.waitForURL(/f=new&s=added/);
  await page.waitForFunction(() => document.querySelector('[data-food-row]')?.getAttribute('data-food-row') === '7');
  assert.deepEqual(await refs(), CAT.new.catalogue.rows.map((r) => r.ref));
  await page.locator('[data-filter="all"]').click();
  await page.waitForURL(/\/library\?s=added$/);
  await page.waitForFunction(() => document.querySelectorAll('[data-food-row]').length === 13);
  await page.locator('[data-sort]').selectOption('eaten');
  await page.waitForURL(/\/library$/);
  await page.waitForFunction(() => document.querySelector('[data-food-row]')?.getAttribute('data-food-row') === '4');
  await page.waitForFunction(() => document.querySelectorAll('[data-food-row]').length === 13);
  assert.equal(await page.evaluate(() => window.__noReload), true, 'search, chips and order without a reload');

  // ---- a food opens in place (under its row; beside the list on the PC), a second tap closes it -------------------------------
  const OATS = CAT.items.oats.food_item;
  await openFood(1);
  const b1 = box(1);
  if (pc) assert.equal(await page.locator('[data-side] [data-box="1"]').count(), 1, 'pc: the box beside the list');
  else assert.equal(await page.locator('[data-food="1"] [data-box="1"]').count(), 1, `${name}: the box under its row`);
  assert.equal(await row(1).getAttribute('aria-expanded'), 'true');
  assert.equal(await text(b1.locator('[data-box-source]')), OATS.source.text);
  for (const v of OATS.values) {
    const input = b1.locator(`[data-value="${v.key}"]`);
    assert.equal(await input.inputValue(), v.value === null ? '' : String(v.value), v.key);
    assert.equal(await input.getAttribute('placeholder'), 'unknown');
  }
  assert.equal(await text(b1.locator('label:has([data-past])')), OATS.past.text);
  assert.equal(await b1.locator('[data-past]').isChecked(), false, 'the tick is off');
  assert.deepEqual(await b1.locator('[data-word]').evaluateAll((els) => els.map((e) => e.getAttribute('data-word'))), OATS.aliases);
  assert.equal(await text(b1.locator('[data-barcode]')), OATS.barcode);
  assert.equal(await b1.locator('[data-review-bar]').count(), 0);
  if (pc) assert.equal(await text(b1.locator('[data-box-name]')), OATS.name);
  await shot('food-open', !pc);
  await checkWidth(page, 'library, a food open');
  await row(1).click();
  await page.waitForURL(/\/library$/);
  await b1.waitFor({ state: 'detached' });

  // ---- values: only what changed is sent; read back in the bar (Yes, change / No); Yes saves, the row's numbers change ------------
  await openFood(2);
  const b2 = box(2);
  await b2.locator('[data-value="kcal"]').fill('70');
  await b2.locator('label:has([data-past])').click();
  assert.equal(await b2.locator('[data-past]').isChecked(), true, 'the tick is on');
  await b2.locator('[data-save-values]').click();
  await page.locator('[data-bar-yes]').waitFor();
  assert.equal(await text(page.locator('[data-bar-yes]')), 'Yes, change');
  assert.equal(await text(page.locator('[data-bar-no]')), 'No');
  assert.ok((await text(bar)).includes(CAT.saves.values_ask.read_back.replace(/\s+/g, ' ')), 'the door\'s read-back');
  assert.equal(await macros(2), '63 kcal · P 11 · F 0.2 · C 4 per 100 g', 'nothing changed before Yes');
  await shot('yes-change');
  await checkWidth(page, 'library, values read back');
  await page.locator('[data-bar-yes]').click();
  await headIs(CAT.saves.values_done.head);
  assert.equal(await macros(2), '70 kcal · P 11 · F 0.2 · C 4 per 100 g', 'the row\'s numbers change in place');
  assert.equal(await b2.locator('[data-value="kcal"]').inputValue(), '70');
  assert.equal(await b2.locator('[data-past]').isChecked(), false, 'the tick is off again after the save');
  assert.equal(await bar.getByRole('button', { name: 'Undo' }).count(), 0, 'no Undo');
  // No drops a change
  await b2.locator('[data-value="kcal"]').fill('75');
  await b2.locator('[data-save-values]').click();
  await page.locator('[data-bar-no]').click();
  await bar.waitFor({ state: 'detached' });
  assert.equal(await macros(2), '70 kcal · P 11 · F 0.2 · C 4 per 100 g', 'No saves nothing');
  // the same values again: "Nothing changed." next to the form, not in the bar; a cleared value is said before sending
  await b2.locator('[data-value="kcal"]').fill('70');
  await b2.locator('[data-save-values]').click();
  await b2.locator('[data-err="values"]').waitFor();
  assert.equal(await text(b2.locator('[data-err="values"]')), 'Nothing changed.');
  assert.equal(await bar.count(), 0, '"Nothing changed." is next to the form only');
  await b2.locator('[data-value="protein"]').fill('');
  await b2.locator('[data-save-values]').click();
  assert.equal(await text(b2.locator('[data-err="values"]')), 'Protein g: give a number (an unknown value cannot be set here).');
  await b2.locator('[data-value="protein"]').fill('11');

  // ---- name and use: a name another food has is refused next to the form and stays; a bad barcode likewise ----------------------
  await b2.locator('[data-basics-name]').fill('Apple');
  await b2.locator('[data-basics-save]').click();
  await b2.locator('[data-err="basics"]').waitFor();
  assert.equal(await text(b2.locator('[data-err="basics"]')), "a food called 'Apple' already exists");
  assert.equal(await b2.locator('[data-basics-name]').inputValue(), 'Apple', 'the name typed stays');
  assert.equal(await bar.count(), 0, 'a refusal is next to its form, not in the bar');
  await b2.locator('[data-basics-name]').fill('Skyr');
  await b2.locator('[data-barcode-input]').fill('123');
  await b2.locator('[data-barcode-set]').click();
  await b2.locator('[data-err="barcode"]').waitFor();
  assert.equal(await text(b2.locator('[data-err="barcode"]')), 'A barcode is 8 to 14 digits.');
  assert.equal(await b2.locator('[data-barcode-input]').inputValue(), '123');
  if (phone) await b2.screenshot({ path: `${out}/library-refusals-${name}-${theme}.png` });
  await checkWidth(page, 'library, refusals');
  await b2.locator('[data-barcode-input]').fill('4000 0000');
  await b2.locator('[data-barcode-set]').click();
  await headIs('Barcode 40000000 saved for N2 Skyr.');
  assert.equal(await text(b2.locator('[data-barcode]')), '40000000');
  assert.equal(await b2.locator('[data-barcode-input]').inputValue(), '');

  // ---- words: added (the row shows it), another food's word refused, removed -------------------------------------------------------
  await b2.locator('[data-word-input]').fill('Curd');
  await b2.locator('[data-word-add]').click();
  await headIs('"curd" now means N2 Skyr.');
  await b2.locator('[data-word="curd"]').waitFor();
  assert.equal(await b2.locator('[data-word-input]').inputValue(), '');
  assert.equal(await text(row(2).locator('[data-food-words]')), 'quark, curd');
  await b2.locator('[data-word-input]').fill('porridge');
  await b2.locator('[data-word-add]').click();
  await b2.locator('[data-err="word"]').waitFor();
  assert.equal(await text(b2.locator('[data-err="word"]')), CAT.saves.word_refused.reason);
  assert.equal(await b2.locator('[data-word-input]').inputValue(), 'porridge');
  await b2.locator('[data-word-remove="curd"]').click();
  await headIs('"curd" no longer means N2 Skyr.');
  await b2.locator('[data-word="curd"]').waitFor({ state: 'detached' });
  assert.equal(await text(row(2).locator('[data-food-words]')), 'quark');

  // ---- a food that needs review: a unit added, Looks right ---------------------------------------------------------------------
  await openFood(5);
  const b5 = box(5);
  assert.equal(await box(2).count(), 0, 'one box at a time');
  assert.equal(await text(b5.locator('[data-review-bar]')), `${CAT.items.rye.food_item.review_reason} Looks right`);
  assert.deepEqual(await b5.locator('[data-unit]').allTextContents(), ['1 slice = 35 g']);
  await b5.locator('[data-unit-name]').fill('slice');
  await b5.locator('[data-unit-grams]').fill('abc');
  await b5.locator('[data-unit-add]').click();
  await b5.locator('[data-err="unit"]').waitFor();
  assert.equal(await text(b5.locator('[data-err="unit"]')), 'Give its weight as a number above 0 and at most 2000 g.');
  await b5.locator('[data-unit-name]').fill('thick slice');
  await b5.locator('[data-unit-grams]').fill('50');
  await b5.locator('[data-unit-add]').click();
  await headIs(CAT.saves.unit.head);
  assert.deepEqual(await b5.locator('[data-unit]').allTextContents(), CAT.saves.unit.food_item.units.map((u) => u.text));
  assert.equal(await b5.locator('[data-unit-name]').inputValue(), '');
  await b5.locator('[data-looks-right]').click();
  await headIs('Kept. N5 Rye bread is no longer flagged.');
  await b5.locator('[data-review-bar]').waitFor({ state: 'detached' });
  assert.equal(await row(5).locator('[data-pill="review"]').count(), 0, 'the row loses its pill');
  assert.equal(await row(5).getAttribute('data-fresh'), '', 'a blue edge on the changed row');

  // ---- a recipe food: its values read only -------------------------------------------------------------------------------------
  await openFood(14);
  assert.equal(await box(14).locator('[data-value="kcal"]').getAttribute('readonly'), '');
  assert.equal(await box(14).locator('[data-save-values]').count(), 0);
  assert.match(await text(box(14).locator('[data-recipe]')), /recipe C1/);

  // ---- Hide: the row and the box go, the address forgets the food ----------------------------------------------------------------
  await openFood(6);
  await box(6).locator('[data-switch="hide"]').click();
  assert.equal(await box(6).locator('[data-switch="hide"]').getAttribute('aria-checked'), 'true');
  await box(6).locator('[data-basics-save]').click();
  await headIs(CAT.saves.hidden.head);
  await row(6).waitFor({ state: 'detached' });
  await box(6).waitFor({ state: 'detached' });
  await page.waitForURL(/\/library$/);
  assert.equal(await text(page.locator('[data-count]')), '12 foods');

  // ---- + New food: the look-up (the button says it is working), its read-back with Yes and No in the bar; Yes adds the row ----------
  await page.locator('[data-new-food]').click();
  const nf = page.locator('[data-new-form]');
  await nf.locator('[data-new-text]').fill('crispbread');
  await nf.locator('[data-look-up]').click();
  await nf.locator('[data-look-up]', { hasText: 'Looking…' }).waitFor();
  assert.equal(await nf.locator('[data-look-up]').isDisabled(), true, 'blocked while it looks');
  await page.locator('[data-bar-yes]').waitFor();
  assert.match(await text(bar), /Open Food Facts has Crispbread: .* \(it would be added as "Crispbread"\)\./);
  assert.equal(await text(page.locator('[data-bar-yes]')), 'Yes');
  assert.equal(await text(page.locator('[data-bar-no]')), 'No');
  if (phone) await shot('new-food');
  await checkWidth(page, 'library, a new food read back');
  await page.locator('[data-bar-yes]').click();
  await headIs('Saved.');
  const added = page.locator('[data-food-row]', { has: page.locator('[data-food-name]', { hasText: 'Crispbread' }) });
  await added.waitFor();
  assert.equal(await added.getAttribute('data-fresh'), '', 'the new row has a blue edge');
  await nf.waitFor({ state: 'detached' });
  // No: nothing is added
  await page.locator('[data-new-food]').click();
  await nf.locator('[data-new-text]').fill('rice cakes');
  await nf.locator('[data-look-up]').click();
  await page.locator('[data-bar-no]').click();
  await bar.waitFor({ state: 'detached' });
  assert.equal(await page.locator('[data-food-name]', { hasText: 'Rice cakes' }).count(), 0, 'No adds nothing');
  assert.equal(await page.evaluate(() => window.__noReload), true, 'every save changed the page in place');
  await checkWidth(page, 'library, after the saves');

  // ---- a food that is not there: the door's words in place of its box, the list still shows -------------------------------------
  await page.goto(`${base}/library?food=N99`);
  await page.locator('[data-gone]').waitFor();
  assert.equal(await text(page.locator('[data-gone]')), 'That food is not there any more.');
  assert.ok((await page.locator('[data-food-row]').count()) > 10, 'the list still shows');
  // the door off: the plain message with a link to app.'s Catalogue
  await standinPost('/standin/door-off');
  await page.goto(`${base}/library`);
  await page.locator('[data-problem]').waitFor();
  assert.match(await page.getByRole('link', { name: 'Open the full app' }).getAttribute('href'), /\/web\/food\/catalogue$/);
  await checkWidth(page, 'library, door off');
  await standinPost('/standin/up');
  // the PC in light: the list with a box beside it (kept for the owner)
  if (pc) {
    await standinPost('/standin/reset');
    await page.goto(`${base}/library?food=N3`);
    await box(3).waitFor();
    await shot('foods-side');
  }
  await page.goto(`${base}/`);
}

/** Deploy 105: Library's Usual meals, Habits and Exercises tabs (the same parts and saves as their own pages). */
async function checkLibraryTabs(page, name, theme) {
  await standinPost('/standin/reset');
  const pc = name === 'pc';
  const shot = (n, full = true) => page.screenshot({ path: `${out}/library-${n}-${name}-${theme}.png`, fullPage: full });
  const bar = page.locator('[data-bar]');
  const headIs = async (want) => {
    await page.locator('[data-bar-head]', { hasText: want }).waitFor();
    assert.equal(await text(page.locator('[data-bar-head]')), want, 'the answer bar');
  };
  const lit = async (key) => {
    assert.equal(await page.locator(`[data-tab="${key}"]`).getAttribute('aria-current'), 'page', `${key}: its tab`);
    assert.equal(await page.locator('[data-place="library"]').getAttribute('aria-current'), 'true', `${key}: the Library tab lit`);
  };

  // ---- Usual meals: /food/usual (with its query) leads here; Today's and the Food day's links point here ---------------------------
  await page.goto(`${base}/food/usual?open=${USUAL[0].meal_id}`);
  await page.waitForURL(new RegExp(`/library/usual\\?open=${USUAL[0].meal_id}$`));
  await page.locator(`[data-usual-editor="${USUAL[0].meal_id}"]`).waitFor();
  await page.goto(`${base}/library/usual`);
  await page.locator('[data-usual]').first().waitFor();
  await lit('usual');
  assert.equal(await page.getByText('‹ Food day').count(), 0, 'no back link: the Library header');
  assert.match(await text(page.locator('[data-count]')), /^\d+ meals? and \d+ drinks?, by name\./);
  if (pc) await page.locator(`[data-usual-editor]`).waitFor();
  await shot('usual');
  await checkWidth(page, 'library usual meals');
  await page.goto(`${base}/`);
  assert.equal(await page.locator('[data-usual-edit]').getAttribute('href'), '/library/usual');
  await page.goto(`${base}/food`);
  assert.equal(await page.locator('[data-usual-link]').getAttribute('href'), '/library/usual');

  // ---- Habits: Your habits under the Library header, the filter at this address, the saves as on the Habits page ------------------
  const hb = HABITS.habits.habits;
  await page.goto(`${base}/library`);
  await page.locator('[data-tab="habits"]').click();
  await page.waitForURL(/\/library\/habits$/);
  await page.locator('[data-card="list"]').waitFor();
  await page.evaluate(() => (window.__noReload = true));
  await lit('habits');
  assert.equal(await page.locator('[data-card="ticks"]').count(), 0, 'the ticks stay on the Habits page');
  assert.deepEqual(await page.locator('[data-chips] a').evaluateAll((els) => els.map((e) => e.getAttribute('href'))), ['/library/habits', '/library/habits?show=untracked', '/library/habits?show=retired', '/library/habits?show=all']);
  assert.equal(await text(page.locator('[data-help]')), hb.help.replace('in the calendar below', 'on the Habits page'));
  assert.equal(await text(page.locator('[data-settings-line]')), 'Which habits show on Today, and their order: in Settings.');
  assert.equal(await page.locator('[data-settings-line] a').getAttribute('href'), '/settings/today', 'deploy 111: Settings is here');
  await shot('habits');
  await checkWidth(page, 'library habits');
  await page.locator('[data-show="all"]').click();
  await page.waitForURL(/\/library\/habits\?show=all$/);
  await page.locator('[data-habit-row="ayurveda"]').waitFor();
  await page.locator('[data-show="tracked"]').click();
  await page.waitForURL(/\/library\/habits$/);
  // a new habit: a used name refused next to the form, then added; Retire and Bring back
  await page.locator('[data-new-habit]').click();
  const form = page.locator('[data-new-form]');
  await form.locator('input[name=label]').fill('stretching');
  await form.getByRole('button', { name: 'Add' }).click();
  await form.locator('[data-refusal]').waitFor();
  assert.equal(await text(form.locator('[data-refusal]')), 'There is already a log type called stretching.');
  assert.equal(await form.locator('input[name=label]').inputValue(), 'stretching');
  await form.locator('input[name=label]').fill('Evening walk');
  await form.getByRole('button', { name: 'Add' }).click();
  await headIs('Added the habit Evening walk. It is tracked: tick it above or log it by its name.');
  const walk = page.locator('[data-habit-row="evening_walk"]');
  await walk.waitFor();
  assert.equal(await walk.getAttribute('data-changed'), '');
  await walk.getByRole('button', { name: 'Retire' }).click();
  await headIs('Retired Evening walk. Its history stays; it is hidden everywhere. Find it under Retired to bring it back.');
  await walk.waitFor({ state: 'detached' });
  assert.equal(await page.evaluate(() => window.__noReload), true, 'the Habits tab saved in place');
  if (name === 'phone') await shot('habits-saved', false);
  await checkWidth(page, 'library habits, after the saves');
  // the Habits Space keeps its own page, with its ticks
  await page.goto(`${base}/habits`);
  await page.locator('[data-card="ticks"]').waitFor();
  assert.equal(await page.locator('[data-place="library"]').getAttribute('aria-current'), null);

  // ---- Exercises: the Gym's list under the Library header, the same saves -----------------------------------------------------
  const EX = GYM.exercises.gym_exercises;
  await page.goto(`${base}/library/exercises`);
  await page.locator('[data-card="exercises"]').waitFor();
  await page.evaluate(() => (window.__noReload = true));
  await lit('exercises');
  assert.deepEqual((await page.locator('[data-ex-name]').allTextContents()).map((t) => t.trim()), EX.exercises.map((x) => x.name));
  await shot('exercises');
  await checkWidth(page, 'library exercises');
  await page.locator('[data-rename="1"]').click();
  const rn = page.locator('[data-rename-form="1"]');
  await rn.locator('[data-rename-name]').fill('Seated row');
  await rn.locator('[data-rename-go]').click();
  assert.equal(await text(rn.locator('[data-err]')), 'Seated row is already in your list.');
  await rn.locator('[data-rename-name]').fill('Flat bench press');
  await rn.locator('[data-rename-go]').click();
  await headIs('Renamed Bench press to Flat bench press. Its history moved with it.');
  assert.equal(await text(page.locator('[data-ex="1"] [data-ex-name]')), 'Flat bench press');
  await page.locator('[data-active-btn="2"]').click();
  await headIs('Retired Shoulder press. Its history stays.');
  assert.equal(await text(page.locator('[data-active-btn="2"]')), 'Bring back');
  assert.equal(await page.evaluate(() => window.__noReload), true, 'the Exercises tab saved in place');
  // the Gym keeps its own Exercises part (it shows the same data)
  await page.goto(`${base}/gym/exercises`);
  await page.locator('[data-card="exercises"]').waitFor();
  assert.equal(await text(page.locator('[data-ex="1"] [data-ex-name]')), 'Flat bench press');
  await page.goto(`${base}/`);
}

/**
 * Deploy 106: Medical at logger. (checkMedicalReports, checkMedicalTests and checkMedicalMeds say what): Medical live as a Space (the rail on the PC,
 * /more and the More tab on phones), Reports (the flagged card, the list against the sample, a report opened under its row or beside the list, a value
 * corrected through the pencil and "Yes, change", No, refusals next to their form, the report's form, a chip opening its test), Tests over time (the
 * search, the list, one test with its chart and history, the thin cases, "Report"), Medication (the list, the pencil, End, Add a course read back with
 * Yes and No). Every save changes the page in place; the three pages are served with the same no-store headers as the others.
 */
const MED_EXPECT = LABS.reports.labs;

/** Medical live in the places: /more on phones and tablets (the More tab lit on every Medical page), the rail on the PC. */
async function checkMedicalPlace(page, name, theme) {
  await standinPost('/standin/reset');
  const pc = name === 'pc';
  await page.goto(`${base}/`);
  if (!pc) {
    await page.locator('[data-place="more"]').click();
    await page.waitForURL(/\/more$/);
    const sp = page.locator('[data-space="medical"]');
    assert.equal(await sp.evaluate((e) => e.tagName), 'A', 'Medical is a link on More');
    assert.equal(await sp.getAttribute('href'), '/medical');
    assert.equal(await sp.evaluate((e) => e.hasAttribute('data-soon')), false);
    assert.equal(await text(sp), 'Medical Lab reports, tests over time, medication');
    assert.equal(await page.locator('[data-soon]').count(), 0, 'every Space is live');
    assert.equal(await page.locator('[data-rest]').count(), 0, 'deploy 108: the dashed "Settings and the rest" box is gone');
    assert.equal(await page.getByText('Settings and the rest are').count(), 0, 'deploy 111: no footer line sends you to app.');
    if (name === 'phone') await page.screenshot({ path: `${out}/medical-more-${name}-${theme}.png` });
    await checkWidth(page, 'more, Medical live');
    await sp.click();
  } else {
    const rail = page.locator('[data-rail-space="medical"]');
    assert.equal(await rail.getAttribute('href'), '/medical', 'Medical in the rail');
    assert.equal(await text(rail), 'Medical');
    assert.deepEqual(await page.locator('[data-rail-space]').evaluateAll((els) => els.map((e) => e.getAttribute('data-rail-space'))), ['gym', 'health', 'habits', 'home', 'medical']);
    await rail.click();
  }
  await page.waitForURL(/\/medical$/);
  await page.locator('[data-card="reports"]').waitFor();
  assert.equal(await page.locator('h1').textContent(), 'Medical');
  if (pc) {
    assert.equal(await page.locator('[data-rail-space="medical"]').getAttribute('aria-current'), 'page', 'Medical lit in the rail');
    assert.match(await page.locator('[data-rail-space="medical"]').getAttribute('class'), /text-blue/);
    assert.equal(await page.locator('[data-rail-space="gym"]').getAttribute('aria-current'), null, 'only Medical lit');
  } else {
    assert.equal(await page.locator('[data-place="more"]').getAttribute('aria-current'), 'true', 'the More tab lit on a Medical page');
    assert.match(await page.locator('[data-place="more"]').getAttribute('class'), /text-blue/);
  }
  assert.equal(await page.locator('[data-place="today"]').getAttribute('aria-current'), null);
  assert.equal(await page.locator('[data-place="library"]').getAttribute('aria-current'), null);
  assert.equal(await page.getByText('Settings and the rest are').count(), 0, 'deploy 111: no footer line sends you to app.');
  assert.equal(await page.getByText('Medical, Settings').count(), 0, 'Medical is no longer in the full app');
  assert.deepEqual(await page.locator('[data-tab]').evaluateAll((els) => els.map((e) => [e.getAttribute('data-tab'), e.textContent.trim(), e.getAttribute('href'), e.getAttribute('aria-current')])), [
    ['reports', 'Reports', '/medical', 'page'], ['tests', 'Tests over time', '/medical/tests', null], ['meds', 'Medication', '/medical/meds', null]]);
  // the same no-caching headers as the front's other signed-in pages (hooks.server.ts sets them on every response)
  const headers = {};
  for (const [k, path] of [['reports', '/medical'], ['tests', '/medical/tests'], ['meds', '/medical/meds'], ['library', '/library'], ['today', '/']]) {
    const r = await page.request.get(`${base}${path}`);
    assert.equal(r.status(), 200, path);
    headers[k] = ['cache-control', 'x-content-type-options', 'x-frame-options', 'referrer-policy', 'permissions-policy'].map((h) => r.headers()[h] ?? '(none)').join(' | ');
  }
  for (const k of ['reports', 'tests', 'meds']) assert.equal(headers[k], headers.library, `${k}: the same headers as /library`);
  assert.equal(headers.library, headers.today);
  assert.match(headers.reports, /^no-store \|/);
  if (name === 'phone' && theme === 'dark') console.log(`medical pages' headers (cache-control | x-content-type-options | x-frame-options | referrer-policy | permissions-policy): ${headers.reports}`);
}

async function checkMedicalReports(page, name, theme) {
  await standinPost('/standin/reset');
  const pc = name === 'pc';
  const phone = name === 'phone';
  const shot = (n, full = false) => page.screenshot({ path: `${out}/medical-${n}-${name}-${theme}.png`, fullPage: full });
  const bar = page.locator('[data-bar]');
  const headIs = async (want) => {
    await page.locator('[data-bar-head]', { hasText: want }).waitFor();
    assert.equal(await text(page.locator('[data-bar-head]')), want, 'the answer bar');
  };
  const row = (id) => page.locator(`[data-report-row="${id}"]`);
  const box = (id) => page.locator(`[data-box="${id}"]`);
  const val = (id) => page.locator(`[data-value-row="${id}"]`);
  const vtext = (id) => text(val(id).locator('[data-value-text]'));
  const flagOf = (id) => val(id).locator('[data-flag]').getAttribute('data-flag');
  const openReport = async (id) => {
    await row(id).click();
    await page.waitForURL(new RegExp(`open=R${id}$`));
    await box(id).waitFor();
  };
  const reports = MED_EXPECT.reports;
  const flagged = MED_EXPECT.flagged;

  await page.goto(`${base}/medical`);
  await page.locator('[data-card="reports"]').waitFor();
  await page.evaluate(() => (window.__noReload = true));

  // ---- the flagged card: the door's title, the date and the report's title, a chip per flagged value, the hint --------------------------
  assert.equal(await text(page.locator('[data-flagged-title]')), flagged.heading);
  assert.equal(await text(page.locator('[data-flagged-meta]')), `${flagged.date_text} · ${flagged.title}`);
  assert.deepEqual(await page.locator('[data-chip]').evaluateAll((els) => els.map((e) => [e.getAttribute('data-chip'), [...e.children].map((c) => c.textContent.trim()).join(' '), e.getAttribute('href')])),
    flagged.chips.map((c) => [String(c.test_id), `${c.test} ${c.value} ${c.flag}`, `/medical/tests?t=${c.test_id}`]));
  assert.match(await page.locator('[data-chip]').first().getAttribute('class'), /border-amber/, 'a chip is amber');
  assert.equal(await text(page.locator('[data-flagged-hint]')), flagged.hint);

  // ---- all reports, newest first -------------------------------------------------------------------------------------------------------
  assert.deepEqual(await page.locator('[data-report-row]').evaluateAll((els) => els.map((e) => e.getAttribute('data-report-row'))), reports.map((r) => String(r.id)), 'newest first');
  for (const r of reports) {
    const el = row(r.id);
    assert.equal(await text(el.locator('[data-report-date]')), r.date_text);
    assert.equal(await text(el.locator('[data-report-title]')), r.title);
    assert.equal(await text(el.locator('[data-kind]')), r.kind);
    if (phone) {
      assert.equal(await el.locator('[data-report-from]').isVisible(), false, 'phones: no "from"');
      assert.equal(await text(el.locator('[data-report-counts]')), `${r.values} ${r.values === 1 ? 'value' : 'values'}${r.flagged ? ` · ${r.flagged} flagged` : ''}`);
      assert.equal(await el.locator('[data-report-counts] .text-amber').count(), r.flagged ? 1 : 0, 'flagged is amber');
    } else {
      assert.equal(await text(el.locator('[data-report-from]')), r.provider);
      assert.equal(await text(el.locator('[data-report-values]')), String(r.values));
      assert.equal(await text(el.locator('[data-report-flagged]')), String(r.flagged));
      assert.match(await el.locator('[data-report-flagged]').getAttribute('class'), r.flagged ? /text-amber/ : /text-muted/);
    }
  }
  assert.equal(await text(page.locator('[data-hint]')), MED_EXPECT.hint, "the door's hint under the list");
  if (pc) assert.equal(await text(page.locator('[data-side-hint]')), 'Pick a report Its values and notes open here.');
  await shot('reports', !pc);
  await checkWidth(page, 'medical reports');

  // ---- a report opens in place (under its row; beside the list on the PC), a second tap closes it -------------------------------------
  const R4 = LABS.open.labs.open;
  await openReport(4);
  if (pc) assert.equal(await page.locator('[data-side] [data-box="4"]').count(), 1, 'pc: the report beside the list');
  else assert.equal(await page.locator('[data-report="4"] [data-box="4"]').count(), 1, `${name}: the report under its row`);
  assert.equal(await row(4).getAttribute('aria-expanded'), 'true');
  assert.deepEqual(await box(4).locator('[data-value-row]').evaluateAll((els) => els.map((e) => e.getAttribute('data-value-row'))), R4.values.map((v) => String(v.id)));
  for (const v of R4.values) {
    assert.equal(await text(val(v.id).locator('[data-value-test]')), v.test);
    assert.equal(await val(v.id).locator('[data-value-link]').getAttribute('href'), `/medical/tests?t=${v.test_id}`, 'the name links to the test');
    assert.equal(await vtext(v.id), v.text);
    assert.equal(await text(val(v.id).locator('[data-value-range]')), v.range);
    assert.equal(await flagOf(v.id), v.flag === 'N' ? 'none' : v.flag, `${v.test}: the flag`);
    assert.equal(await val(v.id).locator('[data-pencil]').count(), 1);
  }
  assert.equal(await val(11).locator('[data-flag="H"]').count(), 1);
  assert.match(await val(11).locator('[data-flag="H"]').getAttribute('class'), /text-amber/, 'a flag is amber');
  if (phone) assert.ok((await val(10).locator('[data-pencil]').boundingBox()).height >= 44, 'the pencil is 44 px');
  assert.equal(await page.evaluate(() => window.__noReload), true, 'a report opens without a reload');
  await shot('report-open', true);
  await checkWidth(page, 'medical, a report open');
  await row(4).click();
  await page.waitForURL(/\/medical$/);
  await box(4).waitFor({ state: 'detached' });
  await openReport(4);
  await box(4).locator('[data-box-close]').click();
  await page.waitForURL(/\/medical$/);
  await box(4).waitFor({ state: 'detached' });

  // ---- a value corrected: the pencil, Save shows it first (Yes, change / No), Yes changes the number and the flag on the page ---------------
  await openReport(4);
  await val(10).locator('[data-pencil]').click();
  const form = val(10).locator('[data-form="value"]');
  assert.equal(await form.locator('[data-edit="value"]').inputValue(), '13.8');
  assert.equal(await form.locator('[data-edit="unit"]').inputValue(), 'g/dL');
  assert.equal(await form.locator('[data-edit="ref"]').inputValue(), '13.5-17.5');
  assert.equal(await text(form), `Value Unit Range Save Cancel ${R4.value_hint}`);
  await form.locator('[data-edit="value"]').fill('12.9');
  await form.locator('[data-save-value]').click();
  await page.locator('[data-bar-yes]').waitFor();
  assert.equal(await text(page.locator('[data-bar-yes]')), 'Yes, change');
  assert.equal(await text(page.locator('[data-bar-no]')), 'No');
  assert.ok((await text(bar)).includes(LABS.saves.value_ask.read_back.replace(/\s+/g, ' ')), "the door's read-back");
  assert.equal(await vtext(10), '13.8 g/dL', 'nothing changed before Yes');
  await shot('yes-change');
  await checkWidth(page, 'medical, a value read back');
  await page.locator('[data-bar-yes]').click();
  await headIs(LABS.saves.value_done.head);
  await page.waitForFunction(() => document.querySelector('[data-value-row="10"] [data-value-text]')?.textContent?.trim() === '12.9 g/dL');
  assert.equal(await flagOf(10), 'L', 'the flag follows the new value');
  assert.equal(await val(10).locator('[data-form]').count(), 0, 'the form closes');
  assert.equal(await val(10).getAttribute('data-fresh'), '', 'a blue edge on the changed value');
  assert.equal(await bar.getByRole('button', { name: 'Undo' }).count(), 0, 'no Undo');
  assert.equal(await page.locator('[data-chip]').count(), 2, 'the flagged card follows: Ferritin and Haemoglobin');
  assert.equal(await page.locator('[data-chip="19"]').count(), 1);
  assert.equal(await text(row(4).locator(phone ? '[data-report-counts]' : '[data-report-flagged]')), phone ? '4 values · 2 flagged' : '2');
  assert.equal(await page.evaluate(() => window.__noReload), true, 'the save changed the page in place');
  // No leaves it: nothing is sent again, nothing changes
  await val(10).locator('[data-pencil]').click();
  assert.equal(await form.locator('[data-edit="value"]').inputValue(), '12.9');
  await form.locator('[data-edit="value"]').fill('14.2');
  await form.locator('[data-save-value]').click();
  await page.locator('[data-bar-no]').click();
  await bar.waitFor({ state: 'detached' });
  assert.equal(await vtext(10), '12.9 g/dL', 'No saves nothing');
  assert.equal(await form.locator('[data-edit="value"]').inputValue(), '14.2', 'what was typed stays after No');

  // ---- refusals and "Nothing changed." next to their form, which keeps what was typed ----------------------------------------------------
  await form.locator('[data-edit="value"]').fill('');
  await form.locator('[data-save-value]').click();
  await form.locator('[data-err="value:10"]').waitFor();
  assert.equal(await text(form.locator('[data-err="value:10"]')), 'The value cannot be empty.');
  assert.equal(await bar.count(), 0, 'a refusal is next to its form, not in the bar');
  assert.equal(await form.locator('[data-edit="unit"]').inputValue(), 'g/dL', 'the rest stays');
  assert.match(await form.locator('[data-err="value:10"]').getAttribute('class'), /text-amber/);
  if (phone) await form.screenshot({ path: `${out}/medical-refusal-${name}-${theme}.png` });
  await checkWidth(page, 'medical, a refusal');
  await form.locator('[data-edit="value"]').fill('12.9');
  await form.locator('[data-save-value]').click();
  await form.locator('[data-err="value:10"]', { hasText: 'Nothing changed.' }).waitFor();
  assert.equal(await bar.count(), 0, '"Nothing changed." is next to the form only');
  await form.locator('[data-cancel-value]').click();
  assert.equal(await val(10).locator('[data-form]').count(), 0);

  // ---- the report's form: date, title, from and notes; refusals; shown first, then Yes -----------------------------------------------------
  await box(4).locator('[data-report-toggle]').click();
  const rf = box(4).locator('[data-form="report"]');
  assert.equal(await rf.locator('[data-edit="collected"]').inputValue(), '2026-10-05');
  assert.equal(await rf.locator('[data-edit="collected"]').getAttribute('type'), 'date');
  assert.equal(await rf.locator('[data-edit="title"]').inputValue(), 'Annual check-up');
  assert.equal(await rf.locator('[data-edit="provider"]').inputValue(), 'Zz Lab');
  assert.equal(await text(rf.locator('label').last()), 'Notes');
  await rf.locator('[data-edit="title"]').fill('');
  await rf.locator('[data-save-report]').click();
  await rf.locator('[data-err="report"]').waitFor();
  assert.equal(await text(rf.locator('[data-err="report"]')), LABS.saves.report_refused.reason);
  await rf.locator('[data-edit="title"]').fill('Yearly check-up');
  await rf.locator('[data-edit="collected"]').fill('');
  await rf.locator('[data-save-report]').click();
  await rf.locator('[data-err="report"]', { hasText: "Give the report's date." }).waitFor();
  assert.equal(await rf.locator('[data-edit="title"]').inputValue(), 'Yearly check-up', 'what was typed stays');
  await checkWidth(page, 'medical, the report form, a refusal');
  await rf.locator('[data-edit="collected"]').fill('2026-10-06');
  await rf.locator('[data-edit="notes"]').fill('Fasting sample.');
  await rf.locator('[data-save-report]').click();
  await page.locator('[data-bar-yes]').waitFor();
  assert.equal(await text(page.locator('[data-bar-yes]')), 'Yes, change');
  assert.equal(await text(row(4).locator('[data-report-title]')), 'Annual check-up', 'nothing changed before Yes');
  await page.locator('[data-bar-yes]').click();
  await headIs('Changed the report.');
  await page.waitForFunction(() => document.querySelector('[data-report-row="4"] [data-report-title]')?.textContent?.trim() === 'Yearly check-up');
  assert.equal(await text(row(4).locator('[data-report-date]')), '06.10.2026');
  assert.equal(await text(box(4).locator('[data-report-notes]')), 'Fasting sample.');
  assert.equal(await box(4).locator('[data-form="report"]').count(), 0, 'the form closes');
  assert.equal(await text(page.locator('[data-flagged-meta]')), '06.10.2026 · Yearly check-up', 'the flagged card follows');
  assert.equal(await page.evaluate(() => window.__noReload), true, 'the report form saved in place');

  // ---- the flagged card leads to the test; the test's name in a report too ------------------------------------------------------------------
  await page.locator('[data-chip="20"]').click();
  await page.waitForURL(/\/medical\/tests\?t=20$/);
  await page.locator('[data-test="20"]').waitFor();
  assert.equal(await text(page.locator('[data-test-name]')), 'Ferritin');
  await page.goBack();
  await page.waitForURL(/\/medical\?open=R4$/);
  await box(4).waitFor();
  await val(12).locator('[data-value-link]').click();
  await page.waitForURL(/\/medical\/tests\?t=21$/);
  await page.locator('[data-test="21"]').waitFor();

  // ---- "Nothing flagged." once nothing is: the values corrected back, the door's words ------------------------------------------------------
  await page.goto(`${base}/medical?open=R4`);
  await box(4).waitFor();
  for (const [id, to] of [[10, '13.8'], [11, '200']]) {
    await val(id).locator('[data-pencil]').click();
    await val(id).locator('[data-edit="value"]').fill(to);
    await val(id).locator('[data-save-value]').click();
    await page.locator('[data-bar-yes]').click();
    await page.waitForFunction(([i, t]) => document.querySelector(`[data-value-row="${i}"] [data-value-text]`)?.textContent?.trim().startsWith(t), [id, to]);
  }
  await page.locator('[data-flagged-empty]').waitFor();
  assert.equal(await text(page.locator('[data-flagged-empty]')), 'Nothing flagged.');
  assert.equal(await page.locator('[data-chip]').count(), 0);
  await checkWidth(page, 'medical, nothing flagged');

  // ---- an imaging report: its value with the site; with none, the door's words and its notes --------------------------------------------------
  await standinPost('/standin/reset');
  await page.goto(`${base}/medical?open=R5`);
  await box(5).waitFor();
  assert.equal(await text(val(14).locator('[data-value-test]')), 'Liver');
  assert.equal(await text(val(14).locator('[data-value-note]')), 'liver');
  assert.equal(await vtext(14), 'slightly enlarged');
  assert.equal(await flagOf(14), 'A');
  await standinPost('/standin/labs-novalues');
  await page.goto(`${base}/medical?open=R5`);
  await box(5).waitFor();
  assert.equal(await text(box(5).locator('[data-no-values]')), 'No values in this report.');
  assert.equal(await text(box(5).locator('[data-report-notes]')), 'Notes of the invented ultrasound.');
  await checkWidth(page, 'medical, an imaging report');
  // a report that is not there: the list, none open
  await page.goto(`${base}/medical?open=R99`);
  await page.locator('[data-card="reports"]').waitFor();
  assert.equal(await page.locator('[data-box]').count(), 0);
  assert.equal(await page.locator('[data-report-row]').count(), 5);
  // no reports: the door's words
  await standinPost('/standin/labs-empty');
  await page.goto(`${base}/medical`);
  await page.locator('[data-empty]').waitFor();
  assert.equal(await text(page.locator('[data-empty]')), 'No reports yet.');
  assert.equal(await text(page.locator('[data-flagged-empty]')), 'Nothing flagged.');
  await checkWidth(page, 'medical, no reports');
  // the door off: the plain message with a link to app.'s Medical page
  await standinPost('/standin/reset');
  await standinPost('/standin/door-off');
  await page.goto(`${base}/medical`);
  await page.locator('[data-problem]').waitFor();
  assert.match(await page.getByRole('link', { name: 'Open the full app' }).getAttribute('href'), /\/web\/labs$/);
  await checkWidth(page, 'medical, door off');
  await standinPost('/standin/up');
  // the PC: the open report beside the list (kept for the owner)
  if (pc) {
    await page.goto(`${base}/medical?open=R4`);
    await box(4).waitFor();
    await shot('reports-side');
  }
  await page.goto(`${base}/`);
}

async function checkMedicalTests(page, name, theme) {
  await standinPost('/standin/reset');
  const pc = name === 'pc';
  const phone = name === 'phone';
  const shot = (n, full = false) => page.screenshot({ path: `${out}/medical-${n}-${name}-${theme}.png`, fullPage: full });
  const T = LABS.tests.labs_tests;
  const V = LABS.test.labs_tests;
  const trow = (id) => page.locator(`[data-test-row="${id}"]`);

  await page.goto(`${base}/medical/tests`);
  await page.locator('[data-list]').waitFor();
  await page.evaluate(() => (window.__noReload = true));
  assert.equal(await page.locator('[data-tab="tests"]').getAttribute('aria-current'), 'page');
  assert.equal(await page.locator('[data-search]').getAttribute('placeholder'), T.placeholder);
  assert.equal(await text(page.locator('label[for="test-q"]')), 'Search a test');
  assert.equal(await text(page.locator('[data-list-title]')), T.title);
  assert.deepEqual(await page.locator('[data-test-row]').evaluateAll((els) => els.map((e) => [e.getAttribute('data-test-row'), e.querySelector('[data-test-row-name]').textContent.trim(), e.querySelector('[data-test-row-count]').textContent.trim(), e.querySelector('[data-test-row-unit]')?.textContent.trim()])),
    T.tests.map((t) => [String(t.id), t.name, `${t.values} values`, t.unit]));
  if (pc) assert.equal(await text(page.locator('[data-side-hint]')), 'Pick a test Its chart and history open here.');
  await shot('tests', !pc);
  await checkWidth(page, 'medical tests');

  // ---- the search: Enter and a pause in typing ask (the focus stays); the matches, one match opens its test, nothing found ---------------------
  await page.locator('[data-search]').pressSequentially('in', { delay: 40 });
  await page.waitForURL(/\/medical\/tests\?q=in$/);
  await page.waitForFunction(() => !document.querySelector('[data-list-title]'));
  assert.equal(await page.evaluate(() => document.activeElement?.hasAttribute('data-search')), true, 'the search box keeps the focus');
  assert.equal(await page.locator('[data-search]').inputValue(), 'in');
  assert.deepEqual(await page.locator('[data-test-row]').evaluateAll((els) => els.map((e) => e.getAttribute('data-test-row'))), ['20', '19', '21'], 'the matches, most values first, then by name');
  await page.locator('[data-search]').fill('zzqq');
  await page.locator('[data-search]').press('Enter');
  await page.waitForURL(/q=zzqq/);
  await page.locator('[data-empty]').waitFor();
  assert.equal(await text(page.locator('[data-empty]')), LABS.no_test.labs_tests.empty);
  await checkWidth(page, 'medical tests, nothing found');
  // one match opens its test by itself
  await page.locator('[data-search]').fill('vit');
  await page.locator('[data-search]').press('Enter');
  await page.waitForURL(/q=vit$/);
  await page.locator('[data-test="21"]').waitFor();
  assert.equal(await text(page.locator('[data-test-name]')), 'Vitamin D');
  if (pc) assert.equal(await page.locator('[data-side] [data-test="21"]').count(), 1, 'pc: the test beside the list');
  if (pc) assert.deepEqual(await page.locator('[data-test-row]').evaluateAll((els) => els.map((e) => e.getAttribute('data-test-row'))), ['21'], 'the list: the one match');
  else assert.equal(await page.locator('[data-test-row]').count(), 0, `${name}: the test is a view of its own`);
  assert.equal(await page.evaluate(() => window.__noReload), true, 'the search asked without a reload');

  // ---- one test from the list: the search kept in "‹ All tests"; the chart, its dots and a tap, the thin cases --------------------------------
  await page.locator('[data-search]').fill('in');
  await page.locator('[data-search]').press('Enter');
  await page.waitForURL(/q=in$/);
  await trow(21).waitFor();
  await trow(21).click();
  await page.waitForURL(/\/medical\/tests\?q=in&t=21$/);
  await page.locator('[data-test="21"]').waitFor();
  assert.equal(await text(page.locator('[data-test-name]')), V.test.name);
  assert.equal(await text(page.locator('[data-test-count]')), '4 values');
  if (pc) {
    assert.equal(await page.locator('[data-side] [data-test="21"]').count(), 1, 'pc: the test beside the list');
    assert.equal(await trow(21).getAttribute('aria-current'), 'true', 'its row is lit');
    assert.equal(await page.locator('[data-test-row]').count(), 3, 'the list stays');
    assert.equal(await page.locator('[data-back]').count(), 0, 'no back link beside the list');
  } else {
    assert.equal(await page.locator('[data-test-row]').count(), 0, `${name}: the test is a view of its own`);
    assert.equal(await page.locator('[data-back]').getAttribute('href'), '/medical/tests?q=in', 'back keeps the search');
    assert.equal(await text(page.locator('[data-back]')), '‹ All tests');
    assert.equal(await page.locator('[data-search]').inputValue(), 'in', 'the search stays above the test');
  }
  const chart = page.locator('[data-test-chart] [data-chart="test"]');
  await chart.locator('svg').waitFor();
  assert.equal(await chart.locator('svg').getAttribute('aria-label'), V.card.chart.label);
  assert.equal(await chart.locator('.band').count(), 1, 'the reference band');
  assert.equal(await chart.locator('[data-mark="line"]').count(), 1);
  assert.equal(await chart.locator('[data-mark="dot"]').count(), 4, 'a dot per value');
  assert.equal(await chart.locator('[data-mark="dot"].w').count(), 2, 'the dots outside the range are amber');
  assert.equal(await chart.locator('[data-mark="dot"].a').count(), 2);
  assert.deepEqual(await page.locator('[data-test-chart] .legend').textContent().then((t) => t.replace(/\s+/g, ' ').trim()), 'reference range (from the newest value) outside the range');
  // a tap on a dot shows the door's words
  await chart.locator('[data-mark="dot"].w').first().click();
  await chart.locator('[data-tip]').waitFor();
  assert.equal(await text(chart.locator('[data-tip] text')), V.card.chart.series[2].pts[0][2], "the door's tooltip words");
  await shot('test', !pc);
  await checkWidth(page, 'medical tests, a test with its chart');
  // the history, newest first: date, site, value, range, flag, Report
  assert.deepEqual(await page.locator('[data-history-row]').evaluateAll((els) => els.map((e) => [e.querySelector('[data-history-date]').textContent.trim(), e.querySelector('[data-history-value]').textContent.trim(), e.querySelector('[data-history-range]').textContent.trim(), e.querySelector('[data-flag]').getAttribute('data-flag'), e.querySelector('[data-history-report]').getAttribute('href')])),
    V.rows.map((r) => [r.date_text, r.value, r.range, r.flag === 'N' ? 'none' : r.flag, `/medical?open=R${r.report_id}`]));
  if (!pc) {
    await page.locator('[data-back]').click();
    await page.waitForURL(/\/medical\/tests\?q=in$/);
    await trow(20).waitFor();
    assert.equal(await page.locator('[data-search]').inputValue(), 'in');
  }
  // "Report" opens that report
  await page.goto(`${base}/medical/tests?t=21`);
  await page.locator('[data-test="21"]').waitFor();
  if (!pc) assert.equal(await page.locator('[data-back]').getAttribute('href'), '/medical/tests');
  await page.locator('[data-history-row="9"] [data-history-report]').click();
  await page.waitForURL(/\/medical\?open=R3$/);
  await page.locator('[data-box="3"]').waitFor();
  assert.equal(await text(page.locator('[data-box="3"] [data-value-row="9"] [data-value-text]')), '31 ng/mL');
  // the thin cases: the door's message in place of the chart
  await page.goto(`${base}/medical/tests?t=22`);
  await page.locator('[data-thin]').waitFor();
  assert.equal(await text(page.locator('[data-thin]')), LABS.one_value.labs_tests.card.note);
  assert.equal(await page.locator('[data-chart]').count(), 0, 'no chart for one value');
  assert.equal(await text(page.locator('[data-test-count]')), '1 value');
  await checkWidth(page, 'medical tests, one value');
  await standinPost('/standin/labs-oneday');
  await page.goto(`${base}/medical/tests?t=21`);
  await page.locator('[data-thin]').waitFor();
  assert.match(await text(page.locator('[data-thin]')), /^All values are from one day/);
  await standinPost('/standin/reset');
  // a test that is not there: the list, nothing open
  await page.goto(`${base}/medical/tests?t=999`);
  await page.locator('[data-list]').waitFor();
  assert.equal(await page.locator('[data-test]').count(), 0);
  // the door off: the plain message with a link to app.'s Tests over time
  await standinPost('/standin/door-off');
  await page.goto(`${base}/medical/tests`);
  await page.locator('[data-problem]').waitFor();
  assert.match(await page.getByRole('link', { name: 'Open the full app' }).getAttribute('href'), /\/web\/labs\/tests$/);
  await checkWidth(page, 'medical tests, door off');
  await standinPost('/standin/up');
  // the PC in light: the list with the test beside it (kept for the owner)
  if (pc) {
    await page.goto(`${base}/medical/tests?t=21`);
    await page.locator('[data-test="21"]').waitFor();
    await page.locator('[data-test-chart] svg').waitFor();
    await shot('tests-side');
  }
  await page.goto(`${base}/`);
}

async function checkMedicalMeds(page, name, theme) {
  await standinPost('/standin/reset');
  const pc = name === 'pc';
  const phone = name === 'phone';
  const shot = (n, full = false) => page.screenshot({ path: `${out}/medical-${n}-${name}-${theme}.png`, fullPage: full });
  const bar = page.locator('[data-bar]');
  const headIs = async (want) => {
    await page.locator('[data-bar-head]', { hasText: want }).waitFor();
    assert.equal(await text(page.locator('[data-bar-head]')), want, 'the answer bar');
  };
  const med = (id) => page.locator(`[data-med="${id}"]`);
  const M = LABS.meds.labs_meds;

  await page.goto(`${base}/medical/meds`);
  await page.locator('[data-card="meds"]').waitFor();
  await page.evaluate(() => (window.__noReload = true));
  assert.equal(await page.locator('[data-tab="meds"]').getAttribute('aria-current'), 'page');

  // ---- the list against the sample: the door's order, name and ingredient, dose · how often · why, start to stop or "running" ----------------
  assert.equal(await text(page.locator('#add-h')), 'Add a course');
  assert.equal(await page.locator('[data-add-text]').getAttribute('placeholder'), 'started vitamin D 1000 IU daily');
  assert.equal(await text(page.locator('[data-add]')), 'Add');
  assert.equal(await text(page.locator('#meds-h')), 'Medication');
  assert.equal(await text(page.locator('[data-running-count]')), `${M.running} running`);
  assert.deepEqual(await page.locator('[data-med]').evaluateAll((els) => els.map((e) => e.getAttribute('data-med'))), M.meds.map((m) => String(m.id)), "the door's order");
  for (const m of M.meds) {
    const el = med(m.id);
    assert.equal(await text(el.locator('[data-med-name]')), m.ingredient ? `${m.name} ${m.ingredient}` : m.name);
    assert.equal(await el.locator('[data-med-ingredient]').count(), m.ingredient ? 1 : 0);
    assert.equal(await text(el.locator('[data-med-line]')), [m.dose, m.frequency, m.indication ? `for ${m.indication}` : null].filter(Boolean).join(' · '));
    const span = await el.locator('[data-med-span]').evaluate((e) => [...e.children].map((c) => c.textContent.trim()).join(' '));
    assert.equal(span, `${m.start_text} to${m.stop_text ? ` ${m.stop_text}` : ''}${m.running ? ' running' : ''}`, `${m.name}: start to stop`);
    assert.equal(await el.locator('[data-end]').count(), m.can_end ? 1 : 0, `${m.name}: End only for a running course with no stop date`);
    assert.equal(await el.locator('[data-pencil]').count(), 1);
  }
  assert.equal(await text(page.locator('[data-hint]')), "A new course is one sentence, read back before it is saved. Today's box takes it too.");
  await shot('meds', !pc);
  await checkWidth(page, 'medical meds');

  // ---- the pencil: dose, how often, why, start and stop (empty = running); shown first, Yes saves; refusals next to the form -----------------
  await med(1).locator('[data-pencil]').click();
  const f = med(1).locator('[data-form="med"]');
  assert.equal(await f.locator('[data-edit="dose"]').inputValue(), '1000 IU');
  assert.equal(await f.locator('[data-edit="frequency"]').inputValue(), 'daily');
  assert.equal(await f.locator('[data-edit="indication"]').inputValue(), 'low vitamin D');
  assert.equal(await f.locator('[data-edit="start"]').inputValue(), '2026-09-01');
  assert.equal(await f.locator('[data-edit="stop"]').inputValue(), '');
  assert.equal(await f.locator('[data-edit="start"]').getAttribute('type'), 'date');
  assert.ok((await text(f)).includes('Stop (empty = running)'), "the door's words for the stop");
  assert.ok((await text(f)).includes(M.form_hint));
  await checkWidth(page, 'medical meds, the pencil');
  await f.locator('[data-edit="stop"]').fill('2026-08-01');
  await f.locator('[data-save-med]').click();
  await f.locator('[data-err="med:1"]').waitFor();
  assert.equal(await text(f.locator('[data-err="med:1"]')), 'stop 01.08.2026 lies before start 01.09.2026');
  assert.equal(await bar.count(), 0, 'a refusal is next to its form');
  assert.equal(await f.locator('[data-edit="stop"]').inputValue(), '2026-08-01', 'what was typed stays');
  await f.locator('[data-edit="stop"]').fill('');
  await f.locator('[data-edit="start"]').fill('');
  await f.locator('[data-save-med]').click();
  await f.locator('[data-err="med:1"]', { hasText: 'Give the start as a date.' }).waitFor();
  await f.locator('[data-edit="start"]').fill('2026-09-01');
  await f.locator('[data-save-med]').click();
  await f.locator('[data-err="med:1"]', { hasText: 'Nothing changed.' }).waitFor();
  assert.equal(await bar.count(), 0, '"Nothing changed." is next to the form only');
  if (phone) await f.screenshot({ path: `${out}/medical-med-refusal-${name}-${theme}.png` });
  await f.locator('[data-edit="dose"]').fill('2000 IU');
  await f.locator('[data-save-med]').click();
  await page.locator('[data-bar-yes]').waitFor();
  assert.equal(await text(page.locator('[data-bar-yes]')), 'Yes, change');
  assert.match(await text(bar), /OK changed D1: dose/);
  assert.equal(await text(med(1).locator('[data-med-line]')), '1000 IU · daily · for low vitamin D', 'nothing changed before Yes');
  await page.locator('[data-bar-no]').click();
  await bar.waitFor({ state: 'detached' });
  assert.equal(await text(med(1).locator('[data-med-line]')), '1000 IU · daily · for low vitamin D', 'No saves nothing');
  await f.locator('[data-save-med]').click();
  await page.locator('[data-bar-yes]').click();
  await headIs('Changed Vitamin D 1000 IU.');
  await page.waitForFunction(() => document.querySelector('[data-med="1"] [data-med-line]')?.textContent?.trim().startsWith('2000 IU'));
  assert.equal(await med(1).locator('[data-form]').count(), 0, 'the form closes');
  assert.equal(await med(1).getAttribute('data-fresh'), '', 'a blue edge on the changed course');
  assert.equal(await bar.getByRole('button', { name: 'Undo' }).count(), 0, 'no Undo');
  assert.equal(await page.evaluate(() => window.__noReload), true, 'the save changed the page in place');

  // ---- End: the bar asks ("Yes, end it today", No); Yes ends it today: no longer running, no End -------------------------------------------
  await med(1).locator('[data-end]').click();
  await page.locator('[data-bar-yes]').waitFor();
  assert.equal(await text(page.locator('[data-bar-yes]')), LABS.saves.end_ask.confirm.label);
  assert.equal(await text(page.locator('[data-bar-no]')), 'No');
  assert.match(await text(bar), /OK changed D1: stop_date/);
  assert.equal(await med(1).locator('[data-pill="running"]').count(), 1, 'still running before Yes');
  await page.locator('[data-bar-no]').click();
  await bar.waitFor({ state: 'detached' });
  assert.equal(await med(1).locator('[data-end]').count(), 1, 'No ends nothing');
  await med(1).locator('[data-end]').click();
  await page.locator('[data-bar-yes]').click();
  await headIs('Vitamin D 1000 IU ended today.');
  await page.waitForFunction(() => !document.querySelector('[data-med="1"] [data-pill="running"]'));
  assert.equal(await med(1).locator('[data-end]').count(), 0, 'no End any more');
  assert.equal(await med(1).locator('[data-med-span]').evaluate((e) => [...e.children].map((c) => c.textContent.trim()).join(' ')), '01.09.2026 to 17.11.2026');
  assert.equal(await text(page.locator('[data-running-count]')), '1 running');
  assert.deepEqual(await page.locator('[data-med]').evaluateAll((els) => els.map((e) => e.getAttribute('data-med'))), ['2', '1', '4', '3'], 'the list in the door\'s order after it');
  // a course ended elsewhere meanwhile: its End on this page is refused in the door's words, on the row
  await standinPost('/standin/reset');
  await page.goto(`${base}/medical/meds`);
  await med(1).locator('[data-end]').waitFor();
  await standinPost('/standin/labs-end?id=1');
  await med(1).locator('[data-end]').click();
  await med(1).locator('[data-err="med:1"]').waitFor();
  assert.equal(await text(med(1).locator('[data-err="med:1"]')), LABS.saves.end_again.reason);
  assert.equal(await bar.count(), 0);
  await checkWidth(page, 'medical meds, End refused');

  // ---- Add a course: the sentence read back in the bar with Yes and No (through Today's typed line); Yes adds the row; No adds nothing -----
  await standinPost('/standin/reset');
  await page.goto(`${base}/medical/meds`);
  await page.locator('[data-card="meds"]').waitFor();
  await page.evaluate(() => (window.__noReload = true));
  await page.locator('[data-add-text]').fill('started magnesium 300 mg evenings');
  await page.locator('[data-add]').click();
  await page.locator('[data-add]', { hasText: 'Reading…' }).waitFor();
  assert.equal(await page.locator('[data-add]').isDisabled(), true, 'blocked while the door reads it');
  await page.locator('[data-bar-yes]').waitFor();
  assert.equal(await text(page.locator('[data-bar-yes]')), 'Yes');
  assert.equal(await text(page.locator('[data-bar-no]')), 'No');
  assert.ok((await text(bar)).includes('start Magnesium 300 mg evenings from 17.11.2026'), "the door's read-back");
  assert.equal(await page.locator('[data-med]').count(), 4, 'nothing added before Yes');
  await shot('add-read-back');
  await checkWidth(page, 'medical meds, a course read back');
  await page.locator('[data-bar-yes]').click();
  await headIs('Changed.');
  const added = page.locator('[data-med]', { has: page.locator('[data-med-name]', { hasText: 'Magnesium 300 mg' }) });
  await added.waitFor();
  assert.equal(await added.getAttribute('data-fresh'), '', 'the new row has a blue edge');
  assert.equal(await text(added.locator('[data-med-line]')), '300 mg · evenings');
  assert.equal(await added.locator('[data-pill="running"]').count(), 1);
  assert.equal(await text(page.locator('[data-running-count]')), '3 running');
  assert.equal(await page.locator('[data-add-text]').inputValue(), '', 'the box is emptied');
  assert.ok((await text(bar)).includes('+ D5 Magnesium 300 mg'), 'the receipt');
  // No: nothing is added
  await page.locator('[data-add-text]').fill('started zinc 25 mg daily');
  await page.locator('[data-add]').click();
  await page.locator('[data-bar-no]').waitFor();
  await page.locator('[data-bar-no]').click();
  await bar.waitFor({ state: 'detached' });
  assert.equal(await page.locator('[data-med-name]', { hasText: 'Zinc' }).count(), 0, 'No adds nothing');
  assert.equal(await page.evaluate(() => window.__noReload), true, 'every save changed the page in place');
  // the question was answered: Today's Needs you has none left of it
  await page.goto(`${base}/`);
  assert.equal(await page.getByText('started zinc 25 mg daily').count(), 0, 'the answered question is gone from Today');
  // the empty list and the door off
  await standinPost('/standin/labs-empty');
  await page.goto(`${base}/medical/meds`);
  await page.locator('[data-empty]').waitFor();
  assert.equal(await text(page.locator('[data-empty]')), 'No medication recorded.');
  assert.equal(await text(page.locator('[data-running-count]')), '0 running');
  await checkWidth(page, 'medical meds, empty');
  await standinPost('/standin/reset');
  await standinPost('/standin/door-off');
  await page.goto(`${base}/medical/meds`);
  await page.locator('[data-problem]').waitFor();
  assert.match(await page.getByRole('link', { name: 'Open the full app' }).getAttribute('href'), /\/web\/labs\/meds$/);
  await checkWidth(page, 'medical meds, door off');
  await standinPost('/standin/up');
  await page.goto(`${base}/`);
}

// ---- Deploy 108: More (its rows, the Words, Sign out), Search, Recent and Usage --------------------------------------------------------------------------------
const SEARCH = JSON.parse(readFileSync(new URL('../samples/search.json', import.meta.url), 'utf8'));
const RECENT = JSON.parse(readFileSync(new URL('../samples/recent.json', import.meta.url), 'utf8')).recent;
const USAGE = JSON.parse(readFileSync(new URL('../samples/usage.json', import.meta.url), 'utf8'));

/** The More tab (phones and tablets) or rail item (PC) is lit on a page under More; no other place is. */
async function assertMoreLit(page, name, where) {
  const more = page.locator('[data-place="more"]');
  const cur = await more.getAttribute('aria-current');
  assert.ok(cur === 'page' || cur === 'true', `${where}: More is lit (aria-current ${cur})`);
  assert.match(await more.getAttribute('class'), /text-blue/, `${where}: More is blue`);
  for (const p of ['today', 'trends', 'library']) assert.equal(await page.locator(`[data-place="${p}"]`).getAttribute('aria-current'), null, `${where}: ${p} is not lit`);
  if (name === 'pc') {
    assert.equal(await page.locator('[data-rail-space][aria-current]').count(), 0, `${where}: no Space is lit in the rail`);
    assert.match(await more.getAttribute('class'), /desktop:bg-blue-bg/, `${where}: the rail's More has the lit background`);
  }
}

/** More: the search field, the Spaces, the four rows (only Settings still at app.), the Words, Sign out; PC in two columns. */
async function checkMoreHome(page, name, theme) {
  await standinPost('/standin/reset');
  const pc = name === 'pc';
  await page.goto(`${base}/`);
  await page.locator('[data-place="more"]').click();
  await page.waitForURL(/\/more$/);
  assert.equal(await page.locator('h1').textContent(), 'More');
  assert.equal(await page.locator('[data-place="more"]').getAttribute('aria-current'), 'page');
  await assertMoreLit(page, name, 'more');
  // the search field: a plain GET form to /search?q=
  const form = page.locator('[data-search-form]');
  assert.equal(await form.getAttribute('method'), 'GET');
  assert.equal(await form.getAttribute('action'), '/search');
  assert.equal(await page.locator('[data-search]').getAttribute('name'), 'q');
  assert.equal(await page.locator('[data-search]').getAttribute('placeholder'), 'Search foods, meals, workouts, chores, tests');
  assert.equal(await text(page.locator('label[for="more-q"]')), 'Search');
  // the Spaces as before, then the four rows, all pages here (Settings since deploy 111: no "app." tag any more)
  assert.deepEqual(await page.locator('[data-space]').evaluateAll((els) => els.map((e) => [e.getAttribute('data-space'), e.getAttribute('href')])),
    [['gym', '/gym'], ['health', '/health'], ['habits', '/habits'], ['home', '/home'], ['medical', '/medical']]);
  const rows = await page.locator('[data-more-place]').evaluateAll((els) => els.map((e) => [e.getAttribute('data-more-place'), e.getAttribute('href'), e.getAttribute('data-where'), e.textContent.replace(/\s+/g, ' ').trim(), e.querySelector('[data-app-tag]') !== null]));
  assert.deepEqual(rows.map((r) => r[0]), ['coach', 'recent', 'usage', 'settings']);
  assert.equal(rows[0][1], '/coach', 'Coach is a page here since deploy 109');
  assert.equal(rows[1][1], '/recent');
  assert.equal(rows[2][1], '/usage');
  assert.equal(rows[3][1], '/settings', 'Settings is a page here since deploy 111');
  assert.deepEqual(rows.map((r) => r[2]), ['here', 'here', 'here', 'here']);
  assert.deepEqual(rows.map((r) => r[4]), [false, false, false, false], 'no "app." tag on any row');
  assert.deepEqual(rows.map((r) => r[3]), ['Coach Every coaching, a day or a week', 'Recent What you sent, and what it saved', 'Usage AI calls and cost', 'Settings Targets, Today page, reminders, devices, export']);
  // the Words: one quiet card, three links to app., each marked
  assert.equal(await text(page.locator('[data-words] p')), 'Ideas, Private and Gratitude are in the full app until the journal app exists.');
  const words = await page.locator('[data-word]').evaluateAll((els) => els.map((e) => [e.getAttribute('data-word'), e.getAttribute('href'), e.textContent.replace(/\s+/g, ' ').trim()]));
  assert.deepEqual(words.map((w) => [w[0], w[2]]), [['ideas', 'Ideas › app.'], ['private', 'Private › app.'], ['gratitude', 'Gratitude › app.']]);
  assert.deepEqual(words.map((w) => w[1].replace(/^https?:\/\/[^/]+/, '')), ['/web/ideas', '/web/private', '/web/gratitude']);
  // the dashed "Settings and the rest" box is gone, and since deploy 111 the footer line too
  assert.equal(await page.locator('[data-rest]').count(), 0, 'no dashed box');
  assert.equal(await page.getByText('Settings and the rest are').count(), 0, 'no footer line');
  // Sign out: the form Today's header has
  const so = page.locator('form[action="/signout"] button');
  assert.equal(await so.count(), 1);
  assert.equal(await text(so), 'Sign out');
  assert.equal(await page.locator('form[action="/signout"]').getAttribute('method'), 'POST');
  // the order: phones one column (search, Spaces, rows, Words, Sign out); the PC search on top, rows left and Spaces right
  const box = async (sel) => (await page.locator(sel).first().boundingBox());
  const [bs, bsp, bp, bw, bo] = [await box('[data-search]'), await box('[data-spaces]'), await box('[data-places-card]'), await box('[data-words]'), await box('form[action="/signout"] button')];
  assert.ok(bs.y < bsp.y && bs.y < bp.y, 'the search is on top');
  if (pc) {
    assert.ok(bp.x < bsp.x, 'pc: the rows are on the left, the Spaces on the right');
    assert.ok(Math.abs(bp.y - bsp.y) < 30, 'pc: both columns start together');
    assert.ok(bw.y > bp.y + bp.height && bo.y > bw.y, 'pc: rows, Words, Sign out down the left column');
    assert.ok(bw.x < bsp.x, 'pc: the Words are on the left');
  } else {
    assert.ok(bsp.y < bp.y && bp.y < bw.y && bw.y < bo.y, `${name}: the Spaces, the rows, the Words, Sign out in one column`);
  }
  await page.screenshot({ path: `${out}/more-page-${name}-${theme}.png`, fullPage: true });
  await checkWidth(page, 'more');
  // a search typed here goes to /search?q=
  await page.locator('[data-search]').fill('muesli');
  await page.locator('[data-search]').press('Enter');
  await page.waitForURL(/\/search\?q=muesli$/);
  assert.equal(await page.locator('[data-search]').inputValue(), 'muesli', 'Search keeps the words');
  await page.goto(`${base}/more`);
  // Recent and Usage open their pages; Settings leaves for app. (not followed here; Coach has its own checks)
  await page.locator('[data-more-place="recent"]').click();
  await page.waitForURL(/\/recent$/);
  await page.goto(`${base}/more`);
  await page.locator('[data-more-place="usage"]').click();
  await page.waitForURL(/\/usage$/);
  // the back chevron leads back to More
  assert.equal(await page.locator('[data-back]').getAttribute('href'), '/more');
  assert.equal(await page.locator('[data-back]').getAttribute('aria-label'), 'Back to More');
  await page.locator('[data-back]').click();
  await page.waitForURL(/\/more$/);
  // Today keeps its own Sign out
  await page.goto(`${base}/`);
  assert.equal(await page.getByRole('button', { name: 'Sign out' }).count(), 1);
}

async function checkSearch(page, name, theme) {
  await standinPost('/standin/reset');
  const pc = name === 'pc';
  const grp = (k) => page.locator(`[data-group="${k}"]`);
  const hrefs = (k) => page.locator(`[data-group="${k}"] [data-row]`).evaluateAll((els) => els.map((e) => e.getAttribute('href')));
  const KEYS = ['foods', 'ate', 'workouts', 'chores', 'tests'];

  // ---- muesli: foods and meals found, the rest "none"; each row's link; the thoughts line ----
  await page.goto(`${base}/search?q=muesli`);
  await page.locator('[data-search-results]').waitFor();
  const M = SEARCH.muesli.search;
  assert.equal(await page.locator('h1').textContent(), 'Search');
  assert.equal(await page.locator('[data-search]').inputValue(), 'muesli', 'the field keeps the words');
  assert.equal(await page.locator('[data-back]').getAttribute('href'), '/more');
  await assertMoreLit(page, name, 'search');
  assert.equal(await text(page.locator('[data-results-for]')), 'Results for “muesli”');
  assert.deepEqual(await page.locator('[data-group]').evaluateAll((els) => els.map((e) => e.getAttribute('data-group'))), KEYS, "the door's five groups in its order");
  assert.deepEqual(await page.locator('[data-group] h2, [data-group][data-none] > span:first-child').evaluateAll((els) => els.map((e) => e.textContent.trim())), KEYS.map((k) => M[k].title), "the door's titles");
  assert.deepEqual(await page.locator('[data-group]').evaluateAll((els) => els.map((e) => [e.getAttribute('data-group'), e.hasAttribute('data-none'), e.querySelector('[data-count]')?.textContent.trim() ?? null])),
    [['foods', false, '2'], ['ate', false, '2'], ['workouts', true, null], ['chores', true, null], ['tests', true, null]]);
  for (const k of ['workouts', 'chores', 'tests']) assert.equal(await text(grp(k)), `${M[k].title} none`, `${k}: none, quietly`);
  assert.deepEqual(await hrefs('foods'), M.foods.rows.map((r) => `/library?q=muesli&food=N${r.food_id}`));
  assert.deepEqual(await hrefs('ate'), M.ate.rows.map((r) => `/food?day=${r.day}&open=${r.ref}`));
  assert.deepEqual(await page.locator('[data-group="foods"] [data-row]').evaluateAll((els) => els.map((e) => e.textContent.replace(/\s+/g, ' ').trim())), M.foods.rows.map((r) => `${r.id} ${r.name}`));
  assert.deepEqual(await page.locator('[data-group="ate"] [data-row]').evaluateAll((els) => els.map((e) => e.textContent.replace(/\s+/g, ' ').trim())), M.ate.rows.map((r) => [r.day_text, r.food, r.amount_text, r.note].filter(Boolean).join(' ')));
  const th = page.locator('[data-thoughts]');
  assert.equal(await text(th), 'Thoughts with “muesli” are searched in the full app ›');
  assert.match(await th.getAttribute('href'), /^https?:\/\/[^/]+\/web\/search\?q=muesli$/);
  assert.equal(await page.locator('[data-search-results]').getByText('idea', { exact: false }).count(), 0, 'no thought in the page');
  await page.screenshot({ path: `${out}/search-${name}-${theme}.png`, fullPage: true });
  await checkWidth(page, 'search, muesli');
  // a row opens its place: a food in Library with the search and the food open; a meal on its day
  await page.locator('[data-group="foods"] [data-row]').first().click();
  await page.waitForURL(/\/library\?q=muesli&food=N1$/);
  await page.locator('[data-box="1"]').waitFor();
  await page.goBack();
  await page.locator('[data-group="ate"] [data-row]').first().click();
  await page.waitForURL(/\/food\?day=2026-11-17&open=f1$/);
  assert.equal(await page.locator('[data-problem]').count(), 0);

  // ---- the field searches again, with the words typed (spaces squeezed) ----
  await page.goto(`${base}/search?q=muesli`);
  await page.locator('[data-search]').fill('  rowing ');
  await page.locator('[data-search]').press('Enter');
  await page.waitForURL(/\/search\?q=\+\+rowing\+$/);
  await page.locator('[data-search-results]').waitFor();
  assert.equal(await page.locator('[data-search]').inputValue(), 'rowing', 'the words squeezed as the door takes them');

  // ---- rowing: a workout; its link asks the History for that workout, which is older than the last 60 ----
  const Rw = SEARCH.rowing.search.workouts.rows[0];
  assert.deepEqual(await hrefs('workouts'), [`/gym/history?w=${Rw.workout_id}#${Rw.anchor}`]);
  assert.equal(await text(page.locator('[data-group="workouts"] [data-row]')), `${Rw.day_text} ${Rw.split} ${Rw.text}`);
  await checkWidth(page, 'search, rowing');
  await page.locator('[data-group="workouts"] [data-row]').click();
  await page.waitForURL(/\/gym\/history\?w=1#w1$/);
  const card = page.locator(`[data-workout="${Rw.workout_id}"]`);
  await card.waitFor();
  assert.equal(await card.getAttribute('id'), Rw.anchor);
  const edge = (sel) => page.locator(sel).evaluate((e) => getComputedStyle(e).borderTopColor);
  assert.notEqual(await edge(`[data-workout="${Rw.workout_id}"]`), await edge('[data-workout="21"]'), 'the card jumped to is marked (blue edge)');
  await page.waitForFunction((id) => { const r = document.getElementById(id).getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; }, Rw.anchor, { timeout: 5000 }); // scrolled into view
  await checkWidth(page, 'gym history, a card jumped to');
  // a workout the last 60 do not hold (w=999 is not in the sample) comes in its place by date, with its card marked
  await page.goto(`${base}/gym/history?w=999#w999`);
  const old = page.locator('[data-workout="999"]');
  await old.waitFor();
  assert.match(await text(old.locator('[data-date]')), /02\.04\.2026/, "an older workout has its card (the door's w)");
  assert.equal(await text(old.locator('[data-line-name]')), 'Rowing');
  assert.notEqual(await edge('[data-workout="999"]'), await edge('[data-workout="21"]'), 'the older card is marked too');
  assert.equal(await page.locator('[data-workout]').last().getAttribute('data-workout'), '999', 'in its place by date: after every newer one');
  await checkWidth(page, 'gym history, an older workout by w');
  // w is passed on only as digits; a workout in the last 60 is listed once; no w: no extra card
  await page.goto(`${base}/gym/history?w=abc`);
  await page.locator('[data-history]').waitFor();
  assert.equal(await page.locator('[data-problem]').count(), 0, 'w that is no id is dropped, not an error');
  assert.equal(await page.locator('[data-workout="999"]').count(), 0);
  await page.goto(`${base}/gym/history?w=21`);
  await page.locator('[data-history]').waitFor();
  assert.equal(await page.locator('[data-workout="21"]').count(), 1, 'a listed workout once');
  await page.goto(`${base}/gym/history`);
  await page.locator('[data-history]').waitFor();
  assert.equal(await page.locator('[data-workout="999"]').count(), 0, 'without w the last 60 only');

  // ---- stove: chores, one a starting point; each opens the chore's page ----
  await page.goto(`${base}/search?q=stove`);
  const C = SEARCH.stove.search.chores.rows;
  assert.deepEqual(await hrefs('chores'), C.map((r) => `/home/chore?id=${r.chore_id}`));
  assert.deepEqual(await page.locator('[data-group="chores"] [data-row]').evaluateAll((els) => els.map((e) => e.textContent.replace(/\s+/g, ' ').trim())), C.map((r) => `${r.label}${r.start ? ' starting point' : ''} ${r.day_text}`));
  assert.equal(await page.locator('[data-group="chores"] [data-row]').count(), 2, 'a chore done twice is two rows');
  await page.locator('[data-group="chores"] [data-row]').first().click();
  await page.waitForURL(/\/home\/chore\?id=1$/);
  await page.locator('[data-card="chore"]').waitFor();

  // ---- vitamin: lab tests; a row opens that test ----
  await page.goto(`${base}/search?q=vitamin`);
  const T = SEARCH.vitamin.search.tests.rows;
  assert.deepEqual(await hrefs('tests'), T.map((r) => `/medical/tests?t=${r.test_id}`));
  assert.deepEqual(await page.locator('[data-group="tests"] [data-row]').evaluateAll((els) => els.map((e) => e.textContent.trim())), T.map((r) => r.name));
  assert.equal(await text(page.locator('[data-group="tests"] [data-count]')), String(T.length));
  await page.locator('[data-group="tests"] [data-row][href$="t=21"]').click();
  await page.waitForURL(/\/medical\/tests\?t=21$/);
  await page.locator('[data-test="21"]').waitFor();

  // ---- nothing found: five quiet "none" and the thoughts line; under two letters or nothing: the door's hint ----
  await page.goto(`${base}/search?q=zzqq`);
  assert.equal(await page.locator('[data-group][data-none]').count(), 5);
  assert.equal(await page.locator('[data-group] [data-row]').count(), 0);
  assert.equal(await text(page.locator('[data-thoughts]')), 'Thoughts with “zzqq” are searched in the full app ›');
  await checkWidth(page, 'search, nothing found');
  for (const [url, hint] of [['/search?q=m', SEARCH.m.search.hint], ['/search', SEARCH.m.search.hint]]) {
    await page.goto(`${base}${url}`);
    await page.locator('[data-hint]').waitFor();
    assert.equal(await text(page.locator('[data-hint]')), hint, `${url}: the door's hint`);
    assert.equal(await page.locator('[data-group]').count(), 0);
    assert.equal(await page.locator('[data-thoughts]').count(), 0, 'no thoughts line without a search');
  }
  await page.goto(`${base}/search?q=m`);
  assert.equal(await page.locator('[data-search]').inputValue(), 'm');
  if (name === 'phone') await page.screenshot({ path: `${out}/search-hint-${name}-${theme}.png` });
  await checkWidth(page, 'search, hint');
  // a group cut at 15 says "15+"
  await page.goto(`${base}/search?q=many`);
  assert.equal(await text(page.locator('[data-group="foods"] [data-count]')), '15+');
  assert.equal(await page.locator('[data-group="foods"] [data-row]').count(), 15);
  assert.match(await text(page.locator('[data-group="foods"] [data-more]')), /^The first 15 are shown/);
  await checkWidth(page, 'search, 15+');
  // the words come back safe: a q with markup is text, not markup
  await page.goto(`${base}/search?q=${encodeURIComponent('<b>oat</b>')}`);
  assert.equal(await page.locator('[data-results-for] b').count(), 0);
  assert.equal(await text(page.locator('[data-results-for]')), 'Results for “<b>oat</b>”');
  // the door off: the plain message with a link to app.'s Search
  await standinPost('/standin/door-off');
  await page.goto(`${base}/search?q=muesli`);
  await page.locator('[data-problem]').waitFor();
  assert.match(await page.getByRole('link', { name: 'Open the full app' }).getAttribute('href'), /\/web\/search$/);
  await checkWidth(page, 'search, door off');
  await standinPost('/standin/up');
  await page.goto(`${base}/`);
}

async function checkRecent(page, name, theme) {
  await standinPost('/standin/reset');
  const pc = name === 'pc';
  const msgs = RECENT.days.flatMap((d) => d.messages);
  await page.goto(`${base}/recent`);
  await page.locator('[data-recent]').waitFor();
  assert.equal(await page.locator('h1').textContent(), 'Recent');
  assert.equal(await page.locator('[data-back]').getAttribute('href'), '/more');
  await assertMoreLit(page, name, 'recent');
  // the amber line: n messages not read yet, to Today
  const nr = page.locator('[data-not-read]');
  assert.equal(await text(nr), '1 message not read yet › Today');
  assert.equal(await nr.getAttribute('href'), '/');
  assert.match(await nr.getAttribute('class'), /bg-amber-bg/);
  // the days (the door's heads), the messages in the door's order
  assert.deepEqual(await page.locator('[data-day] h2').evaluateAll((els) => els.map((e) => e.textContent.trim())), RECENT.days.map((d) => d.head));
  assert.deepEqual(await page.locator('[data-message]').evaluateAll((els) => els.map((e) => e.getAttribute('data-message'))), msgs.map((m) => (m.private ? 'private' : String(m.id))));
  for (const m of msgs) {
    const el = page.locator(m.private ? `[data-message="private"]:has([data-time]:text-is("${m.time}"))` : `[data-message="${m.id}"]`);
    assert.equal(await text(el.locator('[data-time]')), m.time);
    assert.equal(await text(el.locator('[data-channel]')), m.channel_label);
    if (m.private) {
      // a private entry: the "Private" pill and its saved label, nothing else: no words, no saved pills, no buttons
      assert.equal(await text(el), `${m.time} Private ${m.saved[0].text}`, 'a private entry shows its label only');
      assert.equal(await el.locator('button, a').count(), 0, 'no Use again or Open day on a private entry');
      continue;
    }
    assert.equal(await text(el.locator('[data-words]')), m.text);
    if (m.saved.length) assert.deepEqual(await el.locator('[data-saved] li').evaluateAll((els) => els.map((e) => e.textContent.replace(/\s+/g, ' ').trim())), m.saved.map((s) => `${s.kind} ${s.text}`));
    else assert.equal(await text(el.locator('[data-none]')), RECENT.none);
    assert.equal(await el.locator('[data-use-again]').count(), m.again ? 1 : 0);
    assert.equal(await el.locator('[data-open-day]').count(), m.open_day ? 1 : 0);
    if (m.open_day) assert.equal(await el.locator('[data-open-day]').getAttribute('href'), `/food?day=${m.open_day}`);
  }
  // the channel pill: Claude blue, the web app neutral
  assert.match(await page.locator('[data-message="2"] [data-channel]').getAttribute('class'), /text-blue/);
  assert.match(await page.locator('[data-message="1"] [data-channel]').getAttribute('class'), /text-chip-text/);
  assert.equal(await text(page.locator('main > p').last()), `${RECENT.small}. Private entries show only their kind.`);
  await page.screenshot({ path: `${out}/recent-${name}-${theme}.png`, fullPage: true });
  await checkWidth(page, 'recent');
  // the page keeps no private word anywhere (the sample has none, and none is invented)
  assert.equal(await page.locator('[data-message="private"] [data-words]').count(), 0);

  // Open day: that day's Food page
  await page.locator('[data-message="3"] [data-open-day]').click();
  await page.waitForURL(/\/food\?day=2026-11-16$/);
  assert.equal(await page.locator('[data-problem]').count(), 0);

  // Use again: the words go into Today's logging box through the tab's storage, never the address; the box takes them once
  await page.goto(`${base}/recent`);
  await page.locator('[data-message="1"] [data-use-again]').click();
  await page.waitForURL((u) => u.pathname === '/' && u.search === '', { timeout: 10000 });
  await page.locator('#log-text').waitFor();
  assert.equal(await page.locator('#log-text').inputValue(), msgs.find((m) => m.id === 1).again, 'the words are in the box');
  assert.equal(page.url().includes('bircher'), false, 'never in the address');
  assert.equal(await page.evaluate(() => sessionStorage.getItem('logger-use-again')), null, 'taken out of the storage');
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'log-text', 'the cursor is in the box');
  await page.reload();
  await page.locator('#log-text').waitFor();
  assert.equal(await page.locator('#log-text').inputValue(), '', 'only once');
  // the other message's words come in the same way (its own "again": without "at 09:30")
  await page.goto(`${base}/recent`);
  await page.locator('[data-message="2"] [data-use-again]').click();
  await page.waitForURL((u) => u.pathname === '/');
  await page.locator('#log-text').waitFor();
  assert.equal(await page.locator('#log-text').inputValue(), 'green tea');
  await page.locator('#log-text').fill('');
  // the amber line leads to Today
  await page.goto(`${base}/recent`);
  await page.locator('[data-not-read]').click();
  await page.waitForURL((u) => u.pathname === '/' && u.search === '');

  // nothing waits, nothing sent: no amber line, the door's empty words
  await standinPost('/standin/recent-none');
  await page.goto(`${base}/recent`);
  await page.locator('[data-empty]').waitFor();
  assert.equal(await text(page.locator('[data-empty]')), RECENT.empty);
  assert.equal(await page.locator('[data-not-read]').count(), 0);
  await checkWidth(page, 'recent, empty');
  await standinPost('/standin/reset');
  // the door off: the plain message with a link to app.'s Recent
  await standinPost('/standin/door-off');
  await page.goto(`${base}/recent`);
  await page.locator('[data-problem]').waitFor();
  assert.match(await page.getByRole('link', { name: 'Open the full app' }).getAttribute('href'), /\/web\/recent$/);
  await checkWidth(page, 'recent, door off');
  await standinPost('/standin/up');
  void pc;
  await page.goto(`${base}/`);
}

async function checkUsage(page, name, theme) {
  await standinPost('/standin/reset');
  const pc = name === 'pc';
  const fills = (sel) => page.locator(sel).evaluateAll((els) => els.map((e) => getComputedStyle(e).fill));
  const rangeCheck = async (r) => {
    const U = USAGE[r].usage;
    assert.deepEqual(await page.locator('[data-range]').evaluateAll((els) => els.map((e) => [e.getAttribute('data-range'), e.textContent.trim(), e.getAttribute('aria-current'), e.getAttribute('href')])),
      U.ranges.map((x) => [x.r, x.label, x.current ? 'page' : null, x.r === '7' ? '/usage' : `/usage?r=${x.r}`]));
    assert.equal(await text(page.locator('[data-since]')), U.since);
    const t = U.tiles;
    assert.deepEqual(await page.locator('[data-tile]').evaluateAll((els) => els.map((e) => [e.getAttribute('data-tile'), e.querySelector('[data-tile-value]').textContent.trim()])),
      [['calls', String(t.calls)], ['cost', t.usd_text], ['per_message', t.per_message_text], ['tokens', t.tokens_text]]);
    assert.equal(await text(page.locator('[data-tile="per_message"] [data-tile-sub]')), `${t.messages} messages`);
    assert.equal(await text(page.locator('[data-tile="tokens"] [data-tile-sub]')), t.tokens_note);
    // the chart: a bar per point, by family; the door's legend
    const marks = U.chart.series.reduce((n, s) => n + s.pts.length, 0);
    assert.equal(await page.locator('[data-cost-chart] [data-mark="bar"]').count(), marks, 'a bar per point');
    for (const s of U.chart.series) assert.equal(await page.locator(`[data-cost-chart] [data-mark="bar"].${s.cls}`).count(), s.pts.length);
    assert.equal(await text(page.locator('[data-cost-chart] .legend')), U.legend.map((l) => l.text).join(' '));
    assert.equal(await page.locator('[data-cost-chart] svg').getAttribute('aria-label'), U.chart.label);
    // By kind: the door's rows and the All row; the note; the pushes
    assert.deepEqual(await page.locator('[data-kinds] tbody tr').evaluateAll((els) => els.map((e) => [...e.children].map((c) => c.textContent.trim()))),
      [...U.kinds, U.all].map((k) => [k.kind === 'All' ? 'All' : k.kind.charAt(0).toUpperCase() + k.kind.slice(1), String(k.calls), k.tokens_in_text, k.tokens_out_text, k.usd_text]));
    assert.equal(await text(page.locator('[data-kinds-note]')), U.kinds_note);
    assert.equal(await text(page.locator('[data-pushes]')), U.pushes_text);
    // the costly messages: words or a private mark, kind, models, cost, "read again by the larger model"
    assert.equal(await page.locator('[data-top-row]').count(), U.top.length);
    for (const [i, x] of U.top.entries()) {
      const row = page.locator('[data-top-row]').nth(i);
      assert.equal(await text(row.locator('[data-top-line]')), [x.at_text, x.kind, x.models_text].join(' · '));
      assert.equal(await text(row), [x.private ? 'private' : x.text ?? '–', x.usd_text, [x.at_text, x.kind, x.models_text].join(' · '), x.escalated ? 'read again by the larger model' : null].filter(Boolean).join(' '));
      assert.equal(await row.locator('[data-private]').count(), x.private ? 1 : 0);
      assert.equal(await row.locator('[data-escalated]').count(), x.escalated ? 1 : 0);
    }
    assert.equal(await text(page.locator('[data-note]')), U.note);
  };

  await page.goto(`${base}/usage`);
  await page.locator('[data-usage]').waitFor();
  assert.equal(await page.locator('h1').textContent(), 'Usage');
  assert.equal(await page.locator('[data-back]').getAttribute('href'), '/more');
  await assertMoreLit(page, name, 'usage');
  await page.locator('[data-cost-chart] svg').waitFor();
  await rangeCheck('7');
  // Haiku neutral, Sonnet and Opus two blues: three different colours; the legend keys match them
  const [fa, fb, fc] = [(await fills('[data-cost-chart] rect.a'))[0], (await fills('[data-cost-chart] rect.b'))[0], (await fills('[data-cost-chart] rect.c'))[0]];
  assert.equal(new Set([fa, fb, fc]).size, 3, `three families, three colours (${fa} ${fb} ${fc})`);
  const key = (c) => page.locator(`[data-cost-chart] .legend .key.${c}`).evaluate((e) => getComputedStyle(e).backgroundColor);
  assert.deepEqual([await key('a'), await key('b'), await key('c')], [fa, fb, fc], 'the legend squares are the bars’ colours');
  // a tap on a bar shows the door's words
  await page.locator('[data-cost-chart] rect.c').first().click();
  await page.locator('[data-cost-chart] [data-tip]').waitFor();
  assert.equal(await text(page.locator('[data-cost-chart] [data-tip] text')), USAGE['7'].usage.chart.series.find((s) => s.cls === 'c').pts[0][2]);
  await page.screenshot({ path: `${out}/usage-${name}-${theme}.png`, fullPage: true });
  await checkWidth(page, 'usage, 7 days');
  if (pc) assert.equal(await page.locator('[data-tile]').evaluateAll((els) => new Set(els.map((e) => Math.round(e.getBoundingClientRect().y))).size), 1, 'pc: the four tiles in one row');
  else assert.equal(await page.locator('[data-tile]').evaluateAll((els) => new Set(els.map((e) => Math.round(e.getBoundingClientRect().y))).size), 2, `${name}: the tiles two by two`);
  // the chips: 30 days and Everything
  await page.locator('[data-range="30"]').click();
  await page.waitForURL(/\/usage\?r=30$/);
  await page.locator('[data-cost-chart] svg').waitFor();
  await rangeCheck('30');
  await checkWidth(page, 'usage, 30 days');
  await page.locator('[data-range="all"]').click();
  await page.waitForURL(/\/usage\?r=all$/);
  await page.locator('[data-cost-chart] svg').waitFor();
  await rangeCheck('all');
  if (name === 'phone') await page.screenshot({ path: `${out}/usage-all-${name}-${theme}.png`, fullPage: true });
  await checkWidth(page, 'usage, everything');
  await page.locator('[data-range="7"]').click();
  await page.waitForURL((u) => u.pathname === '/usage' && u.search === '');
  // another r is dropped: 7 days
  await page.goto(`${base}/usage?r=5`);
  await page.locator('[data-usage]').waitFor();
  assert.equal(await page.locator('[data-range="7"]').getAttribute('aria-current'), 'page');
  // no call in the range: the door's words in place of the chart, the All row of zeros, no costly message
  await standinPost('/standin/usage-empty');
  await page.goto(`${base}/usage`);
  await page.locator('[data-chart-empty]').waitFor();
  assert.equal(await text(page.locator('[data-chart-empty]')), USAGE['7'].usage.empty);
  assert.equal(await page.locator('[data-cost-chart] svg').count(), 0);
  assert.deepEqual(await page.locator('[data-kinds] tbody tr').evaluateAll((els) => els.map((e) => e.children[0].textContent.trim())), ['All']);
  assert.equal(await page.locator('[data-top-row]').count(), 0);
  assert.equal(await text(page.locator('[data-tile="per_message"] [data-tile-value]')), '–');
  assert.equal(await text(page.locator('[data-tile="per_message"] [data-tile-sub]')), 'no typed messages');
  await checkWidth(page, 'usage, empty');
  await standinPost('/standin/reset');
  // the door off: the plain message with a link to app.'s Usage
  await standinPost('/standin/door-off');
  await page.goto(`${base}/usage`);
  await page.locator('[data-problem]').waitFor();
  assert.match(await page.getByRole('link', { name: 'Open the full app' }).getAttribute('href'), /\/web\/usage$/);
  await checkWidth(page, 'usage, door off');
  await standinPost('/standin/up');
  await page.goto(`${base}/`);
}

const COACH = JSON.parse(readFileSync(new URL('../samples/coach.json', import.meta.url), 'utf8'));

/**
 * More's Coach page (deploy 109): the row at More, the list and the chips against the sample, a day and a week coaching opened (in
 * place on phones and tablets, in the side column on the PC) with their parts, the amber "To improve" and the meal, the month line, the
 * note and Your goals; "Coach a day" in its four states and its date field; the press sent once and never again, working then done in
 * place, a refusal and "already on it" in the answer bar, taking longer, a failed read.
 */
async function checkCoach(page, name, theme) {
  await standinPost('/standin/reset');
  const pc = name === 'pc';
  const co = (k) => COACH[k].coach;
  const starts = async () => (await (await fetch(`${standin}/standin/coach-starts`)).json()).starts;
  const coachSet = (q) => standinPost(`/standin/coach?${q}`);
  const card = page.locator('[data-card="coach"]');
  const shot = (n, full = true) => page.screenshot({ path: `${out}/coach-${n}-${name}-${theme}.png`, fullPage: full });
  const ids = (sel) => page.locator(sel).evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-coaching'))));
  const open = async (id) => {
    await page.locator(`[data-coaching="${id}"] [data-coaching-row]`).click();
    return page.locator(pc ? `[data-side-open="${id}"]` : `[data-coaching="${id}"] [data-coach-open]`);
  };
  const checkParts = async (box, parts) => {
    assert.deepEqual(await box.locator('[data-part]').evaluateAll((els) => els.map((e) => e.getAttribute('data-part'))), parts.map((x) => x.key), 'the parts in the door\'s order');
    for (const part of parts) {
      const el = box.locator(`[data-part="${part.key}"]`);
      if (part.style === 'note') assert.equal(await text(el), part.text);
      else if (part.style === 'meal') {
        assert.equal(await text(el.locator('h3')), part.title);
        assert.equal(await text(el.locator('[data-meal-title]')), part.meal.title);
        assert.equal(await text(el.locator('[data-meal-why]')), part.meal.why);
        assert.equal(await text(el.locator('[data-meal-macros]')), part.meal.macros);
      } else {
        assert.equal(await text(el.locator('h3')), part.title);
        assert.equal(await el.locator(part.style === 'numbered' ? 'ol' : 'ul').count(), 1, `${part.key}: ${part.style}`);
        assert.deepEqual(await el.locator('li').allTextContents(), part.items);
        // "To improve" (tone warn) is amber; every other part is not
        const amber = await el.evaluate((e) => e.className.includes('border-amber'));
        assert.equal(amber, part.tone === 'warn', `${part.key}: amber only for the warn tone`);
        assert.equal(await el.getAttribute('data-tone'), part.tone);
      }
    }
  };

  // ---- More's row opens the page; More is lit ---------------------------------------------------------------------------------------
  await page.goto(`${base}/more`);
  const row = page.locator('[data-more-place="coach"]');
  assert.equal(await row.getAttribute('href'), '/coach');
  assert.equal(await row.getAttribute('data-where'), 'here');
  assert.equal(await row.locator('[data-app-tag]').count(), 0, 'no app. tag on Coach');
  await row.click();
  await page.waitForURL(/\/coach$/);
  await page.locator('[data-coach]').waitFor();
  assert.equal(await page.locator('h1').textContent(), 'Coach');
  assert.equal(await page.locator('[data-back]').getAttribute('href'), '/more');
  assert.equal(await page.locator('[data-back]').getAttribute('aria-label'), 'Back to More');
  await assertMoreLit(page, name, 'coach');
  await page.evaluate(() => (window.__noReload = true));

  // ---- the list, the chips, the month line, the note, Your goals -------------------------------------------------------------------------
  const L = co('all');
  assert.deepEqual(await ids('[data-coaching]'), L.list.map((c) => c.id), 'every finished coaching, newest first');
  for (const c of L.list) {
    const el = page.locator(`[data-coaching="${c.id}"]`);
    assert.equal(await text(el.locator('[data-coaching-heading]')), c.heading);
    assert.equal(await text(el.locator('[data-kind]')), c.kind);
    assert.equal(await text(el.locator('[data-coaching-first]')), c.first);
    assert.equal(await text(el.locator('[data-coaching-meta]')), c.meta.text);
    assert.equal(await el.locator('[data-coach-open]').count(), 0, 'closed until tapped');
  }
  assert.deepEqual(await page.locator('[data-filter]').evaluateAll((els) => els.map((e) => [e.getAttribute('data-filter'), e.textContent.trim(), e.getAttribute('aria-current'), e.getAttribute('href')])),
    [['all', 'All', 'page', '/coach'], ['days', 'Days', null, '/coach?f=days'], ['weeks', 'Weeks', null, '/coach?f=weeks']]);
  assert.equal(await text(page.locator('[data-month]')), L.month.text);
  assert.equal(await text(page.locator('[data-note]')), L.note);
  assert.equal(await text(page.locator('[data-goals]')), 'Your goals ›');
  assert.equal(await page.locator('[data-goals]').getAttribute('href'), '/settings/coach', 'Your goals is Settings\' Coach tab here since deploy 111');
  // the order: Coach a day, the chips, the list, the month line (phones: one column; the PC: the same on the left, the side column right)
  const [bc, bf, bl, bm] = await Promise.all(['[data-card="coach"]', '[data-filters]', '[data-list]', '[data-month]'].map(async (s) => page.locator(s).boundingBox()));
  assert.ok(bc.y < bf.y && bf.y < bl.y && bl.y < bm.y, `${name}: Coach a day, the chips, the list, the month line`);
  await checkWidth(page, 'coach, list');

  // the chips filter the list (a link each, so also an address)
  await page.locator('[data-filter="days"]').click();
  await page.waitForURL(/\/coach\?f=days$/);
  assert.deepEqual(await ids('[data-coaching]'), co('days').list.map((c) => c.id));
  assert.equal(await page.locator('[data-filter="days"]').getAttribute('aria-current'), 'page');
  assert.equal(await page.locator('[data-month]').textContent().then((x) => x.trim()), co('days').month.text, 'the month line does not depend on the filter');
  await page.locator('[data-filter="weeks"]').click();
  await page.waitForURL(/\/coach\?f=weeks$/);
  assert.deepEqual(await ids('[data-coaching]'), co('weeks').list.map((c) => c.id));
  assert.deepEqual(await page.locator('[data-kind]').evaluateAll((els) => [...new Set(els.map((e) => e.textContent.trim()))]), ['week']);
  await page.locator('[data-filter="all"]').click();
  await page.waitForURL(/\/coach$/);
  await page.goto(`${base}/coach?f=nonsense`);
  assert.equal(await page.locator('[data-filter="all"]').getAttribute('aria-current'), 'page', 'a bad filter is all');

  // ---- a day coaching opened: in place (phones, tablets) or in the side column (PC) ----------------------------------------------------
  await page.goto(`${base}/coach`);
  if (pc) {
    assert.equal(await text(page.locator('[data-side-hint]')), 'Pick a coaching Its parts open here.');
    const list = await page.locator('[data-list]').boundingBox();
    const side = await page.locator('[data-side]').boundingBox();
    assert.ok(side.x > list.x + list.width - 1 && side.y <= list.y + list.height, 'pc: the open coaching in a column beside the list');
    assert.ok(Math.abs(side.width - 460) < 2, 'pc: the side column is 460 px');
  }
  const day1 = L.list.find((c) => c.kind === 'day');
  const dayBox = await open(day1.id);
  await dayBox.waitFor();
  assert.equal(await page.locator('[data-coach-open]').count(), 1, 'one coaching open');
  assert.equal(await page.locator(`[data-coaching="${day1.id}"] [data-coaching-row]`).getAttribute('aria-expanded'), 'true');
  await checkParts(dayBox, day1.parts);
  assert.equal(await text(dayBox.locator('[data-coach-caution]')), day1.caution, 'the caution under the open coaching');
  if (pc) {
    assert.equal(await text(page.locator('[data-side-heading]')), day1.heading);
    assert.equal(await text(page.locator('[data-side-meta]')), day1.meta.text);
    assert.equal(await text(page.locator('[data-side] [data-kind]')), 'day');
  } else {
    const r = await page.locator(`[data-coaching="${day1.id}"] [data-coaching-row]`).boundingBox();
    const b = await dayBox.boundingBox();
    assert.ok(b.y >= r.y + r.height - 1, `${name}: the parts open under their row`);
  }
  // the "To improve" part is amber against the others
  const improve = dayBox.locator('[data-part="improve"]');
  const colour = (loc, prop) => loc.evaluate((e, p) => getComputedStyle(e)[p], prop);
  assert.notEqual(await colour(improve.locator('h3'), 'color'), await colour(dayBox.locator('[data-part="went_well"] h3'), 'color'), 'To improve is amber');
  assert.notEqual(await colour(improve, 'borderLeftWidth'), '0px');
  await shot('day-open');
  if (name === 'phone') await dayBox.screenshot({ path: `${out}/coach-day-parts-${name}-${theme}.png` });
  await checkWidth(page, 'coach, a day open');
  // a week review opened in the same way: the numbered focus; the day's closes (one at a time)
  const week1 = L.list.find((c) => c.kind === 'week');
  const weekBox = await open(week1.id);
  await weekBox.waitFor();
  assert.equal(await page.locator('[data-coach-open]').count(), 1, 'the first one closed');
  await checkParts(weekBox, week1.parts);
  assert.equal(await text(weekBox.locator('[data-coach-caution]')), week1.caution);
  await shot('week-open');
  await checkWidth(page, 'coach, a week open');
  // a second tap closes it
  await page.locator(`[data-coaching="${week1.id}"] [data-coaching-row]`).click();
  assert.equal(await page.locator('[data-coach-open]').count(), 0);
  assert.equal(await page.locator(`[data-coaching="${week1.id}"] [data-coaching-row]`).getAttribute('aria-expanded'), 'false');
  // another filter closes the open row
  await open(day1.id);
  await page.locator('[data-filter="weeks"]').click();
  await page.waitForURL(/f=weeks/);
  assert.equal(await page.locator('[data-coach-open]').count(), 0);

  // ---- nothing yet: the door's words -----------------------------------------------------------------------------------------------------
  await coachSet('empty=1');
  await page.goto(`${base}/coach`);
  assert.equal(await text(page.locator('[data-empty]')), co('empty').empty);
  assert.equal(await page.locator('[data-coaching]').count(), 0);
  assert.equal(await text(page.locator('[data-month]')), co('empty').month.text);
  assert.equal(await page.locator('[data-card="coach"]').count(), 1, 'Coach a day is there all the same');
  await checkWidth(page, 'coach, empty');
  await standinPost('/standin/reset');

  // ---- Coach a day in its four states, and the date field ---------------------------------------------------------------------------------
  const dayCard = async (day) => {
    await page.goto(`${base}/coach?day=${day}`);
    await card.waitFor();
    assert.equal(await page.locator('[data-day-field]').inputValue(), day, 'the date field has the day');
  };
  // none
  await dayCard('2026-11-12');
  const cn = co('day_none').card;
  assert.equal(await text(card.locator('h2')), 'Coach a day');
  assert.equal(await text(card.locator('[data-coach-small]')), cn.small);
  assert.equal(await card.getAttribute('data-state'), 'none');
  assert.equal(await text(card.locator('[data-coach-intro]')), cn.intro);
  assert.equal(await text(card.locator('[data-coach-cost]')), cn.cost);
  assert.equal(await text(card.locator('[data-coach-button]')), cn.button);
  assert.equal(await card.locator('[data-coach-form] input[type=hidden]').evaluateAll((els) => els.map((e) => `${e.name}=${e.value}`).join('&')), 'start=2026-11-12&end=2026-11-12&view_f=all&view_day=2026-11-12');
  assert.ok((await page.locator('[data-day-field]').getAttribute('max')) >= '2026-11-17', 'the field offers no day after today');
  await shot('none');
  await checkWidth(page, 'coach, none');
  // done: the parts, the meta line, the caution, the button again; the door has no cost line here
  await dayCard('2026-11-14');
  const cd = co('day_done').card;
  assert.equal(await card.getAttribute('data-state'), 'done');
  assert.equal(await text(card.locator('[data-coach-meta]')), cd.meta.text);
  await checkParts(card, cd.parts);
  assert.equal(await text(card.locator('[data-coach-caution]')), cd.caution);
  assert.equal(await text(card.locator('[data-coach-button]')), cd.button);
  assert.equal(await card.locator('[data-coach-intro]').count(), 0);
  await shot('card-done');
  if (name === 'phone') await card.screenshot({ path: `${out}/coach-card-done-${name}-${theme}.png` });
  await checkWidth(page, 'coach, card done');
  // failed: the notice, then the intro and the button
  await dayCard('2026-11-15');
  const cf = co('day_failed').card;
  assert.equal(await card.getAttribute('data-state'), 'failed');
  assert.equal(await text(card.locator('[data-coach-failed]')), cf.failed);
  assert.equal(await text(card.locator('[data-coach-intro]')), cf.intro);
  assert.equal(await text(card.locator('[data-coach-button]')), cf.button);
  const [bFail, bIntro, bBtn] = await Promise.all(['[data-coach-failed]', '[data-coach-intro]', '[data-coach-button]'].map((s) => card.locator(s).boundingBox()));
  assert.ok(bFail.y < bIntro.y && bIntro.y < bBtn.y, 'the notice, the intro, the button');
  await shot('card-failed', false);
  await checkWidth(page, 'coach, card failed');
  // working: the wait and its note, no button
  await dayCard('2026-11-13');
  const cw = co('all').card;
  assert.equal(await card.getAttribute('data-state'), 'working');
  assert.equal(await text(card.locator('[data-coach-wait-head]')), cw.wait);
  assert.equal(await text(card.locator('[data-coach-wait-note]')), cw.wait_note);
  assert.equal(await card.locator('[data-coach-button]').count(), 0, 'no button while it is read');
  await checkWidth(page, 'coach, card working');
  // the date field: another day reloads the page with ?day=
  await page.locator('[data-day-field]').fill('2026-11-15');
  await page.waitForURL(/day=2026-11-15$/);
  await card.locator('[data-coach-failed]').waitFor();
  // the filter and the day travel together
  await page.locator('[data-filter="weeks"]').click();
  await page.waitForURL(/f=weeks&day=2026-11-15$/);
  assert.equal(await page.locator('[data-day-field]').inputValue(), '2026-11-15');
  await page.locator('[data-day-field]').fill('2026-11-12');
  await page.waitForURL(/f=weeks&day=2026-11-12$/);
  assert.equal(await card.getAttribute('data-state'), 'none');
  // a day after today is not read (the door refuses it): the page shows today; a bad day is dropped
  await page.goto(`${base}/coach?day=2026-11-30`);
  await card.waitFor();
  assert.equal(await page.locator('[data-day-field]').inputValue(), '2026-11-17');
  await page.goto(`${base}/coach?day=tomorrow`);
  assert.equal(await page.locator('[data-day-field]').inputValue(), '2026-11-17');

  // ---- the press: sent once, working, then done in place ----------------------------------------------------------------------------------
  await standinPost('/standin/reset');
  await coachSet('polls=1');
  await dayCard('2026-11-12');
  await page.evaluate(() => (window.__noReload = true));
  const before = await starts();
  await card.locator('[data-coach-button]').dblclick();
  assert.equal(await card.locator('[data-coach-button]').isDisabled().catch(() => true), true, 'the button is disabled from the first press');
  await card.locator('[data-coach-wait]').waitFor();
  assert.equal(await card.getAttribute('data-state'), 'working');
  assert.equal(await text(card.locator('[data-coach-wait-head]')), cw.wait);
  assert.equal(await text(page.locator('[data-bar] [data-bar-head]')), COACH.saves.start.head, 'the door\'s head in the answer bar');
  assert.equal(await page.locator('[data-bar]').getAttribute('data-bar'), 'ok');
  assert.equal(await starts(), before + 1, 'a double press started one coaching');
  assert.equal(await card.locator('[data-coach-button]').count(), 0, 'no button while it is read');
  await shot('working');
  await checkWidth(page, 'coach, started');
  // the poll (every 5 s): done, read again in place: the parts, the button, and the coaching joins the list (no reload)
  await card.locator('[data-review-parts]').waitFor({ timeout: 20000 });
  assert.equal(await card.getAttribute('data-state'), 'done');
  assert.ok(await page.evaluate(() => window.__noReload === true), 'no reload while the coaching was read');
  assert.equal(await text(card.locator('[data-coach-button]')), 'Coach me again');
  assert.equal(await starts(), before + 1, 'nothing was started again');
  assert.equal((await ids('[data-coaching]'))[0], 20, 'the new coaching is first in the list');
  assert.equal(await text(page.locator('[data-coaching="20"] [data-coaching-heading]')), 'Thu 12.11.');
  assert.match(await text(page.locator('[data-month]')), new RegExp(`^This month: ${L.month.count + 1} coachings · \\$\\d+\\.\\d\\d \\(also on the Usage page\\)\\.$`), 'the month line counts the new one');
  await shot('done');
  await checkWidth(page, 'coach, done');
  // Coach me again adds one more (the owner's own press)
  await coachSet('polls=0');
  await card.locator('[data-coach-button]').click();
  await card.locator('[data-coach-wait]').waitFor();
  assert.equal(await starts(), before + 2);
  await page.waitForTimeout(300);
  assert.equal(await starts(), before + 2, 'and again nothing by itself');

  // ---- refusals in the answer bar: the daily limit, and "already on it" -----------------------------------------------------------------------
  await standinPost('/standin/reset');
  await coachSet('limit=1');
  await dayCard('2026-11-11');
  const b2 = await starts();
  await card.locator('[data-coach-button]').click();
  await page.locator('[data-bar="warning"]').waitFor();
  assert.deepEqual(await page.locator('[data-bar] p, [data-bar] [data-bar-head]').allTextContents(), [COACH.saves.limit.head, COACH.saves.limit.reason]);
  assert.equal(await card.getAttribute('data-state'), 'none', 'nothing started');
  assert.equal(await card.locator('[data-coach-button]').isDisabled(), false, 'the owner may press again');
  assert.equal(await starts(), b2 + 1);
  await shot('refused', false);
  await checkWidth(page, 'coach, refused');
  await standinPost('/standin/reset');
  await dayCard('2026-11-10');
  await coachSet('day=2026-11-10&state=working'); // another tab started it meanwhile
  await card.locator('[data-coach-button]').click();
  await card.locator('[data-coach-wait]').waitFor();
  assert.equal(await text(page.locator('[data-bar] [data-bar-head]')), COACH.saves.on_it.head);

  // ---- taking longer: 5 minutes without an end -------------------------------------------------------------------------------------------
  await standinPost('/standin/reset');
  const slow = await page.context().newPage();
  await slow.clock.install();
  await slow.goto(`${base}/coach?day=2026-11-13`);
  await slow.locator('[data-card="coach"] [data-coach-wait]').waitFor();
  await slow.clock.fastForward('05:01');
  await slow.locator('[data-coach-slow]').waitFor();
  assert.equal(await text(slow.locator('[data-coach-slow]')), 'Taking longer than usual: look again in a few minutes. Look again');
  assert.equal(await slow.locator('[data-card="coach"]').getAttribute('data-state'), 'working');
  await checkWidth(slow, 'coach, taking longer');
  await slow.locator('[data-look-again]').click();
  await slow.locator('[data-coach-slow]').waitFor({ state: 'detached' });
  await slow.close();

  // ---- signed out at the press: sent to sign in, and the press is not sent again after it -------------------------------------------------------
  await standinPost('/standin/reset');
  await dayCard('2026-11-12');
  const b3 = await starts();
  await standinPost('/standin/drop-sessions');
  await card.locator('[data-coach-button]').click();
  await page.getByRole('button', { name: 'Sign in' }).waitFor();
  await page.fill('#password', 'test');
  await page.fill('#code', '123 456');
  await page.click('button[type=submit]');
  await page.locator('[data-coach]').waitFor();
  assert.match(page.url(), /\/coach\?day=2026-11-12$/, 'the sign-in leads back to the page');
  await page.goto(`${base}/coach?day=2026-11-12`);
  await card.waitFor();
  assert.equal(await card.getAttribute('data-state'), 'none', 'nothing was started behind your back');
  await page.waitForTimeout(500);
  assert.equal(await starts(), b3, 'no start was sent again after the sign-in');

  // ---- the failed read: the plain message with a link to app.'s Coach ------------------------------------------------------------------------------
  await standinPost('/standin/door-off');
  await page.goto(`${base}/coach`);
  await page.locator('[data-problem]').waitFor();
  assert.match(await page.getByRole('link', { name: 'Open the full app' }).getAttribute('href'), /\/web\/coach$/);
  await checkWidth(page, 'coach, door off');
  await standinPost('/standin/up');
  await standinPost('/standin/reset');

  // ---- Trends' links: All coachings is the Coach page here (with ?f=weeks if the door says so), Your goals Settings' Coach tab (111) ----------
  await standinPost('/standin/week?last=done');
  await page.goto(`${base}/trends?p=last`);
  const links = await page.locator('[data-card="review"] [data-review-link]').evaluateAll((els) => els.map((e) => [e.textContent.trim(), e.getAttribute('href')]));
  assert.equal(links[0][0], 'All coachings');
  assert.equal(links[0][1], '/coach');
  assert.equal(links[1][0], 'Your goals');
  assert.equal(links[1][1], '/settings/coach');
  await page.locator('[data-card="review"] [data-review-link]').first().click();
  await page.waitForURL(/\/coach$/);
  await standinPost('/standin/reset');
  await page.goto(`${base}/`);
}

/**
 * Today's Coach card (deploy 109): placed after the Home card on phones and in the side column on the PC, in its states, the press sent once
 * (the answer's fresh Today brings the working card; the poll reads Today again in place), the links, a refusal in the answer bar, and no
 * card when the door says null (the Settings switch).
 */
async function checkCoachToday(page, name, theme) {
  await standinPost('/standin/reset');
  const pc = name === 'pc';
  const co = (k) => COACH[k].coach;
  const starts = async () => (await (await fetch(`${standin}/standin/coach-starts`)).json()).starts;
  const coachSet = (q) => standinPost(`/standin/coach?${q}`);
  const card = page.locator('[data-card="coach"]');
  const shot = (n) => page.screenshot({ path: `${out}/coach-today-${n}-${name}-${theme}.png`, fullPage: true });
  await page.goto(`${base}/`);
  await page.locator('[data-kcal-left]').waitFor();
  await page.evaluate(() => (window.__noReload = true));
  assert.equal(await card.count(), 1);
  const dc = day.coach;
  assert.equal(await text(card.locator('h2')), dc.title);
  assert.equal(await text(card.locator('[data-coach-small]')), dc.small);
  assert.equal(await card.getAttribute('data-state'), 'none');
  assert.equal(await text(card.locator('[data-coach-intro]')), dc.intro);
  assert.equal(await text(card.locator('[data-coach-cost]')), dc.cost);
  assert.equal(await text(card.locator('[data-coach-button]')), dc.button);
  assert.equal(await card.locator('[data-day-field], input[type=date]').count(), 0, 'no date field on Today');
  const links = await card.locator('[data-coach-link]').evaluateAll((els) => els.map((e) => [e.textContent.trim(), e.getAttribute('href')]));
  assert.deepEqual(links.map((l) => l[0]), ['All coachings ›', 'Your goals ›']);
  assert.equal(links[0][1], '/coach');
  assert.equal(links[1][1], '/settings/coach');
  // the place: phones after the Home card (and before Gratitude), the PC in the right column under the other cards
  const box = async (s) => page.locator(s).first().boundingBox();
  const [bh, bc, bg, bn, bd] = await Promise.all(['[data-card="home"]', '[data-card="coach"]', '[data-card="gratitude"]', '[data-card="needs"]', '[data-card="timeline"]'].map(box));
  assert.ok(bh && bc && bg, 'the Home, Coach and Gratitude cards are there');
  assert.ok(bh.y + bh.height <= bc.y + 1 && bc.y + bc.height <= bg.y + 1, `${name}: Home, then Coach, then Gratitude`);
  if (pc) assert.ok(Math.abs(bc.x - bn.x) < 2 && bc.x > bd.x + bd.width - 1, 'pc: the Coach card in the right column');
  await shot('none');
  await checkWidth(page, 'today, coach none');

  // the press: one start for a double press; the bar says what the door says; the poll brings the parts in place
  await coachSet('polls=1');
  const before = await starts();
  await card.locator('[data-coach-button]').dblclick();
  await card.locator('[data-coach-wait]').waitFor();
  assert.equal(await card.getAttribute('data-state'), 'working');
  assert.equal(await text(card.locator('[data-coach-wait-head]')), co('all').card.wait);
  assert.equal(await card.locator('[data-coach-button]').count(), 0);
  assert.equal(await text(page.locator('[data-bar] [data-bar-head]')), COACH.saves.start.head);
  assert.equal(await starts(), before + 1, 'a double press started one coaching');
  await shot('working');
  await checkWidth(page, 'today, coach working');
  await card.locator('[data-review-parts]').waitFor({ timeout: 20000 });
  assert.equal(await card.getAttribute('data-state'), 'done');
  assert.ok(await page.evaluate(() => window.__noReload === true), 'no reload while it was read');
  assert.equal(await starts(), before + 1, 'nothing was started again');
  const cd = co('day_done').card;
  assert.deepEqual(await card.locator('[data-part]').evaluateAll((els) => els.map((e) => e.getAttribute('data-part'))), cd.parts.map((p) => p.key));
  assert.equal(await text(card.locator('[data-part="next_meal"] [data-meal-macros]')), cd.parts.find((p) => p.key === 'next_meal').meal.macros);
  assert.equal(await card.locator('[data-part="improve"]').evaluate((e) => e.className.includes('border-amber')), true, 'To improve is amber');
  assert.equal(await text(card.locator('[data-coach-meta]')), cd.meta.text);
  assert.equal(await text(card.locator('[data-coach-caution]')), cd.caution);
  assert.equal(await text(card.locator('[data-coach-button]')), 'Coach me again');
  const [meta, parts, caution, btn] = await Promise.all(['[data-coach-meta]', '[data-review-parts]', '[data-coach-caution]', '[data-coach-button]'].map((s) => card.locator(s).boundingBox()));
  assert.ok(meta.y < parts.y && parts.y < caution.y && caution.y < btn.y, 'meta, parts, caution, the button');
  await shot('done');
  if (name === 'phone') await card.screenshot({ path: `${out}/coach-today-card-${name}-${theme}.png` });
  await checkWidth(page, 'today, coach done');
  await page.getByRole('heading', { name: 'Today', exact: true }).waitFor();

  // a refusal: the daily limit, in the bar; the card stays as it was
  await standinPost('/standin/reset');
  await coachSet('limit=1&day=2026-11-16&state=failed');
  await page.goto(`${base}/`);
  await card.waitFor();
  assert.equal(await card.getAttribute('data-state'), 'failed');
  assert.equal(await text(card.locator('[data-coach-failed]')), co('day_failed').card.failed);
  await shot('failed');
  await checkWidth(page, 'today, coach failed');
  await card.locator('[data-coach-button]').click();
  await page.locator('[data-bar="warning"]').waitFor();
  assert.equal(await text(page.locator('[data-bar] [data-bar-head]')), COACH.saves.limit.head);
  assert.equal(await text(page.locator('[data-bar] p')), COACH.saves.limit.reason);
  assert.equal(await card.getAttribute('data-state'), 'failed');

  // taking longer (5 minutes without an end)
  await standinPost('/standin/reset');
  await coachSet('day=2026-11-16&state=working');
  const slow = await page.context().newPage();
  await slow.clock.install();
  await slow.goto(`${base}/`);
  await slow.locator('[data-card="coach"] [data-coach-wait]').waitFor();
  await slow.clock.fastForward('05:01');
  await slow.locator('[data-coach-slow]').waitFor();
  await checkWidth(slow, 'today, coach taking longer');
  await slow.locator('[data-look-again]').click();
  await slow.locator('[data-coach-slow]').waitFor({ state: 'detached' });
  await slow.close();

  // no card when Settings hides it: the door sends null
  await standinPost('/standin/reset');
  await coachSet('off=1');
  await page.goto(`${base}/`);
  await page.locator('[data-kcal-left]').waitFor();
  assert.equal(await card.count(), 0, 'no Coach card when the door says null');
  assert.equal(await page.locator('[data-card="gratitude"]').count(), 1);
  await checkWidth(page, 'today, no coach card');
  await standinPost('/standin/reset');
  await page.goto(`${base}/`);
}

/**
 * Settings (deploy 111): /settings opens Food targets; every tab reads (the header, its tab lit, More lit, the PNG, no sideways scroll,
 * 44 px targets); one save and one refusal per tab, each in the door's words; the Today page's switch, an arrow (the order survives a
 * reload) and "Show everything again" with Yes; Devices: one signed out, all others with Yes; Notifications: a device's off (the twice line
 * goes), the test, the nudges saved; Export: the download is the stand-in's ZIP with the door's headers, a failure comes back to the tab,
 * and a form post from elsewhere is refused (SvelteKit's origin check).
 */
async function checkSettings(page, name, theme) {
  await standinPost('/standin/reset');
  const pc = name === 'pc';
  const shot = (n, full = true) => page.screenshot({ path: `${out}/settings-${n}-${name}-${theme}.png`, fullPage: full });
  const headIs = async (want) => {
    await page.locator('[data-bar-head]', { hasText: want }).waitFor();
    assert.equal(await text(page.locator('[data-bar-head]')), want, 'the answer bar');
  };
  const read = (k) => SETTINGS[k][`settings_${k}`];
  const tabs = [['targets', '/settings/targets', 'Food targets'], ['today', '/settings/today', 'Today page'], ['body', '/settings/body', 'Body'], ['coach', '/settings/coach', 'Coach'],
    ['devices', '/settings/devices', 'Devices'], ['notify', '/settings/notifications', 'Notifications'], ['export', '/settings/export', 'Export']];
  const open = async (key) => {
    const [, href] = tabs.find((x) => x[0] === key);
    await page.goto(`${base}${href}`);
    await page.locator('[data-settings-header]').waitFor();
  };

  // ---- More's row, /settings, the header and the tabs, every tab reads -------------------------------------------------------------
  await page.goto(`${base}/more`);
  await page.locator('[data-more-place="settings"]').click();
  await page.waitForURL(/\/settings\/targets$/);
  for (const [key, href, label] of tabs) {
    await open(key);
    assert.equal(await text(page.locator('h1')), 'Settings');
    assert.equal(await page.locator('[data-back]').getAttribute('href'), '/more');
    assert.deepEqual(await page.locator('[data-tabs] [data-tab]').evaluateAll((els) => els.map((e) => [e.getAttribute('href'), e.textContent.trim()])), tabs.map((x) => [x[1], x[2]]));
    assert.equal(await page.locator('[data-tabs] [aria-current="page"]').getAttribute('href'), href, `${label} is the lit tab`);
    assert.equal(await page.locator('[data-problem]').count(), 0, `${label} reads`);
    await assertMoreLit(page, name, `settings ${key}`);
    assert.equal(await page.getByText('Settings and the rest are').count(), 0, 'no footer line');
    await checkWidth(page, `settings ${key}`);
  }
  // the tabs scroll inside their row on phones, never the page
  if (name === 'phone') {
    const nav = await page.locator('[data-tabs]').evaluate((e) => [e.scrollWidth, e.clientWidth]);
    assert.ok(nav[0] > nav[1], 'phone: the seven tabs scroll sideways inside their row');
  }
  const res = await page.goto(`${base}/settings`);
  assert.ok(res.ok());
  assert.match(page.url(), /\/settings\/targets$/, '/settings opens Food targets');

  // ---- Food targets ---------------------------------------------------------------------------------------------------------------
  const T = read('targets');
  for (const f of T.fields) assert.equal(await page.locator(`[data-field="${f.key}"]`).inputValue(), f.value === null ? '' : String(f.value), `${f.key} as the door has it`);
  assert.equal(await page.locator('[data-field="valid_from"]').inputValue(), T.valid_from);
  assert.equal(await text(page.locator('[data-line]')), 'A new date starts new targets; earlier days keep theirs.');
  assert.deepEqual(await page.locator('[data-history-row]').evaluateAll((els) => els.map((e) => e.getAttribute('data-history-row'))), T.history.map((h) => h.valid_from));
  if (pc) {
    const [f, h] = [await page.locator('[data-form="targets"]').boundingBox(), await page.locator('[data-history]').boundingBox()];
    assert.ok(h.x > f.x + 100 && Math.abs(h.y - f.y) < 2, 'pc: the form left, the history right');
  }
  await shot('targets');
  // a refusal in the door's words next to the form (what was typed stays), and the page's own check of a field that is no number
  await page.locator('[data-field="kcal"]').fill('-5');
  await page.locator('[data-form="targets"] button[type=submit]').click();
  await page.locator('[data-form="targets"] [data-refusal]').waitFor();
  assert.equal(await text(page.locator('[data-form="targets"] [data-refusal]')), SETTINGS.saves.targets_refused.reason);
  assert.equal(await page.locator('[data-field="kcal"]').inputValue(), '-5', 'what was typed stays');
  await page.locator('[data-field="sodium_mg"]').fill('lots');
  await page.locator('[data-form="targets"] button[type=submit]').click();
  assert.equal(await text(page.locator('[data-form="targets"] [data-refusal]')), 'Sodium: give a number from 0 to 100000, or leave it empty.');
  // a save: the bar says what was saved, the history has the new row
  await page.locator('[data-field="kcal"]').fill('2000');
  await page.locator('[data-field="sodium_mg"]').fill('');
  await page.locator('[data-field="note"]').fill('new plan');
  await page.locator('[data-form="targets"] button[type=submit]').click();
  await page.locator('[data-bar-head]', { hasText: 'Targets from 17.11.2026 saved: Calories 2000,' }).waitFor();
  assert.equal(await page.locator('[data-form="targets"] [data-refusal]').count(), 0, 'the refusal goes');
  await page.locator('[data-history-row="2026-11-17"]').waitFor();
  const cells = (loc) => loc.evaluate((e) => [...e.cells].map((c) => c.textContent.trim()));
  const row = await cells(page.locator('[data-history-row="2026-11-17"]'));
  assert.deepEqual([row[0], row[1], row.at(-1)], ['17.11.2026', '2,000', 'new plan']);
  assert.equal(await page.locator('[data-field="sodium_mg"]').inputValue(), '', 'the form is the fresh read');
  if (name === 'phone') await shot('targets-saved', false);
  await checkWidth(page, 'settings targets, saved');

  // ---- Today page: a switch, an arrow, reset with Yes --------------------------------------------------------------------------------
  await open('today');
  // the stand-in starts the two switches GET /day carries as the day sample has them (its Gratitude card shown)
  const D = structuredClone(read('today'));
  D.groups.find((g) => g.kind === 'review').items[0].shown = day.shown.review;
  D.groups.find((g) => g.kind === 'card').items.find((x) => x.id === 'gratitude').shown = day.shown.gratitude;
  const order = (kind) => page.locator(`[data-group="${kind}"] [data-item]`).evaluateAll((els) => els.map((e) => e.getAttribute('data-item').split(':')[1]));
  const shownOf = (kind) => page.locator(`[data-group="${kind}"] [data-item]`).evaluateAll((els) => els.map((e) => e.getAttribute('data-shown') === '1'));
  assert.deepEqual(await page.locator('[data-group]').evaluateAll((els) => els.map((e) => [e.getAttribute('data-group'), e.querySelector('h2').textContent.trim()])), D.groups.map((g) => [g.kind, g.heading]));
  for (const g of D.groups) {
    assert.deepEqual(await order(g.kind), g.items.map((x) => x.id), `${g.kind}: the door's order`);
    assert.deepEqual(await shownOf(g.kind), g.items.map((x) => x.shown), `${g.kind}: shown or hidden`);
    const rows = page.locator(`[data-group="${g.kind}"] [data-item]`);
    assert.equal(await rows.locator('[data-up]').count(), g.items.length > 1 ? g.items.length : 0, `${g.kind}: arrows only with more than one row`);
    if (g.items.length > 1) {
      assert.ok(await rows.first().locator('[data-up]').isDisabled(), 'the first row cannot go up');
      assert.ok(await rows.last().locator('[data-down]').isDisabled(), 'the last row cannot go down');
      assert.ok(!(await rows.first().locator('[data-down]').isDisabled()));
    }
  }
  if (pc) {
    const [a, b] = [await page.locator('[data-group="habit"]').boundingBox(), await page.locator('[data-group="usual"]').boundingBox()];
    assert.ok(b.x > a.x + 100 && Math.abs(a.y - b.y) < 2, 'pc: the groups in two columns');
  }
  await shot('today');
  // the switch: Blood sugar shown
  const sugar = page.locator('[data-item="health:sugar"]');
  assert.equal(await sugar.locator('[data-switch]').getAttribute('aria-checked'), 'false');
  await sugar.locator('[data-switch]').click();
  // the door's words: "… shows what you chose." while something is hidden, "… shows everything." when nothing is
  const allShown = D.groups.every((g) => g.items.every((x) => x.shown || x.id === 'sugar'));
  await headIs(allShown ? 'Saved. The Today page shows everything.' : SETTINGS.saves.today.head);
  await page.locator('[data-item="health:sugar"][data-shown="1"]').waitFor();
  assert.equal(await sugar.locator('[data-switch]').getAttribute('aria-checked'), 'true');
  // an arrow: Weight one up; the order is the door's and survives a reload
  await page.locator('[data-item="health:weight"] [data-up]').click();
  await page.waitForFunction(() => [...document.querySelectorAll('[data-group="health"] [data-item]')].map((e) => e.getAttribute('data-item'))[1] === 'health:weight');
  const moved = ['bed', 'weight', 'wake', 'sugar', 'bp_morning', 'bp_evening'];
  assert.deepEqual(await order('health'), moved);
  await page.reload();
  assert.deepEqual(await order('health'), moved, 'the new order after a reload');
  assert.deepEqual(await shownOf('health'), [true, true, true, true, true, true]);
  // reset: asked first in the bar, Yes resets
  await page.locator('[data-reset]').click();
  await page.locator('[data-bar-yes]').waitFor();
  assert.equal(await text(page.locator('[data-bar-yes]')), 'Yes, reset');
  if (name === 'phone') await shot('today-reset-asked', false);
  await page.locator('[data-bar-yes]').click();
  await headIs(SETTINGS.saves.today_reset.head);
  await page.waitForFunction(() => [...document.querySelectorAll('[data-item]')].every((e) => e.getAttribute('data-shown') === '1'));
  assert.deepEqual(await order('card'), ['gratitude', 'home', 'coach'], 'the default order');
  await checkWidth(page, 'settings today page, after the taps');

  // ---- Body ---------------------------------------------------------------------------------------------------------------------------
  await open('body');
  const B = read('body');
  assert.equal(await page.locator('[data-field="height"]').inputValue(), String(B.height.cm));
  assert.deepEqual(await page.locator('[data-measure]').evaluateAll((els) => els.map((e) => [e.getAttribute('data-measure'), e.getAttribute('aria-checked')])), B.measures.map((m) => [m.key, String(m.shown)]));
  assert.equal(await page.locator('[data-field="interval"]').inputValue(), String(B.interval.days));
  await shot('body');
  await page.locator('[data-field="height"]').fill('300');
  await page.locator('[data-form="height"] button[type=submit]').click();
  await page.locator('[data-form="height"] [data-refusal]').waitFor();
  assert.equal(await text(page.locator('[data-form="height"] [data-refusal]')), SETTINGS.saves.height_refused.reason);
  await page.locator('[data-field="height"]').fill('178');
  await page.locator('[data-form="height"] button[type=submit]').click();
  await headIs('Height 178 cm saved, from 17.11.2026.');
  assert.deepEqual(await page.locator('[data-heights] tr').first().evaluate((e) => [...e.cells].map((c) => c.textContent.trim())), ['17.11.2026', '178 cm']);
  for (const m of B.measures) if (m.shown) await page.locator(`[data-measure="${m.key}"]`).click();
  await page.locator('[data-form="body"] button[type=submit]').click();
  await page.locator('[data-form="body"] [data-refusal]').waitFor();
  assert.equal(await text(page.locator('[data-form="body"] [data-refusal]')), 'Keep at least one measure.');
  await page.locator('[data-measure="waist"]').click();
  await page.locator('[data-measure="hips"]').click();
  await page.locator('[data-field="interval"]').fill('28');
  await page.locator('[data-form="body"] button[type=submit]').click();
  await headIs(SETTINGS.saves.body.head);
  assert.equal(await page.locator('[data-form="body"] [data-refusal]').count(), 0);
  await checkWidth(page, 'settings body, saved');

  // ---- Coach -------------------------------------------------------------------------------------------------------------------------
  await open('coach');
  const C = read('coach');
  assert.equal(await page.locator('[data-field="goals"]').inputValue(), C.goals);
  assert.equal(await page.locator('[data-field="style"]').inputValue(), C.style);
  assert.equal(await page.locator('[data-field="goals"]').getAttribute('maxlength'), String(C.max));
  assert.deepEqual(await page.locator('[data-facts] li').allTextContents(), C.facts);
  assert.deepEqual(await page.locator('[data-part]').evaluateAll((els) => els.map((e) => [e.getAttribute('data-part'), e.getAttribute('aria-checked')])),
    C.kinds.flatMap((k) => k.parts.map((x) => [`${k.kind}:${x.key}`, String(x.on)])));
  await shot('coach');
  for (const x of C.kinds[0].parts) if (x.on) await page.locator(`[data-part="day:${x.key}"]`).click();
  await page.locator('[data-form="coach"] button[type=submit]').click();
  await page.locator('[data-form="coach"] [data-refusal]').waitFor();
  assert.equal(await text(page.locator('[data-form="coach"] [data-refusal]')), SETTINGS.saves.coach_refused.reason);
  await page.locator('[data-part="day:went_well"]').click();
  await page.locator('[data-field="goals"]').fill('Walk every day.');
  await page.locator('[data-form="coach"] button[type=submit]').click();
  await headIs(SETTINGS.saves.coach.head);
  await page.reload();
  assert.equal(await page.locator('[data-field="goals"]').inputValue(), 'Walk every day.');
  assert.equal(await page.locator('[data-part="day:improve"]').getAttribute('aria-checked'), 'false');
  await checkWidth(page, 'settings coach, saved');

  // ---- Devices -----------------------------------------------------------------------------------------------------------------------
  await open('devices');
  const V = read('devices');
  const devs = () => page.locator('[data-device]').evaluateAll((els) => els.map((e) => e.getAttribute('data-device')));
  assert.deepEqual(await devs(), V.devices.map((d) => d.id));
  for (const d of V.devices) {
    const el = page.locator(`[data-device="${d.id}"]`);
    assert.equal(await text(el.locator('[data-address]')), d.address === 'logger' ? 'logger.' : 'app.');
    assert.equal(await el.locator('[data-this]').count(), d.current ? 1 : 0);
    assert.equal(await el.locator('[data-signout]').count(), d.current ? 0 : 1, 'this device has no button');
    assert.match(await text(el.locator('[data-line]')), /^signed in \d\d\.\d\d\.\d{4} · last used \d\d\.\d\d\.\d{4} \d\d:\d\d · stays signed in until \d\d\.\d\d\.\d{4}$/);
  }
  assert.equal(await page.locator('[data-watch-link]').getAttribute('href'), '/gym/activity');
  await shot('devices');
  const appDev = V.devices.find((d) => d.address === 'app').id;
  await page.locator(`[data-device="${appDev}"] [data-signout]`).click();
  await headIs(SETTINGS.saves.device.head);
  await page.locator(`[data-device="${appDev}"]`).waitFor({ state: 'detached' });
  await page.locator('[data-others]').click();
  assert.equal(await text(page.locator('[data-bar-yes]')), 'Yes, sign out');
  await page.locator('[data-bar-no]').click();
  assert.equal((await devs()).length, 2, 'No signs nobody out');
  await page.locator('[data-others]').click();
  await page.locator('[data-bar-yes]').click();
  await headIs(SETTINGS.saves.others.head);
  await page.locator('[data-others]').waitFor({ state: 'detached' });
  assert.equal((await devs()).length, 1, 'only this device');
  await checkWidth(page, 'settings devices, signed out');

  // ---- Notifications ------------------------------------------------------------------------------------------------------------------
  await open('notify');
  const N = read('notify');
  assert.deepEqual(await page.locator('[data-subscription]').evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-subscription')))), N.subscriptions.map((s) => s.id));
  assert.equal(await text(page.locator('[data-twice]')), 'This phone is on at app. too: nudges arrive twice until you turn that one off.');
  for (const s of N.subscriptions) {
    const el = page.locator(`[data-subscription="${s.id}"]`);
    assert.equal(await el.locator('[data-this]').count(), s.this ? 1 : 0);
    assert.match(await text(el.locator('[data-line]')), /^on since \d\d\.\d\d\.\d{4}, last delivered \d\d\.\d\d\.\d{4} \d\d:\d\d$/);
  }
  assert.deepEqual(await page.locator('[data-nudge]').evaluateAll((els) => els.map((e) => [e.getAttribute('data-nudge'), e.querySelector('[data-switch]').getAttribute('aria-checked'), e.querySelector('input').value])),
    N.nudges.map((x) => [x.key, String(x.on), String(x.hours.value)]));
  for (const x of N.nudges) {
    const input = page.locator(`[data-hours="${x.hours.key}"]`);
    assert.deepEqual([await input.getAttribute('min'), await input.getAttribute('max'), await input.getAttribute('step')], [String(x.hours.min), String(x.hours.max), String(x.hours.step)]);
  }
  assert.equal(await text(page.locator('[data-nudge="gratitude"] [data-note]')), N.nudges.find((x) => x.key === 'gratitude').note);
  assert.equal(await page.locator('[data-nudges-on]').getAttribute('aria-checked'), String(N.on));
  await shot('notifications');
  const appSub = N.subscriptions.find((s) => s.address === 'app').id;
  await page.locator(`[data-subscription="${appSub}"] [data-push-off]`).click();
  await headIs(SETTINGS.saves.push_off.head);
  await page.locator('[data-twice]').waitFor({ state: 'detached' });
  const tests = async () => (await (await fetch(`${standin}/standin/push-tests`)).json()).tests;
  const t0 = await tests();
  await page.locator('[data-test]').click();
  await headIs('Test notification sent to 2 devices.');
  assert.equal(await tests(), t0 + 1, 'one test sent');
  await page.locator('[data-nudge="idle"] [data-switch]').click();
  await page.locator('[data-hours="gratitude_after"]').fill('13');
  await page.locator('[data-form="nudges"] button[type=submit]').click();
  await headIs(SETTINGS.saves.nudges.head);
  await page.reload();
  assert.equal(await page.locator('[data-nudge="idle"] [data-switch]').getAttribute('aria-checked'), 'false');
  assert.equal(await page.locator('[data-hours="gratitude_after"]').inputValue(), '13');
  await standinPost('/standin/settings?nopush=1');
  await page.reload();
  assert.equal(await page.locator('[data-test]').count(), 0, 'no test without a device');
  assert.equal(await text(page.locator('[data-none]')), 'No device gets nudges.');
  await checkWidth(page, 'settings notifications, none');

  // ---- Export --------------------------------------------------------------------------------------------------------------------------
  await open('export');
  const E = read('export');
  assert.equal(await text(page.locator('[data-form="export"] h2')), E.title);
  assert.equal(await text(page.locator('[data-intro]')), E.intro);
  assert.equal(await page.locator('[data-private]').isChecked(), false, 'private entries off by default');
  await page.getByText(E.private_label).click(); // the whole line ticks it
  assert.equal(await page.locator('[data-private]').isChecked(), true);
  assert.equal(await text(page.locator('[data-download]')), E.button);
  assert.equal(await text(page.locator('[data-last]')), E.last.text);
  assert.equal(await page.locator('[data-form="export"]').getAttribute('method'), 'POST');
  assert.equal(await page.locator('[data-form="export"]').getAttribute('action'), '/settings/export/download');
  await shot('export');
  const got = await page.evaluate(async () => {
    const f = new FormData();
    f.append('private', '1');
    const r = await fetch('/settings/export/download', { method: 'POST', body: f });
    const b = new Uint8Array(await r.arrayBuffer());
    return { status: r.status, type: r.headers.get('content-type'), cd: r.headers.get('content-disposition'), cache: r.headers.get('cache-control'), magic: [b[0], b[1], b[2], b[3]], size: b.length };
  });
  assert.deepEqual({ ...got, size: got.size > 100 }, { status: 200, type: 'application/zip', cd: 'attachment; filename="logger-export-17.11.2026.zip"', cache: 'no-store', magic: [0x50, 0x4b, 0x03, 0x04], size: true });
  const ex = await (await fetch(`${standin}/standin/exports`)).json();
  assert.equal(ex.last.private, true, 'the tick box went to the door');
  // the button: a download, the page stays
  const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('[data-download]').click()]);
  assert.equal(dl.suggestedFilename(), 'logger-export-17.11.2026.zip');
  assert.match(page.url(), /\/settings\/export$/);
  // a failed export comes back to the tab with a line, never a broken file
  await standinPost('/standin/settings?export_fail=1');
  await page.locator('[data-download]').click();
  await page.waitForURL(/\/settings\/export\?failed=1$/);
  assert.equal(await text(page.locator('[data-failed]')), 'The export could not be made. Nothing was downloaded; try again in a moment.');
  await standinPost('/standin/settings?export_fail=0');
  // a form post from another site is refused (SvelteKit's origin check stays on)
  const cross = await fetch(`${base}/settings/export/download`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', origin: 'https://elsewhere.example' }, body: 'private=1' });
  assert.equal(cross.status, 403, 'a cross-site form post is refused');
  await checkWidth(page, 'settings export');

  // ---- a failed read: ProblemCard with app.'s own tab --------------------------------------------------------------------------------
  await standinPost('/standin/door-off');
  for (const [key, href] of [['targets', '/settings/targets'], ['notify', '/settings/notifications']]) {
    await page.goto(`${base}${href}`);
    assert.match(await page.locator('[data-problem="door_off"]').getByRole('link', { name: 'Open the full app' }).getAttribute('href'), new RegExp(`/web/settings\\?tab=${key}$`));
  }
  await standinPost('/standin/up');
  await standinPost('/standin/reset');
}

/**
 * Deploy 113: Change on a To review row leads to this app's page where there is one. The sample's three rows: a thought (app., with
 * the small tag), a food (its day with the entry open: the Food day shows it, its editor open) and a weight (Health, which opens a
 * day only by a tap). Each link is followed once; every Change is still 44 px high on phones and tablets.
 */
async function checkReviewChange(page, name, theme) {
  await page.goto(`${base}/`);
  const review = page.locator('[data-review]');
  await review.waitFor();
  const rows = day.needs.review;
  const links = review.locator('[data-change]');
  assert.equal(await links.count(), rows.length, 'a Change link per row');
  for (const [i, r] of rows.entries()) {
    const link = links.nth(i);
    assert.equal(await link.evaluate((e) => e.textContent.replace(/\s+/g, ' ').trim().startsWith('Change')), true, `${r.ref}: the link text is Change`);
    const href = await link.getAttribute('href');
    if (r.kind === 'thought') {
      assert.match(href, /^https?:\/\/[^/]+\/web\/$/, 'a thought stays at app.');
      assert.equal(await link.locator('[data-app-tag]').count(), 1, 'a thought: the app. tag');
    } else {
      assert.equal(await link.locator('[data-app-tag]').count(), 0, `${r.ref}: no app. tag`);
      assert.equal(href, r.kind === 'food' ? `/food?day=${r.day}&open=${r.ref}` : '/health', `${r.ref}: where Change leads`);
    }
    if (name !== 'pc') assert.ok((await link.boundingBox()).height >= 44, `${r.ref}: Change is 44 px high`);
  }
  if (name === 'phone') await review.screenshot({ path: `${out}/today-review-change-${name}-${theme}.png` });

  // the food: the Food day of that day, the entry open
  const food = rows.find((r) => r.kind === 'food');
  await review.locator(`[data-change][href^="/food"]`).click();
  await page.waitForURL(new RegExp(`/food\\?day=${food.day}&open=${food.ref}$`));
  await page.locator(`[data-row="${food.ref}"]`).waitFor();
  await page.locator(`[data-food-editor="${food.ref}"]`).waitFor();
  assert.equal(await page.locator('[data-food-editor]').count(), 1, 'the food: its entry is the one open');

  // the weight: the Health page
  await page.goto(`${base}/`);
  await review.waitFor();
  await review.locator('[data-change][href="/health"]').click();
  await page.waitForURL(/\/health$/);
  await page.locator('[data-charts]').waitFor();
  await page.goto(`${base}/`);
}

/**
 * The links that left app. with deploy 111 and Today following the two switches: More's Settings row, the Habits and Library lines, the
 * Health page's height link, Your goals on Today, the sign-in page's line; no footer line; the Needs card's Change (checkReviewChange); with
 * `shown` false the To review items are one line and the Gratitude card is gone, with `shown` missing (an older door) both show.
 */
async function checkSettingsLinks(page, name, theme) {
  await standinPost('/standin/reset');
  await page.goto(`${base}/more`);
  assert.equal(await page.locator('[data-more-place="settings"]').getAttribute('href'), '/settings');
  assert.equal(await page.locator('[data-more-place="settings"] [data-app-tag]').count(), 0);
  await page.goto(`${base}/habits`);
  assert.equal(await page.locator('[data-settings-line] a').getAttribute('href'), '/settings/today');
  await page.goto(`${base}/library/habits`);
  assert.equal(await page.locator('[data-settings-line] a').getAttribute('href'), '/settings/today');
  await page.goto(`${base}/health`);
  await page.locator('[data-charts]').waitFor();
  for (const href of await page.locator('[data-waist-height] a').evaluateAll((els) => els.map((e) => e.getAttribute('href')))) assert.equal(href, '/settings/body');
  const login = await (await fetch(`${base}/login`)).text();
  assert.ok(login.includes('Ideas, Private and Gratitude are in the'), 'the sign-in page names what stays at app.');
  assert.ok(!login.includes('A trial of the new look'), 'the old sign-in line is gone');

  await page.goto(`${base}/`);
  assert.equal(await page.getByText('Settings and the rest are').count(), 0, 'no footer line on Today');
  const goals = page.locator('[data-card="coach"] [data-coach-link]').last();
  assert.equal(await goals.getAttribute('href'), '/settings/coach', 'Your goals on Today');
  // Change on a To review row: a thought's stays app.'s, the food's and the weight's are this app's (checkReviewChange, deploy 113)
  const changes = await page.locator('[data-review] [data-change]').evaluateAll((els) => els.map((e) => e.getAttribute('href')));
  assert.deepEqual(changes.map((h) => h.replace(/^https?:\/\/[^/]+/, '')), ['/web/', '/food?day=2026-11-16&open=f5', '/health']);
  assert.equal(await page.locator('[data-review-hidden]').count(), 0);
  assert.equal(await page.locator('[data-card="gratitude"]').count(), 1);

  // the switches off: the items to review are one line, the Gratitude card goes
  await standinPost('/standin/settings?shown=0');
  await page.reload();
  const n = day.needs.review.length;
  assert.equal(await text(page.locator('[data-review-hidden]')), `${n} items to review are hidden here · show the box`);
  assert.equal(await page.locator('[data-review-hidden] a').getAttribute('href'), '/settings/today');
  assert.equal(await page.locator('[data-review]').count(), 0, 'no items to review');
  assert.equal(await page.locator('[data-card="gratitude"]').count(), 0, 'no Gratitude card');
  if (name === 'phone') await page.screenshot({ path: `${out}/settings-today-hidden-${name}-${theme}.png`, fullPage: true });
  await checkWidth(page, 'today, two parts hidden');
  // an older door without `shown`: both as before
  await standinPost('/standin/settings?noshown=1');
  await page.reload();
  assert.equal(await page.locator('[data-review-hidden]').count(), 0);
  assert.equal(await page.locator('[data-card="gratitude"]').count(), 1);
  assert.ok((await page.locator('[data-review]').count()) === 1);
  await standinPost('/standin/reset');
  await page.goto(`${base}/`);
}

/**
 * Deploy 112: the home-screen app and notifications on this device. Signed out: /manifest.webmanifest, /sw.js and the icons answer 200
 * with their types (no sign-in redirect) and the sign-in page has the head tags; signed in: the tags, the CSP's worker-src and
 * manifest-src, the manifest as the browser reads it (no errors), no service worker before a press, and the real /sw.js registering for
 * "/" under the real CSP (then removed; a real push cannot be sent here). Then "This device" in a context with an iPhone's User-Agent
 * (so the door names the device "iPhone, Safari", as the sample's app. row) and the browser's notification parts stubbed per page.
 */
const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
/** The browser's notification parts, faked in the page (mode: home = from the Home Screen, permission asked and granted; tab = Safari's
 * tab, not from the Home Screen; denied = blocked in the settings; unknown = a push address the door does not know). window.__push logs. */
function pushStub(mode) {
  const P = (window.__push = { log: [], unsubscribed: 0 });
  Object.defineProperty(Navigator.prototype, 'standalone', { configurable: true, get: () => mode !== 'tab' });
  if (mode === 'tab') {
    delete window.PushManager; // as Safari in a tab
    return;
  }
  class FakeNotification {
    static permission = mode === 'denied' ? 'denied' : 'default';
    static async requestPermission() {
      P.log.push('requestPermission');
      FakeNotification.permission = 'granted';
      return 'granted';
    }
  }
  Object.defineProperty(window, 'Notification', { configurable: true, writable: true, value: FakeNotification });
  const endpoint = mode === 'unknown' ? 'https://push.example.org/send/invented-endpoint' : 'https://web.push.apple.com/invented-endpoint-1';
  const keys = { p256dh: 'B' + 'A'.repeat(86), auth: 'C'.repeat(22) };
  let sub = null;
  const pushManager = {
    getSubscription: async () => (P.log.push('getSubscription'), sub),
    subscribe: async (o) => {
      P.log.push(`subscribe ${o.userVisibleOnly} ${o.applicationServerKey.length}`);
      sub = {
        endpoint,
        toJSON: () => ({ endpoint, expirationTime: null, keys }),
        unsubscribe: async () => {
          P.log.push('unsubscribe');
          P.unsubscribed++;
          sub = null;
          return true;
        },
      };
      return sub;
    },
  };
  const reg = { scope: `${location.origin}/`, pushManager };
  const container = {
    controller: null,
    register: async (url, o) => (P.log.push(`register ${url} ${o.scope}`), reg),
    get ready() {
      P.log.push('ready');
      return Promise.resolve(reg);
    },
    getRegistration: async () => reg,
    getRegistrations: async () => [reg],
    addEventListener() {},
    removeEventListener() {},
  };
  Object.defineProperty(Navigator.prototype, 'serviceWorker', { configurable: true, get: () => container });
}

async function checkThisDevice(page, name, theme) {
  await standinPost('/standin/reset');
  const N = SETTINGS.notify.settings_notify;

  // ---- signed out: the files and their types, never the sign-in page ----------------------------------------------------------------
  const files = [['/manifest.webmanifest', /^application\/manifest\+json/], ['/sw.js', /^text\/javascript/], ['/icon-192.png', /^image\/png$/], ['/icon-512.png', /^image\/png$/], ['/apple-touch-icon.png', /^image\/png$/]];
  for (const [path, type] of files) {
    const r = await fetch(`${base}${path}`, { redirect: 'manual' });
    assert.equal(r.status, 200, `${path} signed out`);
    assert.match(r.headers.get('content-type') ?? '', type, `${path}: its type`);
    if (name === 'phone' && theme === 'dark' && path !== '/icon-512.png' && path !== '/apple-touch-icon.png')
      console.log(`${path}: ${['content-type', 'cache-control', 'etag', 'last-modified', 'content-security-policy'].map((h) => `${h}=${r.headers.get(h)}`).join('; ')}`);
  }
  const manifest = await (await fetch(`${base}/manifest.webmanifest`)).json();
  assert.deepEqual([manifest.id, manifest.name, manifest.short_name, manifest.start_url, manifest.scope, manifest.display], ['/', 'Logger', 'Logger', '/', '/', 'standalone']);
  assert.deepEqual(manifest.icons.map((i) => `${i.src} ${i.sizes} ${i.purpose}`), ['/icon-192.png 192x192 any', '/icon-512.png 512x512 any', '/icon-512.png 512x512 maskable']);
  const sw = await (await fetch(`${base}/sw.js`)).text();
  assert.ok(sw.includes("addEventListener('push'") && !sw.includes("addEventListener('fetch'"), 'the worker: push, no fetch handler');
  const login = await (await fetch(`${base}/login`)).text();
  for (const tag of ['rel="manifest"', 'rel="apple-touch-icon"', 'name="apple-mobile-web-app-capable" content="yes"', 'name="mobile-web-app-capable" content="yes"', 'name="apple-mobile-web-app-title" content="Logger"', 'name="apple-mobile-web-app-status-bar-style"', 'name="theme-color"'])
    assert.ok(login.includes(tag), `the sign-in page has ${tag}`);

  // ---- signed in: the tags, the CSP, the manifest as the browser reads it, no worker until a press, the real worker ---------------------
  const resp = await page.goto(`${base}/settings/notifications`);
  await page.locator('[data-this-device]').waitFor();
  const csp = resp?.headers()['content-security-policy'] ?? '';
  assert.match(csp, /worker-src 'self'/);
  assert.match(csp, /manifest-src 'self'/);
  assert.match(csp, /script-src 'self'/);
  const head = await page.evaluate(() => ({
    manifest: document.querySelector('link[rel=manifest]')?.href,
    touch: document.querySelector('link[rel=apple-touch-icon]')?.href,
    title: document.querySelector('meta[name=apple-mobile-web-app-title]')?.content,
    bars: [...document.querySelectorAll('meta[name=theme-color]')].map((m) => m.content),
  }));
  const bar = theme === 'light' ? '#f1f1ee' : '#0c0d0f';
  assert.deepEqual(head, { manifest: `${base}/manifest.webmanifest`, touch: `${base}/apple-touch-icon.png`, title: 'Logger', bars: [bar, bar] }, 'the head tags; the bar is the theme\'s background');
  const cdp = await page.context().newCDPSession(page);
  const got = await cdp.send('Page.getAppManifest');
  await cdp.detach();
  assert.equal(got.url, `${base}/manifest.webmanifest`);
  assert.deepEqual(got.errors, [], 'the browser read the manifest without errors');
  assert.equal(JSON.parse(got.data).name, 'Logger');
  assert.equal(await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length), 0, 'no service worker before a press');
  // nothing on the card touched the browser: still none after it ran
  // (the test browser blocks notifications: the card says so once it ran in the browser; a card waiting has its button disabled)
  await page.waitForFunction(() => document.querySelector('[data-this-device]')?.getAttribute('data-this-device') === 'blocked' || document.querySelector('[data-device-on]:not([disabled]), [data-device-off]:not([disabled])'));
  assert.equal(await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length), 0, 'still none once the card ran');
  const real = await page.evaluate(async () => {
    const r = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    const ready = await navigator.serviceWorker.ready;
    const out = { scope: ready.scope, script: ready.active?.scriptURL ?? null, push: 'pushManager' in ready };
    await r.unregister();
    return out;
  });
  assert.deepEqual(real, { scope: `${base}/`, script: `${base}/sw.js`, push: true }, 'the real worker registers for "/" under the real CSP');

  // ---- "This device", the browser's parts stubbed --------------------------------------------------------------------------------
  const ctx = await browser.newContext({ viewport: page.viewportSize(), deviceScaleFactor: name === 'phone' ? 2 : 1, userAgent: IPHONE_UA });
  if (theme === 'light') await ctx.addInitScript(() => localStorage.setItem('logger-theme', 'light'));
  const first = await ctx.newPage();
  await first.goto(`${base}/`);
  await signIn(first);
  await first.close();
  const shot = (p, n) => p.screenshot({ path: `${out}/settings-device-${n}-${name}-${theme}.png`, fullPage: true });
  const stubbed = async (mode) => {
    const p = await ctx.newPage();
    await p.addInitScript(pushStub, mode);
    await p.goto(`${base}/settings/notifications`);
    await p.locator('[data-this-device]').waitFor();
    return p;
  };
  const stateOf = async (p) => [await p.locator('[data-this-device]').getAttribute('data-this-device'), await text(p.locator('[data-device-state]'))];
  const headOn = async (p, want) => {
    await p.locator('[data-bar-head]', { hasText: want }).waitFor();
    assert.equal(await text(p.locator('[data-bar-head]')), want, 'the answer bar');
  };

  // off (the sample's rows, none of them this device) -> Turn on -> on, with the twice line -> Turn off on this device
  await standinPost('/standin/settings?nothis=1');
  const p = await stubbed('home');
  assert.deepEqual(await stateOf(p), ['off', 'Off on this device']);
  const card = await p.locator('[data-this-device]').boundingBox();
  const list = await p.locator('[data-subscriptions]').boundingBox();
  assert.ok(card && list && card.y + card.height <= list.y, 'This device above the list');
  await p.locator('[data-device-on]:not([disabled])').waitFor();
  assert.equal(await p.locator('[data-device-hint]').count(), 0, 'an iPhone from the Home Screen: no hint');
  const appIphone = N.subscriptions.find((s) => s.address === 'logger' && N.subscriptions.some((a) => a.address === 'app' && a.name === s.name));
  await p.locator(`[data-subscription="${appIphone.id}"] [data-push-off]`).click();
  await p.locator('[data-twice]').waitFor({ state: 'detached' });
  await shot(p, 'off');
  await checkWidth(p, 'settings, this device off');
  await p.locator('[data-device-on]').click();
  await p.locator('[data-this-device="on"]').waitFor();
  await headOn(p, 'Notifications are on for this device.');
  assert.deepEqual(await p.evaluate(() => window.__push.log), ['requestPermission', 'register /sw.js /', 'ready', 'getSubscription', 'subscribe true 65'], 'the order of the press');
  const [, onLine] = await stateOf(p);
  assert.match(onLine, /^On since \d\d\.\d\d\.\d{4}$/);
  const mine = p.locator('[data-subscription]', { has: p.locator('[data-this]') });
  assert.equal(await mine.count(), 1, 'one row is this device');
  assert.equal(await text(mine.locator('[data-address]')), 'logger.');
  assert.match(await text(mine), /^iPhone, Safari logger\. this device/);
  assert.match(await text(mine.locator('[data-line]')), /^on since \d\d\.\d\d\.\d{4}, nothing delivered yet$/);
  assert.equal(await text(p.locator('[data-twice]')), 'This phone is on at app. too: nudges arrive twice until you turn that one off.');
  const kept = await (await fetch(`${standin}/standin/push-subscribed`)).json();
  assert.deepEqual({ subscribed: kept.subscribed, user_agent: kept.user_agent }, { subscribed: 1, user_agent: IPHONE_UA }, 'the door got the browser\'s User-Agent from the front end');
  await p.locator('[data-bar] button[aria-label="Close"], [data-bar-close]').first().click().catch(() => {});
  await shot(p, 'on');
  await checkWidth(p, 'settings, this device on');
  await p.locator('[data-device-off]').click();
  await p.locator('[data-this-device="off"]').waitFor();
  await headOn(p, SETTINGS.saves.push_off.head);
  assert.equal(await mine.count(), 0, 'the row is gone');
  assert.equal(await p.locator('[data-twice]').count(), 0);
  assert.equal(await p.evaluate(() => window.__push.unsubscribed), 1, 'the browser\'s subscription ended');
  await p.close();

  // the door does not know the push address: refused, the device stays off, the subscription is ended again
  const u = await stubbed('unknown');
  await u.locator('[data-device-on]:not([disabled])').click();
  await u.locator('[data-bar-head]').waitFor();
  assert.match(await text(u.locator('[data-bar]')), /Not a known push service\./);
  await u.waitForFunction(() => window.__push.unsubscribed === 1);
  assert.deepEqual(await stateOf(u), ['off', 'Off on this device']);
  assert.equal(await u.locator('[data-subscription] [data-this]').count(), 0);
  await u.close();

  // blocked in the browser's settings: the words, no button
  const d = await stubbed('denied');
  await d.locator('[data-this-device="blocked"]').waitFor();
  assert.equal(await text(d.locator('[data-device-why]')), 'Notifications are blocked for logger. in this browser\'s settings.');
  assert.equal(await d.locator('[data-device-on]').count(), 0);
  await d.close();

  // an iPhone in Safari's tab (not from the Home Screen): the hint, no button
  const tab = await stubbed('tab');
  await tab.locator('[data-this-device="cannot"]').waitFor();
  assert.equal(await text(tab.locator('[data-device-why]')), 'On an iPhone: open logger. from the Home Screen first (Share, then Add to Home Screen).');
  assert.equal(await tab.locator('[data-device-on]').count(), 0);
  await shot(tab, 'iphone');
  await checkWidth(tab, 'settings, this device on an iPhone tab');
  await tab.close();

  // the server without a key
  await standinPost('/standin/settings?nokey=1');
  const k = await stubbed('home');
  await k.locator('[data-this-device="cannot"]').waitFor();
  assert.equal(await text(k.locator('[data-device-why]')), 'Notifications are not set up on the server.');
  await k.close();
  await ctx.close();
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
    if (only('today')) {
      await checkToday(page, name);
      await checkReviewChange(page, name, theme);
    }
    await checkWidth(page, 'today');
    if (only('todayparts')) {
      await checkTodayParts(page, name, theme);
      console.log(`today's food rows, chip boxes, suggestions ${name} ${theme}: checks passed`);
    }
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
    if (only('gym')) {
      await checkGym(page, name, theme);
      console.log(`gym workout, today's gym card, spaces menu ${name} ${theme}: checks passed`);
    }
    if (only('gymparts')) {
      await checkGymParts(page, name, theme);
      console.log(`gym plan, exercises, progress, activity, history ${name} ${theme}: checks passed`);
    }
    if (only('home')) {
      await checkHome(page, name, theme);
      console.log(`home now, pick, timer, today's home card ${name} ${theme}: checks passed`);
    }
    if (only('homeparts')) {
      await checkHomeParts(page, name, theme);
      console.log(`home zones, history, a chore, edit zones ${name} ${theme}: checks passed`);
    }
    if (only('trends')) {
      await checkTrends(page, name, theme);
      console.log(`trends week, the week review, the trends tab ${name} ${theme}: checks passed`);
      await checkTrendsTabs(page, name, theme);
      console.log(`trends charts and insights ${name} ${theme}: checks passed`);
    }
    if (only('library')) {
      await checkLibrary(page, name, theme);
      console.log(`library foods, the library tab ${name} ${theme}: checks passed`);
      await checkLibraryTabs(page, name, theme);
      console.log(`library usual meals, habits, exercises ${name} ${theme}: checks passed`);
    }
    if (only('medical')) {
      await checkMedicalPlace(page, name, theme);
      console.log(`medical in the places ${name} ${theme}: checks passed`);
      await checkMedicalReports(page, name, theme);
      console.log(`medical reports ${name} ${theme}: checks passed`);
      await checkMedicalTests(page, name, theme);
      console.log(`medical tests over time ${name} ${theme}: checks passed`);
      await checkMedicalMeds(page, name, theme);
      console.log(`medical medication ${name} ${theme}: checks passed`);
    }
    if (only('more')) {
      await checkMoreHome(page, name, theme);
      console.log(`more: search field, rows, words, sign out ${name} ${theme}: checks passed`);
      await checkSearch(page, name, theme);
      console.log(`search ${name} ${theme}: checks passed`);
      await checkRecent(page, name, theme);
      console.log(`recent, use again ${name} ${theme}: checks passed`);
      await checkUsage(page, name, theme);
      console.log(`usage ${name} ${theme}: checks passed`);
    }
    if (only('coach')) {
      await checkCoach(page, name, theme);
      console.log(`coach page, coaching a day ${name} ${theme}: checks passed`);
      await checkCoachToday(page, name, theme);
      console.log(`today's coach card ${name} ${theme}: checks passed`);
    }
    if (only('settings')) {
      await checkSettings(page, name, theme);
      console.log(`settings, its seven tabs ${name} ${theme}: checks passed`);
      await checkSettingsLinks(page, name, theme);
      console.log(`settings links, today's two switches ${name} ${theme}: checks passed`);
      await checkThisDevice(page, name, theme);
      console.log(`home-screen app, notifications on this device ${name} ${theme}: checks passed`);
    }
    if (only('problems')) {
      await checkProblems(page, name, theme);
      console.log(`core down, door off, next ${name} ${theme}: checks passed`);
    }
    if (name === 'phone' && theme === 'dark') {
      await page.goto(`${base}/`); // Today's Sign out (an area run alone may end on a page without one, e.g. SHOOT_ONLY=health)
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

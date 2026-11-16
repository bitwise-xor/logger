// Home's other four pages' plain rules (deploy 100): Zones' tiles, cards and starting points, History's rows and links, a chore's page,
// and Edit zones' drafts, checks and fields; against real answers of the door (tests/samples/home.json).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  activeFields,
  alldoneFields,
  allDoneText,
  BRING_BACK,
  choreDraftOf,
  choreFields,
  choreOfHash,
  choreProblem,
  choreToggle,
  doneKey,
  earlierFields,
  editHref,
  formOf,
  goalFields,
  goalProblem,
  historyHref,
  jobValue,
  keyOf,
  lastLine,
  linesOf,
  moreHref,
  moreJobs,
  newChoreDraft,
  newZoneDraft,
  perZoneDraftOf,
  perZoneFields,
  perZoneProblem,
  removeFields,
  startFields,
  startKey,
  startTitle,
  tileLabel,
  tileTitle,
  timeOf,
  whereOptions,
  wordsOfText,
  zoneDraftOf,
  zoneFields,
  zoneLine,
  zoneProblem,
  zoneRowMeta,
  zoneSummary,
  zoneTitle,
  zoneToggle,
  choreIdOf,
  type Chore,
  type Edit,
  type History,
  type Zones,
} from './homeparts.js';

const read = (name: string) => JSON.parse(readFileSync(new URL(`../../tests/samples/${name}`, import.meta.url), 'utf8'));
const H = read('home.json');
const ZONES: Zones = H.zones.home_zones;
const HIST: History = H.history.home_history;
const EDIT: Edit = H.edit.home_edit;
const CHORE: Chore = H.chore.home_chore;
const FLAT: Chore = H.chore_flat.home_chore;

describe('Zones', () => {
  it('writes a starting point row and its fields as the door gives them', () => {
    const [towels, vacuum] = ZONES.start.jobs;
    expect(startTitle(towels!)).toBe('Fresh towels · Bathroom');
    expect(startTitle(vacuum!)).toBe('Vacuum · 2 zones');
    expect(startKey(vacuum!)).toBe('2-2,2-3');
    expect(startFields(vacuum!, 'week')).toEqual({ pairs: '2-2,2-3', ago: 'week' });
    expect(ZONES.start.answers.map((a) => a.label)).toEqual(['This week', 'This month', 'Longer ago', 'Don’t know']);
    expect(moreJobs(4)).toBe('4 more jobs after these.');
    expect(moreJobs(1)).toBe('1 more job after these.');
    expect(moreJobs(0)).toBeNull();
  });

  it('writes a tile and All done in the door’s words', () => {
    const dust = ZONES.flat[0]!;
    expect(dust.per_zone.text).toBe('every 2 weeks; not in Hall');
    const t = dust.tiles[1]!;
    expect(tileTitle(t)).toBe('Bathroom: every 2 weeks');
    expect(tileLabel(t)).toBe('Dust Bathroom: 2 weeks ago. Tap when it is done.');
    expect(allDoneText(dust)).toBe('All done');
    expect(allDoneText({ all_done_today: true })).toBe('All done ✓');
    expect(allDoneText(dust, true)).toBe('All done ✓');
    expect(alldoneFields(dust)).toEqual({ chore_id: '1' });
  });

  it('writes a zone card’s summary with “oldest …” and a row with the interval first', () => {
    const k = ZONES.zones[0]!;
    expect(zoneSummary(k)).toBe('4 chores · oldest not yet');
    expect(zoneSummary({ count: 3, oldest_text: '3 weeks ago' })).toBe('3 chores · oldest 3 weeks ago');
    expect(zoneRowMeta(k.chores[1]!)).toBe('weekly · 9 days ago');
  });
});

describe('History', () => {
  it('links to more rows, writes the count and the time of a row', () => {
    expect(historyHref()).toBe('/home/history');
    expect(historyHref(120)).toBe('/home/history?n=120');
    expect(moreHref({ more: false, limit: 60, step: 60 })).toBeNull();
    expect(moreHref({ more: true, limit: 60, step: 60 })).toBe('/home/history?n=120');
    expect(lastLine(HIST)).toBe('last 8');
    const rows = HIST.days.flatMap((d) => d.rows);
    expect(timeOf(rows[0]!)).toBe('21:04');
    expect(timeOf(rows.find((r) => r.dated)!)).toBe('');
    expect(rows.map((r) => r.how)).toContain('starting point');
  });

  it('removes by the entry’s ids and keys a row by them', () => {
    const e = { ...HIST.days[0]!.rows[0]!, ids: [7, 9] };
    expect(removeFields(e)).toEqual({ ids: '7,9' });
    expect(doneKey(e)).toBe('7,9');
  });

  it('adds one done earlier by the job’s pairs and a date, the jobs as the door lists them', () => {
    expect(jobValue(HIST.jobs[0]!)).toBe('4-1');
    expect(earlierFields('4-1', '2026-11-02')).toEqual({ pairs: '4-1', when: '2026-11-02' });
  });
});

describe('a chore’s page', () => {
  it('leads to Edit with the chore’s form open, and reads the id in an address', () => {
    expect(editHref(3)).toBe('/home/edit#chore-3');
    expect(choreOfHash('#chore-3')).toBe(3);
    expect(choreOfHash('#chore-')).toBeNull();
    expect(choreOfHash('#other')).toBeNull();
    expect(choreIdOf('12')).toBe('12');
    expect(choreIdOf('12; drop')).toBe('');
    expect(choreIdOf(null)).toBe('');
  });

  it('has the door’s lines: dates and “usually …”, per zone for a whole-flat chore', () => {
    expect(CHORE.last_text).toBe('07.11. · 26.10. · 17.10.');
    expect(CHORE.usually).toBe('usually every 12 days');
    expect(CHORE.zones).toBeNull();
    const [kitchen, bath] = FLAT.zones!;
    expect(zoneLine(kitchen!)).toEqual({ name: 'Kitchen', extra: 'every 3 days · 10 min', dates: '14.11.' });
    expect(zoneLine(bath!)).toEqual({ name: 'Bathroom', extra: 'weekly · 5 min', dates: 'not logged yet' });
    expect(zoneLine({ ...bath!, text: 'not done here', usually: 'usually every 9 days' }).extra).toBe('not done here · usually every 9 days');
  });
});

describe('Edit zones', () => {
  const dust = EDIT.flat[0]!;
  const stove = EDIT.zones[0]!.chores[0]!;
  const oven = EDIT.zones[0]!.chores[2]!;
  const L = EDIT.limits;

  it('words Retire and Bring back, the zone title and its count', () => {
    expect(choreToggle(stove)).toBe('Retire');
    expect(choreToggle(oven)).toBe(BRING_BACK);
    expect(zoneToggle(EDIT.zones[0]!)).toBe('Retire this zone');
    expect(zoneToggle(EDIT.zones[3]!)).toBe('Bring back');
    expect(zoneTitle(EDIT.zones[0]!)).toBe('Kitchen');
    expect(zoneTitle(EDIT.zones[3]!)).toBe('Attic · retired');
    expect(oven.meta).toBe('every 3 months · 30 min · retired');
  });

  it('offers a retired zone in “Where” only for the chore already in it', () => {
    expect(whereOptions(EDIT, 'flat').map((o) => o.label)).toEqual(['Whole flat (each zone on its own)', 'Kitchen', 'Bathroom', 'Hallway']);
    expect(whereOptions(EDIT, '4').map((o) => o.value)).toEqual(['flat', '1', '2', '3', '4']);
  });

  it('makes a draft from a chore and sends it as typed', () => {
    const d = choreDraftOf(stove);
    expect(d).toEqual({ name: 'Wipe the stove', zone: '1', days: '7', minutes: '15', steps: 'Knobs\nTop\nWall behind', howto: '', words: '' });
    expect(choreDraftOf(dust).zone).toBe('flat');
    expect(choreDraftOf(dust).words).toBe('dust, dusting');
    expect(choreFields(d, 3)).toEqual({ chore_id: '3', name: 'Wipe the stove', zone_id: '1', days: '7', minutes: '15', steps: 'Knobs\nTop\nWall behind', howto: '', words: '' });
    expect(choreFields({ ...d, days: ' 14 ' })).not.toHaveProperty('chore_id');
    expect(newChoreDraft(L)).toEqual({ name: '', zone: 'flat', days: '', minutes: '15', steps: '', howto: '', words: '' });
  });

  it('checks only what the door answers with a plain 400, and leaves its own refusals to it', () => {
    const ok = { ...newChoreDraft(L), name: 'Clean the oven', days: '90' };
    expect(choreProblem(ok, L)).toBeNull();
    // the door refuses these in its words, so they are sent
    expect(choreProblem({ ...ok, days: '800' }, L)).toBeNull();
    expect(choreProblem({ ...ok, name: '' }, L)).toBeNull();
    // not whole numbers: the door says 400, so the page says it first, in the door’s words
    expect(choreProblem({ ...ok, days: '' }, L)).toBe('Give the interval in whole days and the minutes as a whole number.');
    expect(choreProblem({ ...ok, days: '7.5' }, L)).toBe('Give the interval in whole days and the minutes as a whole number.');
    expect(choreProblem({ ...ok, minutes: 'ten' }, L)).toBe('Give the interval in whole days and the minutes as a whole number.');
    expect(choreProblem({ ...ok, minutes: '' }, L)).toBeNull();
    // too many or too long
    expect(choreProblem({ ...ok, steps: Array.from({ length: 9 }, (_, i) => `step ${i}`).join('\n') }, L)).toBe('Steps: at most 8, one per line.');
    expect(choreProblem({ ...ok, steps: 'x'.repeat(81) }, L)).toBe('Steps: each at most 80 characters.');
    expect(choreProblem({ ...ok, words: Array.from({ length: 13 }, (_, i) => `w${i}`).join(', ') }, L)).toBe('Other words: at most 12, separated by commas.');
    expect(choreProblem({ ...ok, howto: 'x'.repeat(301) }, L)).toBe('The how-to line is at most 300 characters.');
    expect(choreProblem({ ...ok, name: 'x'.repeat(61) }, L)).toBe('The name is at most 60 characters.');
  });

  it('tidies lines and words as the door counts them', () => {
    expect(linesOf('  a  b \n\n c\r\n')).toEqual(['a b', 'c']);
    expect(wordsOfText('Oven,  stove , ,hob')).toEqual(['Oven', 'stove', 'hob']);
  });

  it('makes a zone draft and checks its lists', () => {
    const k = EDIT.zones[0]!;
    expect(zoneDraftOf(k)).toEqual({ name: 'Kitchen', short: 'Kit', spots: 'Counter\nStove top', words: 'galley' });
    expect(zoneFields(zoneDraftOf(k), 1)).toEqual({ zone_id: '1', name: 'Kitchen', short: 'Kit', spots: 'Counter\nStove top', words: 'galley' });
    expect(zoneFields(newZoneDraft())).not.toHaveProperty('zone_id');
    expect(zoneProblem({ ...zoneDraftOf(k), spots: Array.from({ length: 13 }, (_, i) => `s${i}`).join('\n') }, L)).toBe('Spots: at most 12, one per line.');
    expect(zoneProblem({ ...zoneDraftOf(k), short: 'x'.repeat(13) }, L)).toBe('The tile label is at most 12 characters.');
    expect(zoneProblem(zoneDraftOf(k), L)).toBeNull();
  });

  it('sends Retire and Bring back as on 0 and 1, and the goal as typed', () => {
    expect(activeFields('chore_id', 3, false)).toEqual({ chore_id: '3', on: '0' });
    expect(activeFields('zone_id', 4, true)).toEqual({ zone_id: '4', on: '1' });
    expect(goalFields(' 4 ')).toEqual({ goal: '4' });
    expect(goalProblem('4', L)).toBeNull();
    expect(goalProblem('9', L)).toBeNull(); // 1 to 7 is the door's to say
    expect(goalProblem('', L)).toBe('The weekly goal is 1 to 7 sessions.');
    expect(goalProblem('2.5', L)).toBe('The weekly goal is 1 to 7 sessions.');
  });

  it('sends the whole Per zone table: a zone left unticked is off, blank = the chore’s own', () => {
    const vacuum = EDIT.flat[1]!;
    const rows = perZoneDraftOf(vacuum);
    expect(rows).toEqual([
      { zone_id: 1, zone: 'Kitchen', on: true, days: '3', minutes: '' },
      { zone_id: 2, zone: 'Bathroom', on: true, days: '', minutes: '5' },
      { zone_id: 3, zone: 'Hallway', on: true, days: '', minutes: '' },
    ]);
    rows[2]!.on = false;
    expect(perZoneFields(vacuum, rows)).toEqual({
      chore_id: '2',
      zone_ids: ['1', '2', '3'],
      on_1: '1',
      days_1: '3',
      min_1: '',
      on_2: '1',
      days_2: '',
      min_2: '5',
      days_3: '',
      min_3: '',
    });
    expect(perZoneProblem(rows)).toBeNull();
    expect(perZoneProblem([{ ...rows[0]!, days: '9999' }])).toBeNull(); // the range is the door's
    expect(perZoneProblem([{ ...rows[0]!, days: '1.5' }])).toBe('Give the days (1 to 730) and minutes (1 to 240) as whole numbers, or leave them blank.');
    expect(perZoneDraftOf(stove)).toEqual([]);
  });

  it('tells which form a save belongs to, so a refusal is said next to it', () => {
    expect(formOf('home_choreedit', { chore_id: '3' })).toBe('c:3');
    expect(formOf('home_chorezones', { chore_id: '2' })).toBe(keyOf.perZone(2));
    expect(formOf('home_zoneedit', { zone_id: '1' })).toBe('z:1');
    expect(formOf('home_chorenew', {})).toBe('newchore');
    expect(formOf('home_zonenew', {})).toBe('newzone');
    expect(formOf('home_goalset', { goal: '3' })).toBe('goal');
    // Retire and Bring back are said in the answer bar
    expect(formOf('home_choreactive', { chore_id: '3' })).toBeNull();
    expect(formOf('home_zoneactive', { zone_id: '3' })).toBeNull();
  });
});

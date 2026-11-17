// Medical (deploy 106): the pages' addresses, the lines of a row, what changed in a form and which form a save belongs to, against real
// answers of the door for invented data (tests/samples/labs.json).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  addedMeds,
  askedOpen,
  askedQ,
  askedTest,
  changedFields,
  chipText,
  courseQuestion,
  endFields,
  flagLetter,
  formOf,
  listOf,
  medDraft,
  medFields,
  medFrom,
  medLine,
  reportDraft,
  reportFields,
  reportLine,
  reportLink,
  reportMeta,
  reportsHref,
  reportsView,
  runningLine,
  testsHref,
  testsViewOf,
  valueDraft,
  valueFields,
  valueNote,
  valuesLine,
  type Labs,
  type Meds,
  type Tests,
} from './medical.js';
import { mayResend } from './saver.js';

const SAMPLE = JSON.parse(readFileSync(new URL('../../tests/samples/labs.json', import.meta.url), 'utf8'));
const REPORTS = SAMPLE.reports.labs as Labs;
const OPEN = SAMPLE.open.labs as Labs;
const IMAGING = SAMPLE.open_imaging.labs as Labs;
const MEDS = SAMPLE.meds.labs_meds as Meds;
const TEST = SAMPLE.test.labs_tests as Tests;
const LIST = SAMPLE.tests.labs_tests as Tests;
const ONE = SAMPLE.one_value.labs_tests as Tests;

describe("the pages' addresses", () => {
  it('takes a report as the door does (R12, r12 or 12) and nothing else', () => {
    expect(askedOpen('R12')).toBe(12);
    expect(askedOpen('r12')).toBe(12);
    expect(askedOpen(' 12 ')).toBe(12);
    expect(askedOpen('0')).toBeNull();
    expect(askedOpen('R')).toBeNull();
    expect(askedOpen('12a')).toBeNull();
    expect(askedOpen(null)).toBeNull();
  });

  it("takes a test's id, digits only", () => {
    expect(askedTest('21')).toBe(21);
    expect(askedTest('R21')).toBeNull();
    expect(askedTest('x')).toBeNull();
    expect(askedTest('')).toBeNull();
    expect(askedTest(null)).toBeNull();
  });

  it('cuts the search at 60 and trims it', () => {
    expect(askedQ('  vit ')).toBe('vit');
    expect(askedQ('x'.repeat(80))).toHaveLength(60);
    expect(askedQ(null)).toBe('');
  });

  it('leaves the defaults out: /medical is no report open, /medical/tests the list', () => {
    expect(reportsHref(null)).toBe('/medical');
    expect(reportsHref(4)).toBe('/medical?open=R4');
    expect(reportLink(4)).toBe('/medical?open=R4');
    expect(testsHref({})).toBe('/medical/tests');
    expect(testsHref({ q: '' })).toBe('/medical/tests');
    expect(testsHref({ t: 21 })).toBe('/medical/tests?t=21');
    expect(testsHref({ q: 'vit d', t: 21 })).toBe('/medical/tests?q=vit+d&t=21');
    expect(testsViewOf(new URLSearchParams('q=%20vit%20&t=21'))).toEqual({ q: 'vit', t: 21 });
    expect(testsViewOf(new URLSearchParams('t=abc'))).toEqual({ q: '', t: null });
  });

  it("asks the door's fresh Reports for the open report, as the door says it", () => {
    expect(reportsView(null)).toEqual({ view: 'labs' });
    expect(reportsView(12)).toEqual({ view: 'labs', view_open: 'R12' });
  });
});

describe('the rows', () => {
  it('the list of reports against the sample: counts and flags', () => {
    expect(REPORTS.reports.map((r) => [r.ref, r.kind, r.values, r.flagged])).toEqual([
      ['R5', 'imaging', 1, 1],
      ['R4', 'lab', 4, 1],
      ['R3', 'lab', 3, 2],
      ['R2', 'lab', 3, 1],
      ['R1', 'lab', 3, 3],
    ]);
    expect(reportLine(REPORTS.reports[1]!)).toBe('4 values · 1 flagged');
    expect(reportLine({ values: 1, flagged: 0 })).toBe('1 value');
    expect(valuesLine(1)).toBe('1 value');
    expect(valuesLine(4)).toBe('4 values');
  });

  it('a chip says the test, the value as printed and the flag letter; only H, L and A are letters', () => {
    expect(chipText(REPORTS.flagged!.chips[0]!)).toBe('Ferritin 450 ng/mL H');
    expect(flagLetter('H')).toBe('H');
    expect(flagLetter('L')).toBe('L');
    expect(flagLetter('A')).toBe('A');
    expect(flagLetter('N')).toBeNull();
    expect(flagLetter(null)).toBeNull();
    expect(flagLetter(undefined)).toBeNull();
  });

  it("a report's meta line and a value's note", () => {
    expect(reportMeta(OPEN.open!)).toBe('R4 · Zz Lab');
    expect(reportMeta({ ref: 'R9', provider: null })).toBe('R9');
    expect(valueNote(OPEN.open!.values[0]!)).toBe('');
    expect(valueNote(IMAGING.open!.values[0]!)).toBe('liver');
    expect(valueNote({ note: 'calculated', site: null })).toBe('calculated');
  });

  it('a course: dose · how often · why, from, and the running count', () => {
    expect(medLine(MEDS.meds[0]!)).toBe('1000 IU · daily · for low vitamin D');
    expect(medLine(MEDS.meds[3]!)).toBe('100 mg · daily');
    expect(medLine({ dose: null, frequency: null, indication: null })).toBe('');
    expect(medFrom(MEDS.meds[0]!)).toBe('01.09.2026 to');
    expect(runningLine(MEDS)).toBe('2 running');
  });

  it("the tests list: the door's, or the one test a search with one match opened", () => {
    expect(listOf(LIST).map((t) => t.name)).toEqual(['Ferritin', 'Haemoglobin', 'Vitamin D']);
    expect(listOf(SAMPLE.search.labs_tests)).toEqual([SAMPLE.search.labs_tests.test]);
    expect(listOf(SAMPLE.no_test.labs_tests)).toEqual([]);
  });

  it('the thin cases have no chart and say why; a test with values has the chart, the band and the dots', () => {
    expect(ONE.card!.chart).toBeNull();
    expect(ONE.card!.note).toBe('Only one value so far; the chart starts with the second.');
    expect(TEST.card!.chart!.band).toEqual([30, 100]);
    expect(TEST.card!.chart!.series.map((s) => [s.mark, s.cls, s.pts.length])).toEqual([['line', 'a', 4], ['dot', 'a', 2], ['dot', 'w', 2], ['dot', 'r', 0]]);
    expect(TEST.rows.map((r) => [r.date_text, r.flag, r.report_ref])).toEqual([
      ['05.10.2026', 'N', 'R4'],
      ['20.06.2025', 'N', 'R3'],
      ['02.09.2024', 'L', 'R2'],
      ['14.03.2023', 'L', 'R1'],
    ]);
  });
});

describe('the forms', () => {
  it('a value starts from what was printed, and only what was typed over is sent (a cleared one empty)', () => {
    const v = OPEN.open!.values[0]!;
    expect(valueDraft(v)).toEqual({ value: '13.8', unit: 'g/dL', ref: '13.5-17.5' });
    expect(changedFields(valueDraft(v), { value: '12.9', unit: 'g/dL', ref: '13.5-17.5' })).toEqual({ value: '12.9' });
    expect(changedFields(valueDraft(v), { value: ' 13.8 ', unit: 'g/dL', ref: '13.5-17.5' })).toEqual({});
    expect(changedFields(valueDraft(v), { value: '', unit: '', ref: '13.5-17.5' })).toEqual({ value: '', unit: '' });
    expect(valueFields(10, { value: '12.9' })).toEqual({ id: '10', value: '12.9' });
    expect(valueFields(10, {})).toEqual({ id: '10' });
  });

  it("an imaging value's printed words start the form (no unit, no range)", () => {
    expect(valueDraft(IMAGING.open!.values[0]!)).toEqual({ value: 'slightly enlarged', unit: '', ref: '' });
  });

  it("a report's form starts from the door's, the date as a date", () => {
    expect(reportDraft(OPEN.open!)).toEqual({ collected: '2026-10-05', title: 'Annual check-up', provider: 'Zz Lab', notes: '' });
    expect(changedFields(reportDraft(OPEN.open!), { collected: '2026-10-06', title: 'Annual check-up', provider: 'Zz Lab', notes: '' })).toEqual({ collected: '2026-10-06' });
    expect(reportFields(4, { title: 'New' })).toEqual({ id: '4', title: 'New' });
  });

  it("a course's form starts from the course: an empty stop is running; End has the act only", () => {
    expect(medDraft(MEDS.meds[0]!)).toEqual({ dose: '1000 IU', frequency: 'daily', indication: 'low vitamin D', start: '2026-09-01', stop: '' });
    expect(medDraft(MEDS.meds[2]!)).toEqual({ dose: '500 mg', frequency: 'three times daily', indication: 'infection', start: '2024-02-01', stop: '2024-02-08' });
    expect(changedFields(medDraft(MEDS.meds[1]!), { dose: '50 mg', frequency: 'every other day', indication: 'low ferritin', start: '2025-07-01', stop: '' })).toEqual({ stop: '' });
    expect(medFields(1, { dose: '2000 IU' })).toEqual({ id: '1', act: 'save', dose: '2000 IU' });
    expect(endFields(1)).toEqual({ id: '1', act: 'end' });
  });

  it("says which form a save belongs to: a value's by its number, the report, a course's, the typed course", () => {
    expect(formOf('labs_value', { id: '10' })).toBe('value:10');
    expect(formOf('labs_report', { id: '4' })).toBe('report');
    expect(formOf('labs_med', { id: '2', act: 'end' })).toBe('med:2');
    expect(formOf('log', { text: 'x' })).toBe('add');
    expect(formOf('answer', { question_id: 'p1' })).toBe('add');
    expect(formOf('undo', {})).toBeNull();
  });

  it("finds the typed course's question in the door's answer (Yes and No, the read-back), and adds a blue edge to the new row", () => {
    const q = courseQuestion(SAMPLE.saves.log_ask);
    expect(q).toEqual({ id: 'pe229fa35', readBack: 'start Vitamin D 1000 IU daily from 17.11.2026', yes: 'Yes', no: 'No' });
    expect(courseQuestion(SAMPLE.saves.value_ask)).toBeNull();
    const after: Meds = { ...MEDS, meds: [{ ...MEDS.meds[0]!, id: 5, ref: 'D5' }, ...MEDS.meds] };
    expect(addedMeds(MEDS, after)).toEqual([5]);
    expect(addedMeds(null, MEDS)).toEqual(MEDS.meds.map((m) => m.id));
  });

  it('the three forms and End are never sent again by the page', () => {
    for (const a of ['labs_value', 'labs_report', 'labs_med']) expect(mayResend(a)).toBe(false);
  });
});

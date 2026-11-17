// Library's Foods tab (deploy 105): the page's address, a row's lines, what changed in the values form and the forms' fields, against
// real answers of the door (tests/samples/catalogue.json).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  addedIds,
  askedFilter,
  askedFood,
  askedSort,
  basicsFields,
  catalogueHref,
  countLine,
  formOf,
  lookupQuestion,
  macroLine,
  perLine,
  statsLine,
  typedNumber,
  unitProblem,
  valueChanges,
  valuesDraft,
  valuesFields,
  viewFields,
  viewOf,
  type Catalogue,
  type Item,
} from './catalogue.js';

const SAMPLE = JSON.parse(readFileSync(new URL('../../tests/samples/catalogue.json', import.meta.url), 'utf8'));
const ALL = SAMPLE.all.catalogue as Catalogue;
const OATS = SAMPLE.items.oats.food_item as Item;
const BOWL = SAMPLE.items.bowl.food_item as Item;

describe("the page's address", () => {
  it('takes only what the door knows, else its default', () => {
    expect(askedFilter('drinks')).toBe('drinks');
    expect(askedFilter('soups')).toBe('all');
    expect(askedFilter(null)).toBe('all');
    expect(askedSort('kcal_low')).toBe('kcal_low');
    expect(askedSort('best')).toBe('eaten');
    expect(ALL.sorts.map((s) => askedSort(s.key))).toEqual(ALL.sorts.map((s) => s.key));
    expect(ALL.filters.map((f) => askedFilter(f.key))).toEqual(ALL.filters.map((f) => f.key));
    expect(askedFood('N12')).toBe(12);
    expect(askedFood('n7')).toBe(7);
    expect(askedFood('3')).toBe(3);
    expect(askedFood('N0')).toBeNull();
    expect(askedFood('C3')).toBeNull();
    expect(askedFood(null)).toBeNull();
  });

  it('leaves the defaults out and keeps the rest', () => {
    expect(catalogueHref({})).toBe('/library');
    expect(catalogueHref({ q: '  ', f: 'all', s: 'eaten', food: null })).toBe('/library');
    expect(catalogueHref({ q: 'oat milk', f: 'drinks', s: 'name', food: 3 })).toBe('/library?q=oat+milk&f=drinks&s=name&food=N3');
    expect(catalogueHref({ q: 'x'.repeat(80) })).toBe(`/library?q=${'x'.repeat(60)}`);
    expect(viewOf(new URLSearchParams('q=oat&f=new&s=added&food=N5'))).toEqual({ q: 'oat', f: 'new', s: 'added', food: 5 });
    expect(viewOf(new URLSearchParams('f=odd&s=odd&food=x'))).toEqual({ q: '', f: 'all', s: 'eaten', food: null });
  });

  it('asks every save for the Catalogue of the view shown (view "catalogue")', () => {
    expect(viewFields({ q: '', f: 'all', s: 'eaten', food: null })).toEqual({ view: 'catalogue', view_f: 'all', view_s: 'eaten' });
    expect(viewFields({ q: 'oat', f: 'drinks', s: 'name', food: 3 })).toEqual({ view: 'catalogue', view_q: 'oat', view_f: 'drinks', view_s: 'name', view_food: '3' });
  });
});

describe('a row', () => {
  it("prints kcal, P, F and C as the door's text, per 100 g or ml, and the stats", () => {
    const oats = ALL.rows.find((r) => r.ref === 'N1')!;
    expect(macroLine(oats)).toBe('372 kcal · P 13.5 · F 7 · C 58.7');
    expect(perLine(oats)).toBe('per 100 g');
    expect(statsLine(oats)).toBe('Eaten 5× · Last 16.11. · Added 01.05.26');
    const tea = ALL.rows.find((r) => r.ref === 'N4')!;
    expect(perLine(tea)).toBe('per 100 ml');
    const never = ALL.rows.find((r) => r.ref === 'N8')!;
    expect(statsLine(never)).toBe('Eaten 0× · Last – · Added 19.08.26');
    expect(countLine(ALL)).toBe('13 foods');
    expect(countLine({ count: 1 })).toBe('1 food');
    expect(countLine(SAMPLE.none.catalogue)).toBe('0 foods');
  });
});

describe('the values form', () => {
  it('starts from the box: a value as text, an unknown one empty', () => {
    const d = valuesDraft(OATS);
    expect(d.kcal).toBe('372');
    expect(d.carbs).toBe('58.7');
    expect(d.sodium_mg).toBe('');
    expect(Object.keys(d)).toEqual(['kcal', 'protein', 'fat', 'sat_fat', 'carbs', 'fibre', 'sugar_total', 'sugar_added', 'sodium_mg', 'caffeine_mg']);
  });

  it('sends only what changed: nothing, one value, a value given where it was unknown, a comma', () => {
    const d = valuesDraft(OATS);
    expect(valueChanges(OATS, d)).toEqual({ changed: {}, problem: null });
    expect(valueChanges(OATS, { ...d, kcal: '380' })).toEqual({ changed: { kcal: 380 }, problem: null });
    expect(valueChanges(OATS, { ...d, kcal: ' 372.0 ', sodium_mg: '5', fat: '7,5' })).toEqual({ changed: { sodium_mg: 5, fat: 7.5 }, problem: null });
  });

  it("says in app.'s words why it cannot be sent: a known value cleared, not a number", () => {
    const d = valuesDraft(OATS);
    expect(valueChanges(OATS, { ...d, protein: '' }).problem).toBe('Protein g: give a number (an unknown value cannot be set here).');
    expect(valueChanges(OATS, { ...d, fat: 'lots' }).problem).toBe('Fat g: give a number of 0 or more.');
    expect(valueChanges(OATS, { ...d, fat: '-1' }).problem).toBe('Fat g: give a number of 0 or more.');
    expect(typedNumber('12,5')).toBe(12.5);
    expect(typedNumber('1e3')).toBeNull();
  });

  it('builds the fields: the food, the changed values, the tick only when on', () => {
    expect(valuesFields(1, { kcal: 380, fat: 7.5 }, false)).toEqual({ id: '1', kcal: '380', fat: '7.5' });
    expect(valuesFields(1, { kcal: 380 }, true)).toEqual({ id: '1', kcal: '380', past: '1' });
    expect(BOWL.values_editable).toBe(false);
    expect(BOWL.recipe).toBe('C1');
  });
});

describe('the other forms', () => {
  it('sends the basics filled in, a tick only when on', () => {
    expect(basicsFields(6, 'Apple', false, true)).toEqual({ id: '6', name: 'Apple', hide: '1' });
    expect(basicsFields(3, 'Oat drink', true, false)).toEqual({ id: '3', name: 'Oat drink', drink: '1' });
  });

  it("checks a unit's weight is a number before sending (empty is the door's to refuse)", () => {
    expect(unitProblem('35', OATS)).toBeNull();
    expect(unitProblem('12,5', OATS)).toBeNull();
    expect(unitProblem('', OATS)).toBeNull();
    expect(unitProblem('abc', OATS)).toBe('Give its weight as a number above 0 and at most 2000 g.');
  });

  it('says a refusal next to its form', () => {
    expect(formOf('catalogue_values', {})).toBe('values');
    expect(formOf('catalogue_words', { act: 'add' })).toBe('word');
    expect(formOf('catalogue_words', { act: 'remove' })).toBe('words');
    expect(formOf('catalogue_barcode', {})).toBe('barcode');
    expect(formOf('catalogue_basics', {})).toBe('basics');
    expect(formOf('catalogue_unit', {})).toBe('unit');
    expect(formOf('catalogue_reviewed', {})).toBe('review');
    expect(formOf('lookup', {})).toBe('new');
    expect(formOf('undo', {})).toBeNull();
  });

  it("finds the look-up's question with its Yes and No, and the rows a save added", () => {
    const scan = JSON.parse(readFileSync(new URL('../../tests/samples/scan.json', import.meta.url), 'utf8'));
    const a = scan.saves.lookup;
    expect(lookupQuestion(a)).toEqual({ id: a.questions[0].id, yes: 'Yes', no: 'No' });
    expect(lookupQuestion({ questions: [] })).toBeNull();
    const after = { ...ALL, rows: [...ALL.rows, { ...ALL.rows[0]!, id: 99, ref: 'N99' }] };
    expect(addedIds(ALL, after)).toEqual([99]);
    expect(addedIds(ALL, ALL)).toEqual([]);
  });
});

// The scan sheet's plain rules (deploy 90), against the door's real answers in tests/samples/scan.json.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  afterBarcode,
  afterLabel,
  afterOff,
  cleanCode,
  closesSheet,
  failedWords,
  formFrom,
  labeladdBody,
  labelName,
  shrunkSize,
  typedNumber,
  type ReadAnswer,
} from './scan.js';

const SCAN = JSON.parse(readFileSync(new URL('../../tests/samples/scan.json', import.meta.url), 'utf8'));
const fields = (o: Record<string, string>) => ({ get: (k: string) => (k in o ? o[k] : null) });

describe('the digits', () => {
  it('takes 8 to 14 digits, leaving out spaces and dashes', () => {
    expect(cleanCode('4006040123456')).toBe('4006040123456');
    expect(cleanCode(' 4006 0401-23456 ')).toBe('4006040123456');
    expect(cleanCode('12345678')).toBe('12345678');
    expect(cleanCode('12345678901234')).toBe('12345678901234');
  });
  it('refuses anything else', () => {
    for (const x of ['', '1234567', '123456789012345', '40060401234a6', '4006040123456;', '٤٠٠٦٠٤٠١٢٣٤٥٦']) expect(cleanCode(x)).toBeNull();
  });
});

describe('what the sheet shows for each answer', () => {
  it('a food of the catalogue: its name and last amount, to log', () => {
    const s = afterBarcode('4006040123456', SCAN.barcode);
    expect(s).toEqual({ kind: 'found', code: '4006040123456', food: { food_id: 10, name: 'Oats', unit: 'g', amount: 100 } });
  });
  it('an unknown code: not in the catalogue yet', () => {
    expect(afterBarcode('4000000000000', SCAN.barcode_none)).toEqual({ kind: 'unknown', code: '4000000000000' });
  });
  it('Open Food Facts knows it: the form, filled, with the brand in the name, per 100 ml, source off, the barcode kept', () => {
    const { step, message } = afterOff('4012345678901', SCAN.off);
    expect(message).toBe('Check the values, give an amount to log it now, then Add.');
    expect(step).toEqual({
      kind: 'form',
      form: {
        name: 'Oat drink (Samplemarke)',
        basis: 'ml',
        values: { kcal: '46', protein: '1', fat: '1.5', carbs: '6.6', sat_fat: '', sugar_total: '4', fibre: '', salt_g: '0.1' },
        barcode: '4012345678901',
        source: 'off',
        note: "From Open Food Facts (other people's entries). Values per 100 ml. Correct anything that is off.",
      },
    });
  });
  it('Open Food Facts does not know it: why, and the label photo next', () => {
    const { step, message } = afterOff('4000000000000', SCAN.off_none);
    expect(step).toEqual({ kind: 'unknown', code: '4000000000000' });
    expect(message).toBe(`${SCAN.off_none.reason} Use Photo of the label.`);
  });
  it('a label read: the form to check, source label', () => {
    const { step } = afterLabel(null, SCAN.label);
    expect(step).toMatchObject({ kind: 'form', form: { name: 'Crunchy Granola (Testmarke)', basis: 'g', barcode: '', source: 'label' } });
    if (step.kind === 'form') expect(step.form.note).toBe('Values per 100 g. Correct anything that is off.');
  });
  it('a read that failed: the photos again, with why', () => {
    expect(afterLabel('4000000000000', SCAN.label_unreadable)).toEqual({
      step: { kind: 'photos', problem: SCAN.label_unreadable.reason },
      message: '',
    });
  });
  it('a refused photo or a failed call: the door’s words, or plain ones', () => {
    expect(failedWords(400, SCAN.label_refused)).toBe('A photo must be JPEG, PNG, WebP or GIF.');
    expect(failedWords(413, null)).toMatch(/too large/);
    expect(failedWords(502, {})).toBe('That did not work; try again in a moment.');
  });
});

describe('the form', () => {
  it('names a food as app.: the brand in brackets unless the name has it', () => {
    expect(labelName('Crunchy Granola', 'Testmarke')).toBe('Crunchy Granola (Testmarke)');
    expect(labelName('Testmarke Granola', 'testmarke')).toBe('Testmarke Granola');
    expect(labelName('Granola', null)).toBe('Granola');
    expect(labelName(null, 'Testmarke')).toBe('');
  });
  it('reads typed numbers with a comma or a point', () => {
    expect(typedNumber('4,5')).toBe(4.5);
    expect(typedNumber(' 17.8 ')).toBe(17.8);
    expect(typedNumber('')).toBeNull();
    expect(typedNumber(null)).toBeNull();
    expect(typedNumber('lots')).toBeNaN();
  });
  it('round-trips a read into the labeladd body', () => {
    const f = formFrom(SCAN.label as Extract<ReadAnswer, { ok: true }>, 'label', '4012345678901');
    const body = labeladdBody(fields({ name: f.name, basis: f.basis, source: f.source, barcode: f.barcode, ...f.values }));
    expect(body).toEqual({
      name: 'Crunchy Granola (Testmarke)', basis: 'g', source: 'label', barcode: '4012345678901',
      kcal: 452, protein: 9.5, fat: 17.8, sat_fat: 3.1, carbs: 61.2, sugar_total: 19, fibre: 6.4, salt_g: 0.3,
    });
  });
  it('sends the amount and time only with an amount; a bad barcode or time is left out; a non-number goes as typed', () => {
    const base = { name: 'X bar', kcal: '100', protein: '1', fat: '1', carbs: 'lots' };
    expect(labeladdBody(fields({ ...base, amount: '', time: '08:30' }))).not.toHaveProperty('time');
    expect(labeladdBody(fields({ ...base, amount: '45', time: '8:30', barcode: '12' }))).toMatchObject({ amount: 45, carbs: 'lots' });
    expect(labeladdBody(fields({ ...base, amount: '45', time: '8:30', barcode: '12' }))).not.toHaveProperty('barcode');
    expect(labeladdBody(fields({ ...base, amount: '45', time: '8:30' }))).not.toHaveProperty('time');
    expect(labeladdBody(fields({ ...base, basis: 'kg', source: 'x' }))).toMatchObject({ basis: 'g', source: 'label' });
    // a needed value left empty is left out: the door says what is missing
    expect(labeladdBody(fields({ name: 'X bar', protein: '1' }))).not.toHaveProperty('kcal');
  });
});

describe('the photos and the saves', () => {
  it('shrinks to at most 1600 px on the longer side, never larger', () => {
    expect(shrunkSize(4032, 3024)).toEqual({ width: 1600, height: 1200 });
    expect(shrunkSize(3024, 4032)).toEqual({ width: 1200, height: 1600 });
    expect(shrunkSize(800, 600)).toEqual({ width: 800, height: 600 });
  });
  it('closes the sheet once saved, not when refused (unless the food was added)', () => {
    expect(closesSheet(SCAN.saves.labeladd)).toBe(true);
    expect(closesSheet({ outcome: 'changed', head: 'Added Granola to your catalogue.' })).toBe(true);
    expect(closesSheet({ outcome: 'rejected', head: 'Nothing saved.' })).toBe(false);
    expect(closesSheet({ outcome: 'rejected', head: 'Added Granola to your catalogue, not logged.' })).toBe(true);
    expect(closesSheet(null)).toBe(false);
  });
});

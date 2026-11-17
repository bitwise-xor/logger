/**
 * Medical at logger. (deploy 106): the door's Reports, Tests over time and Medication reads (docs/API.md, "Medical (104)"), and the plain
 * rules the three pages need: their addresses (?open=, ?q=, ?t=), what changed in a form, the lines of a row, which form a save belongs
 * to. Plain TypeScript, so the tests need no browser; the state is reportspage.svelte.ts, testspage.svelte.ts and medspage.svelte.ts.
 * Nothing here (or in the pages) writes a value, a test name or a medicine to a log line.
 */
import type { ChartData } from './chart.js';
import type { FieldValues } from './saver.js';

/** H high, L low, A abnormal; N or null: none. */
export type Flag = 'H' | 'L' | 'A' | 'N' | null;

// ---- Reports ---------------------------------------------------------------------------------------------------------------------

export interface FlaggedChip {
  test_id: number;
  test: string;
  value: string;
  range: string;
  flag: Flag;
  flag_word: string | null;
}

export interface Flagged {
  report_id: number;
  ref: string;
  date: string;
  date_text: string;
  title: string;
  heading: string;
  hint: string;
  empty: string | null;
  chips: FlaggedChip[];
}

export interface ReportRow {
  id: number;
  ref: string;
  date: string;
  date_text: string;
  title: string;
  kind: 'lab' | 'imaging';
  provider: string | null;
  values: number;
  flagged: number;
}

export interface LabValue {
  id: number;
  ref: string;
  test_id: number;
  test: string;
  note: string | null;
  text: string;
  value: number | null;
  unit: string | null;
  range: string;
  flag: Flag;
  flag_word: string | null;
  site: string | null;
  printed: { value: string; unit: string; ref: string };
}

export interface OpenReport {
  id: number;
  ref: string;
  date: string;
  date_text: string;
  title: string;
  kind: 'lab' | 'imaging';
  provider: string | null;
  notes: string | null;
  values: LabValue[];
  empty: string | null;
  form: { collected: string; title: string; provider: string; notes: string };
  value_hint: string;
  report_hint: string;
}

export interface Labs {
  flagged: Flagged | null;
  reports: ReportRow[];
  empty: string | null;
  hint: string;
  open: OpenReport | null;
  limits: { value_max: number; unit_max: number; ref_max: number; title_max: number; provider_max: number; notes_max: number };
}

// ---- Tests over time -------------------------------------------------------------------------------------------------------------

export interface TestRef {
  id: number;
  name: string;
  unit: string | null;
  values: number;
}

export interface TestCard {
  id: string;
  title: string;
  small: string | null;
  stat: { text: string; bold: boolean }[];
  /** null: the thin cases (one value, one day): `note` says so. */
  chart: ChartData | null;
  legend: { key: string; text: string }[];
  note: string | null;
}

export interface TestHistoryRow {
  id: number;
  date: string;
  date_text: string;
  site: string | null;
  value: string;
  range: string;
  flag: Flag;
  flag_word: string | null;
  report_id: number;
  report_ref: string;
}

export interface Tests {
  q: string;
  placeholder: string;
  title: string | null;
  empty: string | null;
  tests: TestRef[];
  test: TestRef | null;
  card: TestCard | null;
  rows: TestHistoryRow[];
}

// ---- Medication ------------------------------------------------------------------------------------------------------------------

export interface Med {
  id: number;
  ref: string;
  name: string;
  ingredient: string | null;
  dose: string | null;
  frequency: string | null;
  indication: string | null;
  start: string | null;
  stop: string | null;
  start_text: string | null;
  stop_text: string | null;
  running: boolean;
  can_end: boolean;
}

export interface Meds {
  today: string;
  running: number;
  empty: string | null;
  hint: string;
  form_hint: string;
  meds: Med[];
  limits: { dose_max: number; frequency_max: number; indication_max: number };
}

// ---- addresses -------------------------------------------------------------------------------------------------------------------

/** ?open= as the door takes it ("R12", "r12" or "12"); anything else is none. */
export function askedOpen(x: string | null): number | null {
  const m = /^[Rr]?(\d{1,9})$/.exec(x?.trim() ?? '');
  return m && Number(m[1]) > 0 ? Number(m[1]) : null;
}

/** ?t= as the door takes it: a test's id, digits only; anything else is none. */
export function askedTest(x: string | null): number | null {
  const m = /^(\d{1,9})$/.exec(x?.trim() ?? '');
  return m && Number(m[1]) > 0 ? Number(m[1]) : null;
}

/** The search as the door takes it (cut at 60). */
export const askedQ = (x: string | null) => (x ?? '').trim().slice(0, 60);

/** The Reports page's address: /medical, with ?open=R12 for an open report. */
export const reportsHref = (open: number | null) => (open ? `/medical?open=R${open}` : '/medical');

/** A value's "Report" link, and a chip's or a value's link to its test: the tests tab with ?t= (and the search kept). */
export const reportLink = (reportId: number) => reportsHref(reportId);

export interface TestsView {
  q: string;
  t: number | null;
}

export function testsViewOf(params: URLSearchParams): TestsView {
  return { q: askedQ(params.get('q')), t: askedTest(params.get('t')) };
}

/** The Tests page's address: the defaults are left out (/medical/tests is the list, no search, no test). */
export function testsHref(v: Partial<TestsView>): string {
  const p = new URLSearchParams();
  const q = askedQ(v.q ?? '');
  if (q) p.set('q', q);
  if (v.t) p.set('t', String(v.t));
  const s = p.toString();
  return s ? `/medical/tests?${s}` : '/medical/tests';
}

/** The fields every save of the Reports page carries, so its answer brings the Reports as shown (view "labs", view_open). */
export function reportsView(open: number | null): FieldValues {
  const out: FieldValues = { view: 'labs' };
  if (open) out.view_open = `R${open}`;
  return out;
}

// ---- rows --------------------------------------------------------------------------------------------------------------------------

/** The letter to show for a flag (H, L, A), or null: a dash. */
export const flagLetter = (f: Flag | undefined): 'H' | 'L' | 'A' | null => (f === 'H' || f === 'L' || f === 'A' ? f : null);

/** "8 values · 3 flagged" (as the mockup's row on phones). */
export function reportLine(r: Pick<ReportRow, 'values' | 'flagged'>): string {
  const v = `${r.values} ${r.values === 1 ? 'value' : 'values'}`;
  return r.flagged ? `${v} · ${r.flagged} flagged` : v;
}

/** "5 values" / "1 value". */
export const valuesLine = (n: number) => `${n} ${n === 1 ? 'value' : 'values'}`;

/** A report's meta line in its box: "R4 · Zz Lab" or "R4". */
export const reportMeta = (r: Pick<OpenReport, 'ref' | 'provider'>) => [r.ref, r.provider].filter(Boolean).join(' · ');

/** What the chip says: "Ferritin 450 ng/mL H" (name, value as printed, flag letter). */
export const chipText = (c: FlaggedChip) => [c.test, c.value, flagLetter(c.flag)].filter(Boolean).join(' ');

/** The note line under a value's name: its note and, for imaging, the site. */
export const valueNote = (v: Pick<LabValue, 'note' | 'site'>) => [v.note, v.site].filter(Boolean).join(' · ');

/** "1000 IU · daily · for low vitamin D": dose, how often, why (each when given). */
export function medLine(m: Pick<Med, 'dose' | 'frequency' | 'indication'>): string {
  return [m.dose, m.frequency, m.indication ? `for ${m.indication}` : null].filter(Boolean).join(' · ');
}

/** "01.09.2026 to" (start; the running pill or the stop date follow). */
export const medFrom = (m: Pick<Med, 'start_text'>) => (m.start_text ? `${m.start_text} to` : 'to');

/** "n running" over the list. */
export const runningLine = (m: Pick<Meds, 'running'>) => `${m.running} running`;

// ---- forms -------------------------------------------------------------------------------------------------------------------------

export type ValueField = 'value' | 'unit' | 'ref';
export type ReportField = 'collected' | 'title' | 'provider' | 'notes';
export type MedField = 'dose' | 'frequency' | 'indication' | 'start' | 'stop';

/** What a value's form starts from: the value, the unit and the range as printed on the report. */
export const valueDraft = (v: Pick<LabValue, 'printed'>): Record<ValueField, string> => ({ value: v.printed.value, unit: v.printed.unit, ref: v.printed.ref });
export const reportDraft = (r: Pick<OpenReport, 'form'>): Record<ReportField, string> => ({ ...r.form });
/** What a course's form starts from: the stop empty means running. */
export const medDraft = (m: Pick<Med, 'dose' | 'frequency' | 'indication' | 'start' | 'stop'>): Record<MedField, string> => ({
  dose: m.dose ?? '',
  frequency: m.frequency ?? '',
  indication: m.indication ?? '',
  start: m.start ?? '',
  stop: m.stop ?? '',
});

/** Only the fields typed over (the door keeps one left out as it is); a cleared one is sent empty. Whitespace around is not a change. */
export function changedFields<K extends string>(was: Record<K, string>, now: Record<string, string>): Partial<Record<K, string>> {
  const out: Partial<Record<K, string>> = {};
  for (const k of Object.keys(was) as K[]) {
    const typed = (now[k] ?? '').trim();
    if (typed !== was[k].trim()) out[k] = typed;
  }
  return out;
}

export const valueFields = (id: number, changed: Partial<Record<ValueField, string>>): FieldValues => ({ id: String(id), ...changed });
export const reportFields = (id: number, changed: Partial<Record<ReportField, string>>): FieldValues => ({ id: String(id), ...changed });
export const medFields = (id: number, changed: Partial<Record<MedField, string>>): FieldValues => ({ id: String(id), act: 'save', ...changed });
export const endFields = (id: number): FieldValues => ({ id: String(id), act: 'end' });

/** Which form a save belongs to: its refusal is said next to it (a value's by its number). */
export function formOf(action: string, fields: FieldValues): string | null {
  const id = typeof fields.id === 'string' ? fields.id : '';
  switch (action) {
    case 'labs_value':
      return `value:${id}`;
    case 'labs_report':
      return 'report';
    case 'labs_med':
      return `med:${id}`;
    case 'log':
    case 'answer':
      return 'add';
    default:
      return null;
  }
}

/** The question of a typed course in an answer (tool "command_confirm": the read-back with Yes and No), or none. */
export function courseQuestion(a: { questions: { id: string; tool: string; read_back?: string | null; answers: { reply: string; label: string }[] }[] }) {
  const q = a.questions.find((x) => x.answers.some((y) => y.reply === 'yes') && x.answers.some((y) => y.reply === 'no'));
  if (!q) return null;
  return {
    id: q.id,
    readBack: q.read_back ?? '',
    yes: q.answers.find((x) => x.reply === 'yes')?.label ?? 'Yes',
    no: q.answers.find((x) => x.reply === 'no')?.label ?? 'No',
  };
}

/** The courses a save added (in the fresh list, not in the one shown before): a new course gets a blue edge. */
export function addedMeds(before: Meds | null, after: Meds): number[] {
  const had = new Set(before?.meds.map((m) => m.id));
  return after.meds.filter((m) => !had.has(m.id)).map((m) => m.id);
}

/** What the tests list shows for the test open: the list the door sent, or (a search with one match opens it) that test alone. */
export function listOf(list: Pick<Tests, 'tests' | 'test'>): TestRef[] {
  return list.tests.length || !list.test ? list.tests : [list.test];
}

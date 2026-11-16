/**
 * Display strings, the way app. writes them (core/app/todaypage.py), so the two show the same numbers: dates as dd.mm.,
 * times as hh:mm in Europe/Berlin, numbers with a thousands comma, rounded half to even as Python's round() does.
 */

const PARTS = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Berlin',
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
});

const CLOCK = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Berlin',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** "Mon 16.11." for a moment, in Berlin's calendar. */
export function dayLine(at: Date): string {
  const p = Object.fromEntries(PARTS.formatToParts(at).map((x) => [x.type, x.value]));
  return `${p.weekday} ${p.day}.${p.month}.`;
}

/** "Mon 16.11." for a logging day as the door sends it ("2026-11-16"). */
export function dayOf(iso: string): string {
  // Noon UTC is the same calendar day in Berlin, summer or winter.
  return dayLine(new Date(`${iso}T12:00:00Z`));
}

/** "05:40" for an ISO time (the door's are Berlin times with their offset); "" for none. */
export function hm(iso: string | null | undefined): string {
  if (!iso) return '';
  const at = new Date(iso);
  return Number.isNaN(at.getTime()) ? '' : CLOCK.format(at);
}

/** Python's round(): halves go to the even neighbour (round(700.5) == 700), so a number here is the one app. shows. */
export function roundHalfEven(value: number, digits = 0): number {
  const f = 10 ** digits;
  const x = value * f;
  const low = Math.floor(x);
  const rest = x - low;
  const r = rest > 0.5 ? low + 1 : rest < 0.5 ? low : low % 2 === 0 ? low : low + 1;
  return r / f;
}

const GROUPED = new Map<number, Intl.NumberFormat>();

/** A number as app. shows it (todaypage._n): "1,400", "82.4" with digits 1; "–" when there is none. */
export function n(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '–';
  let fmt = GROUPED.get(digits);
  if (!fmt) {
    fmt = new Intl.NumberFormat('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
    GROUPED.set(digits, fmt);
  }
  // + 0 turns -0 into 0
  return fmt.format(roundHalfEven(value, digits) + 0);
}

/** A measured value as typed (todaypage._plain): no thousands comma, no trailing zeros ("82.4", "118"). */
export function plain(value: number | null | undefined): string {
  return value === null || value === undefined ? '' : String(value);
}

/** A length of time as app. writes it (todaypage._hours): "7 h 20 min", minutes always two digits. */
export function hours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h} h ${String(m).padStart(2, '0')} min`;
}

/** A bar's fill in percent: 0 to 100, 0 without a target. */
export function pct(value: number | null | undefined, target: number | null | undefined): number {
  if (!target) return 0;
  return Math.max(0, Math.min(100, ((value ?? 0) / target) * 100));
}

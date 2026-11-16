/** Display strings: dates as the owner reads them (dd.mm., Europe/Berlin). */

const PARTS = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Berlin',
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
});

/** "Mon 16.11." for a moment, in Berlin's calendar. */
export function dayLine(at: Date): string {
  const p = Object.fromEntries(PARTS.formatToParts(at).map((x) => [x.type, x.value]));
  return `${p.weekday} ${p.day}.${p.month}.`;
}

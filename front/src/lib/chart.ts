/**
 * The chart part's geometry (deploy 92): app.'s drawChart (core/app/static/app.js) as plain functions, so the Svelte component
 * (components/chart/Chart.svelte) only draws what these return, and the tests need no browser. Nothing in here knows about
 * health: the door sends a chart as a description (docs/API.md, "Chart"), the same one app. puts into data-chart, and the
 * Health page, Trends and Gym all draw theirs with it.
 *
 * x is the day number from `start` (0 to days − 1); every mark of a chart shares the two scales. A point is [day, value, hover
 * text, base]: the text is what a tap or the mouse shows (a line's points have none), base lifts a bar (stacked bars).
 */

export type Mark = 'line' | 'dot' | 'ring' | 'bar';
export type Point = [number, number, (string | null)?, number?];

export interface Series {
  mark: Mark;
  /** The colour key: a, b (the two series colours), c (grey), w and r (amber). */
  cls: string;
  pts: Point[];
}

export interface ChartData {
  /** The first day, yyyy-mm-dd, and the number of days. */
  start: string;
  days: number;
  series: Series[];
  /** What the chart shows, in words (the picture's label for screen readers). */
  label: string;
  /** Dashed reference lines: [value, w (grey) | r (amber) | t (ink), label]. */
  lines?: [number, string, (string | null)?][];
  /** A fixed bottom or top of the scale. */
  min?: number;
  max?: number;
  /** Before and after the axis numbers (" h", "€"); decimals of the axis numbers. */
  prefix?: string;
  unit?: string;
  decimals?: number;
  /** A shaded band from .. to (null: the scale's end). */
  band?: [number | null, number | null];
  /** The value above each point (the last only when there are more than 8); the dates of the points on the axis. */
  pointLabels?: number | boolean;
  xAtPoints?: number | boolean;
  /** The axis dates with the year. */
  years?: number | boolean;
}

/** One thing to draw, in the order drawChart draws them (a series' line under its points). */
export type Shape =
  | { kind: 'line'; cls: string; points: string }
  | { kind: 'bar'; cls: string; x: number; y: number; w: number; h: number; tip: string | null }
  | { kind: 'dot' | 'ring'; cls: string; x: number; y: number; r: number; tip: string | null }
  | { kind: 'label'; x: number; y: number; text: string; anchor: Anchor };

export type Anchor = 'start' | 'middle' | 'end';

/** What a tap can hit: a mark's place and its text. */
export interface Hit {
  x: number;
  y: number;
  t: string;
  bar: boolean;
}

export interface Layout {
  W: number;
  H: number;
  L: number;
  R: number;
  band: { x: number; y: number; w: number; h: number } | null;
  ticks: { y: number; text: string }[];
  refs: { y: number; cls: string; text: string; x: number }[];
  xLabels: { x: number; text: string; anchor: Anchor }[];
  shapes: Shape[];
  hits: Hit[];
  /** A bar's width (a tap within it hits the bar). */
  bw: number;
}

export const HEIGHT = 190;
/** The narrowest a chart is drawn (app.'s 260 px): below that it is scaled down. */
export const MIN_WIDTH = 260;

/** About n round steps from lo to hi, covering both: 1, 2, 2.5 or 5 times a power of ten (app.js niceTicks). */
export function niceTicks(lo: number, hi: number, n: number): number[] {
  if (hi - lo < 1e-9) {
    lo -= 1;
    hi += 1;
  }
  const raw = (hi - lo) / n;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const m = raw / p;
  const step = (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
  const ticks: number[] = [];
  for (let v = Math.floor(lo / step) * step; v <= Math.ceil(hi / step) * step + step / 2; v += step) ticks.push(+v.toFixed(6));
  return ticks;
}

/** "18.10." (or "18.10.26" with years) for day i of a chart starting on start. */
export function dateAt(start: string, i: number, years = false): string {
  const [y = 2000, m = 1, d = 1] = start.split('-').map(Number);
  const at = new Date(Date.UTC(y, m - 1, d + i));
  const dd = String(at.getUTCDate()).padStart(2, '0');
  const mm = String(at.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}.${years ? String(at.getUTCFullYear()).slice(2) : ''}`;
}

/** An axis number as app. writes it: the decimals asked for, else as it is (JavaScript's own way, "2.5", "80"). */
const axisText = (o: ChartData, t: number) => `${o.prefix ?? ''}${o.decimals ? t.toFixed(o.decimals) : String(t)}${o.unit ?? ''}`;

const r1 = (v: number) => +v.toFixed(1);

/** The chart drawn at a width (the box's; at least MIN_WIDTH): null when it has no point at all ("No values in this range."). */
export function chartLayout(o: ChartData, width: number): Layout | null {
  const pts = o.series.flatMap((s) => s.pts);
  if (!pts.length) return null;
  const W = Math.max(MIN_WIDTH, Math.round(width) || 0);
  const H = HEIGHT;
  const L = 42;
  const R = 8;
  const T = o.pointLabels ? 22 : 8; // room for the top point's label
  const B = 22;
  const refs = o.lines ?? [];
  const ys: number[] = [
    ...pts.map((p) => p[1] + (p[3] ?? 0)),
    ...(o.band ?? []).flatMap((v) => (typeof v === 'number' ? [v] : [])),
    ...refs.map((l) => l[0]),
  ];
  const ticks = niceTicks(o.min ?? Math.min(...ys), o.max ?? Math.max(...ys), 4);
  const y0 = ticks[0]!;
  const y1 = ticks[ticks.length - 1]!;
  const bars = o.series.some((s) => s.mark === 'bar');
  const inset = bars ? 8 : 0;
  const x = (i: number) => L + inset + (o.days === 1 ? 0.5 : i / (o.days - 1)) * (W - L - R - 2 * inset);
  const y = (v: number) => T + (1 - (v - y0) / (y1 - y0)) * (H - T - B);

  let band: Layout['band'] = null;
  if (o.band) {
    const lo = o.band[0] ?? y0;
    const hi = o.band[1] ?? y1;
    band = { x: L, y: r1(y(hi)), w: W - L - R, h: r1(Math.max(0, y(lo) - y(hi))) };
  }

  // the dates on the axis: the first, the middle and the last (every day in a week); with xAtPoints the points' own, at most 6
  const at = o.xAtPoints ? [...new Set(pts.map((p) => p[0]))].sort((a, b) => a - b) : null;
  const labels = at
    ? at.length <= 6
      ? at
      : [at[0]!, at[Math.floor((at.length - 1) / 2)]!, at[at.length - 1]!]
    : o.days <= 7
      ? [...Array(o.days).keys()]
      : [0, Math.floor((o.days - 1) / 2), o.days - 1];
  const edge = (i: number, wide: boolean): Anchor => (wide && i === 0 ? 'start' : wide && i === o.days - 1 ? 'end' : 'middle');
  const xLabels = labels.map((i) => ({ x: r1(x(i)), text: dateAt(o.start, i, !!o.years), anchor: edge(i, at ? o.days > 1 : o.days > 7) }));

  const bw = Math.max(2, ((W - L - R) / o.days) * 0.62);
  const shapes: Shape[] = [];
  const hits: Hit[] = [];
  for (const se of o.series) {
    if (se.mark === 'line' && se.pts.length > 1) {
      shapes.push({ kind: 'line', cls: se.cls, points: se.pts.map((p) => `${r1(x(p[0]))},${r1(y(p[1]))}`).join(' ') });
    }
    for (const p of se.pts) {
      const tip = p[2] ?? null;
      if (tip) hits.push({ x: x(p[0]), y: y(p[1] + (se.mark === 'bar' ? (p[3] ?? 0) : 0)), t: tip, bar: se.mark === 'bar' });
      if (se.mark === 'bar') {
        const b0 = Math.max(p[3] ?? 0, y0);
        shapes.push({ kind: 'bar', cls: se.cls, x: r1(x(p[0]) - bw / 2), y: r1(y(b0 + p[1])), w: r1(bw), h: r1(y(b0) - y(b0 + p[1])), tip });
      } else if (se.mark === 'dot') {
        shapes.push({ kind: 'dot', cls: se.cls, x: r1(x(p[0])), y: r1(y(p[1])), r: 3.2, tip });
        if (o.pointLabels && (se.pts.length <= 8 || p === se.pts[se.pts.length - 1])) {
          shapes.push({ kind: 'label', x: r1(x(p[0])), y: r1(y(p[1]) - 8), text: p[1].toFixed(1), anchor: edge(p[0], o.days > 1) });
        }
      } else if (se.mark === 'ring') {
        shapes.push({ kind: 'ring', cls: se.cls, x: r1(x(p[0])), y: r1(y(p[1])), r: 3, tip });
      }
    }
  }

  return {
    W,
    H,
    L,
    R,
    band,
    ticks: ticks.map((t) => ({ y: r1(y(t)), text: axisText(o, t) })),
    refs: refs.map(([v, cls, txt]) => ({ y: r1(y(v)), cls, text: txt ?? String(v), x: W - R - 3 })),
    xLabels,
    shapes,
    hits,
    bw,
  };
}

/**
 * The mark a tap at (px, py) in the chart's own units hits: the nearest within 16 units (a bar: within its width, at any
 * height), or null (app.js showTip).
 */
export function nearestHit(hits: Hit[], px: number, py: number, bw: number): Hit | null {
  let best: Hit | null = null;
  let bd = 1e9;
  for (const m of hits) {
    const dx = Math.abs(m.x - px);
    const dy = m.bar ? 0 : Math.abs(m.y - py);
    const d = Math.hypot(dx, dy);
    const reach = m.bar ? Math.max(8, bw / 2 + 4) : 16;
    if (d <= reach && d < bd) {
      best = m;
      bd = d;
    }
  }
  return best;
}

/** The box of a mark's text: above the mark, below it when there is no room, never past the chart's sides. */
export function tipBox(m: Hit, W: number): { x: number; y: number; w: number; h: number } {
  const w = Math.min(W - 4, m.t.length * 6.3 + 14);
  const h = 20;
  const x = Math.max(2, Math.min(W - w - 2, m.x - w / 2));
  const y = m.y - h - 8 < 2 ? m.y + 10 : m.y - h - 8;
  return { x, y, w, h };
}

// ---- rows across the clock (the sleep times) -------------------------------------------------------------------------------

/** A row per date, the clock across 0 to 24 h (docs/API.md, "Times"): bands from .. to (minutes from that date's midnight), ticks. */
export interface ClockRows {
  days: number;
  empty: boolean;
  rows: {
    date: string;
    label: string | null;
    bands: { from: number; to: number; nap: boolean; tip: string }[];
    ticks: { at: number; nap: boolean; tip: string }[];
  }[];
}

export interface ClockLayout {
  W: number;
  H: number;
  grid: { x: number; y1: number; y2: number; text: string }[];
  rows: {
    y: number;
    label: { x: number; y: number; text: string } | null;
    bands: { x: number; y: number; w: number; h: number; nap: boolean; tip: string }[];
    ticks: { x: number; y1: number; y2: number; nap: boolean; tip: string }[];
  }[];
}

/** app.'s drawing of the rows (healthpage._times): sized for a phone, about 1:1 at 375 px, so the text stays readable. */
export function clockLayout(t: ClockRows): ClockLayout {
  const n = t.rows.length;
  const left = 40;
  const width = 320;
  const rh = 13;
  const top = 16;
  const x = (m: number) => r1(left + (width * m) / 1440);
  const grid = [0, 6, 12, 18, 24].map((h) => ({
    x: r1(left + (width * h) / 24),
    y1: top - 4,
    y2: top + n * rh,
    text: String(h).padStart(2, '0'),
  }));
  const rows = t.rows.map((row, i) => {
    const y = top + i * rh;
    return {
      y,
      label: row.label ? { x: left - 6, y: y + rh - 4, text: row.label } : null,
      bands: row.bands.map((b) => ({ x: x(b.from), y: y + 2, w: r1(Math.max(x(b.to) - x(b.from), 1.5)), h: rh - 4, nap: b.nap, tip: b.tip })),
      ticks: row.ticks.map((k) => ({ x: x(k.at), y1: y + 1, y2: y + rh - 1, nap: k.nap, tip: k.tip })),
    };
  });
  return { W: left + width + 8, H: top + n * rh + 4, grid, rows };
}

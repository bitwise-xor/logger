/**
 * The More page's Usage (deploy 108) from GET /api/v1/usage?r=7|30|all (docs/API.md, "More (107)"): the range asked, the door's
 * shapes and the few words the page puts together (tiles, kind names, a message's line). Plain TypeScript, so the tests need no
 * browser. The cost chart is the door's own description of stacked bars, drawn by the chart part (chart.ts).
 */
import type { ChartData } from './chart.js';

export type Range = '7' | '30' | 'all';
export const RANGES: Range[] = ['7', '30', 'all'];

/** ?r= as the door takes it; anything else is dropped (the door's own default is 7 days). */
export const askedRange = (x: string | null): Range | undefined => (RANGES as string[]).includes(x ?? '') ? (x as Range) : undefined;

/** A range chip's address: 7 days is the page without a question. */
export const usageHref = (r: string): string => (r === '7' ? '/usage' : `/usage?r=${encodeURIComponent(r)}`);

export interface Kind {
  kind: string;
  calls: number;
  tokens_in: number;
  tokens_out: number;
  tokens_known: boolean;
  tokens_in_text: string;
  tokens_out_text: string;
  usd: number;
  usd_text: string;
}

export interface Top {
  at: string;
  at_text: string;
  kind: string;
  text: string | null;
  private: boolean;
  models: string[];
  models_text: string;
  usd: number;
  usd_text: string;
  escalated: boolean;
}

export interface Usage {
  r: string;
  ranges: { r: string; label: string; current: boolean }[];
  start: string;
  end: string;
  days: number;
  first: string | null;
  since: string;
  tiles: {
    calls: number;
    usd: number;
    usd_text: string;
    per_message: number | null;
    per_message_text: string;
    messages: number;
    tokens_in: number;
    tokens_out: number;
    tokens_text: string;
    tokens_known: boolean;
    tokens_note: string | null;
  };
  chart: ChartData | null;
  empty: string;
  legend: { key: string; text: string }[];
  kinds: Kind[];
  all: Kind;
  kinds_note: string | null;
  pushes: number;
  pushes_text: string;
  top: Top[];
  note: string;
}

export interface Tile {
  key: string;
  label: string;
  value: string;
  sub: string;
}

/** The four tiles in the door's order: AI calls, Cost, Per message, Tokens in / out. */
export function tilesOf(u: Pick<Usage, 'tiles'>): Tile[] {
  const t = u.tiles;
  return [
    { key: 'calls', label: 'AI calls', value: t.calls.toLocaleString('en-US'), sub: 'all kinds' },
    { key: 'cost', label: 'Cost', value: t.usd_text, sub: 'paid to the AI' },
    { key: 'per_message', label: 'Per message', value: t.per_message_text, sub: t.messages ? `${t.messages} ${t.messages === 1 ? 'message' : 'messages'}` : 'no typed messages' },
    { key: 'tokens', label: 'Tokens in / out', value: t.tokens_text, sub: !t.tokens_known && t.tokens_note ? t.tokens_note : 'read / written' },
  ];
}

/** "Food look-up" for the door's "food look-up". */
export const kindName = (kind: string): string => (kind ? kind.charAt(0).toUpperCase() + kind.slice(1) : kind);

/** A row of "By kind", with the numbers as the door writes them. */
export const kindCells = (k: Kind): string[] => [kindName(k.kind), String(k.calls), k.tokens_in_text, k.tokens_out_text, k.usd_text];

/** A costly message's line under its words: "Tue 17.11. 12:24 · message · Haiku + Sonnet". */
export const topLine = (t: Pick<Top, 'at_text' | 'kind' | 'models_text'>): string => [t.at_text, t.kind, t.models_text].filter(Boolean).join(' · ');

/** What a costly call shows as its words: the door's, "private" for a private entry (a pill, never words), or none. */
export const topWords = (t: Pick<Top, 'text' | 'private'>): { words: string | null; private: boolean } =>
  t.private ? { words: null, private: true } : { words: t.text?.trim() ? t.text : null, private: false };

export const ESCALATED = 'read again by the larger model';

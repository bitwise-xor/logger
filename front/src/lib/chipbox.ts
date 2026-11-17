/**
 * The boxes under Today's chips (deploy 117): an Again chip's amount part, or a usual meal's "…", opens a small box to log it with
 * another amount, at another time, or (a usual meal) with only some of its foods. What the boxes send and what a usual meal becomes,
 * in plain TypeScript, so the unit tests need no browser. The saved usual meal itself is not changed by them.
 */
import type { Nutrients, UsualItem } from './day.js';
import { parseAmount } from './food.js';
import { n } from './format.js';
import type { FieldValues } from './saver.js';

/** A food of the usual meal's box: ticked or not, and its amount as typed. */
export interface ItemPick {
  item_id: number;
  on: boolean;
  amount: string;
}

/** The box as it opens: every food ticked, at its saved amount. */
export const startPicks = (items: UsualItem[]): ItemPick[] => items.map((i) => ({ item_id: i.item_id, on: true, amount: String(i.amount) }));

/** Log may be pressed: at least one food ticked, and every ticked one with an amount above 0. */
export const ready = (picks: ItemPick[]) => picks.some((p) => p.on) && picks.every((p) => !p.on || parseAmount(p.amount) !== null);

/**
 * What the ticked foods become: each food's nutrients scaled by its new amount over its saved one; null when a ticked amount is
 * not a number above 0 (or none is ticked).
 */
export function becomes(items: UsualItem[], picks: ItemPick[]): Nutrients | null {
  if (!ready(picks)) return null;
  const sum: Nutrients = { kcal: 0, protein: 0, fat: 0, carbs: 0 };
  for (const p of picks) {
    const item = items.find((i) => i.item_id === p.item_id);
    if (!p.on || !item) continue;
    const k = item.amount > 0 ? parseAmount(p.amount)! / item.amount : 0;
    sum.kcal += item.nutrients.kcal * k;
    sum.protein += item.nutrients.protein * k;
    sum.fat += item.nutrients.fat * k;
    sum.carbs += item.nutrients.carbs * k;
  }
  return sum;
}

/** "Becomes 412 kcal · P 30 · F 6 · C 52 g", or what is missing. */
export function becomesLine(items: UsualItem[], picks: ItemPick[]): string {
  if (!picks.some((p) => p.on)) return 'Tick at least one food.';
  const x = becomes(items, picks);
  return x ? `${n(x.kcal)} kcal · P ${n(x.protein)} · F ${n(x.fat)} · C ${n(x.carbs)} g` : 'Give each ticked food an amount above 0.';
}

/** The usual save's fields (saves.ts): the meal, the ticked foods as item_id and amount pairs in their order, the time (none: now). */
export function usualFields(meal_id: number, picks: ItemPick[], time: string): FieldValues {
  const on = picks.filter((p) => p.on);
  const fields: FieldValues = {
    meal_id: String(meal_id),
    item_id: on.map((p) => String(p.item_id)),
    amount: on.map((p) => String(parseAmount(p.amount) ?? p.amount.trim())),
  };
  if (time) fields.time = time;
  return fields;
}

/** The again save's fields: the food, the amount (a comma as a point) and the time (none: now). */
export function againFields(food_id: number, amount: string, time: string): FieldValues {
  const fields: FieldValues = { food_id: String(food_id), amount: String(parseAmount(amount) ?? amount.trim()) };
  if (time) fields.time = time;
  return fields;
}

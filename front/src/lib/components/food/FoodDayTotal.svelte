<script lang="ts">
  import type { FoodDay } from '#lib/food.js';
  import { anyUnknown, dayCard, type Cell } from '#lib/foodvalues.js';

  // Web 73, the phone (and tablet): the day's total against the daily budget after the rows, one row per value (the four macros in
  // Macros: the other six are hidden by CSS), the difference with its percent under it. The PC has the table's closing rows instead.
  let { day }: { day: FoodDay } = $props();
  const rows = $derived(dayCard(day));
  const unknownMacros = $derived(anyUnknown(day, 'macros'));
  const unknownAll = $derived(anyUnknown(day, 'all'));
  const toneClass = (c: Cell) => (c.tone === 'amber' ? 'text-amber' : c.tone === 'muted' ? 'text-muted' : '');
  const cell = 'num w-[72px] shrink-0 text-right whitespace-nowrap';
</script>

<section aria-labelledby="day-total-h" class="flex flex-col rounded-card border border-line bg-panel px-3 pt-2.5 pb-3 desktop:hidden" data-day-card>
  <h2 id="day-total-h" class="m-0 mb-1 text-[15px] font-semibold">Day total</h2>
  <div class="flex gap-2 py-1 text-xs font-medium text-muted" aria-hidden="true">
    <span class="min-w-0 flex-1"></span>
    <span class="w-[72px] shrink-0 text-right">Total</span>
    <span class="w-[72px] shrink-0 text-right">Budget</span>
    <span class="w-[72px] shrink-0 text-right">Difference</span>
  </div>
  {#each rows as r (r.key)}
    <div class="flex items-baseline gap-2 border-t border-line py-1.5 text-[13px] {r.macro ? '' : 'macros:hidden'}" data-day-card-row={r.key}>
      <span class="min-w-0 flex-1 {r.quiet ? 'pl-3 text-muted' : ''}">{r.name} <span class="text-[11px] text-muted">{r.unit}</span></span>
      <span class="{cell} {toneClass(r.total)}" data-card-total>{r.total.text}</span>
      <span class="{cell} text-muted" data-card-budget>{r.budget.text}</span>
      <span class="{cell} flex flex-col items-end {toneClass(r.diff)}" data-card-diff
        ><span class="font-medium">{r.diff.text}</span>{#if r.pct}<span class="text-xs" data-card-pct>{r.pct.text}</span>{/if}</span
      >
    </div>
  {/each}
  <p class="m-0 mt-2 border-t border-line pt-2 text-xs text-muted" data-day-foot>
    Difference is the total minus the daily budget, as an amount and in percent of the budget: − is under it, + is over it, and – means no
    budget is set.
    <span class={unknownMacros ? '' : unknownAll ? 'hidden allvalues:inline' : 'hidden'}
      ><span class="text-amber">?</span> means the food has no value for it. <span class="text-amber">≥</span> means the total leaves those foods out.</span
    >
  </p>
</section>

<script lang="ts">
  import { macroLine, perLine, statsLine, type CatalogueRow } from '#lib/catalogue.js';
  import { getCataloguePage } from '#lib/cataloguepage.svelte.js';

  // A food of the catalogue (deploy 105, the mockup's row): its number, name, the pills "review" and "drink", the words you call it, kcal
  // · P · F · C per 100 g or ml, and from the tablet width Eaten, Last and Added on the right. A tap opens its box (under the row on
  // phones and tablets, beside the list on the PC); a second tap closes it.
  let { r }: { r: CatalogueRow } = $props();
  const page = getCataloguePage();
  const open = $derived(page.view.food === r.id);
  const fresh = $derived(page.fresh === r.id);
  const pill = 'rounded-chip px-[7px] py-px text-xs font-medium';
</script>

<button
  type="button"
  aria-expanded={open}
  class="grid min-h-14 w-full cursor-pointer grid-cols-[44px_minmax(0,1fr)] items-start gap-x-2 border-0 px-3 py-2.5 text-left text-text transition-colors duration-500 tablet:grid-cols-[52px_minmax(0,1fr)_auto] tablet:gap-x-3 {open
    ? 'bg-blue-bg'
    : 'bg-transparent hover:bg-panel2'} {fresh ? 'shadow-[inset_3px_0_0_var(--color-blue)]' : ''}"
  onclick={() => page.toggle(r.id)}
  data-food-row={r.id}
  data-fresh={fresh ? '' : undefined}
>
  <span class="num pt-0.5 text-[13px] text-muted" data-food-ref>{r.ref}</span>
  <span class="flex min-w-0 flex-col gap-0.5">
    <span class="flex flex-wrap items-center gap-x-2 gap-y-1">
      <span class="font-medium break-words" data-food-name>{r.name}</span>
      {#if r.review}<span class="{pill} bg-amber-bg text-amber" data-pill="review">review</span>{/if}
      {#if r.drink}<span class="{pill} bg-blue-bg text-blue" data-pill="drink">drink</span>{/if}
    </span>
    {#if r.aliases.length}<span class="text-[13px] break-words text-muted" data-food-words>{r.aliases.join(', ')}</span>{/if}
    <span class="num text-[13px] tablet:hidden" data-food-macros>{macroLine(r)} <span class="text-muted">{perLine(r)}</span></span>
  </span>
  <span class="hidden flex-col items-end gap-0.5 text-right tablet:flex">
    <span class="num text-[13px] whitespace-nowrap" data-food-macros-wide>{macroLine(r)} <span class="text-muted">{perLine(r)}</span></span>
    <span class="num text-xs whitespace-nowrap text-muted" data-food-stats>{statsLine(r)}</span>
  </span>
</button>

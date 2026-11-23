<script lang="ts">
  import { tiles, type FoodDay } from '#lib/food.js';
  import { extraTiles } from '#lib/foodvalues.js';

  let { day }: { day: FoodDay } = $props();
  const list = $derived(tiles(day));
  const extra = $derived(extraTiles(day));
</script>

<!-- The four totals against the targets (the mockup's tiles): two by two on the phone, one row on the PC with what is left. -->
<section aria-label="Totals against your targets" class="grid grid-cols-2 gap-2 desktop:grid-cols-4 desktop:gap-3" data-card="tiles">
  {#each list as t (t.key)}
    <div class="flex flex-col gap-1.5 rounded-card border border-line bg-panel px-3 py-2.5 desktop:px-3.5 desktop:py-3" data-tile={t.key}>
      <span class="text-xs text-muted">{t.name}</span>
      <span class="flex flex-wrap items-baseline gap-x-1 gap-y-0.5 desktop:gap-x-1.5">
        <strong class="num text-[22px] leading-none font-medium tracking-[-0.02em] desktop:text-2xl" data-tile-value>{t.value}</strong>
        {#if t.target}<span class="num text-[11px] whitespace-nowrap text-muted desktop:text-xs">/ {t.target}</span>{/if}
      </span>
      <div class="h-1.5 overflow-hidden rounded-[3px] bg-track">
        <div class="h-1.5 rounded-[3px] bg-text transition-[width] duration-300" style="width: {t.pct.toFixed(1)}%"></div>
      </div>
      <span class="hidden text-xs text-muted desktop:block" data-tile-left>{t.left}</span>
    </div>
  {/each}
</section>

<!-- Web 73, All values: the six other tracked values (three by two on the phone, one row of six on the PC); a total that leaves foods
     without a value out reads "at least" and says so in amber. Hidden in Macros by CSS (no flash: static/theme.js). -->
<section aria-label="The other tracked values" class="grid grid-cols-3 gap-2 macros:hidden desktop:grid-cols-6 desktop:gap-3" data-card="extra-tiles">
  {#each extra as t (t.key)}
    <div class="flex min-w-0 flex-col gap-1 rounded-card border border-line bg-panel px-2.5 py-2 desktop:gap-1.5 desktop:px-3 desktop:py-2.5" data-extra-tile={t.key}>
      <span class="text-xs text-muted">{t.name}</span>
      {#if t.atLeast}<span class="text-[11px] leading-none text-muted desktop:hidden">at least</span>{/if}
      <span class="flex flex-wrap items-baseline gap-x-1 gap-y-0.5 desktop:gap-x-1.5">
        {#if t.atLeast}<span class="hidden text-xs text-muted desktop:inline">at least</span>{/if}
        <strong class="num text-base leading-[1.1] font-medium tracking-[-0.01em] desktop:text-[17px]" data-extra-value>{t.value}</strong>
        {#if t.target}<span class="num text-[11px] whitespace-nowrap text-muted desktop:text-xs">{t.target}</span>{/if}
      </span>
      {#if t.pct !== null}
        <div class="h-1 overflow-hidden rounded-sm bg-track">
          <div class="h-1 rounded-sm bg-text transition-[width] duration-300" style="width: {t.pct.toFixed(1)}%"></div>
        </div>
      {/if}
      <span class="text-[11px] desktop:text-xs {t.warn ? 'text-amber' : 'text-muted'}" data-extra-note>{t.note}</span>
    </div>
  {/each}
</section>

<script lang="ts">
  import { n, pct } from '#lib/format.js';
  import { kcalLeft, macroBars, macroPie, type Day } from '#lib/day.js';
  import MacroPie from '#lib/components/today/MacroPie.svelte';
  import { getToday } from '#lib/today.svelte.js';

  let { day, foodHref }: { day: Day; foodHref: string } = $props();
  const today = getToday();

  const e = $derived(day.energy);
  const left = $derived(kcalLeft(e));
  // Bars: kcal in the text colour (the mockup), protein, fat and carbs in the pie's colours with their share of the kcal, so
  // they are its legend (the owner, 16.11.2026); then water. The pie: kcal from the macros, none before anything is eaten.
  const bars = $derived(macroBars(e));
  const pie = $derived(macroPie(e));
</script>

<section aria-labelledby="energy-h" class="flex flex-col gap-3 rounded-card border border-line bg-panel p-3 desktop:p-3.5" data-card="energy">
  <div class="flex items-baseline gap-2">
    <h2 id="energy-h" class="m-0 flex-1 text-[13px] font-medium text-muted">Energy against today's targets</h2>
    <a href={foodHref} class="-my-3 inline-flex min-h-11 items-center font-medium no-underline desktop:hidden">Food day</a>
  </div>
  <div class="flex items-center gap-3">
    <div class="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-1">
      <strong class="num text-[40px] leading-none font-medium tracking-[-0.03em]" data-kcal-left>{left.big}</strong>
      <span class="text-muted">{left.after}{#if left.target}{' '}<span class="num">{left.target}</span>{/if}</span>
    </div>
    {#if pie}<MacroPie kcal={pie.kcal} slices={pie.slices} />{/if}
  </div>
  {#each bars as b (b.name)}
    <div class="flex flex-col gap-1.5" data-macro={b.name}>
      <div class="flex justify-between gap-2 text-[13px]">
        <span class="flex items-center gap-1.5"
          >{#if b.key}<span aria-hidden="true" class="size-2 rounded-full" style="background: var(--macro-{b.key})"></span>{/if}{b.name}</span
        >
        <span class="num text-muted"
          >{n(b.value)}{b.target ? ` / ${n(b.target)}` : ''} {b.unit}{#if b.share}<span data-share>{` · ${b.share}`}</span>{/if}</span
        >
      </div>
      {#if b.target}
        <div class="h-1.5 overflow-hidden rounded-[3px] bg-track">
          <div class="h-1.5 rounded-[3px] {b.key ? '' : 'bg-text'}" style="width: {pct(b.value, b.target).toFixed(1)}%{b.key ? `; background: var(--macro-${b.key})` : ''}"></div>
        </div>
      {/if}
    </div>
  {/each}
  <div class="flex items-center gap-2.5">
    <div class="flex flex-1 flex-col gap-1.5">
      <div class="flex justify-between text-[13px]">
        <span>Water</span>
        <span class="num text-muted" data-water>
          {n(day.water.ml)}{day.water.target_ml ? ` / ${n(day.water.target_ml)}` : ''} ml
        </span>
      </div>
      {#if day.water.target_ml}
        <div class="h-1.5 overflow-hidden rounded-[3px] bg-track">
          <div class="h-1.5 rounded-[3px] bg-text" style="width: {pct(day.water.ml, day.water.target_ml).toFixed(1)}%"></div>
        </div>
      {/if}
    </div>
    {#if !day.past}
      <form method="POST" action="?/water" class="m-0" onsubmit={today.submit('water', 'water')}>
        <input type="hidden" name="ml" value={day.water.glass_ml} />
        <button
          type="submit"
          disabled={today.busy.water}
          class="min-h-11 cursor-pointer rounded-lg border border-line bg-panel2 px-3 font-medium whitespace-nowrap text-text disabled:opacity-60 desktop:min-h-9"
          >+ {n(day.water.glass_ml)} ml</button
        >
      </form>
    {/if}
  </div>
  <a href={foodHref} class="hidden font-medium no-underline desktop:inline">Food day</a>
</section>

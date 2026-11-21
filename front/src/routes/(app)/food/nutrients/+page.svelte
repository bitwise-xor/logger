<script lang="ts">
  import ProblemCard from '#lib/components/ProblemCard.svelte';
  import DaySwitch from '#lib/components/food/DaySwitch.svelte';
  import FoodHeader from '#lib/components/food/FoodHeader.svelte';
  import { foodDayHref } from '#lib/food.js';
  import {
    details,
    foodAmount,
    foodLine,
    foodsBy,
    libraryHref,
    lineView,
    mealsBy,
    nutrientsHref,
    periodLinks,
    periodNote,
    periodSpan,
    PERIODS,
    type NutrientKey,
  } from '#lib/nutrients.js';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();

  // The Food space's Nutrients tab (21.11.2026, idea 64): every tracked value of what was eaten on a day, or the average of 7 or 30
  // days. The switch (‹ day ›, a date field) and the period chips; then the lines against their targets (protein and fibre to reach,
  // the rest to stay under; over is said in words, not a colour, as the Food day's tiles), a total made with foods that have no value
  // marked "at least" with how many; a tap on a line sorts the foods (and the meals) by their share of it. A food opens in place: its
  // values for the amount eaten and per 100 g or ml, its source, a link to it in Library > Foods. Read only.
  const x = $derived(data.nutrients);
  const links = $derived(x ? periodLinks(x) : null);
  let sel = $state<NutrientKey | null>(null);
  let open = $state<number | null>(null);
  // another day or period: nothing picked, nothing open
  $effect.pre(() => {
    void data.nutrients;
    sel = null;
    open = null;
  });

  const lines = $derived(x ? x.nutrients.map(lineView) : []);
  const selLine = $derived(x && sel ? x.nutrients.find((l) => l.key === sel) : undefined);
  const foods = $derived(x ? foodsBy(x, sel) : []);
  const meals = $derived(x ? mealsBy(x, sel) : []);
  const note = $derived(x ? periodNote(x) : null);
  const name = (s: string) => s.replace(/^of which /, '').replace(/^./, (c) => c.toUpperCase());

  // the bar's colour: the macro colours of the Energy card for protein, fat and carbs (and their "of which"), the ink for the rest
  const COLOUR: Partial<Record<NutrientKey, string>> = { protein: 'protein', fat: 'fat', sat_fat: 'fat', carbs: 'carbs', sugar_total: 'carbs' };
  const card = 'flex flex-col overflow-hidden rounded-card border border-line bg-panel';
  const head = 'm-0 text-[15px] font-semibold';
  const chip = 'inline-flex min-h-11 items-center rounded-full border px-3.5 text-sm no-underline desktop:min-h-9';
</script>

<svelte:head><title>Nutrients · Food · Logger</title></svelte:head>

<FoodHeader on="nutrients" day={x?.past ? x.day : null} />

{#if x && links}
  <div class="flex flex-col gap-2 desktop:flex-row desktop:items-center desktop:gap-4">
    <div class="min-w-0 desktop:flex-none">
      <DaySwitch
        day={x.day}
        today={x.today}
        past={x.past}
        before={links.before}
        after={links.after}
        hrefFor={(d) => nutrientsHref(d, x.days, x.today)}
        text={periodSpan(x)}
        beforeLabel={x.per_day ? `The ${x.days} days before` : 'The day before'}
        afterLabel={x.per_day ? `The ${x.days} days after` : 'The day after'}
      />
    </div>
    <nav aria-label="Period" class="flex gap-1.5" data-periods>
      {#each PERIODS as p (p)}
        <a
          href={nutrientsHref(x.past ? x.day : null, p, x.today)}
          aria-current={p === x.days ? 'page' : undefined}
          class="{chip} {p === x.days ? 'border-text bg-text font-medium text-bg' : 'border-line bg-panel text-text hover:bg-panel2'}"
          data-period={p}>{p === 1 ? '1 day' : `${p} days`}</a
        >
      {/each}
    </nav>
  </div>
  {#if note}<p class="m-0 text-[13px] text-muted" data-period-note>{note}</p>{/if}
{/if}

{#if !x}
  <ProblemCard kind={data.problem ?? 'trouble'} appHref="{data.appUrl}/web/food" />
{:else}
  <main class="flex flex-col gap-3 desktop:grid desktop:grid-cols-[minmax(0,440px)_minmax(0,1fr)] desktop:items-start desktop:gap-4">
    <div class="flex min-w-0 flex-col gap-3">
      <section aria-labelledby="lines-h" class={card} data-card="nutrients">
        <div class="flex items-baseline justify-between gap-2 px-3 pt-3 pb-1 desktop:px-3.5">
          <h2 id="lines-h" class={head}>{x.per_day ? 'Per day' : 'This day'}</h2>
          <span class="text-[13px] text-muted">tap one to see where it came from</span>
        </div>
        {#each lines as l (l.key)}
          {@const on = sel === l.key}
          <button
            type="button"
            class="flex min-h-11 w-full cursor-pointer flex-col gap-1 border-0 border-t border-line px-3 py-2 text-left text-text desktop:px-3.5 {on
              ? 'bg-blue-bg'
              : 'bg-transparent hover:bg-panel2'} {l.sub ? 'pl-7 desktop:pl-8' : ''}"
            aria-pressed={on}
            onclick={() => (sel = on ? null : l.key)}
            data-line={l.key}
          >
            <span class="flex items-baseline justify-between gap-2 text-sm">
              <span class={l.sub ? 'text-muted' : 'font-medium'}>{l.label}</span>
              <span class="num text-right"
                ><span data-line-value>{l.value}</span>{#if l.target}<span class="text-muted">{' '}{l.target}</span>{/if}</span
              >
            </span>
            {#if l.target}
              <span class="h-1.5 overflow-hidden rounded-[3px] bg-track" aria-hidden="true">
                <span
                  class="block h-1.5 rounded-[3px] {COLOUR[l.key] ? '' : 'bg-text'}"
                  style="width: {l.pct.toFixed(1)}%{COLOUR[l.key] ? `; background: var(--macro-${COLOUR[l.key]})` : ''}"
                ></span>
              </span>
            {/if}
            {#if l.unknown || l.extra || l.gap}
              <span class="flex justify-between gap-2 text-xs text-muted">
                <span>{#if l.unknown}<span class="text-amber" data-unknown>{l.unknown}</span>{:else if l.extra}<span class="num">{l.extra}</span>{/if}</span>
                <span class="num" data-gap>{l.gap}</span>
              </span>
            {/if}
          </button>
        {/each}
      </section>

      {#if meals.length}
        <section aria-labelledby="meals-h" class={card} data-card="meals">
          <h2 id="meals-h" class="{head} px-3 pt-3 pb-1 desktop:px-3.5">{selLine ? `${name(selLine.label)} by meal` : 'Calories by meal'}</h2>
          {#each meals as m (m.meal)}
            <a href="{foodDayHref(x.day, x.today)}#meal-{m.meal}" class="flex min-h-11 flex-col justify-center gap-1 border-t border-line px-3 py-1.5 text-text no-underline hover:bg-panel2 desktop:px-3.5" data-meal={m.meal}>
              <span class="flex justify-between gap-2 text-sm"><span>{m.label}</span><span class="num text-muted">{m.text}</span></span>
              <span class="h-1 overflow-hidden rounded-[2px] bg-track" aria-hidden="true"><span class="block h-1 rounded-[2px] bg-text" style="width: {m.share.toFixed(1)}%"></span></span>
            </a>
          {/each}
        </section>
      {/if}
    </div>

    <section aria-labelledby="foods-h" class={card} data-card="foods">
      <div class="flex flex-wrap items-baseline justify-between gap-x-2 px-3 pt-3 pb-1 desktop:px-3.5">
        <h2 id="foods-h" class={head} data-foods-title>{selLine ? `${name(selLine.label)}: largest share first` : 'Foods eaten'}</h2>
        <span class="text-[13px] text-muted">{selLine ? (x.per_day ? `of the ${x.days} days` : 'of the day') : 'most kcal first'}</span>
      </div>
      {#if !foods.length}
        <p class="m-0 border-t border-line px-3 py-3 text-muted desktop:px-3.5" data-foods-none>
          {x.per_day ? `Nothing logged in these ${x.days} days.` : `Nothing logged ${x.past ? 'on this day' : 'yet today'}.`}
        </p>
      {/if}
      {#each foods as f (f.food.food_id)}
        {@const isOpen = open === f.food.food_id}
        <div class="border-t border-line {isOpen ? 'bg-panel2' : ''}" data-food={f.food.ref}>
          <button
            type="button"
            class="flex min-h-[52px] w-full cursor-pointer flex-col gap-0.5 border-0 bg-transparent px-3 py-2 text-left text-text hover:bg-panel2 desktop:px-3.5"
            aria-expanded={isOpen}
            onclick={() => (open = isOpen ? null : f.food.food_id)}
          >
            <span class="flex items-baseline justify-between gap-2">
              <span class="min-w-0 break-words {isOpen ? 'font-medium' : ''}">{f.food.name}</span>
              <span class="num shrink-0 text-xs whitespace-nowrap text-muted">{foodAmount(f.food)}</span>
            </span>
            {#if sel}
              <span class="num text-[13px] {f.value === null ? 'text-amber' : 'text-text'}" data-share>{f.text}</span>
              <span class="h-1 overflow-hidden rounded-[2px] bg-track" aria-hidden="true"><span class="block h-1 rounded-[2px] bg-text" style="width: {f.share.toFixed(1)}%"></span></span>
            {:else}
              <span class="num text-xs text-muted" data-food-line>{foodLine(f.food.values)}</span>
            {/if}
          </button>
          {#if isOpen}
            <div class="flex flex-col gap-2 px-3 pb-3 desktop:px-3.5" data-food-details>
              <table class="w-full border-collapse text-[13px]">
                <thead>
                  <tr class="text-xs text-muted">
                    <th class="py-1 text-left font-medium"></th>
                    <th class="py-1 text-right font-medium">{x.per_day ? 'Eaten' : 'As eaten'} <span class="num">{foodAmount({ ...f.food, entries: 1 })}</span></th>
                    <th class="py-1 text-right font-medium">Per <span class="num">100 {f.food.unit}</span></th>
                  </tr>
                </thead>
                <tbody>
                  {#each details(f.food, x.nutrients) as d (d.key)}
                    <tr class="border-t border-line {d.key === sel ? 'font-medium' : ''}" data-detail={d.key}>
                      <td class="py-1.5 {d.sub ? 'pl-3 text-muted' : ''}">{d.label}</td>
                      <td class="num py-1.5 text-right {d.eaten === 'unknown' ? 'text-muted' : ''}">{d.eaten}</td>
                      <td class="num py-1.5 text-right {d.per100 === 'unknown' ? 'text-muted' : ''}">{d.per100}</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
              {#if f.food.source}<p class="m-0 text-xs text-muted" data-source>Source: {f.food.source}</p>{/if}
              <div class="flex flex-wrap gap-x-4">
                <a href={libraryHref(f.food)} class="inline-flex min-h-11 items-center font-medium no-underline desktop:min-h-8" data-library-link>Open in Library › Foods</a>
                {#if f.food.refs?.length}
                  <a href="{foodDayHref(x.day, x.today)}{x.past ? '&' : '?'}open={f.food.refs[0]}" class="inline-flex min-h-11 items-center font-medium no-underline desktop:min-h-8" data-day-link
                    >Open on the Day tab</a
                  >
                {/if}
              </div>
            </div>
          {/if}
        </div>
      {/each}
    </section>
  </main>
{/if}

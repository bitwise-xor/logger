<script lang="ts">
  import { foodDayHref } from '#lib/food.js';
  import { DAYS_SHOWN, kcalText, kgText, shown, type Week } from '#lib/week.js';
  import type { WeekPage } from '#lib/weekpage.svelte.js';

  // "The days": the period's days with food, newest first (the door's order and labels), a "partly" mark where the door marks a day
  // under half the calorie target (left out of the averages); seven rows until "Show all N" (the 30 days). Since 21.11.2026 a day
  // leads to its Food day (idea 63).
  let { week, page }: { week: Week; page: WeekPage } = $props();
  const rows = $derived(shown(week.days, DAYS_SHOWN, page.daysAll));
  const th = 'px-1 py-1.5 text-xs font-medium text-muted';
  const td = 'num border-t border-line px-1 py-2 text-right';
</script>

<section aria-labelledby="days-h" class="flex flex-col gap-1.5 rounded-card border border-line bg-panel p-3 desktop:p-3.5" data-card="days">
  <div class="flex items-baseline justify-between gap-2">
    <h2 id="days-h" class="m-0 text-[15px] font-semibold">The days</h2>
    {#if week.days.length}<span class="text-[13px] text-muted">newest first</span>{/if}
  </div>
  {#if week.days.length}
    <table class="w-full border-collapse text-[13px]" data-days>
      <thead>
        <tr>
          <th class="{th} text-left">Day</th>
          <th class="{th} text-right">kcal</th>
          <th class="{th} text-right">protein</th>
          <th class="{th} text-right">fat</th>
          <th class="{th} text-right">carbs</th>
          <th class="{th} text-right">kg</th>
        </tr>
      </thead>
      <tbody>
        {#each rows as d (d.day)}
          <tr class={d.partly ? 'text-muted' : ''} data-day={d.day} data-partly={d.partly}>
            <td class="border-t border-line px-1 py-0 text-left whitespace-nowrap desktop:py-1"
              ><a href={foodDayHref(d.day)} class="inline-flex min-h-11 items-center font-medium no-underline desktop:min-h-8" data-day-link>{d.label}</a
              >{#if d.partly}{' '}<span class="rounded-full bg-chip px-2 py-0.5 text-xs text-chip-text" data-partly-mark>partly</span>{/if}</td
            >
            <td class={td}>{kcalText(d.kcal)}</td>
            <td class={td}>{kcalText(d.protein)}</td>
            <td class={td}>{kcalText(d.fat)}</td>
            <td class={td}>{kcalText(d.carbs)}</td>
            <td class={td}>{kgText(d.kg)}</td>
          </tr>
        {/each}
      </tbody>
    </table>
    {#if week.days.length > DAYS_SHOWN}
      <button
        type="button"
        class="inline-flex min-h-11 cursor-pointer items-center self-start rounded-lg border border-line bg-transparent px-3.5 text-sm font-medium text-text hover:bg-panel2 desktop:min-h-9"
        aria-expanded={page.daysAll}
        onclick={() => (page.daysAll = !page.daysAll)}
        data-days-all>{page.daysAll ? 'Show fewer' : `Show all ${week.days.length}`}</button
      >
    {/if}
  {:else}
    <p class="m-0 text-muted" data-days-none>{week.days_none}</p>
  {/if}
</section>

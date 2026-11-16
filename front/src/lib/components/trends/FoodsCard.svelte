<script lang="ts">
  import { FOODS_SHOWN, shown, type Food, type Week } from '#lib/week.js';
  import type { WeekPage } from '#lib/weekpage.svelte.js';

  // "Foods that count most": the door's two lists, "Most calories" and "Eaten most often" (eight each), five rows each until
  // "Show all N".
  let { week, page }: { week: Week; page: WeekPage } = $props();
  const most = $derived(Math.max(week.foods.by_kcal.length, week.foods.by_count.length));
  const lists = $derived([
    { key: 'kcal', title: 'Most calories', rows: week.foods.by_kcal },
    { key: 'count', title: 'Eaten most often', rows: week.foods.by_count },
  ] as { key: string; title: string; rows: Food[] }[]);
</script>

{#if most}
  <section aria-labelledby="foods-h" class="flex flex-col gap-2.5 rounded-card border border-line bg-panel p-3 desktop:p-3.5" data-card="foods">
    <h2 id="foods-h" class="m-0 text-[15px] font-semibold">Foods that count most</h2>
    {#each lists as l (l.key)}
      <div class="flex flex-col gap-1">
        <h3 class="m-0 text-xs font-medium tracking-wider text-muted uppercase">{l.title}</h3>
        <ol class="m-0 flex list-none flex-col p-0" data-foods={l.key}>
          {#each shown(l.rows, FOODS_SHOWN, page.foodsAll) as f, i (`${f.name}:${i}`)}
            <li class="grid grid-cols-[20px_minmax(0,1fr)_auto] items-baseline gap-2 border-t border-line py-1.5 first:border-t-0" data-food>
              <span class="num text-[13px] text-muted">{i + 1}</span>
              <span class="min-w-0 break-words" data-food-name>{f.name}</span>
              <span class="num text-[13px] whitespace-nowrap text-muted" data-food-text>{f.text}</span>
            </li>
          {/each}
        </ol>
      </div>
    {/each}
    {#if most > FOODS_SHOWN}
      <button
        type="button"
        class="inline-flex min-h-11 cursor-pointer items-center self-start rounded-lg border border-line bg-transparent px-3.5 text-sm font-medium text-text hover:bg-panel2 desktop:min-h-9"
        aria-expanded={page.foodsAll}
        onclick={() => (page.foodsAll = !page.foodsAll)}
        data-foods-all>{page.foodsAll ? 'Show fewer' : `Show all ${most}`}</button
      >
    {/if}
  </section>
{/if}

<script lang="ts">
  import Chart from '#lib/components/chart/Chart.svelte';
  import MoreHeader from '#lib/components/more/MoreHeader.svelte';
  import ProblemCard from '#lib/components/ProblemCard.svelte';
  import { ESCALATED, kindCells, tilesOf, topLine, topWords, usageHref } from '#lib/usage.js';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();

  // More's Usage (deploy 108): app.'s Usage page. The range chips (the door's ranges), four tiles, "Cost per day" as stacked bars by
  // model family (the door's chart: neutral for Haiku, two blues for Sonnet and Opus), "By kind" with the All row, the push count,
  // the most expensive messages (a private entry only as a "private" mark) and the door's note. One column on phones and tablets;
  // from 1100 px the chart and the table on the left, the costly messages on the right.
  const u = $derived(data.usage);
  const card = 'rounded-card border border-line bg-panel p-3 desktop:p-3.5';
  const th = 'px-1.5 py-1.5 text-right text-xs font-medium whitespace-nowrap text-muted first:pl-0 last:pr-0 first:text-left';
  const td = 'px-1.5 py-[7px] text-right whitespace-nowrap first:pl-0 first:text-left last:pr-0';
</script>

<svelte:head><title>Usage · Logger</title></svelte:head>

<MoreHeader title="Usage" />

{#if !u}
  <ProblemCard kind={data.problem ?? 'trouble'} appHref="{data.appUrl}/web/usage" />
{:else}
  <main class="flex min-w-0 flex-col gap-3 desktop:max-w-[1100px]" data-usage>
    <nav aria-label="Range" class="flex flex-wrap gap-1.5" data-ranges>
      {#each u.ranges as x (x.r)}
        <a
          href={usageHref(x.r)}
          aria-current={x.current ? 'page' : undefined}
          class="inline-flex min-h-11 items-center justify-center rounded-full border px-3.5 font-medium no-underline {x.current ? 'border-blue bg-blue-bg text-blue' : 'border-line bg-panel text-text hover:bg-panel2'}"
          data-range={x.r}>{x.label}</a
        >
      {/each}
    </nav>
    <p class="m-0 text-[13px] text-muted" data-since>{u.since}</p>

    <div class="grid grid-cols-2 gap-2 desktop:grid-cols-4" data-tiles>
      {#each tilesOf(u) as t (t.key)}
        <div class="flex min-w-0 flex-col gap-0.5 rounded-card border border-line bg-panel px-3 py-2.5" data-tile={t.key}>
          <span class="text-xs font-medium tracking-wider text-muted uppercase">{t.label}</span>
          <span class="num text-[22px] font-medium tracking-tight" data-tile-value>{t.value}</span>
          <span class="text-xs text-muted" data-tile-sub>{t.sub}</span>
        </div>
      {/each}
    </div>

    <div class="flex min-w-0 flex-col gap-3 desktop:grid desktop:grid-cols-2 desktop:items-start desktop:gap-4">
      <div class="flex min-w-0 flex-col gap-3 desktop:gap-4">
        <section aria-labelledby="cost-h" class={card} data-cost-chart>
          <h2 id="cost-h" class="m-0 mb-1 text-[15px] font-semibold">Cost per day</h2>
          {#if u.chart}
            <div class="usage-chart">
              <Chart chart={u.chart} id="usage" legend={u.legend} />
            </div>
          {:else}
            <p class="m-0 py-3 text-muted" data-chart-empty>{u.empty}</p>
          {/if}
        </section>

        <section aria-labelledby="kind-h" class={card} data-kinds>
          <h2 id="kind-h" class="m-0 mb-1.5 text-[15px] font-semibold">By kind</h2>
          <div class="-mx-3 overflow-x-auto px-3 desktop:-mx-3.5 desktop:px-3.5">
            <table class="w-full border-collapse text-[13px]">
              <thead>
                <tr class="border-b border-line">
                  {#each ['Kind', 'Calls', 'Tokens in', 'Tokens out', 'Cost'] as h (h)}<th scope="col" class={th}>{h}</th>{/each}
                </tr>
              </thead>
              <tbody>
                {#each u.kinds as k (k.kind)}
                  <tr class="border-b border-line" data-kind={k.kind}>
                    {#each kindCells(k) as c, i (i)}<td class="{td} {i === 0 ? '' : 'num'}">{c}</td>{/each}
                  </tr>
                {/each}
                <tr class="font-semibold" data-kind-all>
                  {#each kindCells(u.all) as c, i (i)}<td class="{td} {i === 0 ? '' : 'num'}">{c}</td>{/each}
                </tr>
              </tbody>
            </table>
          </div>
          {#if u.kinds_note}<p class="m-0 mt-2 text-[13px] text-muted" data-kinds-note>{u.kinds_note}</p>{/if}
          <p class="m-0 mt-2 text-[13px] text-muted" data-pushes>{u.pushes_text}</p>
        </section>
      </div>

      <section aria-labelledby="top-h" class={card} data-top>
        <h2 id="top-h" class="m-0 mb-1 text-[15px] font-semibold">Most expensive messages</h2>
        {#each u.top as t, i (i)}
          {@const w = topWords(t)}
          <div class="flex flex-col gap-0.5 border-t border-line py-2.5 first:border-t-0" data-top-row>
            <div class="flex items-baseline justify-between gap-2">
              <span class="min-w-0 truncate" data-top-words>
                {#if w.private}<span class="rounded-full bg-chip px-2 text-xs text-chip-text" data-private>private</span>{:else if w.words}{w.words}{:else}<span class="text-muted">–</span>{/if}
              </span>
              {' '}<span class="num shrink-0">{t.usd_text}</span>
            </div>
            {' '}<span class="text-[13px] text-muted" data-top-line>{topLine(t)}</span>
            {#if t.escalated}{' '}<span><span class="rounded-full bg-blue-bg px-2 text-xs text-blue" data-escalated>{ESCALATED}</span></span>{/if}
          </div>
        {:else}
          <p class="m-0 py-2 text-muted" data-top-none>No calls in this range.</p>
        {/each}
      </section>
    </div>

    <p class="m-0 text-[13px] text-muted" data-note>{u.note}</p>
  </main>
{/if}

<style>
  /* The three model families on the door's chart classes (a Haiku, b Sonnet, c Opus): a neutral grey, then two blues (the deploy's mockup). */
  .usage-chart {
    --usage-a: color-mix(in srgb, var(--muted) 45%, var(--panel));
    --usage-b: color-mix(in srgb, var(--blue) 45%, var(--panel));
    --usage-c: var(--blue);
  }
  .usage-chart :global(.chart rect.a),
  .usage-chart :global(.legend .key.a) {
    fill: var(--usage-a);
    background: var(--usage-a);
  }
  .usage-chart :global(.chart rect.b),
  .usage-chart :global(.legend .key.b) {
    fill: var(--usage-b);
    background: var(--usage-b);
  }
  .usage-chart :global(.chart rect.c),
  .usage-chart :global(.legend .key.c) {
    fill: var(--usage-c);
    background: var(--usage-c);
  }
  .usage-chart :global(.legend .key.sq) {
    border-radius: 3px;
  }
</style>

<script lang="ts">
  import ProblemCard from '#lib/components/ProblemCard.svelte';
  import InsightCard from '#lib/components/trends/InsightCard.svelte';
  import TrendsTabs from '#lib/components/trends/TrendsTabs.svelte';
  import { insightRangeLinks } from '#lib/trendscharts.js';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();

  // Trends' Insights tab (deploy 103): app.'s Insights page, read only, in the door's words and order: the range chips (90, 180 or
  // 365 days, web item 50; built like the Charts tab's), the header line, nine cards (those with a statement first: the difference as
  // a chip in the corner, the sentence, two bars and the door's caveat when there is one; a card that waits is dashed) and the note.
  // One column on phones and tablets, two from 1100 px (three when there is room).
  const ins = $derived(data.insights);
  const links = $derived(insightRangeLinks(data.days, data.insights?.ranges));
</script>

<svelte:head><title>Trends insights · Logger</title></svelte:head>

<TrendsTabs on="insights" />

{#if !ins}
  <ProblemCard kind={data.problem ?? 'trouble'} appHref="{data.appUrl}/web/insights" />
{:else}
  <div class="flex flex-col gap-2">
    <nav aria-label="Range" class="grid grid-cols-3 gap-1.5 tablet:flex tablet:flex-wrap tablet:gap-2" data-ranges>
      {#each links as l (l.days)}
        <a
          href={l.href}
          aria-current={l.current ? 'page' : undefined}
          class="flex min-h-11 items-center justify-center rounded-full border px-3 text-sm font-medium whitespace-nowrap no-underline tablet:px-4 desktop:min-h-9 {l.current
            ? 'border-blue bg-blue-bg text-blue'
            : 'border-line bg-panel text-text hover:bg-panel2'}"
          data-range={l.days}>{l.label}</a
        >
      {/each}
    </nav>
    <p class="m-0 text-[13px] text-muted" data-head-line>{ins.small}</p>
  </div>
  <main class="flex min-w-0 flex-col gap-3 desktop:gap-4">
    <div class="grid items-start gap-3 desktop:grid-cols-2 desktop:gap-4 min-[1500px]:grid-cols-3" data-insights>
      {#each ins.cards as c (c.key)}<InsightCard card={c} />{/each}
    </div>
    <p class="m-0 max-w-[720px] text-[13px] text-muted" data-note>{ins.note}</p>
  </main>
{/if}

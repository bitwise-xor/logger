<script lang="ts">
  import ProblemCard from '#lib/components/ProblemCard.svelte';
  import InsightCard from '#lib/components/trends/InsightCard.svelte';
  import TrendsTabs from '#lib/components/trends/TrendsTabs.svelte';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();

  // Trends' Insights tab (deploy 103): app.'s Insights page, read only, in the door's words and order: the header line, three cards
  // (the difference as a chip in the corner, the sentence, two bars; a card that waits is dashed) and the note. One column on phones
  // and tablets, two from 1100 px (three when there is room).
  const ins = $derived(data.insights);
</script>

<svelte:head><title>Trends insights · Logger</title></svelte:head>

<TrendsTabs on="insights" />

{#if !ins}
  <ProblemCard kind={data.problem ?? 'trouble'} appHref="{data.appUrl}/web/insights" />
{:else}
  <p class="m-0 text-[13px] text-muted" data-head-line>{ins.small}</p>
  <main class="flex min-w-0 flex-col gap-3 desktop:gap-4">
    <div class="grid items-start gap-3 desktop:grid-cols-2 desktop:gap-4 min-[1500px]:grid-cols-3" data-insights>
      {#each ins.cards as c (c.key)}<InsightCard card={c} />{/each}
    </div>
    <p class="m-0 max-w-[720px] text-[13px] text-muted" data-note>{ins.note}</p>
  </main>
{/if}

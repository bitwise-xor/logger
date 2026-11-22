<script lang="ts">
  import InsightBars from '#lib/components/trends/InsightBars.svelte';
  import { waitParts, type Insight } from '#lib/trendscharts.js';

  // One of the nine insight cards, in the door's words: the title with the corner chip (the difference, or "no difference"), the
  // sentence with its two averages in bold, then the two bars and, when the door gives one, its caveat (a small difference or few
  // days) as a muted line under them. A card that waits (a group has fewer days than it needs) is dashed:
  // the door's "Not enough days yet" words and the sentence on what it counts.
  let { card: c }: { card: Insight } = $props();
  const wait = $derived(waitParts(c.wait_text));
</script>

{#if c.waiting}
  <section class="flex min-w-0 flex-col gap-1.5 rounded-card border border-dashed border-line bg-transparent p-3 desktop:p-3.5" data-insight={c.key} data-waiting="true">
    <h2 class="m-0 text-[15px] leading-snug font-semibold">{c.title}</h2>
    <p class="m-0 text-muted" data-wait>{wait.head}</p>
    {#if wait.counts}<p class="m-0 text-[13px] text-muted" data-counts>{wait.counts}</p>{/if}
  </section>
{:else}
  <section class="flex min-w-0 flex-col gap-2.5 rounded-card border border-line bg-panel p-3 desktop:p-3.5" data-insight={c.key}>
    <div class="flex items-start justify-between gap-2.5">
      <h2 class="m-0 min-w-0 text-[15px] leading-snug font-semibold">{c.title}</h2>
      {#if c.chip}<span class="num shrink-0 rounded-full bg-chip px-2.5 py-0.5 text-xs whitespace-nowrap text-chip-text" data-chip>{c.chip}</span>{/if}
    </div>
    <p class="m-0" data-say>
      {#each c.say ?? [] as p, i (i)}{#if p.bold}<b class="num font-semibold">{p.text}</b>{:else}{p.text}{/if}{/each}
    </p>
    <InsightBars card={c} />
    {#if c.caveat}<p class="m-0 text-[13px] leading-snug text-muted" data-caveat>{c.caveat}</p>{/if}
  </section>
{/if}

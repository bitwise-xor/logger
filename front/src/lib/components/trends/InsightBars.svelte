<script lang="ts">
  import { barStyle, daysText, type Insight } from '#lib/trendscharts.js';

  // The two bars of an insight card, one per group: the label with "· n days" on the left and the value on the right, under them the
  // bar on its track from the door's `left` to `left + width` percent (as app. draws it; a thin line marks zero when a value is below
  // it). The first group (the one the sentence is about) is drawn in --chart-a, the second in --chart-b.
  let { card }: { card: Pick<Insight, 'key' | 'groups' | 'zero'> } = $props();
</script>

<div class="flex flex-col gap-2.5" data-insight-bars={card.key}>
  {#each card.groups as g (g.key)}
    {@const b = barStyle(g, card.zero)}
    <div class="flex flex-col gap-1" data-bar-group={g.key}>
      <div class="flex items-baseline justify-between gap-3">
        <span class="min-w-0 text-[13px] text-muted" data-bar-label>{g.label} · {daysText(g.n)}</span>
        <span class="num shrink-0 text-sm font-semibold" data-bar-value>{g.text}</span>
      </div>
      <div class="relative h-2.5 overflow-hidden rounded-full bg-chip" role="img" aria-label="{g.label}: {g.text}">
        <span
          class="absolute inset-y-0 rounded-full"
          style="left: {b.left}%; width: {b.width}%; background: var(--chart-{g.cls});"
          data-bar-fill={g.cls}
        ></span>
        {#if b.zero !== null}<span class="absolute inset-y-0 w-px bg-muted" style="left: {b.zero}%;" data-bar-zero></span>{/if}
      </div>
    </div>
  {/each}
</div>

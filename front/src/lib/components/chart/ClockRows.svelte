<script lang="ts">
  import { clockLayout, type ClockRows } from '#lib/chart.js';

  // A row per date with the clock across 0 to 24 h (deploy 92; the Health page's sleep times, app.'s healthpage._times): a band
  // from .. to (a lighter one: nap: true), a tick at a moment. The mouse shows a band's or tick's text (<title>); a tap shows it
  // under the picture. Nothing here knows what the bands are.
  let { rows, label, id }: { rows: ClockRows; label: string; id?: string } = $props();
  const layout = $derived(clockLayout(rows));
  let picked = $state<string | null>(null);
  $effect(() => {
    void rows;
    picked = null;
  });
</script>

<div class="clock" data-clock={id}>
  <svg viewBox="0 0 {layout.W} {layout.H}" role="img" aria-label={label} class="my-1.5 block h-auto w-full">
    {#each layout.grid as g (g.text)}
      <line class="grid" x1={g.x} y1={g.y1} x2={g.x} y2={g.y2} />
      <text x={g.x} y={g.y1 - 3} text-anchor="middle">{g.text}</text>
    {/each}
    {#each layout.rows as r, i (i)}
      {#if r.label}<text x={r.label.x} y={r.label.y} text-anchor="end">{r.label.text}</text>{/if}
      {#each r.bands as b, j (j)}
        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
        <rect class="band" class:nap={b.nap} x={b.x} y={b.y} width={b.w} height={b.h} rx="2" data-band onclick={() => (picked = picked === b.tip ? null : b.tip)}
          ><title>{b.tip}</title></rect
        >
      {/each}
      {#each r.ticks as k, j (j)}
        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
        <line class="up" x1={k.x} y1={k.y1} x2={k.x} y2={k.y2} data-tick onclick={() => (picked = picked === k.tip ? null : k.tip)}
          ><title>{k.tip}</title></line
        >
      {/each}
    {/each}
  </svg>
  {#if picked}<p class="m-0 text-[13px]" data-clock-tip>{picked}</p>{/if}
</div>

<style>
  .clock :global(svg text) {
    fill: var(--muted);
    font-size: 11px;
    font-family: var(--font-sans);
  }
  .clock :global(.grid) {
    stroke: var(--line);
    stroke-width: 1;
  }
  .clock :global(.band) {
    fill: var(--chart-a);
    cursor: pointer;
  }
  .clock :global(.band.nap) {
    fill: var(--chart-soft);
    stroke: var(--chart-a);
    stroke-width: 1;
  }
  .clock :global(.up) {
    stroke: var(--text);
    stroke-width: 2;
    cursor: pointer;
  }
</style>

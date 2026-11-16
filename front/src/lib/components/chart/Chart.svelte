<script lang="ts">
  import { chartLayout, nearestHit, tipBox, type ChartData, type Hit } from '#lib/chart.js';
  import Legend from './Legend.svelte';

  // The chart part (deploy 92): a chart description of the door (docs/API.md, "Chart"; app.'s data-chart) drawn as SVG, with
  // app.'s look: lines, dots, rings, bars, dashed reference lines, the axis numbers and dates. The mouse shows a mark's text
  // (its <title>); a tap shows it in a box, a second tap on the same mark or a tap elsewhere hides it. The geometry is
  // src/lib/chart.ts; nothing here knows what the chart is about, so any page can use it. `legend`: the colour keys and words
  // under it (Legend.svelte).
  let { chart, id, legend = [] }: { chart: ChartData; id?: string; legend?: { key: string; text: string }[] } = $props();

  let width = $state(0);
  // The width of the box; before the browser has measured it (the page drawn on the server) a phone's, then the real one.
  const layout = $derived(chartLayout(chart, width || 340));
  let tip = $state<Hit | null>(null);
  const box = $derived(tip && layout ? tipBox(tip, layout.W) : null);

  function tap(event: MouseEvent) {
    const svg = (event.currentTarget as SVGSVGElement).getBoundingClientRect();
    if (!layout || !svg.width) return;
    const px = ((event.clientX - svg.left) * layout.W) / svg.width;
    const py = ((event.clientY - svg.top) * layout.H) / svg.height;
    const hit = nearestHit(layout.hits, px, py, layout.bw);
    tip = !hit || (tip && tip.t === hit.t) ? null : hit;
  }

  // A new description (another range, a save) closes the box.
  $effect(() => {
    void chart;
    tip = null;
  });
</script>

<div class="chart min-h-[190px]" bind:clientWidth={width} data-chart={id}>
  {#if !layout}
    <p class="m-0 py-8 text-muted" data-chart-empty>No values in this range.</p>
  {:else}
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
    <svg
      viewBox="0 0 {layout.W} {layout.H}"
      width={layout.W}
      height={layout.H}
      role="img"
      aria-label={chart.label}
      class="block h-auto w-full overflow-visible"
      onclick={tap}
    >
      {#if layout.band}<rect class="band" x={layout.band.x} y={layout.band.y} width={layout.band.w} height={layout.band.h} />{/if}
      {#each layout.ticks as t, i (i)}
        <line class="grid-line" x1={layout.L} x2={layout.W - layout.R} y1={t.y} y2={t.y} />
        <text x={layout.L - 6} y={+(t.y + 4).toFixed(1)} text-anchor="end">{t.text}</text>
      {/each}
      {#each layout.refs as r, i (i)}
        <line class="ref {r.cls}" x1={layout.L} x2={layout.W - layout.R} y1={r.y} y2={r.y} />
        <text class="reflbl {r.cls}" x={r.x} y={+(r.y - 3).toFixed(1)} text-anchor="end">{r.text}</text>
      {/each}
      {#each layout.xLabels as l, i (i)}
        <text x={l.x} y={layout.H - 5} text-anchor={l.anchor}>{l.text}</text>
      {/each}
      {#each layout.shapes as s, i (i)}
        {#if s.kind === 'line'}
          <polyline class="line {s.cls}" points={s.points} data-mark="line" />
        {:else if s.kind === 'bar'}
          <rect class={s.cls} x={s.x} y={s.y} width={s.w} height={s.h} rx="1.5" data-mark="bar">{#if s.tip}<title>{s.tip}</title>{/if}</rect>
        {:else if s.kind === 'dot'}
          <circle class={s.cls} cx={s.x} cy={s.y} r={s.r} data-mark="dot">{#if s.tip}<title>{s.tip}</title>{/if}</circle>
        {:else if s.kind === 'ring'}
          <circle class="ring {s.cls}" cx={s.x} cy={s.y} r={s.r} data-mark="ring">{#if s.tip}<title>{s.tip}</title>{/if}</circle>
        {:else if s.kind === 'label'}
          <text class="ptl" x={s.x} y={s.y} text-anchor={s.anchor}>{s.text}</text>
        {/if}
      {/each}
      {#if tip && box}
        <g class="tip" data-tip>
          <rect x={box.x} y={box.y} width={box.w} height={box.h} rx="4" />
          <text x={box.x + 7} y={box.y + 14}>{tip.t}</text>
        </g>
      {/if}
    </svg>
  {/if}
</div>
{#if legend.length}<Legend items={legend} />{/if}

<style>
  /* app.'s chart look (core/app/static/app.css, ".chart"), in this app's tokens (--chart-* in src/app.css). */
  .chart :global(svg text) {
    fill: var(--muted);
    font-size: 11px;
    font-family: var(--font-sans);
  }
  .chart :global(.grid-line) {
    stroke: var(--line);
  }
  .chart :global(.band) {
    fill: var(--chart-soft);
  }
  .chart :global(.a) {
    fill: var(--chart-a);
  }
  .chart :global(.b) {
    fill: var(--chart-b);
  }
  .chart :global(.c) {
    fill: var(--muted);
  }
  .chart :global(.w),
  .chart :global(.r) {
    fill: var(--chart-warn);
  }
  .chart :global(.ring) {
    fill: var(--panel);
    stroke-width: 1.6;
  }
  .chart :global(.ring.a) {
    stroke: var(--chart-a);
  }
  .chart :global(.ring.b) {
    stroke: var(--chart-b);
  }
  .chart :global(.line) {
    fill: none;
    stroke-width: 2.2;
    stroke-linejoin: round;
    stroke-linecap: round;
  }
  .chart :global(.line.a) {
    stroke: var(--chart-a);
  }
  .chart :global(.line.b) {
    stroke: var(--chart-b);
  }
  .chart :global(.ref) {
    fill: none;
    stroke-width: 1.2;
    stroke-dasharray: 5 4;
  }
  .chart :global(.ref.w) {
    stroke: var(--muted);
  }
  .chart :global(.ref.r) {
    stroke: var(--chart-warn);
  }
  .chart :global(.ref.t) {
    stroke: var(--chart-a);
  }
  .chart :global(text.reflbl) {
    font-size: 10px;
  }
  .chart :global(text.reflbl.w) {
    fill: var(--muted);
  }
  .chart :global(text.reflbl.r) {
    fill: var(--chart-warn);
  }
  .chart :global(text.reflbl.t) {
    fill: var(--chart-a);
  }
  .chart :global(text.ptl) {
    fill: var(--text);
    font-weight: 600;
  }
  .chart :global(.tip rect) {
    fill: var(--text);
  }
  .chart :global(.tip text) {
    fill: var(--panel);
  }
</style>

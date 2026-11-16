<script lang="ts">
  import { bars, BARS_BASE, BARS_H, BARS_W, barsLabel, goodWeeks, type PerWeek } from '#lib/gymread.js';

  // "Workouts per week" (app.'s _per_week): the last 8 weeks as bars, the count above each and the Monday under it, this week's in
  // the accent colour, "5 of 8 weeks with 2+" in the title. The door sends the numbers (per_week); the page draws them.
  let { perWeek }: { perWeek: PerWeek } = $props();
  const list = $derived(bars(perWeek));
</script>

<section aria-labelledby="weeks-h" class="flex min-w-0 flex-col gap-1.5 rounded-card border border-line bg-panel px-3 py-3 desktop:px-3.5" data-card="per-week">
  <div class="flex flex-wrap items-baseline justify-between gap-x-2">
    <h2 id="weeks-h" class="m-0 text-[15px] font-semibold">Workouts per week</h2>
    <span class="text-[13px] text-muted" data-good>{goodWeeks(perWeek)}</span>
  </div>
  <svg viewBox="0 0 {BARS_W} {BARS_H}" role="img" aria-label={barsLabel(perWeek)} class="block h-auto w-full max-w-[480px] overflow-visible" data-bars>
    <path d="M0 {BARS_BASE + 0.5}H{BARS_W}" class="stroke-line" fill="none"></path>
    {#each list as b, i (i)}
      <rect x={b.x} y={b.y} width="24" height={b.h} rx="3" class={b.now ? 'fill-blue' : 'fill-muted'} data-bar={b.n} data-now={b.now ? 'true' : undefined}></rect>
      <text x={b.cx} y={b.ny} text-anchor="middle" font-size="11" class="fill-text">{b.n}</text>
      <text x={b.cx} y="80" text-anchor="middle" font-size="10" class="fill-muted">{b.label}</text>
    {/each}
  </svg>
</section>

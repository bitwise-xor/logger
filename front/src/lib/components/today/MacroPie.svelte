<script lang="ts">
  import type { MacroKey } from '#lib/day.js';
  import { n } from '#lib/format.js';

  // A donut as app.'s "Energy from macros" (todaypage._pie): kcal from protein, carbs and fat, the day's kcal in its hole.
  let { kcal, slices }: { kcal: string; slices: { key: MacroKey; name: string; share: number }[] } = $props();

  const R = 48;
  const parts = $derived(slices.filter((s) => s.share > 0));
  const paths = $derived.by(() => {
    let a0 = -Math.PI / 2;
    return parts.map((s) => {
      const a1 = a0 + 2 * Math.PI * s.share;
      const [x0, y0, x1, y1] = [50 + R * Math.cos(a0), 50 + R * Math.sin(a0), 50 + R * Math.cos(a1), 50 + R * Math.sin(a1)];
      const d = `M50 50 L${x0.toFixed(2)} ${y0.toFixed(2)} A${R} ${R} 0 ${s.share > 0.5 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`;
      a0 = a1;
      return { key: s.key, d };
    });
  });
  const label = $derived(`${kcal} kcal; calories from ${slices.map((s) => `${s.name.toLowerCase()} ${n(s.share * 100)} %`).join(', ')}`);
</script>

<div class="relative size-[84px] shrink-0" data-pie>
  <svg viewBox="0 0 100 100" role="img" aria-label={label} class="block size-full">
    {#if parts.length === 1}
      <circle cx="50" cy="50" r={R} style="fill: var(--macro-{parts[0]!.key})" data-slice={parts[0]!.key} />
    {:else}
      {#each paths as p (p.key)}
        <path d={p.d} style="fill: var(--macro-{p.key}); stroke: var(--panel); stroke-width: 1.2" data-slice={p.key} />
      {/each}
    {/if}
    <circle cx="50" cy="50" r="31" style="fill: var(--panel)" />
  </svg>
  <div aria-hidden="true" class="absolute inset-0 flex flex-col items-center justify-center leading-none">
    <b class="num text-[13px] font-medium">{kcal}</b>
    <span class="text-[10px] text-muted">kcal</span>
  </div>
</div>

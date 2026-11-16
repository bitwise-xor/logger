<script lang="ts">
  import { METER_LINE, meterFill, meterWarn, pctText, type Week } from '#lib/week.js';

  // "Food" (app.'s Food card of the Week): the average complete day against the target, four tiles (two by two on phones and tablets,
  // one row on the PC). The meter: the bar of the average day, the thin line at 100%; amber only at the door's warn level, every
  // other level neutral (never red or green). A tile without a target or days says the door's note instead of a bar.
  let { week }: { week: Week } = $props();
</script>

<section aria-labelledby="food-h" class="flex flex-col gap-2.5 rounded-card border border-line bg-panel p-3 desktop:p-3.5" data-card="food">
  <div class="flex flex-col gap-0.5">
    <h2 id="food-h" class="m-0 text-[15px] font-semibold">Food</h2>
    <p class="m-0 text-[13px] text-muted" data-meter-hint>{week.meter_hint}</p>
  </div>
  <div class="grid grid-cols-2 gap-2 desktop:grid-cols-4" data-tiles>
    {#each week.food as t (t.key)}
      {@const warn = meterWarn(t)}
      <div class="flex min-w-0 flex-col gap-1 rounded-[10px] border border-line bg-panel2 p-2.5" data-tile={t.key} data-level={t.level}>
        <span class="text-[13px] text-muted">{t.label}</span>
        <span class="flex flex-wrap items-baseline gap-x-1">
          <strong class="num text-[22px] leading-tight font-semibold tracking-[-0.01em]" data-tile-avg>{t.average_text}</strong>
          <span class="text-[13px] text-muted">{t.unit}</span>
        </span>
        <span class="text-[13px] text-muted" data-tile-target
          >average per day{#if t.target_text}{' · '}target <span class="num whitespace-nowrap">{t.target_text} {t.unit}</span>{/if}</span
        >
        {#if t.note}
          <span class="text-xs text-muted" data-tile-note>{t.note}</span>
        {:else}
          <div
            class="relative mt-1 h-2 overflow-hidden rounded-full bg-track"
            role="img"
            aria-label="average day {pctText(t.pct)} of the target"
            data-meter
          >
            <span class="absolute inset-y-0 left-0 rounded-full {warn ? 'bg-amber' : 'bg-text'}" style="width: {meterFill(t.pct).toFixed(1)}%" data-meter-fill></span>
            <i class="absolute inset-y-0 w-0.5 bg-muted" style="left: {METER_LINE}%"></i>
          </div>
          <span class="num text-xs font-medium {warn ? 'text-amber' : 'text-muted'}" data-tile-pct>{pctText(t.pct)}</span>
        {/if}
      </div>
    {/each}
  </div>
</section>

<script lang="ts">
  import { WEEK_NOTE, weekLines, type Now } from '#lib/home.js';

  // "This week" (app.'s _week_card): sessions of the weekly goal, a segment per session, the last 4 weeks (the latest first) and
  // what a session is.
  let { week }: { week: Now['week'] } = $props();
  const w = $derived(weekLines(week));
</script>

<section aria-labelledby="week-h" class="flex flex-col gap-2 rounded-card border border-line bg-panel p-3 desktop:p-3.5" data-card="week">
  <div class="flex items-baseline justify-between gap-2">
    <h2 id="week-h" class="m-0 text-[15px] font-semibold">This week</h2>
    <span class="text-[13px] text-muted" data-week-count>{w.count}</span>
  </div>
  <div class="grid gap-1.5" style="grid-template-columns: repeat({Math.max(1, w.segments.length)}, minmax(0, 1fr))" role="img" aria-label={w.count} data-segments>
    {#each w.segments as on, i (i)}
      <span class="h-[9px] rounded-full {on ? 'bg-text' : 'bg-track'}" data-seg={on ? 'on' : 'off'}></span>
    {/each}
  </div>
  <p class="num m-0 text-[13px] text-muted" data-weeks>{w.weeks}</p>
  <p class="m-0 text-[13px] text-muted">{WEEK_NOTE}</p>
</section>

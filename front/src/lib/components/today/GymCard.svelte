<script lang="ts">
  import type { Day } from '#lib/day.js';
  import { lastLine, squares, weekLine } from '#lib/gym.js';

  // Today's Gym card (app.'s today_card, deploy 96): today's day of the split, the last workout, the last 14 days as squares (oldest
  // first, today marked), last week and this week, and "Open today's workout" to the Workout page. None on a past day (the door
  // sends null).
  let { day }: { day: Day } = $props();
  const g = $derived(day.gym ?? null);
  const sq = $derived(g ? squares(g) : null);
</script>

{#if g && sq}
  <section aria-labelledby="gym-h" class="flex flex-col gap-2 rounded-card border border-line bg-panel px-3 pt-3 pb-3 desktop:px-3.5" data-card="gym">
    <h2 id="gym-h" class="m-0 text-[15px] font-semibold">
      <a href="/gym" class="inline-flex min-h-11 items-center gap-1 text-text no-underline desktop:min-h-0" data-gym-link>Gym <span class="text-muted" aria-hidden="true">›</span></a>
    </h2>
    <div class="flex flex-col gap-0.5">
      {#if g.day_label}<span data-gym-day>Today: <span class="font-medium">{g.day_label}</span></span>{/if}
      <span class="text-[13px] text-muted" data-gym-last>{lastLine(g)}</span>
    </div>
    <div class="grid grid-cols-[repeat(14,minmax(0,1fr))] gap-1" role="img" aria-label={sq.label} data-gym-days>
      {#each sq.days as d (d.day)}
        <span
          class="h-[18px] rounded-[4px] {d.today ? (d.on ? 'bg-blue' : 'bg-track ring-2 ring-blue') : d.on ? 'bg-text' : 'bg-track'}"
          title={d.title}
          data-sq={d.on ? 'on' : 'off'}
        ></span>
      {/each}
    </div>
    <div class="flex justify-between text-[11px] text-muted" aria-hidden="true"><span class="num">{sq.from}</span><span>today</span></div>
    <span class="text-[13px] text-muted" data-gym-weeks>{weekLine(g)}</span>
    <a
      href="/gym"
      class="flex min-h-11 items-center justify-center rounded-lg bg-text font-medium text-bg no-underline desktop:min-h-10"
      data-gym-open>Open today’s workout</a
    >
  </section>
{/if}

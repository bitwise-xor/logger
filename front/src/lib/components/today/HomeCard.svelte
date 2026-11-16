<script lang="ts">
  import type { Day } from '#lib/day.js';
  import { cardLines, pickHref } from '#lib/home.js';

  // Today's Home card (app.'s today_card, deploy 99): "this week N of goal", the chore waiting longest with its age and interval (or
  // "Nothing else is waiting today."), "N hidden for today", and the buttons "15 minutes" (the Pick page for 15 minutes) and "Open
  // Home". None when the door sends null (a past day, no chores, or the card hidden in Settings > Today page).
  let { day }: { day: Day } = $props();
  const h = $derived(day.home ?? null);
  const l = $derived(h ? cardLines(h) : null);
</script>

{#if h && l}
  <section aria-labelledby="home-h" class="flex flex-col gap-2 rounded-card border border-line bg-panel px-3 pt-3 pb-3 desktop:px-3.5" data-card="home">
    <div class="flex items-baseline justify-between gap-2">
      <h2 id="home-h" class="m-0 text-[15px] font-semibold">
        <a href="/home" class="inline-flex min-h-11 items-center gap-1 text-text no-underline desktop:min-h-0" data-home-link>Home <span class="text-muted" aria-hidden="true">›</span></a>
      </h2>
      <span class="text-[13px] text-muted" data-home-week>{l.week}</span>
    </div>
    {#if l.waiting}
      <div class="flex flex-col gap-0.5" data-home-waiting>
        <span class="text-[13px] text-muted">Waiting longest</span>
        <span class="font-medium" data-home-label>{l.waiting.label}</span>
        <span class="text-[13px] text-muted" data-home-meta>{l.waiting.meta}</span>
      </div>
    {:else}
      <p class="m-0 text-[13px] text-muted" data-home-none>{l.none}</p>
    {/if}
    {#if l.hidden}<p class="m-0 text-[13px] text-muted" data-home-hidden>{l.hidden}</p>{/if}
    <div class="grid grid-cols-2 gap-2 pt-1">
      <a href={pickHref(15)} class="flex min-h-11 items-center justify-center rounded-lg bg-text font-medium text-bg no-underline desktop:min-h-10" data-home-15>15 minutes</a>
      <a href="/home" class="flex min-h-11 items-center justify-center rounded-lg border border-line bg-panel font-medium text-text no-underline hover:bg-panel2 desktop:min-h-10" data-home-open
        >Open Home</a
      >
    </div>
  </section>
{/if}

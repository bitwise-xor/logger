<script lang="ts">
  import { timeline, type Day } from '#lib/day.js';

  let { day }: { day: Day } = $props();

  const blocks = $derived(timeline(day));
</script>

<section aria-labelledby="day-h" class="flex flex-col gap-1.5" data-card="timeline">
  <h2 id="day-h" class="m-0 text-[15px] font-semibold">Your day</h2>
  {#if blocks.length === 0}
    <p class="m-0 text-muted">Nothing logged {day.past ? 'on this day' : 'yet today'}.</p>
  {/if}
  {#each blocks as b (b.key)}
    <div
      class="flex justify-between px-0.5 pt-2 text-xs font-medium tracking-[0.06em] text-muted uppercase"
      data-meal-label
    >
      <span>{b.label}</span><span class="num">{b.total}</span>
    </div>
    {#each b.lines as r (r.ref)}
      <div
        class="grid min-h-11 grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-lg border border-line bg-panel px-3 py-2 desktop:grid-cols-[48px_minmax(0,1fr)_auto] desktop:gap-3"
        data-row={r.ref}
      >
        <span class="num text-xs text-muted">{r.time}</span>
        <span class="flex min-w-0 flex-col">
          <span class="break-words">{r.name}</span>
          {#if r.sub}<span class="text-xs text-muted">{r.sub}</span>{/if}
        </span>
        <span class="num text-[13px] whitespace-nowrap {r.review ? 'text-amber' : ''}">{r.value}</span>
      </div>
    {/each}
  {/each}
</section>

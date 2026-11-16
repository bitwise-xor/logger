<script lang="ts">
  import { timeline, type Day } from '#lib/day.js';
  import { getToday } from '#lib/today.svelte.js';

  let { day }: { day: Day } = $props();

  const today = getToday();
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
      {@const cls = `grid min-h-11 grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-lg border bg-panel px-3 py-2 text-text no-underline transition-colors duration-[600ms] desktop:grid-cols-[48px_minmax(0,1fr)_auto] desktop:gap-3 ${today.fresh.has(r.ref) ? 'border-blue' : 'border-line'}`}
      {#snippet line()}
        <span class="num text-xs text-muted">{r.time}</span>
        <span class="flex min-w-0 flex-col">
          <span class="break-words">{r.name}</span>
          {#if r.sub}<span class="text-xs text-muted">{r.sub}</span>{/if}
        </span>
        <span class="num text-[13px] whitespace-nowrap {r.review ? 'text-amber' : ''}">{r.value}</span>
      {/snippet}
      <!-- A food row opens the Food day at that row (the plan, step E). -->
      {#if r.ref.startsWith('f')}
        <a href="/food?open={r.ref}" class="{cls} hover:border-muted" data-row={r.ref} data-fresh={today.fresh.has(r.ref) ? '' : undefined}
          >{@render line()}</a
        >
      {:else}
        <div class={cls} data-row={r.ref} data-fresh={today.fresh.has(r.ref) ? '' : undefined}>{@render line()}</div>
      {/if}
    {/each}
  {/each}
</section>

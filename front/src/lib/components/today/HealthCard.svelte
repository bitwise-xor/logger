<script lang="ts">
  import { healthLines, type Day } from '#lib/day.js';

  let { day }: { day: Day } = $props();

  const lines = $derived(healthLines(day));
</script>

<!-- The compact Health card under the timeline (the plan, question 1). Values only in step B; typing them in comes in step C. -->
{#if lines.length}
  <section aria-labelledby="health-h" class="flex flex-col rounded-card border border-line bg-panel px-3 pt-3 pb-1.5 desktop:px-3.5" data-card="health">
    <h2 id="health-h" class="m-0 pb-1 text-[15px] font-semibold">Health</h2>
    {#each lines as h (h.row)}
      <div class="flex min-h-11 items-center gap-3 border-t border-line py-1" data-health={h.row}>
        <span class="flex min-w-0 flex-1 flex-col">
          <span>{h.label}</span>
          {#if h.sub}<span class="text-xs text-muted">{h.sub}</span>{/if}
        </span>
        {#if h.time}<span class="num text-xs text-muted">{h.time}</span>{/if}
        <span class="num text-[13px] whitespace-nowrap {h.value === '–' ? 'text-muted' : ''}">{h.value}</span>
      </div>
    {/each}
  </section>
{/if}

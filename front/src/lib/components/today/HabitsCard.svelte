<script lang="ts">
  import { habitsDone, type Day } from '#lib/day.js';

  let { day }: { day: Day } = $props();
</script>

{#if day.habits.length}
  <section aria-labelledby="habits-h" class="flex flex-col rounded-card border border-line bg-panel px-3 pt-3 pb-1.5 desktop:px-3.5" data-card="habits">
    <div class="flex items-baseline justify-between pb-1">
      <h2 id="habits-h" class="m-0 text-[15px] font-semibold">Habits</h2>
      <span class="num text-[13px] text-muted" data-habits-done>{habitsDone(day.habits)}</span>
    </div>
    {#each day.habits as h (h.name)}
      <button
        type="button"
        aria-pressed={h.complete}
        disabled={day.past}
        class="flex min-h-12 w-full cursor-pointer items-center gap-3 border-0 border-t border-line bg-transparent px-0 py-1 text-left text-text disabled:cursor-default desktop:min-h-11"
      >
        <span
          aria-hidden="true"
          class="flex size-[22px] shrink-0 items-center justify-center rounded-full border-[1.5px] desktop:size-5 {h.complete
            ? 'border-text bg-text text-bg'
            : 'border-muted bg-transparent text-transparent'}"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"
            ><path d="M5 12.5l4.5 4.5L19 7.5"></path></svg
          >
        </span>
        <span class="min-w-0 flex-1">{h.label}</span>
        {#if h.target > 1}<span class="num text-xs text-muted">{h.done}/{h.target}</span>{/if}
        {#if h.avoid}<span class="text-xs text-muted">avoid</span>{/if}
      </button>
    {/each}
  </section>
{/if}

<script lang="ts">
  import { habitsDone, type Day } from '#lib/day.js';
  import { getToday } from '#lib/today.svelte.js';

  let { day }: { day: Day } = $props();
  const today = getToday();
</script>

{#if day.habits.length}
  <section aria-labelledby="habits-h" class="flex flex-col rounded-card border border-line bg-panel px-3 pt-3 pb-1.5 desktop:px-3.5" data-card="habits">
    <div class="flex items-baseline justify-between pb-1">
      <h2 id="habits-h" class="m-0 text-[15px] font-semibold">Habits</h2>
      <span class="num text-[13px] text-muted" data-habits-done>{habitsDone(day.habits)}</span>
    </div>
    <!-- Two habits per row on every width (the owner, 16.11.2026); a long name wraps. -->
    <div class="grid grid-cols-2 gap-x-4" data-habit-grid>
    {#each day.habits as h (h.name)}
      <!-- As app.: tap to tick; a habit done is unticked (its last tick). -->
      <form method="POST" action="?/habit" class="m-0" onsubmit={today.submit('habit', `habit:${h.name}`)}>
      <input type="hidden" name="name" value={h.name} />
      <input type="hidden" name="action" value={h.complete ? 'untick' : 'tick'} />
      {#if h.complete && h.last_tick}<input type="hidden" name="ref" value={h.last_tick} />{/if}
      <button
        type="submit"
        aria-pressed={h.complete}
        disabled={day.past || today.busy[`habit:${h.name}`]}
        data-habit={h.name}
        class="flex min-h-12 w-full cursor-pointer items-center gap-2.5 border-0 border-t border-line bg-transparent px-0 py-1 text-left text-text disabled:cursor-default {day.past
          ? ''
          : 'disabled:opacity-60'} desktop:min-h-11"
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
        <span class="min-w-0 flex-1 break-words">{h.label}</span>
        {#if h.target > 1}<span class="num text-xs text-muted">{h.done}/{h.target}</span>{/if}
        {#if h.avoid}<span class="text-xs text-muted">avoid</span>{/if}
      </button>
      </form>
    {/each}
    </div>
  </section>
{/if}

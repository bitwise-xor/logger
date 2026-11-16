<script lang="ts">
  import HabitGrid from '#lib/components/today/HabitGrid.svelte';
  import { habitsDone, type Day } from '#lib/day.js';
  import { getToday } from '#lib/today.svelte.js';

  let { day }: { day: Day } = $props();
  const today = getToday();
</script>

{#if day.habits.length}
  <section aria-labelledby="habits-h" class="flex flex-col rounded-card border border-line bg-panel px-3 pt-3 pb-1.5 desktop:px-3.5" data-card="habits">
    <div class="flex items-center justify-between pb-1">
      <!-- The Habits page (deploy 94): today's ticks, the last 30 days as a calendar, and your habits. -->
      <h2 id="habits-h" class="m-0 text-[15px] font-semibold">
        <a href="/habits" class="inline-flex min-h-11 items-center gap-1 text-text no-underline desktop:min-h-0" data-habits-link>Habits <span class="text-muted" aria-hidden="true">›</span></a>
      </h2>
      <span class="num text-[13px] text-muted" data-habits-done>{habitsDone(day.habits)}</span>
    </div>
    <HabitGrid habits={day.habits} answers={today} disabled={day.past} />
  </section>
{/if}

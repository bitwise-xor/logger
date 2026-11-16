<script lang="ts">
  import { plain } from '#lib/format.js';
  import { chipNames, type Day } from '#lib/day.js';

  let { day }: { day: Day } = $props();

  // As app.: up to 12 Again chips, the first 8 on a phone (todaypage.AGAIN, AGAIN_PHONE); then the usual meals.
  const again = $derived(day.chips.again.slice(0, 12));
  const names = $derived(chipNames(again.map((a) => a.name)));
  const chip =
    'flex min-h-11 max-w-full cursor-pointer items-center gap-1.5 rounded-full border border-line bg-panel px-3.5 text-text desktop:min-h-9';
</script>

{#if !day.past && (again.length || day.chips.usual.length)}
  <div aria-label="Log again with one tap" role="group" class="flex flex-wrap gap-1.5" data-card="chips">
    {#each again as a, i (a.food_id)}
      <button type="button" class="{chip} {i >= 8 ? 'hidden desktop:flex' : ''}" title="Log {a.name} {plain(a.amount)} {a.unit} now">
        <span class="truncate">+ {names[i]}</span>
        <span class="num text-xs whitespace-nowrap text-muted">{plain(a.amount)} {a.unit}</span>
      </button>
    {/each}
    {#each day.chips.usual as u (u.meal_id)}
      <button type="button" class={chip} title="Log {u.name} now, as saved"><span class="truncate">+ {u.name}</span></button>
    {/each}
  </div>
{/if}

<script lang="ts">
  import { plain } from '#lib/format.js';
  import { chipNames, type Day } from '#lib/day.js';
  import { getToday } from '#lib/today.svelte.js';

  let { day }: { day: Day } = $props();
  const today = getToday();

  // As app.: up to 12 Again chips, the first 8 on a phone (todaypage.AGAIN, AGAIN_PHONE); then the usual meals.
  const again = $derived(day.chips.again.slice(0, 12));
  const names = $derived(chipNames(again.map((a) => a.name)));
  const chip =
    'flex min-h-11 max-w-full cursor-pointer items-center gap-1.5 rounded-full border border-line bg-panel px-3.5 text-text disabled:opacity-60 desktop:min-h-9';
</script>

{#if !day.past && (again.length || day.chips.usual.length)}
  <div aria-label="Log again with one tap" role="group" class="flex flex-wrap gap-1.5" data-card="chips">
    {#each again as a, i (a.food_id)}
      <form method="POST" action="?/again" class="m-0 max-w-full {i >= 8 ? 'hidden desktop:flex' : 'flex'}" onsubmit={today.submit('again', `again:${a.food_id}`)}>
        <input type="hidden" name="food_id" value={a.food_id} />
        <input type="hidden" name="amount" value={a.amount} />
        <button type="submit" class={chip} disabled={today.busy[`again:${a.food_id}`]} title="Log {a.name} {plain(a.amount)} {a.unit} now">
          <span class="truncate">+ {names[i]}</span>
          <span class="num text-xs whitespace-nowrap text-muted">{plain(a.amount)} {a.unit}</span>
        </button>
      </form>
    {/each}
    {#each day.chips.usual as u (u.meal_id)}
      <form method="POST" action="?/usual" class="m-0 flex max-w-full" onsubmit={today.submit('usual', `usual:${u.meal_id}`)}>
        <input type="hidden" name="meal_id" value={u.meal_id} />
        <button type="submit" class={chip} disabled={today.busy[`usual:${u.meal_id}`]} title="Log {u.name} now, as saved"
          ><span class="truncate">+ {u.name}</span></button
        >
      </form>
    {/each}
  </div>
{/if}

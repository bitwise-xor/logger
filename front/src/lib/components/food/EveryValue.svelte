<script lang="ts">
  import type { FoodDayRow } from '#lib/food.js';
  import { getFoodPage } from '#lib/foodday.svelte.js';
  import { everyValue } from '#lib/foodvalues.js';
  import type { Values } from '#lib/nutrients.js';
  import { onMount } from 'svelte';

  // Web 73: an opened food row on the phone shows its ten values as eaten (the row's own, from the Food day) and per 100 g or ml (the
  // food's catalogue values, from GET /food/entry: the same read the editor makes, asked once per row). Here and not in
  // FoodEditor.svelte, because Today opens food rows with the same editor and Today does not change.
  let { row }: { row: FoodDayRow } = $props();
  const food = getFoodPage();
  let per100 = $state<Values | null>(null);
  let failed = $state(false);

  onMount(() => {
    void food.entry(row.ref).then((e) => {
      if (e?.per_100) per100 = e.per_100;
      else failed = true;
    });
  });

  const list = $derived(everyValue(row.values, per100, failed));
</script>

<div class="border-t border-line bg-panel2 px-3 pt-1.5 pb-1 desktop:hidden" data-every-value={row.ref}>
  <table class="w-full border-collapse text-[13px]">
    <caption class="sr-only">Every value of {row.food}: as eaten and per 100 {row.unit}</caption>
    <thead>
      <tr class="text-xs text-muted">
        <th scope="col" class="py-1 text-left font-medium">Every value</th>
        <th scope="col" class="w-[92px] py-1 text-right font-medium">As eaten</th>
        <th scope="col" class="w-[100px] py-1 pl-2 text-right font-medium">Per 100 {row.unit}</th>
      </tr>
    </thead>
    <tbody>
      {#each list as d (d.key)}
        <tr class="border-t border-line" data-value-row={d.key}>
          <th scope="row" class="py-1.5 text-left font-normal {d.sub ? 'pl-3 text-muted' : ''}">{d.label}</th>
          <td class="num py-1.5 text-right {d.unknown ? 'text-muted' : ''}" data-eaten>{d.eaten}</td>
          <td class="num py-1.5 pl-2 text-right {d.per100Known ? '' : 'text-muted'}" data-per100>{d.per100}</td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>

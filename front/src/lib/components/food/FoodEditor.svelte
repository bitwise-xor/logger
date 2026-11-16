<script lang="ts">
  import { amountText, becomes, becomesText, inUnit, parseAmount, stepped, type FoodDayRow } from '#lib/food.js';
  import { hm } from '#lib/format.js';
  import { getFoodPage } from '#lib/foodday.svelte.js';
  import { onMount, untrack } from 'svelte';

  let { row }: { row: FoodDayRow } = $props();
  const food = getFoodPage();

  // The row's values as they stand, to change (the mockup: amount with − and +, what it becomes, Save, Cancel, Delete); plus the
  // unit, the time, another food by its name, and the note (the plan's Food day row).
  const start = untrack(() => row);
  let amount = $state(String(start.amount));
  let unit = $state(start.unit);
  let time = $state(start.time_known ? hm(start.at) : '');
  let name = $state(start.food);
  let note = $state(start.note ?? '');
  let units = $state([{ unit: start.unit, in_basis: 1 }]);

  onMount(() => {
    // The food's other units (a slice, a cup) come from GET /food/entry; until then (or without) the row's own unit.
    void food.entry(start.ref).then((e) => {
      if (e && e.units.length) units = e.units;
    });
  });

  const inBasis = $derived(units.find((u) => u.unit === unit)?.in_basis ?? 1);
  const value = $derived(parseAmount(amount));
  const otherFood = $derived(name.trim().toLowerCase() !== row.food.toLowerCase() && name.trim() !== '');
  const after = $derived(otherFood ? null : becomes(row, value, inBasis));
  const busy = $derived(!!food.busy[`entry:${row.ref}`]);

  function more(dir: 1 | -1) {
    amount = String(stepped(value ?? 0, inBasis, dir));
  }

  function switchUnit(event: Event) {
    const next = (event.currentTarget as HTMLSelectElement).value;
    const to = units.find((u) => u.unit === next)?.in_basis ?? 1;
    if (value !== null) amount = String(inUnit(value, inBasis, to));
    unit = next;
  }

  const label = 'w-[52px] shrink-0 text-xs text-muted desktop:w-16';
  const field = 'h-11 min-w-0 rounded-lg border border-line bg-panel px-3 text-base text-text desktop:h-9 desktop:text-sm';
  const square = 'flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-line bg-panel p-0 text-lg text-text desktop:size-9';
  const btn = 'min-h-11 cursor-pointer rounded-lg px-4 font-medium disabled:opacity-60 desktop:min-h-9';
</script>

<!-- A row opened to change (step E). Save sends the amount, unit and time (and another food when its name changed) to the door's
     /food/entry; Delete removes the row; both answer with Undo. The note is saved on its own (/food/note). -->
<div class="flex flex-col gap-2.5 border-t border-line bg-panel2 px-3 pt-2.5 pb-3 desktop:px-3.5" data-food-editor={row.ref}>
  <form method="POST" action="?/food_entry" class="m-0 flex flex-col gap-2.5" onsubmit={food.submit('food_entry', `entry:${row.ref}`)}>
    <input type="hidden" name="ref" value={row.ref} />
    <div class="flex items-center gap-2">
      <label for="amount-{row.ref}" class={label}>Amount</label>
      <button type="button" class={square} aria-label="Less" onclick={() => more(-1)}>−</button>
      <input
        id="amount-{row.ref}"
        name="amount"
        inputmode="decimal"
        autocomplete="off"
        required
        bind:value={amount}
        class="{field} num w-0 flex-1 text-center desktop:w-28 desktop:flex-none"
      />
      <button type="button" class={square} aria-label="More" onclick={() => more(1)}>+</button>
      <select
        name="unit"
        aria-label="Unit"
        value={unit}
        onchange={switchUnit}
        class="{field} w-auto max-w-28 cursor-pointer px-2"
        disabled={units.length < 2}
      >
        {#each units as u (u.unit)}
          <option value={u.unit}>{u.unit}{u.in_basis !== 1 ? ` (${amountText(u.in_basis)} ${row.unit})` : ''}</option>
        {/each}
      </select>
      {#if units.length < 2}<input type="hidden" name="unit" value={unit} />{/if}
    </div>
    <div class="flex items-center gap-2">
      <label for="time-{row.ref}" class={label}>Time</label>
      <input id="time-{row.ref}" name="time" type="time" bind:value={time} class="{field} num w-32" />
    </div>
    <div class="flex flex-col gap-1">
      <div class="flex items-center gap-2">
        <label for="food-{row.ref}" class={label}>Food</label>
        <input
          id="food-{row.ref}"
          name={otherFood ? 'food_name' : undefined}
          autocomplete="off"
          bind:value={name}
          class="{field} w-0 flex-1 desktop:max-w-80"
        />
      </div>
      {#if otherFood}
        <p class="m-0 pl-[60px] text-xs text-muted desktop:pl-[72px]">Another food from your catalogue, by its exact name.</p>
      {/if}
    </div>
    <div class="flex items-center gap-2">
      <span class={label}>Becomes</span>
      <span class="num flex-1" data-becomes>{otherFood ? 'the new food’s values, after Save' : becomesText(after)}</span>
    </div>
    <div class="flex gap-2">
      <button type="submit" name="action" value="save" class="{btn} border-0 bg-text text-bg" disabled={busy}>Save</button>
      <button type="button" class="{btn} border border-line bg-panel text-text" onclick={() => food.toggle(row.ref)}>Cancel</button>
      <span class="flex-1"></span>
      <button type="submit" name="action" value="delete" formnovalidate class="{btn} border border-line bg-transparent text-muted" disabled={busy}
        >Delete</button
      >
    </div>
  </form>
  <form
    method="POST"
    action="?/food_note"
    class="m-0 flex flex-wrap items-center gap-2 border-t border-line pt-2.5"
    onsubmit={food.submit('food_note', `note:${row.ref}`)}
  >
    <input type="hidden" name="ref" value={row.ref} />
    <label for="note-{row.ref}" class={label}>Note</label>
    <input id="note-{row.ref}" name="note" maxlength="300" autocomplete="off" placeholder="Add a note" bind:value={note} class="{field} w-0 flex-1" />
    <span class="flex gap-2">
      <button type="submit" class="{btn} border border-line bg-panel text-text" disabled={!!food.busy[`note:${row.ref}`] || !note.trim()}
        >Save note</button
      >
      {#if row.note}
        <button
          type="button"
          class="{btn} border-0 bg-transparent text-muted"
          disabled={!!food.busy[`note:${row.ref}`]}
          onclick={() => food.tap('food_note', `note:${row.ref}`, { ref: row.ref, note: '' })}>Remove</button
        >
      {/if}
    </span>
  </form>
</div>

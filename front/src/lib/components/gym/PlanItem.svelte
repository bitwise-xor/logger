<script lang="ts">
  import { canMove, CARDIO_NOTE, hasNumbers, type PlanDay, type PlanItem } from '#lib/gymplan.js';
  import { getPlanPage } from '#lib/planpage.svelte.js';

  // One exercise of a day's plan (app.'s _plan_day): its name and "Weights · plan 3 × 10" (tap to open its numbers: sets and reps,
  // both empty for none; cardio has none: its minutes are set when it is logged), up and down, and take it off the day (with Undo).
  let { day, item, index }: { day: PlanDay; item: PlanItem; index: number } = $props();
  const page = getPlanPage();

  const isOpen = $derived(page.open === item.item_id);
  const draft = $derived(page.numbers[item.item_id]);
  const err = $derived(page.errs[`item:${item.item_id}`]);
  const moving = $derived(!!page.busy[`move:${item.item_id}`]);

  const icon = 'flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent p-0 text-text disabled:cursor-default disabled:opacity-35 desktop:size-9';
  const field = 'num h-11 w-full min-w-0 rounded-lg border border-line bg-panel px-2 text-center text-base text-text desktop:h-9 desktop:text-sm';
</script>

<div
  class="rounded-lg border bg-panel transition-colors duration-500 {page.changed === item.item_id ? 'border-blue' : 'border-line'}"
  data-pi={item.item_id}
>
  <div class="flex items-stretch">
    <button
      type="button"
      class="flex min-h-14 min-w-0 flex-1 cursor-pointer flex-col justify-center gap-0.5 border-0 bg-transparent py-2 pr-1 pl-3 text-left text-text"
      aria-expanded={isOpen}
      onclick={() => page.toggle(item)}
      data-pi-name={item.item_id}
    >
      <span class="font-medium break-words">{item.name}</span>
      <span class="text-[13px] text-muted" data-pi-text>{item.text}</span>
    </button>
    <div class="flex shrink-0 items-center pr-0.5">
      <button
        type="button"
        class={icon}
        aria-label="Move up: {item.name}"
        title="Move up"
        disabled={!canMove(day, index, 'up') || moving}
        onclick={() => page.move(item, 'up')}
        data-up={item.item_id}
      >
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 15l6-6 6 6"></path></svg>
      </button>
      <button
        type="button"
        class={icon}
        aria-label="Move down: {item.name}"
        title="Move down"
        disabled={!canMove(day, index, 'down') || moving}
        onclick={() => page.move(item, 'down')}
        data-down={item.item_id}
      >
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"></path></svg>
      </button>
      <button
        type="button"
        class={icon}
        aria-label="Take {item.name} off this day"
        title="Take off this day"
        disabled={!!page.busy[`rm:${item.item_id}`]}
        onclick={() => page.remove(item)}
        data-remove={item.item_id}
      >
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M4 4l8 8M12 4l-8 8"></path></svg>
      </button>
    </div>
  </div>
  {#if isOpen}
    <div class="flex flex-col gap-2 border-t border-line px-3 pt-2.5 pb-3" data-pi-editor={item.item_id}>
      {#if hasNumbers(item) && draft}
        <form method="POST" action="?/gym_itemset" class="m-0 flex flex-col gap-2" onsubmit={(e) => (e.preventDefault(), page.saveNumbers(item))}>
          <div class="flex gap-2">
            <label class="flex min-w-0 flex-1 flex-col gap-1 text-[13px] text-muted" for="pi{item.item_id}-sets">Sets
              <input id="pi{item.item_id}-sets" name="sets" inputmode="numeric" autocomplete="off" bind:value={draft.sets} class={field} data-field="sets" />
            </label>
            <label class="flex min-w-0 flex-1 flex-col gap-1 text-[13px] text-muted" for="pi{item.item_id}-reps">Reps
              <input id="pi{item.item_id}-reps" name="reps" inputmode="numeric" autocomplete="off" bind:value={draft.reps} class={field} data-field="reps" />
            </label>
          </div>
          {#if err}<p role="alert" class="m-0 text-[13px] text-amber" data-err>{err}</p>{/if}
          <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
            <button
              type="submit"
              class="min-h-11 cursor-pointer rounded-lg border-0 bg-text px-4 font-medium text-bg disabled:opacity-60 desktop:min-h-9"
              disabled={!!page.busy[`item:${item.item_id}`]}
              data-save>Save</button
            >
            <span class="text-xs text-muted">Both empty: no plan numbers.</span>
          </div>
        </form>
      {:else}
        <p class="m-0 text-[13px] text-muted" data-cardio>{CARDIO_NOTE}</p>
      {/if}
    </div>
  {/if}
</div>

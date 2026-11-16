<script lang="ts">
  import { dayTag, DAY_NAME_MAX, type PlanDay } from '#lib/gymplan.js';
  import { getPlanPage } from '#lib/planpage.svelte.js';
  import PlanItem from './PlanItem.svelte';

  // A workout day of the split (app.'s _plan_day): its label and "Today" or the count, its exercises, "+ Add exercise" (a choice of
  // the exercises the read allows, optional sets and reps) and "Rename or remove". A refusal is said next to its form, which keeps
  // what was typed.
  let { day }: { day: PlanDay } = $props();
  const page = getPlanPage();
  const w = $derived(page.plan);

  const adding = $derived(page.adding === day.day_id);
  const editing = $derived(page.editing === day.day_id);
  const addErr = $derived(page.errs[`add:${day.day_id}`]);
  const editErr = $derived(page.errs[`edit:${day.day_id}`]);

  const field = 'h-11 w-full min-w-0 rounded-lg border border-line bg-panel px-3 text-base text-text desktop:h-9 desktop:text-sm';
  const btn = 'min-h-11 cursor-pointer rounded-lg px-4 font-medium disabled:opacity-60 desktop:min-h-9';
  const ghost = `${btn} border border-line bg-panel text-text`;
  const solid = `${btn} border-0 bg-text text-bg`;
</script>

<section
  aria-labelledby="day{day.day_id}-h"
  class="flex min-w-0 flex-col gap-2.5 rounded-card border bg-panel p-3 transition-colors duration-500 desktop:p-3.5 {page.changedDay === day.day_id ? 'border-blue' : 'border-line'}"
  data-day={day.day_id}
>
  <div class="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
    <h2 id="day{day.day_id}-h" class="m-0 text-lg font-semibold tracking-tight" data-day-label>{day.label}</h2>
    {#if day.today}
      <span class="rounded-full bg-blue-bg px-2 text-xs text-blue" data-day-tag>{dayTag(day)}</span>
    {:else}
      <span class="text-[13px] text-muted" data-day-tag>{dayTag(day)}</span>
    {/if}
  </div>

  <div class="flex flex-col gap-2" data-items>
    {#each day.items as item, i (item.item_id)}
      <PlanItem {day} {item} index={i} />
    {:else}
      <p class="m-0 text-muted" data-empty>No exercises yet.</p>
    {/each}
  </div>

  {#if !adding}
    {#if day.can_add.length}
      <button type="button" class="{ghost} self-start" onclick={() => page.startAdd(day)} data-add={day.day_id}>+ Add exercise</button>
    {:else}
      <p class="m-0 text-[13px] text-muted" data-all-on>All your exercises are on this day. New ones: the <a href="/gym/exercises">Exercises</a> part.</p>
    {/if}
  {:else}
    <form
      method="POST"
      action="?/gym_itemadd"
      class="m-0 flex flex-col gap-2.5 rounded-lg border border-line bg-panel2 p-3"
      onsubmit={(e) => (e.preventDefault(), page.addItem(day))}
      data-add-form={day.day_id}
    >
      <label class="flex flex-col gap-1 text-[13px] text-muted">
        Exercise
        <select name="exercise_id" bind:value={page.addOne.exercise_id} class={field} data-add-exercise>
          {#each day.can_add as x (x.exercise_id)}<option value={String(x.exercise_id)}>{x.name}</option>{/each}
        </select>
      </label>
      <div class="flex gap-2">
        <label class="flex min-w-0 flex-1 flex-col gap-1 text-[13px] text-muted">
          Sets (optional)
          <input name="sets" inputmode="numeric" autocomplete="off" bind:value={page.addOne.sets} class={field} data-add-sets />
        </label>
        <label class="flex min-w-0 flex-1 flex-col gap-1 text-[13px] text-muted">
          Reps (optional)
          <input name="reps" inputmode="numeric" autocomplete="off" bind:value={page.addOne.reps} class={field} data-add-reps />
        </label>
      </div>
      {#if addErr}<p role="alert" class="m-0 text-[13px] text-amber" data-err>{addErr}</p>{/if}
      <div class="flex flex-wrap items-center gap-2">
        <button type="submit" class={solid} disabled={!!page.busy[`add:${day.day_id}`]} data-add-go>Add</button>
        <button type="button" class={ghost} onclick={() => page.closeAdd()}>Cancel</button>
      </div>
      <p class="m-0 text-xs text-muted">New exercises: the <a href="/gym/exercises">Exercises</a> part.</p>
    </form>
  {/if}

  {#if !editing}
    <button type="button" class="{ghost} self-start" onclick={() => page.startEdit(day)} data-edit={day.day_id}>Rename or remove</button>
  {:else}
    <div class="flex flex-col gap-2.5 rounded-lg border border-line bg-panel2 p-3" data-edit-panel={day.day_id}>
      <form method="POST" action="?/gym_dayedit" class="m-0 flex flex-col gap-2" onsubmit={(e) => (e.preventDefault(), page.rename(day))}>
        <label class="flex flex-col gap-1 text-[13px] text-muted">
          Name
          <input name="name" maxlength={DAY_NAME_MAX} autocomplete="off" bind:value={page.editName} class={field} data-edit-name />
        </label>
        {#if editErr}<p role="alert" class="m-0 text-[13px] text-amber" data-err>{editErr}</p>{/if}
        <div class="flex flex-wrap items-center gap-2">
          <button type="submit" class={solid} disabled={!!page.busy[`edit:${day.day_id}`]} data-rename>Rename</button>
          <button type="button" class={ghost} onclick={() => page.closeEdit()}>Cancel</button>
        </div>
      </form>
      <div class="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line pt-2.5">
        <button type="button" class={ghost} disabled={!!page.busy[`day:${day.day_id}`]} onclick={() => page.removeDay(day)} data-remove-day={day.day_id}>Remove this day</button>
        <span class="text-xs text-muted">Past workouts keep its name.</span>
      </div>
    </div>
  {/if}
</section>

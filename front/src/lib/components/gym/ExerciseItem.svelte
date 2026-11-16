<script lang="ts">
  import { activeLabel, type ExerciseRow } from '#lib/gymplan.js';
  import { getExercisesPage } from '#lib/exercisespage.svelte.js';

  // One exercise of the list (app.'s render_exercises): its name, the line under it (kind, "also: words", "n workouts, last dd.mm."
  // or "not done yet"), Rename (a small form: the name, Save; past workouts move with it) and Retire or Bring back. A retired one is
  // greyed. A refusal of Rename is said next to its form, which keeps the name typed.
  let { x }: { x: ExerciseRow } = $props();
  const page = getExercisesPage();

  const renaming = $derived(page.renaming === x.exercise_id);
  const err = $derived(page.errs[`rename:${x.exercise_id}`]);

  const btn = 'min-h-11 cursor-pointer rounded-lg px-4 font-medium disabled:opacity-60 desktop:min-h-9';
  const ghost = `${btn} border border-line bg-panel text-text`;
</script>

<div
  class="flex flex-col gap-2 rounded-lg border bg-panel p-3 transition-colors duration-500 {page.changed === x.exercise_id ? 'border-blue' : 'border-line'}"
  data-ex={x.exercise_id}
  data-active={x.active ? 'true' : 'false'}
>
  <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
    <span class="flex min-w-0 flex-1 basis-48 flex-col gap-0.5 {x.active ? '' : 'opacity-60'}">
      <span class="font-medium break-words" data-ex-name>{x.name}</span>
      <span class="text-[13px] text-muted" data-ex-meta>{x.meta}</span>
    </span>
    <div class="flex shrink-0 gap-2">
      {#if !renaming}
        <button type="button" class={ghost} onclick={() => page.startRename(x)} data-rename={x.exercise_id}>Rename</button>
      {/if}
      <button type="button" class={ghost} disabled={!!page.busy[`active:${x.exercise_id}`]} onclick={() => page.toggleActive(x)} data-active-btn={x.exercise_id}
        >{activeLabel(x)}</button
      >
    </div>
  </div>
  {#if renaming}
    <form method="POST" action="?/gym_rename" class="m-0 flex flex-col gap-2 border-t border-line pt-2.5" onsubmit={(e) => (e.preventDefault(), page.rename(x))} data-rename-form={x.exercise_id}>
      <label class="flex flex-col gap-1 text-[13px] text-muted">
        New name for {x.name}
        <!-- svelte-ignore a11y_autofocus -->
        <input
          name="name"
          maxlength={page.exercises?.limits.name_max ?? 60}
          autocomplete="off"
          autofocus
          bind:value={page.renameText}
          class="h-11 w-full min-w-0 rounded-lg border border-line bg-panel px-3 text-base text-text desktop:h-9 desktop:text-sm"
          data-rename-name
        />
      </label>
      {#if err}<p role="alert" class="m-0 text-[13px] text-amber" data-err>{err}</p>{/if}
      <div class="flex flex-wrap items-center gap-2">
        <button type="submit" class="{btn} border-0 bg-text text-bg" disabled={!!page.busy[`rename:${x.exercise_id}`]} data-rename-go>Save</button>
        <button type="button" class={ghost} onclick={() => page.closeRename()}>Cancel</button>
        <span class="text-xs text-muted">Past workouts move with it.</span>
      </div>
    </form>
  {/if}
</div>

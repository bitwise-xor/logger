<script lang="ts">
  import { circleLabel, circleOf, draftText, logLabel, upText, type GymRow } from '#lib/gym.js';
  import { getGymPage } from '#lib/gympage.svelte.js';

  // One exercise of the Workout page (app.'s _row): the round button logs the read's ready numbers in one tap, takes a done one off
  // (all of today's rows, with Undo), or, where the numbers are not complete, opens the row. The name, the numbers (today's rows or
  // what the circle logs), "+2.5 kg" and the "Last …" line open the row: − and + (and typing) for sets, reps and kg, or minutes and
  // km, with the read's steps and limits; "Log", or "Add another row" when it is logged already; × per logged row.
  let { row }: { row: GymRow } = $props();
  const page = getGymPage();

  const circle = $derived(circleOf(row));
  const up = $derived(upText(row.up_kg));
  const isOpen = $derived(page.open === row.exercise_id);
  const fields = $derived(page.fields(row));
  const busy = $derived(!!page.busy[`circle:${row.exercise_id}`]);

  const square = 'flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-line bg-panel p-0 text-lg text-text desktop:size-9';
  const field = 'num h-11 w-0 min-w-0 flex-1 rounded-lg border border-line bg-panel px-2 text-center text-base text-text desktop:h-9 desktop:w-24 desktop:flex-none desktop:text-sm';
  const btn = 'min-h-11 cursor-pointer rounded-lg px-4 font-medium disabled:opacity-60 desktop:min-h-9';
</script>

<div
  class="rounded-lg border bg-panel transition-colors duration-500 {page.changed === row.exercise_id ? 'border-blue' : 'border-line'}"
  data-gx={row.exercise_id}
  data-done={row.logged.length ? 'true' : 'false'}
>
  <div class="flex items-stretch">
    <button
      type="button"
      class="flex min-h-14 w-[52px] shrink-0 cursor-pointer items-center justify-center border-0 bg-transparent p-0 disabled:cursor-default disabled:opacity-60"
      aria-pressed={circle === 'done'}
      aria-label={circleLabel(row)}
      title={circle === 'off' ? 'Set the numbers first: tap the name' : undefined}
      disabled={busy}
      onclick={() => page.circle(row)}
      data-circle={circle}
    >
      <span
        aria-hidden="true"
        class="flex size-6 items-center justify-center rounded-full border-[1.5px] {circle === 'done'
          ? 'border-text bg-text text-bg'
          : circle === 'ready'
            ? 'border-muted bg-transparent text-transparent'
            : 'border-dashed border-line bg-transparent text-transparent'}"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"
          ><path d="M5 12.5l4.5 4.5L19 7.5"></path></svg
        >
      </span>
    </button>
    <button
      type="button"
      class="flex min-h-14 min-w-0 flex-1 cursor-pointer flex-col justify-center gap-0.5 border-0 bg-transparent py-2 pr-3 pl-0 text-left text-text"
      aria-expanded={isOpen}
      onclick={() => page.toggle(row)}
      data-gx-name={row.exercise_id}
    >
      <span class="flex w-full flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span class="flex-auto font-medium break-words">{row.name}</span>
        <span class="num text-[13px]" data-gx-text>{row.text}</span>
        {#if up}<span class="num self-center rounded-full bg-blue-bg px-2 text-xs text-blue" data-up>{up}</span>{/if}
      </span>
      <span class="text-[13px] text-muted" data-last>{row.last_text}</span>
    </button>
  </div>
  {#if isOpen}
    <div class="flex flex-col gap-2 border-t border-line px-3 pt-2.5 pb-3" data-gx-editor={row.exercise_id}>
      <form method="POST" action="?/gym_tick" class="m-0 flex flex-col gap-2" onsubmit={(e) => (e.preventDefault(), page.log(row))}>
        {#each fields as f (f.name)}
          <div class="flex items-center gap-2">
            <label for="g{row.exercise_id}-{f.name}" class="w-16 shrink-0 text-[13px] text-muted">{f.label}</label>
            <button type="button" class={square} aria-label="{f.label} down by {f.step}" onclick={() => page.step(f, -1)} data-less={f.name}>−</button>
            <input
              id="g{row.exercise_id}-{f.name}"
              name={f.name}
              inputmode="decimal"
              autocomplete="off"
              bind:value={page.draft[f.name]}
              class={field}
              data-field={f.name}
            />
            <button type="button" class={square} aria-label="{f.label} up by {f.step}" onclick={() => page.step(f, 1)} data-more={f.name}>+</button>
          </div>
        {/each}
        <div class="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1">
          <button type="submit" class="{btn} border-0 bg-text text-bg" disabled={!!page.busy[`log:${row.exercise_id}`]} data-log>{logLabel(row)}</button>
          <span class="num text-[13px] text-muted" data-draft-text>{draftText(row.kind, fields, page.draft)}</span>
        </div>
      </form>
      {#if row.logged.length}
        <div class="flex flex-col border-t border-line pt-1.5" data-logged>
          <span class="text-xs font-medium tracking-wider text-muted uppercase">Logged today</span>
          {#each row.logged as s (s.set_id)}
            <div class="flex min-h-11 items-center gap-2" data-set={s.set_id}>
              <span class="num min-w-0 flex-1">{s.text}</span>
              <button
                type="button"
                class={square}
                aria-label="Remove {s.text}"
                title="Remove"
                disabled={!!page.busy[`set:${s.set_id}`]}
                onclick={() => page.removeSet(s)}
                data-remove={s.set_id}
              >
                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"
                  ><path d="M4 4l8 8M12 4l-8 8"></path></svg
                >
              </button>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</div>

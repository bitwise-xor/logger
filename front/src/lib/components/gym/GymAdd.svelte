<script lang="ts">
  import { getGymPage } from '#lib/gympage.svelte.js';
  import { NAME_MAX } from '#lib/gym.js';

  // "+ Add exercise" (app.'s form on the Workout tab): a name, its kind, other words (optional); it also goes on today's day of the
  // split, so it shows in today's list. A retired exercise of the same name comes back with its history. No Undo; a refusal is
  // said here and the words stay.
  const page = getGymPage();
  const w = $derived(page.workout);

  const field = 'h-11 w-full min-w-0 rounded-lg border border-line bg-panel px-3 text-base text-text desktop:h-9 desktop:text-sm';
  const btn = 'min-h-11 cursor-pointer rounded-lg px-4 font-medium disabled:opacity-60 desktop:min-h-9';
</script>

{#if !page.adding}
  <button type="button" class="{btn} self-start border border-line bg-panel text-text" onclick={() => page.startAdd()} data-add>+ Add exercise</button>
{:else if w}
  <form
    method="POST"
    action="?/gym_new"
    class="m-0 flex flex-col gap-2.5 rounded-lg border border-line bg-panel2 p-3"
    onsubmit={(e) => (e.preventDefault(), page.addNew())}
    data-add-form
  >
    <label class="flex flex-col gap-1 text-[13px] text-muted">
      Name{w.day ? `, put on today’s ${w.day.name}` : ''}
      <!-- svelte-ignore a11y_autofocus -->
      <input
        name="name"
        maxlength={NAME_MAX}
        autocomplete="off"
        autofocus
        list="gym-retired"
        placeholder="e.g. Cable fly"
        bind:value={page.newOne.name}
        class={field}
      />
    </label>
    <datalist id="gym-retired">
      {#each w.retired as r (r)}<option value={r}></option>{/each}
    </datalist>
    <fieldset class="m-0 flex flex-col gap-1 border-0 p-0">
      <legend class="pb-1 text-[13px] text-muted">Kind</legend>
      <div class="flex flex-wrap gap-1.5">
        {#each w.kinds as k (k.key)}
          <label
            class="inline-flex min-h-11 cursor-pointer items-center rounded-full border px-3.5 text-sm font-medium desktop:min-h-9 {page.newOne.kind === k.key
              ? 'border-text bg-text text-bg'
              : 'border-line bg-panel text-text'}"
          >
            <input type="radio" name="kind" value={k.key} bind:group={page.newOne.kind} class="sr-only" />{k.label}
          </label>
        {/each}
      </div>
    </fieldset>
    <label class="flex flex-col gap-1 text-[13px] text-muted">
      Other words (optional)
      <input name="words" maxlength="200" autocomplete="off" placeholder="e.g. bench, chest press" bind:value={page.newOne.words} class={field} />
    </label>
    {#if page.err}<p role="alert" class="m-0 text-[13px] text-amber" data-add-err>{page.err}</p>{/if}
    <div class="flex flex-wrap items-center gap-2">
      <button type="submit" class="{btn} border-0 bg-text text-bg" disabled={!!page.busy.new}>Add</button>
      <button type="button" class="{btn} border border-line bg-panel text-text" onclick={() => page.closeAdd()}>Cancel</button>
    </div>
    <p class="m-0 text-xs text-muted">A retired exercise of the same name comes back with its history.</p>
  </form>
{/if}

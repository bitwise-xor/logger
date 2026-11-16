<script lang="ts">
  import HabitRow from '#lib/components/habits/HabitRow.svelte';
  import { chips, groupTitle, helpText, type Habits } from '#lib/habits.js';
  import { getHabitsPage } from '#lib/habitspage.svelte.js';

  // "Your habits": the filter (tracked, not tracked, retired, all, each with its count), the habits by group, and "+ New habit"
  // with its form. app.'s Habits page, the same functions; hiding and ordering habits on Today stay at app. (Settings).
  let { habits }: { habits: Habits } = $props();
  const page = getHabitsPage();
  const lim = $derived(habits.limits);
  const d = $derived(page.newOne);
  const err = $derived(page.err?.where === 'new' ? page.err.text : null);
  const busy = $derived(!!page.busy.new);

  const field = 'h-11 min-w-0 rounded-lg border border-line bg-panel px-3 text-base text-text desktop:h-9 desktop:text-sm';
  const btn = 'min-h-11 cursor-pointer rounded-lg px-4 font-medium disabled:opacity-60 desktop:min-h-9';
</script>

<section aria-labelledby="list-h" class="flex flex-col gap-2 rounded-card border border-line bg-panel px-3 pt-3 pb-3 desktop:px-3.5" data-card="list">
  <div class="flex items-center justify-between gap-2">
    <h2 id="list-h" class="m-0 text-[15px] font-semibold">Your habits</h2>
    <button
      type="button"
      class="{btn} border-0 bg-text text-bg"
      aria-expanded={page.adding}
      onclick={() => (page.adding ? page.closeNew() : page.newHabit())}
      data-new-habit>{page.adding ? 'Close' : '+ New habit'}</button
    >
  </div>

  {#if page.adding}
    <form
      method="POST"
      action="?/habits_manage"
      class="m-0 flex flex-col gap-2.5 rounded-lg border border-line bg-panel2 p-3"
      onsubmit={(e) => {
        e.preventDefault();
        void page.addNew();
      }}
      data-new-form
    >
      <label class="flex flex-col gap-1 text-xs text-muted">
        Name
        <input name="label" bind:value={d.label} maxlength={lim.label_max} required autocomplete="off" placeholder="e.g. Stretching" class="{field} text-text" aria-label="Name of the new habit" />
      </label>
      <div class="grid grid-cols-2 gap-2.5">
        <label class="flex flex-col gap-1 text-xs text-muted">
          Group
          <select name="group" bind:value={d.group} class="{field} text-text">
            {#each habits.groups as g (g.key)}<option value={g.key}>{g.label}</option>{/each}
          </select>
        </label>
        <label class="flex flex-col gap-1 text-xs text-muted">
          Times a day
          <input name="target" type="text" inputmode="numeric" maxlength="2" autocomplete="off" bind:value={d.target} class="{field} num text-text" />
        </label>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={d.track}
        class="flex min-h-11 w-full cursor-pointer items-center gap-2.5 border-0 bg-transparent p-0 text-left text-text"
        onclick={() => (d.track = !d.track)}
        data-track-now
      >
        <span aria-hidden="true" class="flex h-6 w-10 shrink-0 items-center rounded-full border border-line p-0.5 {d.track ? 'justify-end bg-text' : 'justify-start bg-panel'}">
          <span class="size-4.5 rounded-full {d.track ? 'bg-bg' : 'bg-muted'}"></span>
        </span>
        Track it now
      </button>
      {#if err}<p class="m-0 text-[13px] text-amber" role="alert" data-refusal>{err}</p>{/if}
      <p class="m-0 text-xs text-muted">Then log it in the chat or the logging box by its name ("did stretching"), or tick it above.</p>
      <div class="flex gap-2">
        <button type="submit" class="{btn} border-0 bg-text text-bg" disabled={busy}>Add</button>
        <button type="button" class="{btn} border border-line bg-panel text-text" onclick={() => page.closeNew()}>Cancel</button>
      </div>
    </form>
  {/if}

  <nav class="flex flex-wrap gap-1.5" aria-label="Show" data-chips>
    {#each chips(habits) as c (c.key)}
      <a
        href={c.href}
        aria-current={c.current ? 'page' : undefined}
        data-sveltekit-noscroll
        class="inline-flex min-h-11 items-center rounded-full border px-3.5 text-[13px] whitespace-nowrap no-underline desktop:min-h-8 {c.current
          ? 'border-text bg-text text-bg'
          : 'border-line bg-panel text-text'}"
        data-show={c.key}>{c.text}</a
      >
    {/each}
  </nav>
  <p class="m-0 text-xs text-muted" data-help>{helpText(habits)}</p>

  {#each habits.list as g (g.group)}
    <div class="flex flex-col" data-group={g.group}>
      <h3 class="m-0 pt-1.5 pb-1 text-[13px] font-semibold text-muted">{groupTitle(g)}</h3>
      {#each g.habits as h (h.name)}
        <HabitRow {h} groups={habits.groups} />
      {/each}
    </div>
  {:else}
    <p class="m-0 text-muted">Nothing here.</p>
  {/each}
</section>

<script lang="ts">
  import ProblemCard from '#lib/components/ProblemCard.svelte';
  import GymDock from '#lib/components/gym/GymDock.svelte';
  import ChoreForm from '#lib/components/home/edit/ChoreForm.svelte';
  import EditChoreRow from '#lib/components/home/edit/EditChoreRow.svelte';
  import EditZoneCard from '#lib/components/home/edit/EditZoneCard.svelte';
  import ZoneForm from '#lib/components/home/edit/ZoneForm.svelte';
  import HomeHeader from '#lib/components/home/HomeHeader.svelte';
  import { EditPage, setEditPage } from '#lib/homeedit.svelte.js';
  import { FLAT_EDIT_NOTE, GOAL_NOTE, keyOf } from '#lib/homeparts.js';
  import { untrack } from 'svelte';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();

  // Home's Edit zones page (deploy 100): app.'s Edit zones in the new look, every change saving in place. "‹ Zones", "Weekly goal"
  // ("Sessions a week", Save), "Whole flat" with its chores, a card per zone (retired ones too) with its chores, "Rename or change the
  // zone", Retire or Bring back, and at the end "+ New chore" and "+ New zone". A chore opens its form (and "Per zone" for a whole-flat
  // one); a chore's page leads here with `#chore-7` and that form open. None of these saves has Undo, none takes a key: the answer
  // bar shows the door's words, and a refusal is said next to its form, which keeps what was typed. One column, up to 720 px on the PC.
  const page = setEditPage(untrack(() => new EditPage(data.edit)));
  $effect.pre(() => page.load(data.edit));

  // The chore a chore's page asked for (`#chore-7`): its form open, scrolled into view (after the first paint, on the client).
  $effect(() => {
    if (!page.edit || typeof location === 'undefined') return;
    const id = untrack(() => page.openFromHash(location.hash));
    if (id !== null) requestAnimationFrame(() => document.getElementById(`chore-${id}`)?.scrollIntoView({ block: 'start' }));
  });

  const e = $derived(page.edit);
  const btn = 'min-h-11 cursor-pointer rounded-lg border border-line bg-panel px-4 font-medium text-text disabled:opacity-60 desktop:min-h-9';
  const field = 'h-11 w-24 rounded-lg border border-line bg-panel px-3 text-base text-text desktop:h-9 desktop:text-sm';
  const card = 'flex flex-col gap-2.5 rounded-card border bg-panel p-3 desktop:p-3.5';
</script>

<svelte:head><title>Edit zones · Logger</title></svelte:head>

<HomeHeader on="zones" />

{#if !e}
  <ProblemCard kind={data.problem ?? 'trouble'} appHref="{data.appUrl}/web/home/edit" />
{:else}
  <a href="/home/zones" class="inline-flex min-h-11 items-center self-start text-blue no-underline hover:underline" data-back>‹ Zones</a>
  <main class="flex flex-col gap-3 desktop:max-w-[720px] desktop:gap-4">
    <section aria-labelledby="goal-h" class="{card} transition-colors duration-500 {page.changed === keyOf.goal ? 'border-blue' : 'border-line'}" data-card="goal">
      <h2 id="goal-h" class="m-0 text-[15px] font-semibold">Weekly goal</h2>
      <form method="POST" novalidate class="m-0 flex flex-wrap items-end gap-2" onsubmit={(ev) => (ev.preventDefault(), page.saveGoal())} data-goal-form>
        <label class="flex flex-col gap-1 text-[13px] text-muted">
          Sessions a week
          <input name="goal" type="number" inputmode="numeric" min={e.limits.goal_min} max={e.limits.goal_max} value={page.goal} oninput={(ev) => (page.goal = ev.currentTarget.value)} class={field} data-goal />
        </label>
        <button type="submit" class="min-h-11 cursor-pointer rounded-lg border-0 bg-text px-4 font-medium text-bg disabled:opacity-60 desktop:min-h-9" disabled={!!page.busy.goal} data-goal-save>Save</button>
      </form>
      {#if page.errs[keyOf.goal]}<p role="alert" class="m-0 text-[13px] text-amber" data-err>{page.errs[keyOf.goal]}</p>{/if}
      <p class="m-0 text-[13px] text-muted">{GOAL_NOTE}</p>
    </section>

    {#if e.flat.length}
      <section aria-labelledby="flat-h" class="{card} border-line" data-card="flat">
        <div class="flex items-baseline justify-between gap-2">
          <h2 id="flat-h" class="m-0 text-[15px] font-semibold">Whole flat</h2>
          <span class="text-right text-[13px] text-muted">{FLAT_EDIT_NOTE}</span>
        </div>
        {#each e.flat as c (c.chore_id)}
          <EditChoreRow {c} />
        {/each}
      </section>
    {/if}

    {#each e.zones as z (z.zone_id)}
      <EditZoneCard {z} />
    {/each}

    <section aria-labelledby="add-h" class="{card} border-line" data-card="add">
      <h2 id="add-h" class="m-0 text-[15px] font-semibold">Add</h2>
      <button type="button" class="{btn} self-start" aria-expanded={!!page.open[keyOf.newChore]} onclick={() => page.toggleNewChore()} data-new-chore>+ New chore</button>
      {#if page.open[keyOf.newChore]}<ChoreForm k={keyOf.newChore} label="Add" save={() => page.addChore()} />{/if}
      <button type="button" class="{btn} self-start" aria-expanded={!!page.open[keyOf.newZone]} onclick={() => page.toggleNewZone()} data-new-zone>+ New zone</button>
      {#if page.open[keyOf.newZone]}
        <ZoneForm k={keyOf.newZone} label="Add" save={() => page.addZone()} note="A retired zone of the same name comes back with its history." />
      {/if}
    </section>
  </main>
{/if}

<GymDock answers={page} />

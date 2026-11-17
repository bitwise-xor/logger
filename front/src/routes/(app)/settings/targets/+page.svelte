<script lang="ts">
  import GymDock from '#lib/components/gym/GymDock.svelte';
  import ProblemCard from '#lib/components/ProblemCard.svelte';
  import SettingsHeader from '#lib/components/settings/SettingsHeader.svelte';
  import { S } from '#lib/components/settings/styles.js';
  import { n } from '#lib/format.js';
  import { settingsAppPath } from '#lib/places.js';
  import { targetsProblem, type SettingsTargets } from '#lib/settings.js';
  import { SettingsPage } from '#lib/settingspage.svelte.js';
  import { untrack } from 'svelte';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();

  // Settings > Food targets (deploy 111): app.'s form in the new look. "From" (the logging day), the nine targets with the door's
  // units, a note, Save; the answer in the bar, a refusal next to the form in the door's words (what was typed stays); the history,
  // newest first. A new date starts new targets; earlier days keep theirs.
  const page = untrack(() => new SettingsPage<SettingsTargets>('targets', data.read, '/settings/targets'));
  $effect.pre(() => page.load(data.read));
  const t = $derived(page.read);

  /** The form as the read has it (the page's load, also on the server, and after a save went through). */
  const formOf = (r: SettingsTargets | null) => ({
    from: r?.valid_from ?? '',
    typed: Object.fromEntries((r?.fields ?? []).map((f) => [f.key, f.value === null ? '' : String(f.value)])) as Record<string, string>,
    note: '',
  });
  let form = $state(untrack(() => formOf(data.read)));
  let filled = untrack(() => data.read);
  $effect.pre(() => {
    if (data.read !== filled) form = formOf((filled = data.read));
  });

  const busy = $derived(!!page.busy.targets);
  function save(event: SubmitEvent) {
    event.preventDefault();
    if (!t) return;
    const stop = targetsProblem(t.fields, form.typed, t.limits);
    page.refuse('targets', stop);
    if (stop) return;
    void page.tap('settings_targets', 'targets', { valid_from: form.from, ...form.typed, note: form.note }).then((a) => {
      if (a && a.outcome !== 'rejected') form = formOf(page.read);
    });
  }
  // the history's columns, as app.'s table
  const COLS = ['kcal', 'protein', 'fat', 'sat_fat', 'carbs', 'water_ml'];
  const HEADS = ['kcal', 'Protein', 'Fat', 'Sat fat', 'Carbs', 'Water'];
</script>

<svelte:head><title>Food targets · Settings · Logger</title></svelte:head>

<SettingsHeader on="targets" />

{#if !t}
  <ProblemCard kind={data.problem ?? 'trouble'} appHref="{data.appUrl}{settingsAppPath('targets')}" />
{:else}
  <main class="{S.wide} desktop:grid desktop:grid-cols-2 desktop:items-start desktop:gap-4">
    <form method="POST" action="?/settings_targets" class={S.card} onsubmit={save} data-form="targets">
      <h2 class={S.h2}>Food targets</h2>
      <label class="{S.fieldLabel} max-w-[220px]">
        From
        <input name="valid_from" type="date" required bind:value={form.from} class="{S.field} num" data-field="valid_from" />
      </label>
      <div class="grid grid-cols-2 gap-x-2.5 gap-y-2 tablet:grid-cols-3">
        {#each t.fields as f (f.key)}
          <label class={S.fieldLabel}>
            {f.label}
            <span class="relative">
              <input
                name={f.key}
                type="text"
                inputmode="decimal"
                autocomplete="off"
                bind:value={form.typed[f.key]}
                oninput={() => page.refuse('targets', null)}
                class="{S.field} num pr-12"
                data-field={f.key}
              />
              <span class="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs text-muted">{f.unit}</span>
            </span>
          </label>
        {/each}
      </div>
      <label class={S.fieldLabel}>
        Note
        <input name="note" type="text" maxlength={t.limits.note_max} autocomplete="off" placeholder="why it changed" bind:value={form.note} class={S.field} data-field="note" />
      </label>
      {#if page.errs.targets}<p class={S.refusal} role="alert" data-refusal>{page.errs.targets}</p>{/if}
      <div><button type="submit" class={S.primary} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button></div>
      <p class={S.note} data-line>A new date starts new targets; earlier days keep theirs.</p>
      <p class={S.note} data-hint>{t.hint}</p>
    </form>

    <section class={S.card} aria-labelledby="hist-h" data-history>
      <h2 id="hist-h" class={S.h2}>History</h2>
      {#if t.history.length}
        <div class="-mx-3 overflow-x-auto px-3">
          <table class={S.table}>
            <thead>
              <tr><th>From</th>{#each HEADS as h (h)}<th>{h}</th>{/each}<th>Note</th></tr>
            </thead>
            <tbody>
              {#each t.history as h (h.valid_from)}
                <tr data-history-row={h.valid_from}>
                  <td class="num">{h.valid_from_text}</td>
                  {#each COLS as c (c)}<td class="num">{n(h.values[c])}</td>{/each}
                  <td class="min-w-[120px] !text-left !whitespace-normal">{h.note ?? ''}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {:else}
        <p class={S.note}>No targets yet.</p>
      {/if}
    </section>
  </main>
{/if}

<GymDock answers={page} />

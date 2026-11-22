<script lang="ts">
  import GymDock from '#lib/components/gym/GymDock.svelte';
  import ProblemCard from '#lib/components/ProblemCard.svelte';
  import SettingsHeader from '#lib/components/settings/SettingsHeader.svelte';
  import Switch from '#lib/components/settings/Switch.svelte';
  import { S } from '#lib/components/settings/styles.js';
  import { settingsAppPath } from '#lib/places.js';
  import {
    EMPTY_MEASURE,
    canMove,
    heightProblem,
    intervalProblem,
    measureDraft,
    measureFields,
    measureLine,
    measureProblem,
    type BodyMeasure,
    type MeasureDraft,
    type MeasureSuggestion,
    type SettingsBody,
  } from '#lib/settings.js';
  import { SettingsPage } from '#lib/settingspage.svelte.js';
  import { untrack } from 'svelte';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();

  // Settings > Body (deploy 111): the height (cm, from a date; for waist ÷ height on the Health page) with its history, and the body
  // measurements: how often they are due and which measures show. Each form saves on its own; a refusal stands next to its form in
  // the door's words ("Keep at least one measure.") and what was typed stays. Web item 58: the measures are the owner's, a list in
  // the door's order; each row has its landmark and range, the shown switch (saved with "Due every" by Save), up and down (saved at
  // once) and Edit, which opens the form in place (Save, Cancel, Remove: asked first, and not possible for a measure with values).
  // "+ Add a measure" opens the same form empty, with the door's suggestions as chips that fill it. One form is open at a time.
  const page = untrack(() => new SettingsPage<SettingsBody>('body', data.read, '/settings/body'));
  $effect.pre(() => page.load(data.read));
  const b = $derived(page.read);

  const heightOf = (r: SettingsBody | null) => ({ height: r?.height ? String(r.height.cm) : '', from: r?.valid_from ?? '' });
  const measuresOf = (r: SettingsBody | null) => ({
    interval: r ? String(r.interval.days) : '',
    shown: Object.fromEntries((r?.measures ?? []).map((m) => [m.key, m.shown])) as Record<string, boolean>,
  });
  // the forms as the read has them (the page's load, also on the server, and after each form's save went through)
  let h = $state(untrack(() => heightOf(data.read)));
  let m = $state(untrack(() => measuresOf(data.read)));
  let filled = untrack(() => data.read);
  $effect.pre(() => {
    if (data.read !== filled) {
      filled = data.read;
      h = heightOf(filled);
      m = measuresOf(filled);
    }
  });

  function saveHeight(event: SubmitEvent) {
    event.preventDefault();
    if (!b) return;
    const stop = heightProblem(h.height, b.height_range);
    page.refuse('height', stop);
    if (stop) return;
    void page.tap('settings_height', 'height', { valid_from: h.from, height: h.height }).then((a) => {
      if (a && a.outcome !== 'rejected') h = heightOf(page.read);
    });
  }
  // a measure's form: "add", a measure's key (Edit), or none open
  let editing = $state<string | null>(null);
  let d = $state<MeasureDraft>({ ...EMPTY_MEASURE });
  const busyMeasure = $derived(Object.keys(page.busy).some((k) => k.startsWith('measure') || k === 'confirm:settings_body_measure'));
  // a measure that is gone (removed) closes its form
  $effect.pre(() => {
    if (b && editing && editing !== 'add' && !b.measures.some((x) => x.key === editing)) editing = null;
  });

  function open(which: string, from: MeasureSuggestion | null) {
    editing = which;
    d = from ? measureDraft(from) : { ...EMPTY_MEASURE };
    page.refuse('measure', null);
  }
  /** After a measure's save: new measures shown as the door says, the switches already changed here kept. */
  function keepShown() {
    if (page.read) m.shown = Object.fromEntries(page.read.measures.map((x) => [x.key, m.shown[x.key] ?? x.shown]));
  }
  function saveMeasure(event: SubmitEvent) {
    event.preventDefault();
    if (!b || !editing) return;
    const stop = measureProblem(d, b.limits.cm);
    page.refuse('measure', stop);
    if (stop) return;
    const fields = editing === 'add' ? measureFields('add', d) : measureFields('edit', d, editing);
    void page.tap('settings_body_measure', 'measure', fields).then((a) => {
      keepShown();
      if (a && a.outcome !== 'rejected') editing = null;
    });
  }
  function move(x: BodyMeasure, dir: 'up' | 'down') {
    void page.tap('settings_body_measure', `measure:${x.key}`, { action: 'move', measure: x.key, dir }).then(keepShown);
  }
  function remove(x: BodyMeasure) {
    page.ask(`Remove the measure ${x.label}?`, 'Yes, remove', 'settings_body_measure', { action: 'remove', measure: x.key });
  }

  function saveMeasures(event: SubmitEvent) {
    event.preventDefault();
    if (!b) return;
    const stop = intervalProblem(m.interval, b.interval);
    page.refuse('body', stop);
    if (stop) return;
    void page.tap('settings_body', 'body', { interval: m.interval, show: b.measures.filter((x) => m.shown[x.key]).map((x) => x.key) }).then((a) => {
      if (a && a.outcome !== 'rejected') m = measuresOf(page.read);
    });
  }

  const arrow =
    'flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-line bg-transparent p-0 text-text hover:border-muted disabled:cursor-default disabled:opacity-30 disabled:hover:border-line';
  const chip = 'min-h-11 cursor-pointer rounded-full border border-line bg-panel px-3.5 text-[13px] text-text hover:border-muted desktop:min-h-8';
</script>

<svelte:head><title>Body · Settings · Logger</title></svelte:head>

<!-- A measure's form: x the measure (Edit), or null (Add, with the suggestions as chips that fill it). -->
{#snippet measureForm(x: BodyMeasure | null)}
  {@const lim = b!.limits}
  <form
    method="POST"
    action="?/settings_body_measure"
    class="m-0 flex flex-col gap-2.5 rounded-lg border border-line bg-panel2 p-2.5"
    onsubmit={saveMeasure}
    aria-label={x ? `Edit ${x.label}` : 'Add a measure'}
    data-measure-form={x ? x.key : 'add'}
  >
    <input type="hidden" name="action" value={x ? 'edit' : 'add'} />
    {#if x}<input type="hidden" name="measure" value={x.key} />{/if}
    {#if !x && b!.suggestions.length}
      <div class="flex flex-wrap items-center gap-1.5" role="group" aria-label="Suggestions">
        <span class="text-xs text-muted">Suggestions:</span>
        {#each b!.suggestions as s (s.label)}
          <button type="button" class={chip} onclick={() => ((d = measureDraft(s)), page.refuse('measure', null))} data-suggestion={s.label}>{s.label}</button>
        {/each}
      </div>
    {/if}
    <label class={S.fieldLabel}>
      Name
      <input name="label" type="text" autocomplete="off" maxlength={lim.label.max} bind:value={d.label} oninput={() => page.refuse('measure', null)} class={S.field} data-field="m-label" />
    </label>
    <label class={S.fieldLabel}>
      Where to measure <span class="sr-only">(optional)</span>
      <input name="landmark" type="text" autocomplete="off" maxlength={lim.landmark_max} placeholder="Optional" bind:value={d.landmark} class={S.field} data-field="m-landmark" />
    </label>
    <div class="grid grid-cols-2 gap-x-2.5">
      <label class={S.fieldLabel}>
        Lowest
        <span class="relative">
          <input name="min" type="text" inputmode="decimal" autocomplete="off" bind:value={d.min} oninput={() => page.refuse('measure', null)} class="{S.field} num pr-11" data-field="m-min" />
          <span class="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs text-muted">cm</span>
        </span>
      </label>
      <label class={S.fieldLabel}>
        Highest
        <span class="relative">
          <input name="max" type="text" inputmode="decimal" autocomplete="off" bind:value={d.max} oninput={() => page.refuse('measure', null)} class="{S.field} num pr-11" data-field="m-max" />
          <span class="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs text-muted">cm</span>
        </span>
      </label>
    </div>
    <p class="{S.note} -mt-1 text-xs">The usual range, {lim.cm.min} to {lim.cm.max} cm: a value outside it is read back.</p>
    <label class={S.fieldLabel}>
      Other words for it, with commas
      <input name="words" type="text" autocomplete="off" placeholder="Optional, e.g. calves" bind:value={d.words} class={S.field} data-field="m-words" />
    </label>
    {#if page.errs.measure}<p class={S.refusal} role="alert" data-measure-refusal>{page.errs.measure}</p>{/if}
    <div class="flex flex-wrap gap-2">
      <button type="submit" class={S.primary} disabled={busyMeasure} data-measure-save>{x ? 'Save' : 'Add'}</button>
      <button type="button" class={S.plain} onclick={() => ((editing = null), page.refuse('measure', null))} data-measure-cancel>Cancel</button>
      {#if x}
        <button type="button" class={S.plain} disabled={busyMeasure || x.has_values} aria-describedby={x.has_values ? `rm-${x.key}` : undefined} onclick={() => remove(x)} data-remove={x.key}>Remove</button>
      {/if}
    </div>
    {#if x?.has_values}<p id="rm-{x.key}" class={S.note} data-remove-note>{b!.hints.remove}</p>{/if}
  </form>
{/snippet}

<SettingsHeader on="body" />

{#if !b}
  <ProblemCard kind={data.problem ?? 'trouble'} appHref="{data.appUrl}{settingsAppPath('body')}" />
{:else}
  <main class={S.main}>
    <form method="POST" action="?/settings_height" class={S.card} onsubmit={saveHeight} data-form="height">
      <h2 class={S.h2}>Height</h2>
      <div class="grid grid-cols-2 gap-x-2.5 gap-y-2">
        <label class={S.fieldLabel}>
          Height
          <span class="relative">
            <input name="height" type="text" inputmode="decimal" autocomplete="off" bind:value={h.height} oninput={() => page.refuse('height', null)} class="{S.field} num pr-11" data-field="height" />
            <span class="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs text-muted">cm</span>
          </span>
        </label>
        <label class={S.fieldLabel}>
          From
          <input name="valid_from" type="date" required bind:value={h.from} class="{S.field} num" data-field="valid_from" />
        </label>
      </div>
      {#if page.errs.height}<p class={S.refusal} role="alert" data-refusal>{page.errs.height}</p>{/if}
      <div><button type="submit" class={S.primary} disabled={!!page.busy.height}>Save</button></div>
      {#if b.heights.length}
        <table class={S.table} data-heights>
          <tbody>
            {#each b.heights as h (h.valid_from)}<tr><td class="num">{h.valid_from_text}</td><td class="num">{h.cm} cm</td></tr>{/each}
          </tbody>
        </table>
      {/if}
      <p class={S.note} data-hint>{b.hints.height}</p>
    </form>

    <section class={S.card} aria-labelledby="bm-h" data-form="body">
      <h2 id="bm-h" class={S.h2}>Body measurements</h2>
      <form method="POST" action="?/settings_body" id="body-form" class="m-0" onsubmit={saveMeasures}>
        <label class="flex flex-wrap items-center gap-2">
          Due every
          <input
            name="interval"
            type="text"
            inputmode="numeric"
            autocomplete="off"
            bind:value={m.interval}
            oninput={() => page.refuse('body', null)}
            aria-label="Due every, days ({b.interval.min} to {b.interval.max})"
            class="{S.short} num w-16 text-right"
            data-field="interval"
          />
          days
        </label>
      </form>
      <ul class="m-0 flex list-none flex-col p-0" aria-label="Measures, in their order" data-measures>
        {#each b.measures as x, i (x.key)}
          <li class="border-t border-line" data-measure-row={x.key}>
            {#if editing === x.key}
              <div class="py-2">{@render measureForm(x)}</div>
            {:else}
              <div class="grid grid-cols-[minmax(0,1fr)_44px_44px_44px_auto] items-center gap-x-1 pt-1">
                <span class="min-w-0 truncate font-medium {m.shown[x.key] ? '' : 'text-muted'}">{x.label}</span>
                <Switch on={!!m.shown[x.key]} label="Show {x.label}" onclick={() => ((m.shown[x.key] = !m.shown[x.key]), page.refuse('body', null))} data-measure={x.key} />
                <button type="button" class={arrow} aria-label="Move {x.label} up" disabled={busyMeasure || !canMove(b.measures, i, -1)} onclick={() => move(x, 'up')} data-up={x.key}>
                  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10l4-4 4 4"></path></svg>
                </button>
                <button type="button" class={arrow} aria-label="Move {x.label} down" disabled={busyMeasure || !canMove(b.measures, i, 1)} onclick={() => move(x, 'down')} data-down={x.key}>
                  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6l4 4 4-4"></path></svg>
                </button>
                <button type="button" class="{S.plain} px-3" aria-label="Edit {x.label}" disabled={busyMeasure} onclick={() => open(x.key, x)} data-edit={x.key}>Edit</button>
                <small class="col-span-full pb-2 text-xs text-muted" data-measure-line>
                  {measureLine(x)}{x.words.length ? ` · also “${x.words.join('”, “')}”` : ''}
                </small>
              </div>
            {/if}
          </li>
        {/each}
      </ul>
      {#if page.errs.body}<p class={S.refusal} role="alert" data-refusal>{page.errs.body}</p>{/if}
      {#if page.errs.measure && !editing}<p class={S.refusal} role="alert" data-measure-refusal>{page.errs.measure}</p>{/if}
      <p class={S.note} data-hint>{b.hints.measures}</p>
      <div><button type="submit" form="body-form" class={S.primary} disabled={!!page.busy.body} data-save-body>Save</button></div>
      <div class="border-t border-line pt-2.5">
        {#if editing === 'add'}
          {@render measureForm(null)}
        {:else}
          <button type="button" class={S.plain} disabled={busyMeasure} onclick={() => open('add', null)} data-add-measure>+ Add a measure</button>
        {/if}
      </div>
    </section>
  </main>
{/if}

<GymDock answers={page} />

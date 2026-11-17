<script lang="ts">
  import GymDock from '#lib/components/gym/GymDock.svelte';
  import ProblemCard from '#lib/components/ProblemCard.svelte';
  import SettingsHeader from '#lib/components/settings/SettingsHeader.svelte';
  import Switch from '#lib/components/settings/Switch.svelte';
  import { S } from '#lib/components/settings/styles.js';
  import { settingsAppPath } from '#lib/places.js';
  import { heightProblem, intervalProblem, type SettingsBody } from '#lib/settings.js';
  import { SettingsPage } from '#lib/settingspage.svelte.js';
  import { untrack } from 'svelte';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();

  // Settings > Body (deploy 111): the height (cm, from a date; for waist ÷ height on the Health page) with its history, and the body
  // measurements: how often they are due and which of the five measures show. Each form saves on its own; a refusal stands next to
  // its form in the door's words ("Keep at least one measure.") and what was typed stays.
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
</script>

<svelte:head><title>Body · Settings · Logger</title></svelte:head>

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

    <form method="POST" action="?/settings_body" class={S.card} onsubmit={saveMeasures} data-form="body">
      <h2 class={S.h2}>Body measurements</h2>
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
      <div class="flex flex-col">
        {#each b.measures as x (x.key)}
          <Switch on={!!m.shown[x.key]} onclick={() => ((m.shown[x.key] = !m.shown[x.key]), page.refuse('body', null))} data-measure={x.key}>{x.label}</Switch>
        {/each}
      </div>
      {#if page.errs.body}<p class={S.refusal} role="alert" data-refusal>{page.errs.body}</p>{/if}
      <p class={S.note} data-hint>{b.hints.measures}</p>
      <div><button type="submit" class={S.primary} disabled={!!page.busy.body}>Save</button></div>
    </form>
  </main>
{/if}

<GymDock answers={page} />

<script lang="ts">
  import ProblemCard from '#lib/components/ProblemCard.svelte';
  import SettingsHeader from '#lib/components/settings/SettingsHeader.svelte';
  import { S } from '#lib/components/settings/styles.js';
  import { settingsAppPath } from '#lib/places.js';
  import { EXPORT_FAILED } from '#lib/settings.js';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();

  // Settings > Export (deploy 111): the door's words, the tick box for private and gratitude entries (off unless ticked), Download and
  // the last download. Download is a plain form post to ./download, which hands the door's ZIP through (the browser saves it; the
  // page stays). When the file could not be made it comes back here with ?failed=1 and says so.
  const e = $derived(data.read);
  // Core 37: with private entries ticked, the authenticator code (the door checks it as at a sign-in); after a refusal the box stays
  // ticked and the door's words stand under the field.
  let priv = $state(false);
  $effect.pre(() => {
    if (data.refused) priv = true;
  });
</script>

<svelte:head><title>Export · Settings · Logger</title></svelte:head>

<SettingsHeader on="export" />

{#if !e}
  <ProblemCard kind={data.problem ?? 'trouble'} appHref="{data.appUrl}{settingsAppPath('export')}" />
{:else}
  <main class={S.main}>
    <form method="POST" action="/settings/export/download" class={S.card} data-form="export">
      <h2 class={S.h2}>{e.title}</h2>
      <p class={S.note} data-intro>{e.intro}</p>
      <!-- the tick box: the whole line is the 44 px target (the box itself is drawn, the input is for the form and the screen reader) -->
      <label class="flex min-h-11 cursor-pointer items-center gap-2 desktop:min-h-9">
        <input type="checkbox" name="private" value="1" class="peer sr-only" bind:checked={priv} data-private />
        <span
          aria-hidden="true"
          class="flex size-[18px] shrink-0 items-center justify-center rounded-[4px] border border-muted text-transparent peer-checked:border-blue peer-checked:bg-blue peer-checked:text-on-blue peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-blue"
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8.5l3.2 3L13 4.5"></path></svg>
        </span>
        {e.private_label}
      </label>
      {#if priv}
        <label class="flex flex-col gap-1" data-code-field>
          <span class="text-[13px] text-muted">Authenticator code (private and gratitude entries leave only with it)</span>
          <input
            name="code"
            type="text"
            inputmode="numeric"
            autocomplete="one-time-code"
            pattern="[0-9 ]*"
            maxlength="8"
            required
            class="min-h-11 w-40 rounded-lg border border-line bg-panel px-3 text-base text-text num focus-visible:border-blue focus-visible:outline-none desktop:min-h-9 tablet:text-sm"
            data-code
          />
        </label>
      {/if}
      {#if data.refused}<p class={S.refusal} role="alert" data-code-refused>{data.refused}</p>{/if}
      {#if data.failed}<p class={S.refusal} role="alert" data-failed>{EXPORT_FAILED}</p>{/if}
      <div><button type="submit" class={S.primary} data-download>{e.button}</button></div>
      {#if e.last}<p class="{S.note} num" data-last>{e.last.text}</p>{/if}
      <p class={S.note} data-hint>{e.hint}</p>
    </form>
  </main>
{/if}

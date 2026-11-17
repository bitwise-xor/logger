<script lang="ts">
  import GymDock from '#lib/components/gym/GymDock.svelte';
  import ProblemCard from '#lib/components/ProblemCard.svelte';
  import SettingsHeader from '#lib/components/settings/SettingsHeader.svelte';
  import Switch from '#lib/components/settings/Switch.svelte';
  import ThisDevice from '#lib/components/settings/ThisDevice.svelte';
  import { S } from '#lib/components/settings/styles.js';
  import { settingsAppPath } from '#lib/places.js';
  import { addressTag, nudgesDraft, nudgesFields, pushLine, TWICE_LINE, type NudgesDraft, type SettingsNotify } from '#lib/settings.js';
  import { SettingsPage } from '#lib/settingspage.svelte.js';
  import { untrack } from 'svelte';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();

  // Settings > Notifications (deploy 111): every device that gets nudges, here (logger.) and at app., each with "Turn off"; the amber
  // line when one phone is on at both (the door's `twice`: each nudge comes twice); "Send a test notification" (only when there are
  // devices; the door's refusal when none took it is in the answer bar); the Nudges form (the master switch, each nudge's switch and
  // hours after waking, the gratitude one's note), Save. Deploy 112: "This device" on top (Turn on here, Turn off): ThisDevice.svelte.
  const page = untrack(() => new SettingsPage<SettingsNotify>('notify', data.read, '/settings/notifications'));
  $effect.pre(() => page.load(data.read));
  const s = $derived(page.read);

  // the form as the read has it (the page's load, also on the server, and after a save went through)
  const draftOf = (r: SettingsNotify | null): NudgesDraft => (r ? nudgesDraft(r) : { on: true, rows: [] });
  let draft = $state(untrack(() => draftOf(data.read)));
  let filled = untrack(() => data.read);
  $effect.pre(() => {
    if (data.read !== filled) draft = draftOf((filled = data.read));
  });

  function save(event: SubmitEvent) {
    event.preventDefault();
    void page.tap('settings_nudges', 'nudges', nudgesFields(draft)).then((a) => {
      if (a && a.outcome !== 'rejected') draft = draftOf(page.read);
    });
  }
</script>

<svelte:head><title>Notifications · Settings · Logger</title></svelte:head>

<SettingsHeader on="notify" />

{#if !s}
  <ProblemCard kind={data.problem ?? 'trouble'} appHref="{data.appUrl}{settingsAppPath('notify')}" />
{:else}
  <main class={S.main}>
    <!-- deploy 112: the "This device" card (Turn on, Turn off on this device) -->
    <ThisDevice {page} read={s} />

    <section class={S.card} aria-labelledby="subs-h" data-subscriptions>
      <h2 id="subs-h" class={S.h2}>Devices that get nudges</h2>
      {#if s.twice}<p class="m-0 rounded-[10px] bg-amber-bg px-3 py-2.5 text-[13px] font-medium text-amber" data-twice>{TWICE_LINE}</p>{/if}
      <div class="flex flex-col">
        {#each s.subscriptions as x, i (x.id)}
          <div class="flex flex-col gap-1 py-2.5 {i ? 'border-t border-line' : 'pt-0'}" data-subscription={x.id}>
            <span class="flex flex-wrap items-center gap-1.5 font-medium">
              {x.name}
              <span class={S.tag} data-address>{addressTag(x.address)}</span>
              {#if x.this}<span class={S.pill} data-this>this device</span>{/if}
            </span>
            <span class="num text-xs text-muted" data-line>{pushLine(x)}</span>
            <div class="pt-1">
              <button type="button" class={S.plain} disabled={!!page.busy[`push:${x.id}`]} onclick={() => void page.tap('push_off', `push:${x.id}`, { id: String(x.id) })} data-push-off
                >Turn off</button
              >
            </div>
          </div>
        {:else}
          <p class={S.note} data-none>No device gets nudges.</p>
        {/each}
      </div>
      {#if s.subscriptions.length}
        <div><button type="button" class={S.plain} disabled={!!page.busy.test} onclick={() => void page.tap('push_test', 'test', {})} data-test>Send a test notification</button></div>
      {/if}
    </section>

    <form method="POST" action="?/settings_nudges" class={S.card} onsubmit={save} data-form="nudges">
      <h2 class={S.h2}>Nudges</h2>
      <Switch on={draft.on} onclick={() => (draft.on = !draft.on)} data-nudges-on>
        <span class="font-medium">{s.on_label}</span>
        {#if !draft.on}<small class="block text-xs text-muted">off: nothing is sent</small>{/if}
      </Switch>
      <div class="flex flex-col {draft.on ? '' : 'opacity-55'}">
        {#each s.nudges as nu, i (nu.key)}
          {@const r = draft.rows[i]}
          {#if r}
            <div class="grid grid-cols-[44px_minmax(0,1fr)] items-center gap-x-2 gap-y-0.5 border-t border-line py-2" data-nudge={nu.key}>
              <Switch on={r.on} label={nu.label.replace(/,$/, '')} onclick={() => (r.on = !r.on)} data-switch />
              <span class="min-w-0">
                {nu.label.replace(/,$/, '')}
                {#if nu.note}<small class="block text-xs text-muted" data-note>{nu.note}</small>{/if}
              </span>
              <span class="col-start-2 flex items-center gap-2">
                <input
                  name={nu.hours.key}
                  type="number"
                  inputmode="decimal"
                  min={nu.hours.min}
                  max={nu.hours.max}
                  step={nu.hours.step}
                  value={r.hours}
                  oninput={(e) => (r.hours = e.currentTarget.value)}
                  aria-label="{nu.label.replace(/,$/, '')}: {nu.after} ({nu.hours.min} to {nu.hours.max})"
                  class="{S.short} num w-20 shrink-0 text-right"
                  data-hours={nu.hours.key}
                />
                <span class="text-[13px] text-muted">{nu.after}</span>
              </span>
            </div>
          {/if}
        {/each}
      </div>
      {#if page.errs.nudges}<p class={S.refusal} role="alert" data-refusal>{page.errs.nudges}</p>{/if}
      <div><button type="submit" class={S.primary} disabled={!!page.busy.nudges}>Save</button></div>
      <p class={S.note}>
        Times count from the time you woke up (the Woke up value). Quiet hours: nothing before you log waking up, nothing after a bed time is logged,
        nothing later than {s.awake_hours} hours after waking. Each nudge comes at most once a day; the check runs every 5 minutes.
      </p>
    </form>
  </main>
{/if}

<GymDock answers={page} />

<script lang="ts">
  import GymDock from '#lib/components/gym/GymDock.svelte';
  import ProblemCard from '#lib/components/ProblemCard.svelte';
  import SettingsHeader from '#lib/components/settings/SettingsHeader.svelte';
  import { S } from '#lib/components/settings/styles.js';
  import { settingsAppPath } from '#lib/places.js';
  import { addressTag, deviceLine, type SettingsDevices } from '#lib/settings.js';
  import { SettingsPage } from '#lib/settingspage.svelte.js';
  import { untrack } from 'svelte';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();

  // Settings > Devices (deploy 111): every signed-in device, here (logger.) and at app., last used first, with its address; this
  // device has a "this device" pill and no button (Sign out on More ends it), any other one "Sign out". "Sign out all others" (only
  // when there are others) is asked first in the answer bar. The quiet Watch card leads to the Gym's Activity.
  const page = untrack(() => new SettingsPage<SettingsDevices>('devices', data.read, '/settings/devices'));
  $effect.pre(() => page.load(data.read));
  const d = $derived(page.read);
  const others = () => page.ask('Sign out every other device, here and at app.?', 'Yes, sign out', 'settings_others');
</script>

<svelte:head><title>Devices · Settings · Logger</title></svelte:head>

<SettingsHeader on="devices" />

{#if !d}
  <ProblemCard kind={data.problem ?? 'trouble'} appHref="{data.appUrl}{settingsAppPath('devices')}" />
{:else}
  <main class={S.main}>
    <section class={S.card} aria-labelledby="dev-h">
      <h2 id="dev-h" class={S.h2}>Signed-in devices <span class="num text-[13px] font-normal text-muted">{d.devices.length}</span></h2>
      <div class="flex flex-col">
        {#each d.devices as x, i (x.id)}
          <div class="flex flex-col gap-1 py-2.5 {i ? 'border-t border-line' : 'pt-0'}" data-device={x.id} data-current={x.current ? '1' : '0'}>
            <span class="flex flex-wrap items-center gap-1.5 font-medium">
              {x.name}
              <span class={S.tag} data-address>{addressTag(x.address)}</span>
              {#if x.current}<span class={S.pill} data-this>this device</span>{/if}
            </span>
            <span class="num text-xs text-muted" data-line>{deviceLine(x)}</span>
            {#if !x.current}
              <div class="pt-1">
                <button type="button" class={S.plain} disabled={!!page.busy[`device:${x.id}`]} onclick={() => void page.tap('settings_device', `device:${x.id}`, { id: x.id })} data-signout
                  >Sign out</button
                >
              </div>
            {/if}
          </div>
        {/each}
      </div>
      {#if d.others > 0}
        <div><button type="button" class={S.plain} disabled={!!page.busy['confirm:settings_others']} onclick={others} data-others>Sign out all others</button></div>
      {/if}
      <p class={S.note}>A device in use stays signed in (30 days from its last use). If a phone is lost, sign it out here. Sign out on More ends this device only.</p>
    </section>

    <section class={S.quiet} aria-labelledby="watch-h" data-watch>
      <h2 id="watch-h" class={S.h2}>Watch</h2>
      <p class={S.note}>Steps, heart rate, sleep and workouts from the watch show under Gym › Activity once they arrive.</p>
      <div><a href="/gym/activity" class="inline-flex min-h-11 items-center font-medium text-blue desktop:min-h-0" data-watch-link>Activity in Gym ›</a></div>
    </section>
  </main>
{/if}

<GymDock answers={page} />

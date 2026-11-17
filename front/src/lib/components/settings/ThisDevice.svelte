<script lang="ts">
  import { onMount } from 'svelte';
  import { S } from './styles.js';
  import { browserEnv, deviceState, isIos, turnOff, turnOn, WORDS, type PushEnv } from '#lib/pushdevice.js';
  import { dateText, type SettingsNotify } from '#lib/settings.js';
  import type { SettingsPage } from '#lib/settingspage.svelte.js';

  // Settings > Notifications' "This device" card (deploy 112), above "Devices that get nudges": whether this browser gets the nudges,
  // and Turn on / Turn off on this device. The rules and the browser's steps are in src/lib/pushdevice.ts; the saves go through the
  // tab's form actions (push_subscribe, push_off), whose answer brings the fresh list. Nothing of the browser is touched until a
  // press: the worker is registered only by "Turn on". Before the page runs in the browser, the door's word only (buttons waiting).
  let { page, read }: { page: SettingsPage<SettingsNotify>; read: SettingsNotify } = $props();

  let env = $state.raw<PushEnv | null>(null);
  let working = $state(false);
  onMount(() => {
    env = browserEnv(window);
  });
  const st = $derived(deviceState(read, env));

  async function on() {
    const key = read.public_key;
    if (!env || !key || working) return;
    working = true;
    try {
      const r = await turnOn(env, key, async (f) => {
        const a = await page.tap('push_subscribe', 'push:on', f);
        return !!a && a.outcome !== 'rejected';
      });
      if (!r.on && r.words) page.tell(r.words);
    } finally {
      env = browserEnv(window); // the permission may have changed
      working = false;
    }
  }

  async function off(id: number) {
    if (!env || working) return;
    working = true;
    try {
      await turnOff(env, () => page.tap('push_off', `push:${id}`, { id: String(id) }));
    } catch {
      // the answer bar says what the door said
    } finally {
      working = false;
    }
  }
</script>

<section class={S.card} aria-labelledby="device-h" data-this-device={st.kind}>
  <h2 id="device-h" class={S.h2}>This device</h2>
  <span class="flex items-center gap-2 font-medium" data-device-state>
    <span class="size-2 shrink-0 rounded-full {st.kind === 'on' ? 'bg-blue' : 'bg-track'}" aria-hidden="true"></span>
    {st.kind === 'on' ? `On since ${dateText(st.row.on_since)}` : 'Off on this device'}
  </span>
  {#if st.kind === 'on'}
    {@const id = st.row.id}
    <div>
      <button type="button" class={S.plain} disabled={!env || working || !!page.busy[`push:${id}`]} onclick={() => void off(id)} data-device-off>Turn off on this device</button>
    </div>
  {:else if st.kind === 'off'}
    <div>
      <button type="button" class={S.primary} disabled={!env || working} onclick={() => void on()} data-device-on>Turn on</button>
    </div>
    {#if !(env && isIos(env))}<p class={S.note} data-device-hint>{WORDS.iphone}</p>{/if}
  {:else}
    <p class="{S.note} {st.kind === 'blocked' ? 'font-medium text-amber' : ''}" data-device-why>{st.words}</p>
  {/if}
</section>

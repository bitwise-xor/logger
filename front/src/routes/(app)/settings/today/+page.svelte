<script lang="ts">
  import GymDock from '#lib/components/gym/GymDock.svelte';
  import ProblemCard from '#lib/components/ProblemCard.svelte';
  import SettingsHeader from '#lib/components/settings/SettingsHeader.svelte';
  import Switch from '#lib/components/settings/Switch.svelte';
  import { S } from '#lib/components/settings/styles.js';
  import { settingsAppPath } from '#lib/places.js';
  import { canMove, groupFields, moved, switched, type SettingsToday, type TodayGroup, type TodayItem } from '#lib/settings.js';
  import { SettingsPage } from '#lib/settingspage.svelte.js';
  import { untrack } from 'svelte';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();

  // Settings > Today page (deploy 111): what Today shows, and in which order, by the door's groups (Habits, Health card rows, Usual
  // meal buttons, the To review box, Cards). Every tap saves at once: a switch (shown or hidden) or an arrow (one place up or down)
  // posts the whole group in its new state, and the list on screen is the door's fresh read in the answer (never a guess of this
  // page). While a group's tap is on its way, that group waits. "Show everything again" is asked first in the answer bar. On the PC
  // the groups stand in two columns. The gratitude goal stays at app. (with the gratitude list).
  const page = untrack(() => new SettingsPage<SettingsToday>('today', data.read, '/settings/today'));
  $effect.pre(() => page.load(data.read));
  const t = $derived(page.read);
  const columns = $derived(t ? [t.groups.slice(0, 2), t.groups.slice(2)] : []);

  const send = (g: TodayGroup, items: TodayItem[]) => void page.tap('settings_today', `group:${g.kind}`, groupFields(g.kind, items));
  const reset = () => page.ask('Show everything on Today again, in the default order?', 'Yes, reset', 'settings_today_reset');

  const arrow =
    'flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-line bg-transparent p-0 text-text hover:border-muted disabled:cursor-default disabled:opacity-30 disabled:hover:border-line';
</script>

<svelte:head><title>Today page · Settings · Logger</title></svelte:head>

{#snippet group(g: TodayGroup)}
  {@const busy = !!page.busy[`group:${g.kind}`]}
  {@const arrows = g.items.length > 1}
  <section class="flex min-w-0 flex-col rounded-card border border-line bg-panel px-3 pt-2 pb-1" aria-labelledby="g-{g.kind}" aria-busy={busy} data-group={g.kind}>
    <h2 id="g-{g.kind}" class="{S.label} pt-1 pb-1.5">{g.heading}</h2>
    {#each g.items as it, i (it.id)}
      <div class="grid min-h-[52px] items-center gap-1 border-t border-line {arrows ? 'grid-cols-[minmax(0,1fr)_48px_44px_44px]' : 'grid-cols-[minmax(0,1fr)_48px]'}" data-item="{g.kind}:{it.id}" data-shown={it.shown ? '1' : '0'}>
        <span class="flex min-w-0 flex-col">
          <span class="truncate {it.shown ? '' : 'text-muted'}">{it.label}</span>
          <small class="text-xs text-muted">{it.shown ? 'shown' : 'hidden'}</small>
        </span>
        <span class="flex justify-center">
          <Switch on={it.shown} label="Show {it.label}" disabled={busy} onclick={() => send(g, switched(g.items, i))} data-switch />
        </span>
        {#if arrows}
          <button type="button" class={arrow} aria-label="Move {it.label} up" disabled={busy || !canMove(g.items, i, -1)} onclick={() => send(g, moved(g.items, i, -1))} data-up>
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10l4-4 4 4"></path></svg>
          </button>
          <button type="button" class={arrow} aria-label="Move {it.label} down" disabled={busy || !canMove(g.items, i, 1)} onclick={() => send(g, moved(g.items, i, 1))} data-down>
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6l4 4 4-4"></path></svg>
          </button>
        {/if}
      </div>
    {:else}
      <p class="{S.note} border-t border-line py-3">None yet.</p>
    {/each}
  </section>
{/snippet}

<SettingsHeader on="today" />

{#if !t}
  <ProblemCard kind={data.problem ?? 'trouble'} appHref="{data.appUrl}{settingsAppPath('today')}" />
{:else}
  <main class={S.wide}>
    <p class={S.note}>What Today shows, and in which order.</p>
    <div class="flex flex-col gap-3 desktop:grid desktop:grid-cols-2 desktop:items-start desktop:gap-4" data-columns>
      {#each columns as col, c (c)}
        <div class="contents desktop:flex desktop:min-w-0 desktop:flex-col desktop:gap-3" data-column={c}>
          {#each col as g (g.kind)}{@render group(g)}{/each}
        </div>
      {/each}
    </div>
    <div>
      <button type="button" class={S.plain} disabled={!!page.busy['confirm:settings_today_reset']} onclick={reset} data-reset>Show everything again</button>
    </div>
    <!-- app. orders with number boxes; here the arrows do, so its sentence about numbers is left out. -->
    <p class={S.note} data-hint>{t.hint.replace('Order: the smaller number comes first. ', '')}</p>
  </main>
{/if}

<GymDock answers={page} />

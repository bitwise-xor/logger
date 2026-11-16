<script lang="ts">
  import ProblemCard from '#lib/components/ProblemCard.svelte';
  import GymDock from '#lib/components/gym/GymDock.svelte';
  import FlatCard from '#lib/components/home/FlatCard.svelte';
  import HomeHeader from '#lib/components/home/HomeHeader.svelte';
  import StartCard from '#lib/components/home/StartCard.svelte';
  import ZoneCard from '#lib/components/home/ZoneCard.svelte';
  import { setZonesPage, ZonesPage } from '#lib/homezones.svelte.js';
  import { untrack } from 'svelte';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();

  // Home's Zones page (deploy 100, step 3 of the move to logger.): app.'s Zones tab in the new look, every tap saving in place. "Edit
  // zones", "When did you last do these?" (only when the door lists jobs), "Whole flat" with its tiles, then a card per zone. One
  // column on phones and tablets in app.'s order; from 1100 px the starting points and Whole flat in the middle and the zone cards
  // beside them (the mockup's screen 10). No Home save is sent again by the page (saver.ts), so no resend on mount.
  const page = setZonesPage(untrack(() => new ZonesPage(data.zones, data.undo)));
  $effect.pre(() => page.load(data.zones, data.undo));

  const z = $derived(page.zones);
</script>

<svelte:head><title>Home zones · Logger</title></svelte:head>

<HomeHeader on="zones" />

{#if !z}
  <ProblemCard kind={data.problem ?? 'trouble'} appHref="{data.appUrl}/web/home/zones" />
{:else}
  <a
    href="/home/edit"
    class="inline-flex min-h-11 items-center self-start rounded-lg border border-line bg-panel px-4 font-medium text-text no-underline hover:bg-panel2 desktop:min-h-9"
    data-edit-link>Edit zones</a
  >
  {#if z.empty}
    <section class="flex flex-col gap-1 rounded-card border border-line bg-panel p-3 desktop:max-w-[640px] desktop:p-3.5" data-card="empty">
      <p class="m-0 text-muted" data-empty>No zones or chores yet.</p>
    </section>
  {:else}
    <main class="flex flex-col gap-3 desktop:grid desktop:grid-cols-2 desktop:items-start desktop:gap-4">
      <div class="flex min-w-0 flex-col gap-3 desktop:gap-4" data-col="middle">
        <StartCard />
        <FlatCard />
      </div>
      <div class="flex min-w-0 flex-col gap-3 desktop:gap-4" data-col="zones">
        {#each z.zones as zone (zone.zone_id)}
          <ZoneCard z={zone} appUrl={data.appUrl} />
        {/each}
      </div>
    </main>
  {/if}
{/if}

<GymDock answers={page} />

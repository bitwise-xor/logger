<script lang="ts">
  import ProblemCard from '#lib/components/ProblemCard.svelte';
  import GymDock from '#lib/components/gym/GymDock.svelte';
  import ChoreRow from '#lib/components/home/ChoreRow.svelte';
  import HomeHeader from '#lib/components/home/HomeHeader.svelte';
  import RecentCard from '#lib/components/home/RecentCard.svelte';
  import TimeCard from '#lib/components/home/TimeCard.svelte';
  import TimerCard from '#lib/components/home/TimerCard.svelte';
  import WeekCard from '#lib/components/home/WeekCard.svelte';
  import { hiddenLine, nWord, showAll } from '#lib/home.js';
  import { NowPage, setNowPage } from '#lib/homepage.svelte.js';
  import { untrack } from 'svelte';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();

  // Home's Now page (deploy 99, step 3 of the move to logger.): app.'s Now tab in the new look, the tick circle saving in place. In
  // app.'s order: the timer card (when one is open), the time card, This week, "Longest since last done" (six rows, "Show all N
  // chores" leads to Zones, "N hidden for today"), Recently done. One column on phones and tablets; from 1100 px
  // the timer, the time and the list in the middle and This week and Recently done in a right column of 340 px (the mockup's
  // screen 9). No Home save is sent again by the page (saver.ts), so no resend on mount.
  const page = setNowPage(untrack(() => new NowPage(data.now, data.undo, data.min)));
  $effect.pre(() => page.load(data.now, data.undo, data.min));

  const now = $derived(page.now);
  const more = $derived(now ? showAll(now) : null);
  const hidden = $derived(now ? hiddenLine(now.hidden) : null);

  // The Timer card counts each second while it runs (the end is kept on the server; this only draws the seconds left).
  $effect(() => {
    if (page.now?.timer?.state !== 'running') return;
    const id = setInterval(() => (page.tickNow = Date.now()), 1000);
    return () => clearInterval(id);
  });
</script>

<svelte:head><title>Home · Logger</title></svelte:head>

<HomeHeader />

{#if !now}
  <ProblemCard kind={data.problem ?? 'trouble'} appHref="{data.appUrl}/web/home" />
{:else if now.empty}
  <section class="flex flex-col gap-1 rounded-card border border-line bg-panel p-3 desktop:max-w-[640px] desktop:p-3.5" data-card="empty">
    <h2 class="m-0 text-[15px] font-semibold">Home</h2>
    <p class="m-0 text-muted" data-empty>No zones or chores yet.</p>
    <p class="m-0 text-[13px] text-muted">Add them on <a href="/home/edit">Edit zones</a>.</p>
  </section>
{:else}
  <!-- Phones and tablets: one column in app.'s order (order-*). The PC: the timer, the time and the list in the middle, This week
       and Recently done on the right; the two column boxes are display: contents on phones, so their cards join one list. -->
  <main class="flex flex-col gap-3 desktop:flex-row desktop:items-start desktop:gap-4">
    <div class="contents desktop:flex desktop:min-w-0 desktop:flex-1 desktop:flex-col desktop:gap-4">
      <div class="order-1 empty:hidden desktop:order-none"><TimerCard /></div>
      <div class="order-2 desktop:order-none"><TimeCard {now} /></div>
      <section
        aria-labelledby="rows-h"
        class="order-4 flex flex-col rounded-card border border-line bg-panel px-3 pt-3 pb-2 desktop:order-none desktop:px-3.5"
        data-card="rows"
      >
        <div class="flex items-baseline justify-between gap-2 pb-1">
          <h2 id="rows-h" class="m-0 text-[15px] font-semibold">Longest since last done</h2>
          <span class="text-[13px] text-muted" data-count>{nWord(now.count, 'chore')}</span>
        </div>
        <div class="flex flex-col" data-list="rows">
          {#each page.rows as row (row.chore_id)}
            <ChoreRow {row} {page} />
          {/each}
        </div>
        {#if more}
          <a
            href="/home/zones"
            class="mt-1 inline-flex min-h-11 items-center self-start rounded-lg border border-line px-3.5 text-sm font-medium text-text no-underline hover:bg-panel2 desktop:min-h-9"
            data-show-all>{more}</a
          >
        {/if}
        {#if hidden}<p class="m-0 py-1.5 text-[13px] text-muted" data-hidden>{hidden}</p>{/if}
      </section>
    </div>
    <div class="contents desktop:flex desktop:w-[340px] desktop:min-w-0 desktop:flex-none desktop:flex-col desktop:gap-4" data-side>
      <div class="order-3 desktop:order-none"><WeekCard week={now.week} /></div>
      <div class="order-5 empty:hidden desktop:order-none"><RecentCard recent={now.recent} /></div>
    </div>
  </main>
{/if}

<GymDock answers={page} />

<script lang="ts">
  import { goto, invalidateAll } from '$app/navigation';
  import ProblemCard from '#lib/components/ProblemCard.svelte';
  import DaysCard from '#lib/components/trends/DaysCard.svelte';
  import FoodCard from '#lib/components/trends/FoodCard.svelte';
  import FoodsCard from '#lib/components/trends/FoodsCard.svelte';
  import HealthCard from '#lib/components/trends/HealthCard.svelte';
  import ReviewCard from '#lib/components/trends/ReviewCard.svelte';
  import TrendsTabs from '#lib/components/trends/TrendsTabs.svelte';
  import { loginHref } from '#lib/next.js';
  import { headLine, periodHref, StatusPoll, statusOf } from '#lib/week.js';
  import { WeekPage } from '#lib/weekpage.svelte.js';
  import { untrack } from 'svelte';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();

  // Trends' Week tab (deploy 102, step 4 of the move to logger.): app.'s Week page with its Week review card in the new look. The four
  // periods (links), the header line, then on phones and tablets the Week review, Food, Health and habits, Foods that count most and
  // The days; from 1100 px Food, Health and habits and The days in the middle and the Week review and the foods in a right column of
  // 380 px. The door's food charts are not drawn here: they come with the Charts tab (deploy 103).
  const page = untrack(() => new WeekPage(data.week, data.p));
  $effect.pre(() => page.load(data.week, data.p));

  const w = $derived(page.week);
  const review = $derived(w?.review ?? null);

  // While the review is read: ask every 5 seconds (through this app's /trends/status), and when it is no longer working read the
  // week again in place (no reload). After 5 minutes stop and say it takes longer, with Look again (as app.).
  let again = $state(0);
  $effect(() => {
    const id = review?.state === 'working' ? review.id : null;
    void again;
    if (id === null || id === undefined) return;
    const poll = new StatusPoll({
      ask: async () => {
        const r = await fetch(`/trends/status?id=${id}`, { cache: 'no-store', headers: { accept: 'application/json' } });
        return statusOf(r.status, await r.json().catch(() => null));
      },
      over: () => void invalidateAll(),
      signedOut: () => void goto(loginHref(location.pathname + location.search)),
      slow: () => (page.slow = true),
    });
    untrack(() => (page.slow = false));
    poll.start();
    return () => poll.stop();
  });
  const lookAgain = () => {
    page.slow = false;
    again++;
    void invalidateAll();
  };
</script>

<svelte:head><title>Trends · Logger</title></svelte:head>

<TrendsTabs />

{#if !w}
  <ProblemCard kind={data.problem ?? 'trouble'} appHref="{data.appUrl}/web/week" />
{:else}
  <div class="flex flex-col gap-2">
    <nav aria-label="Period" class="grid grid-cols-2 gap-1.5 tablet:flex tablet:flex-wrap tablet:gap-2" data-periods>
      {#each w.periods as x (x.p)}
        <a
          href={periodHref(x.p)}
          aria-current={x.current ? 'page' : undefined}
          class="flex min-h-11 items-center justify-center rounded-full border px-3 text-sm font-medium whitespace-nowrap no-underline tablet:px-4 desktop:min-h-9 {x.current
            ? 'border-blue bg-blue-bg text-blue'
            : 'border-line bg-panel text-text hover:bg-panel2'}"
          data-period={x.p}>{x.label}</a
        >
      {/each}
    </nav>
    {#if !w.empty}<p class="m-0 text-[13px] text-muted" data-head-line>{headLine(w)}</p>{/if}
  </div>

  {#if w.empty}
    <section class="flex flex-col gap-1 rounded-card border border-line bg-panel p-3 desktop:max-w-[640px] desktop:p-3.5" data-card="empty">
      <p class="m-0 text-muted" data-empty>{w.empty_text}</p>
    </section>
  {:else}
    <!-- Phones and tablets: one column in the mockup's order (order-*). The PC: Food, Health and habits and The days in the middle,
         the Week review and the foods on the right; the two column boxes are display: contents below 1100 px. -->
    <main class="flex flex-col gap-3 desktop:flex-row desktop:items-start desktop:gap-4">
      <div class="contents desktop:flex desktop:min-w-0 desktop:flex-1 desktop:flex-col desktop:gap-4" data-col="middle">
        <div class="order-2 min-w-0 desktop:order-none"><FoodCard week={w} /></div>
        <div class="order-3 min-w-0 desktop:order-none"><HealthCard week={w} /></div>
        <div class="order-5 min-w-0 desktop:order-none"><DaysCard week={w} {page} /></div>
      </div>
      <div class="contents desktop:flex desktop:w-[380px] desktop:min-w-0 desktop:flex-none desktop:flex-col desktop:gap-4" data-col="side">
        {#if review}<div class="order-1 min-w-0 desktop:order-none"><ReviewCard {review} {page} appUrl={data.appUrl} {lookAgain} /></div>{/if}
        <div class="order-4 min-w-0 empty:hidden desktop:order-none"><FoodsCard week={w} {page} /></div>
      </div>
    </main>
  {/if}
{/if}

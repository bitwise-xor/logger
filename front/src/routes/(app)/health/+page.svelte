<script lang="ts">
  import ProblemCard from '#lib/components/ProblemCard.svelte';
  import ThemeButton from '#lib/components/ThemeButton.svelte';
  import BodyCard from '#lib/components/health/BodyCard.svelte';
  import HealthCharts from '#lib/components/health/HealthCharts.svelte';
  import HealthDays from '#lib/components/health/HealthDays.svelte';
  import AnswerBar from '#lib/components/today/AnswerBar.svelte';
  import { healthHref } from '#lib/health.js';
  import { HealthPage, setHealthPage } from '#lib/healthpage.svelte.js';
  import { onMount, untrack } from 'svelte';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();

  // The Health page (deploy 92, step 1b of the move to logger.): app.'s Health page in the new look. The range switch and "Show
  // all" are other loads (?range=, ?all=1); saves change the page in place (src/lib/healthpage.svelte.ts) with the answer bar
  // and Undo; the body form opens from Today's "Measure" (?measure=1#body).
  const health = setHealthPage(untrack(() => new HealthPage(data.health, data.body, data.undo, data.measuring)));
  $effect.pre(() => health.load(data.health, data.body, data.undo, data.measuring));
  onMount(() => void health.resend());

  const h = $derived(health.health);
  const b = $derived(health.body);

  // On phones the answer bar floats above the tab bar; the page leaves room for it (the layout's --dock), as on the Food day.
  let barHeight = $state(0);
  $effect(() => {
    document.documentElement.style.setProperty('--dock', `${barHeight}px`);
    return () => document.documentElement.style.removeProperty('--dock');
  });
</script>

<svelte:head><title>Health · Logger</title></svelte:head>

<header class="flex flex-col gap-0.5 desktop:flex-row desktop:flex-wrap desktop:items-center desktop:gap-3">
  <div class="flex flex-col gap-0.5 desktop:flex-1">
    <a href="/" class="inline-flex min-h-11 items-center self-start font-medium no-underline desktop:min-h-0 desktop:text-[13px]">‹ Today</a>
    <div class="flex items-center gap-2">
      <h1 class="m-0 flex-1 text-[26px] leading-[1.1] font-semibold tracking-tight desktop:text-[30px]">Health</h1>
      <span class="desktop:hidden"><ThemeButton /></span>
    </div>
  </div>
  {#if h}
    <nav aria-label="Range" class="flex items-center gap-2 pt-1 desktop:pt-0">
      <span class="flex flex-1 rounded-lg border border-line bg-panel p-0.5 desktop:flex-none" data-range>
        {#each h.ranges as r (r)}
          <a
            href={healthHref(r)}
            aria-current={r === h.range ? 'page' : undefined}
            class="flex min-h-11 flex-1 items-center justify-center rounded-md px-3.5 text-[13px] font-medium whitespace-nowrap no-underline desktop:min-h-8 {r === h.range
              ? 'bg-text text-bg'
              : 'text-text'}">{r} days</a
          >
        {/each}
      </span>
      <span class="hidden desktop:inline"><ThemeButton /></span>
    </nav>
  {/if}
</header>

{#if !h || !b}
  <ProblemCard kind={data.problem ?? 'trouble'} appHref="{data.appUrl}/web/health" />
{:else}
  <main class="flex flex-col gap-3 desktop:gap-4">
    <HealthCharts health={h} />
    <BodyCard body={b} range={h.range} appUrl={data.appUrl} />
    <HealthDays health={h} />
    <p class="m-0 text-[13px] text-muted">The habits calendar is on <a href="{data.appUrl}/web/habits">app.'s Habits page</a>.</p>
  </main>
{/if}

<!-- The answer bar: above the tab bar on phones, at the bottom right on the PC. -->
<div
  bind:clientHeight={barHeight}
  class="pointer-events-none fixed inset-x-0 bottom-[calc(52px+env(safe-area-inset-bottom))] z-20 px-3.5 pb-2 desktop:static desktop:p-0"
>
  <AnswerBar answers={health} />
</div>

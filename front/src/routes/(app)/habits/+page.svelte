<script lang="ts">
  import ProblemCard from '#lib/components/ProblemCard.svelte';
  import ThemeButton from '#lib/components/ThemeButton.svelte';
  import HabitDays from '#lib/components/habits/HabitDays.svelte';
  import HabitList from '#lib/components/habits/HabitList.svelte';
  import AnswerBar from '#lib/components/today/AnswerBar.svelte';
  import HabitGrid from '#lib/components/today/HabitGrid.svelte';
  import { doneLine } from '#lib/habits.js';
  import { HabitsPage, setHabitsPage } from '#lib/habitspage.svelte.js';
  import { onMount, untrack } from 'svelte';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();

  // The Habits page (deploy 94, step 1c of the move to logger.): app.'s Habits page in the new look, saving in place. Today's ticks,
  // the last 30 days (a tap on a habit opens its calendar in weeks), and "Your habits". One column on phones and tablets; from
  // 1100 px the ticks and the 30 days on the left and "Your habits" on the right.
  const page = setHabitsPage(untrack(() => new HabitsPage(data.habits, data.undo)));
  $effect.pre(() => page.load(data.habits, data.undo));
  onMount(() => void page.resend());

  const h = $derived(page.habits);

  // The answer bar floats above the tab bar on phones; the page leaves room for it (the layout's --dock).
  let barHeight = $state(0);
  let dock = $state<HTMLElement | null>(null);
  $effect(() => {
    document.documentElement.style.setProperty('--dock', `${barHeight}px`);
    return () => document.documentElement.style.removeProperty('--dock');
  });

  // Deploy 96: after a day of an open calendar is ticked, the answer bar must not hide the calendar's lower weeks. On phones and
  // tablets (the bar floats above the tab bar) the open calendar is scrolled into the room above the bar: its bottom just above it,
  // as long as its top stays on screen (a calendar taller than the room keeps its top in view).
  $effect(() => {
    const mark = page.changedDay;
    const name = page.open;
    const top = barHeight && dock ? dock.getBoundingClientRect().top : 0;
    if (!mark || !name || !top || window.innerWidth >= 1100) return;
    const cal = document.querySelector(`[data-calendar="${CSS.escape(name)}"]`);
    if (!cal) return;
    const r = cal.getBoundingClientRect();
    const by = Math.min(r.bottom + 8 - top, r.top - 8);
    if (by > 0) window.scrollBy({ top: by, behavior: 'smooth' });
  });

  // Deploy 102: on the PC the bar floats at the bottom right over the page's end, where the left column's open calendar can end
  // (a short "Your habits", a window near 1100 px): while it shows, the page gets room for it, so the calendar's last week can always
  // be scrolled above it. (Phones and tablets have that room already: the layout's --dock.)
  let pcBar = $state(0);
  $effect(() => {
    const el = dock?.firstElementChild;
    if (!(el instanceof HTMLElement)) return;
    const ro = new ResizeObserver(() => (pcBar = window.innerWidth >= 1100 ? el.offsetHeight : 0));
    ro.observe(el);
    return () => ro.disconnect();
  });
</script>

<svelte:head><title>Habits · Logger</title></svelte:head>

<header class="flex flex-col gap-0.5 desktop:flex-row desktop:flex-wrap desktop:items-center desktop:gap-3">
  <div class="flex flex-col gap-0.5 desktop:flex-1">
    <a href="/" class="inline-flex min-h-11 items-center self-start font-medium no-underline desktop:min-h-0 desktop:text-[13px]">‹ Today</a>
    <div class="flex items-center gap-2">
      <h1 class="m-0 flex-1 text-[26px] leading-[1.1] font-semibold tracking-tight desktop:text-[30px]">Habits</h1>
      <span class="desktop:hidden"><ThemeButton /></span>
    </div>
  </div>
  <span class="hidden desktop:inline"><ThemeButton /></span>
</header>

{#if !h}
  <ProblemCard kind={data.problem ?? 'trouble'} appHref="{data.appUrl}/web/habits" />
{:else}
  <main class="flex flex-col gap-3 desktop:flex-row desktop:items-start desktop:gap-4">
    <div class="flex min-w-0 flex-col gap-3 desktop:flex-1 desktop:gap-4">
      <section aria-labelledby="ticks-h" class="flex flex-col rounded-card border border-line bg-panel px-3 pt-3 pb-1.5 desktop:px-3.5" data-card="ticks">
        <div class="flex items-baseline justify-between pb-1">
          <h2 id="ticks-h" class="m-0 text-[15px] font-semibold">Today</h2>
          <span class="num text-[13px] text-muted" data-ticks-done>{doneLine(h)}</span>
        </div>
        {#if h.checklist.habits.length}
          <HabitGrid habits={h.checklist.habits} answers={page} />
          <p class="m-0 border-t border-line py-2 text-xs text-muted">Tap to tick, tap again to untick. A habit to avoid is ticked when it happened.</p>
        {:else}
          <p class="m-0 border-t border-line py-2.5 text-muted">No habit is tracked. Switch Track on for one in Your habits.</p>
        {/if}
      </section>
      <HabitDays habits={h} />
    </div>
    <div class="flex min-w-0 flex-col gap-3 desktop:w-[380px] desktop:shrink-0">
      <HabitList habits={h} />
    </div>
  </main>
  <p class="m-0 text-[13px] text-muted" data-settings-line>
    Hiding habits on Today and their order are in <a href="/settings/today">Settings</a>; the reminders too (Notifications).
  </p>
{/if}

<div aria-hidden="true" class="hidden shrink-0 desktop:block" style="height: {pcBar ? pcBar + 24 : 0}px" data-bar-room></div>

<!-- The answer bar: above the tab bar on phones, at the bottom right on the PC (as on the Health page). -->
<div
  bind:clientHeight={barHeight}
  bind:this={dock}
  class="pointer-events-none fixed inset-x-0 bottom-[calc(52px+env(safe-area-inset-bottom))] z-20 px-3.5 pb-2 desktop:static desktop:p-0"
>
  <AnswerBar answers={page} />
</div>

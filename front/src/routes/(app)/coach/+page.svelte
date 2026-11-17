<script lang="ts">
  import CoachDayCard from '#lib/components/coach/CoachDayCard.svelte';
  import CoachOpen from '#lib/components/coach/CoachOpen.svelte';
  import MoreHeader from '#lib/components/more/MoreHeader.svelte';
  import ProblemCard from '#lib/components/ProblemCard.svelte';
  import GymDock from '#lib/components/gym/GymDock.svelte';
  import { askedDay, arrowed, coachFields, coachHref, goalsLink } from '#lib/coach.js';
  import { CoachPage } from '#lib/coachpage.svelte.js';
  import { pollWhileWorking } from '#lib/coachpoll.svelte.js';
  import { doorLink } from '#lib/week.js';
  import { goto, invalidateAll } from '$app/navigation';
  import { page as route } from '$app/state';
  import { untrack } from 'svelte';
  import { MediaQuery } from 'svelte/reactivity';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();

  // More's Coach page (deploy 109): app.'s Coach in the new look. "Coach a day" (a date field and the door's card of that day: none,
  // working, done, failed), the chips All / Days / Weeks, the list of every finished coaching (a row opens in place on phones and
  // tablets and in the column beside the list from 1100 px), this month's line, the door's note and Your goals. The button posts
  // the form action `coach_day` once per press (never sent again by the page); the answer's fresh page replaces this one, and while the
  // day is read the page asks (GET /coach/status through this app) and reads again when it is ready.
  const page = untrack(() => new CoachPage(data.coach));
  $effect.pre(() => page.load(data.coach));

  const wide = new MediaQuery('min-width: 68.75rem', false);
  const c = $derived(page.coach);
  const open = $derived(c && page.open !== null ? (c.list.find((x) => x.id === page.open) ?? null) : null);
  const fields = $derived(c ? coachFields(c.card, { f: c.f, day: c.day }) : null);
  const goals = $derived(goalsLink(c?.card));

  let again = $state(0);
  pollWhileWorking({
    id: () => (c?.card.state === 'working' ? c.card.id : null),
    again: () => again,
    over: () => void invalidateAll(),
    slow: (on) => (page.run.slow = on),
  });
  const lookAgain = () => {
    page.run.slow = false;
    again++;
    void invalidateAll();
  };

  // the date field: another day reloads the page with ?day= (a plain GET form, so it works as an address too)
  function changed(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const day = askedDay(input.value);
    if (!c || !day || !input.validity.valid) {
      input.value = c?.day ?? '';
      return;
    }
    void goto(coachHref({ f: c.f, day }));
  }

  const field = 'h-11 w-full max-w-[220px] min-w-0 rounded-lg border border-line bg-panel2 px-3 text-base text-text desktop:h-10 desktop:text-sm num';
  const pill = 'rounded-full px-2 py-px text-xs font-normal whitespace-nowrap';
</script>

<svelte:head><title>Coach · Logger</title></svelte:head>

<MoreHeader title="Coach" />

{#snippet pillOf(kind: string)}
  <span class="{pill} {kind === 'week' ? 'bg-blue-bg text-blue' : 'bg-chip text-chip-text'}" data-kind={kind}>{kind}</span>
{/snippet}

{#if !c}
  <ProblemCard kind={data.problem ?? 'trouble'} appHref="{data.appUrl}/web/coach" />
{:else}
  <main class="flex min-w-0 flex-col gap-3 desktop:flex-row desktop:items-start desktop:gap-4" data-coach>
    <div class="flex min-w-0 flex-col gap-3 desktop:max-w-[760px] desktop:flex-1">
      <CoachDayCard card={c.card} run={page.run} {fields} start={(f) => void page.start(f)} {lookAgain} appUrl={data.appUrl} title="Coach a day">
        <form method="GET" action="/coach" class="m-0 flex flex-col gap-0.5" data-day-form>
          {#if c.f !== 'all'}<input type="hidden" name="f" value={c.f} />{/if}
          <label for="coach-day" class="text-xs text-muted">Day</label>
          <input id="coach-day" type="date" name="day" value={c.day} max={data.latest ?? c.day} required onchange={changed} class={field} data-day-field />
        </form>
      </CoachDayCard>

      <nav aria-label="Show" class="flex flex-wrap gap-1.5" data-filters>
        {#each c.filters as x (x.f)}
          <a
            href={coachHref({ f: x.f, day: askedDay(route.url.searchParams.get('day')) })}
            aria-current={x.current ? 'page' : undefined}
            class="inline-flex min-h-11 items-center justify-center rounded-full border px-3.5 font-medium no-underline desktop:min-h-10 {x.current
              ? 'border-blue bg-blue-bg text-blue'
              : 'border-line bg-panel text-text hover:bg-panel2'}"
            data-filter={x.f}>{x.label}</a
          >
        {/each}
      </nav>

      <section aria-label="Coachings" class="flex flex-col overflow-hidden rounded-card border border-line bg-panel [&>*+*]:border-t [&>*+*]:border-line" data-list>
        {#each c.list as item (item.id)}
          {@const on = page.open === item.id}
          <div data-coaching={item.id} data-kind-of={item.kind}>
            <button
              type="button"
              aria-expanded={on}
              class="flex min-h-14 w-full cursor-pointer flex-col items-start gap-0.5 border-0 px-3 py-2.5 text-left text-text {on ? 'bg-blue-bg' : 'bg-transparent hover:bg-panel2'}"
              onclick={() => page.toggle(item.id)}
              data-coaching-row
            >
              <span class="flex items-center gap-2 font-medium"><span data-coaching-heading>{item.heading}</span>{@render pillOf(item.kind)}</span>
              {#if item.first}<span class="text-[13px]" data-coaching-first>{item.first}</span>{/if}
              {#if item.meta}<span class="num text-xs text-muted" data-coaching-meta>{item.meta.text}</span>{/if}
            </button>
            {#if on && !wide.current}
              <div class="px-3 pt-1 pb-3"><CoachOpen {item} /></div>
            {/if}
          </div>
        {:else}
          <p class="m-0 p-3.5 text-muted" data-empty>{c.empty}</p>
        {/each}
      </section>

      <p class="m-0 text-[13px] text-muted" data-month>{c.month.text}</p>
      <p class="m-0 text-[13px] text-muted" data-note>{c.note}</p>
      <div>
        <a href={doorLink(data.appUrl, goals.href)} class="inline-flex min-h-11 items-center font-medium text-blue desktop:min-h-0" data-goals>{arrowed(goals.label)}</a>
      </div>
    </div>

    {#if wide.current}
      <aside aria-label="The open coaching" class="sticky top-4 flex max-h-[calc(100dvh-2rem)] w-[460px] shrink-0 flex-col gap-3 overflow-y-auto" data-side>
        {#if open}
          <section class="flex flex-col gap-2 rounded-card border border-line bg-panel p-3.5" data-side-open={open.id}>
            <div class="flex flex-wrap items-baseline justify-between gap-2">
              <h2 class="m-0 text-[15px] font-semibold" data-side-heading>{open.heading}</h2>
              {@render pillOf(open.kind)}
            </div>
            {#if open.meta}<p class="num m-0 text-[13px] text-muted" data-side-meta>{open.meta.text}</p>{/if}
            <CoachOpen item={open} />
          </section>
        {:else}
          <p class="m-0 flex flex-col gap-1 rounded-card border border-dashed border-line p-6 text-center text-muted" data-side-hint>
            <span class="font-medium text-text">Pick a coaching</span>
            <span>Its parts open here.</span>
          </p>
        {/if}
      </aside>
    {/if}
  </main>
{/if}

<GymDock answers={page} />

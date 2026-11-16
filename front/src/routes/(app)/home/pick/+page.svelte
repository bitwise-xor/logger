<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import ProblemCard from '#lib/components/ProblemCard.svelte';
  import ThemeButton from '#lib/components/ThemeButton.svelte';
  import GymDock from '#lib/components/gym/GymDock.svelte';
  import JobCard from '#lib/components/home/JobCard.svelte';
  import { alsoTitle, anotherHref, EMPTY, pickHref, START_NOTE } from '#lib/home.js';
  import { PickPage, type PickSpot } from '#lib/homepage.svelte.js';
  import { untrack } from 'svelte';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();

  // Home's Pick page (deploy 99): app.'s "Pick a job for me" in the new look, every button saving in place. Without a timer: the job
  // for the time, the clock at the time's minutes with "Start timer", Done, Another job, Not today, "Done it earlier?" and "Also fits".
  // With one open (the job and minutes are the timer's): the clock counts down in the browser from the read's seconds left, redrawn
  // every quarter second, and the screen is kept on while it runs (asked again when the page comes back into view; let go at zero
  // or when leaving); Pause or Resume, Done, "Done, next job" (running with 3 minutes or more left), Stop timer. At zero, without a
  // reload: "Time is up · well done", Pause and "Done, next job" go, "Stop timer" reads "Finished"; no sound. When the page comes
  // back into view it reads again, so the clock follows the server (the end time lives there).
  const page = untrack(() => new PickPage(data.pick, data.undo, data.min, data.n));
  $effect.pre(() => page.load(data.pick, data.undo, data.min, data.n));

  const p = $derived(page.pick);
  const v = $derived(page.view);
  const live = $derived(v.live);
  const wanted = $derived(v.wake);

  $effect(() => {
    if (!live) return;
    const id = setInterval(() => (page.tickNow = Date.now()), 250);
    return () => clearInterval(id);
  });

  // The screen stays on while the timer runs (the browser's wake lock; not every browser has one, and it may say no: the timer
  // runs on anyway).
  let lock: WakeLockSentinel | null = null;
  let asking = false;
  async function wake() {
    if (lock || asking || !('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
    asking = true;
    try {
      const l = await navigator.wakeLock.request('screen');
      if (!wanted) void l.release().catch(() => {});
      else {
        lock = l;
        l.addEventListener('release', () => {
          if (lock === l) lock = null;
        });
      }
    } catch {
      /* not allowed now (battery saver, no tap yet) */
    } finally {
      asking = false;
    }
  }
  function sleep() {
    const l = lock;
    lock = null;
    void l?.release().catch(() => {});
  }
  $effect(() => {
    if (wanted) void wake();
    else sleep();
  });
  $effect(() => {
    const back = () => {
      if (document.visibilityState !== 'visible') return;
      if (wanted) void wake();
      void invalidateAll(); // the clock follows the server again
    };
    document.addEventListener('visibilitychange', back);
    return () => {
      document.removeEventListener('visibilitychange', back);
      sleep();
    };
  });

  const ghost = 'flex min-h-11 cursor-pointer items-center justify-center rounded-lg border border-line bg-panel px-3 text-center font-medium text-text no-underline hover:bg-panel2 disabled:cursor-default disabled:opacity-60 desktop:min-h-10';
  const primary = 'flex min-h-11 cursor-pointer items-center justify-center rounded-lg border-0 bg-text px-3 text-center font-medium text-bg disabled:cursor-default disabled:opacity-60 desktop:min-h-10';
  const errAt = (spot: PickSpot | PickSpot[]) => (page.err && ([] as PickSpot[]).concat(spot).includes(page.err.spot) ? page.err.text : null);
</script>

<svelte:head><title>{p?.title ?? 'Pick a job'} · Logger</title></svelte:head>

<div class="flex items-center gap-2">
  <a href="/home" class="-ml-1 inline-flex min-h-11 flex-1 items-center self-start px-1 text-blue no-underline desktop:min-h-9" data-back>‹ Home</a>
  <ThemeButton />
</div>

{#if !p}
  <ProblemCard kind={data.problem ?? 'trouble'} appHref="{data.appUrl}/web/home/pick" />
{:else if p.empty === 'no_chores'}
  <section class="rounded-card border border-line bg-panel p-3 desktop:max-w-[640px]" data-card="empty"><p class="m-0 text-muted" data-empty>{EMPTY.no_chores}</p></section>
{:else}
  <main class="flex flex-col gap-3 desktop:max-w-[640px]">
    <h1 class="m-0 text-[26px] leading-[1.1] font-semibold tracking-tight desktop:text-[30px]" data-title>{p.title}</h1>
    {#if p.empty === 'nothing_waiting' || !p.job}
      <section class="flex flex-col gap-1 rounded-card border border-line bg-panel p-3" data-card="empty">
        <p class="m-0 text-muted" data-empty>{EMPTY.nothing_waiting}</p>
        <p class="m-0 text-[13px] text-muted">{EMPTY.nothing_why}</p>
      </section>
    {:else}
      <JobCard pick={p} job={p.job} />

      <section aria-label="Timer" class="flex flex-col gap-2.5 rounded-card border border-line bg-panel p-3 desktop:p-3.5" data-card="clock" data-state={v.state}>
        <div class="num text-center text-[56px] leading-[1.1] font-semibold tracking-tight {v.live ? 'text-blue' : 'text-text'}" role="timer" data-clock>{v.clock}</div>
        {#if v.line}
          <p class="m-0 text-center {v.state === 'over' ? 'font-semibold text-blue' : 'text-[13px] text-muted'}" data-line>{v.line}</p>
        {/if}
        {#if v.state === 'none'}
          <button type="button" class={primary} disabled={!!page.busy.start} onclick={() => page.start()} data-btn="start">Start timer</button>
          <p class="m-0 text-[13px] text-muted">{START_NOTE}</p>
        {:else if v.pause}
          <button type="button" class={primary} disabled={!!page.busy.pause} onclick={() => page.pause()} data-btn="pause">Pause</button>
        {:else if v.resume}
          <button type="button" class={primary} disabled={!!page.busy.resume} onclick={() => page.resume()} data-btn="resume">Resume</button>
        {/if}
        {#if errAt(['start', 'pause', 'resume'])}<p class="m-0 text-[13px] text-amber" data-err>{errAt(['start', 'pause', 'resume'])}</p>{/if}
      </section>

      <div class="flex flex-col gap-1.5" data-buttons>
        <div class="grid auto-cols-fr grid-flow-col gap-2 text-[15px] [&>*]:px-2 desktop:text-base">
          {#if v.state === 'none'}
            <button type="button" class={ghost} disabled={!!page.busy.done} onclick={() => page.done()} data-btn="done">Done</button>
            {#if anotherHref(p)}<a href={anotherHref(p)} class={ghost} data-btn="another">Another job</a>{/if}
            <button type="button" class={ghost} disabled={!!page.busy.skip} onclick={() => page.skip()} data-btn="skip">Not today</button>
          {:else}
            <button type="button" class={primary} disabled={!!page.busy.done} onclick={() => page.done()} data-btn="done">Done</button>
            {#if v.next}<button type="button" class={ghost} disabled={!!page.busy.next} onclick={() => page.next()} data-btn="next">Done, next job</button>{/if}
            <button type="button" class={ghost} disabled={!!page.busy.stop} onclick={() => page.stop()} data-btn="stop">{v.stop}</button>
          {/if}
        </div>
        {#if errAt(['done', 'next', 'stop', 'skip'])}<p class="m-0 text-[13px] text-amber" data-err>{errAt(['done', 'next', 'stop', 'skip'])}</p>{/if}
      </div>

      {#if v.state === 'none'}
        <section class="flex flex-col gap-2 rounded-card border border-line bg-panel p-3 desktop:p-3.5" data-card="earlier">
          <button
            type="button"
            class="{ghost} self-start"
            aria-expanded={page.earlierOpen}
            onclick={() => (page.earlierOpen = !page.earlierOpen)}
            data-earlier-open>Done it earlier? <span aria-hidden="true" class="ml-1 inline-block text-muted transition-transform {page.earlierOpen ? 'rotate-90' : ''}">›</span></button
          >
          {#if page.earlierOpen}
            <div class="flex flex-wrap gap-2" data-earlier>
              {#each p.earlier as e (e.when)}
                <button type="button" class={ghost} disabled={!!page.busy[`earlier:${e.when}`]} onclick={() => page.earlier(e.when)} data-when={e.when}>{e.label}</button>
              {/each}
            </div>
            <form
              class="m-0 flex flex-wrap items-center gap-2"
              onsubmit={(e) => {
                e.preventDefault();
                void page.earlier(page.earlierDate);
              }}
            >
              <label class="flex items-center gap-2">
                <span>On</span>
                <input
                  type="date"
                  name="when"
                  required
                  min={page.range?.min}
                  max={page.range?.max}
                  bind:value={page.earlierDate}
                  class="h-11 rounded-lg border border-line bg-panel px-2 text-base text-text desktop:h-9 desktop:text-sm"
                  data-earlier-date
                />
              </label>
              <button type="submit" class={ghost} disabled={!!page.busy[`earlier:${page.earlierDate}`]} data-earlier-save>Save</button>
            </form>
            {#if errAt('earlier')}<p class="m-0 text-[13px] text-amber" data-err>{errAt('earlier')}</p>{/if}
          {/if}
        </section>

        {#if p.also.length}
          <section aria-labelledby="also-h" class="flex flex-col rounded-card border border-line bg-panel px-3 pt-3 pb-1.5 desktop:px-3.5" data-card="also">
            <h2 id="also-h" class="m-0 text-[13px] font-medium text-muted">{alsoTitle(p.minutes)}</h2>
            <ul class="m-0 flex list-none flex-col p-0">
              {#each p.also as a (a.n)}
                <li class="border-t border-line first:border-t-0">
                  <a href={pickHref(p.minutes, a.n)} class="flex min-h-11 items-center text-blue no-underline hover:underline" data-also={a.n}>{a.title}</a>
                </li>
              {/each}
            </ul>
          </section>
        {/if}
      {/if}
    {/if}
  </main>
{/if}

<GymDock answers={page} />

<script lang="ts">
  import ProblemCard from '#lib/components/ProblemCard.svelte';
  import MedicalHeader from '#lib/components/medical/MedicalHeader.svelte';
  import TestView from '#lib/components/medical/TestView.svelte';
  import { listOf, testsHref, valuesLine } from '#lib/medical.js';
  import { setTestsPage, TestsPage } from '#lib/testspage.svelte.js';
  import { untrack } from 'svelte';
  import { MediaQuery } from 'svelte/reactivity';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();

  // Medical's Tests over time tab (deploy 106), read only: the search "Search a test" (Enter, or a short pause in typing, the focus kept),
  // the door's list (tests with values on three or more days, or the matches of the search) and one test: on phones and tablets its own
  // view under the search with "‹ All tests" back to the list (the search kept), from 1100 px the list stays in the middle and the test
  // stands in a column beside it (the address carries ?q= and ?t=).
  const page = setTestsPage(untrack(() => new TestsPage(data.view)));
  $effect.pre(() => page.load(data.view));

  const wide = new MediaQuery('min-width: 68.75rem', false);
  const l = $derived(data.list);
  const shown = $derived(data.shown);
  const rows = $derived(l ? listOf(l) : []);
  // "‹ All tests": the list of the search; a search that opened its one match by itself would open it again, so that goes back to all
  const back = $derived(data.view.t ? testsHref({ q: data.view.q }) : testsHref({}));

  const field = 'h-11 w-full min-w-0 rounded-lg border border-line bg-panel px-3 text-base text-text placeholder:text-muted desktop:h-10 desktop:text-sm';
</script>

<svelte:head><title>Tests over time · Medical · Logger</title></svelte:head>

<MedicalHeader on="tests" />

{#if !l}
  <ProblemCard kind={data.problem ?? 'trouble'} appHref="{data.appUrl}/web/labs/tests" />
{:else}
  <main class="flex flex-col gap-3 desktop:flex-row desktop:items-start desktop:gap-4">
    <div class="flex min-w-0 flex-col gap-3 desktop:flex-1">
      <section class="flex flex-col gap-2.5 rounded-card border border-line bg-panel p-3 desktop:p-3.5" data-card="tests">
        <form
          method="GET"
          action="/medical/tests"
          role="search"
          class="m-0 flex flex-col gap-1"
          onsubmit={(e) => {
            e.preventDefault();
            page.searchNow();
          }}
        >
          <label for="test-q" class="text-[13px] text-muted">Search a test</label>
          <input
            id="test-q"
            type="search"
            name="q"
            maxlength="60"
            autocomplete="off"
            placeholder={l.placeholder}
            value={page.search}
            oninput={(e) => page.typed(e.currentTarget.value)}
            class={field}
            data-search
          />
        </form>
        {#if wide.current || !shown}
          {#if l.title && !data.view.q}<p class="m-0 text-[13px] text-muted" data-list-title>{l.title}</p>{/if}
          {#if rows.length}
            <div class="flex flex-col overflow-hidden rounded-lg border border-line [&>*+*]:border-t [&>*+*]:border-line" data-list>
              {#each rows as t (t.id)}
                <a
                  href={testsHref({ q: data.view.q, t: t.id })}
                  aria-current={shown?.test?.id === t.id ? 'true' : undefined}
                  class="flex min-h-14 items-center gap-3 px-3 py-2 text-text no-underline {shown?.test?.id === t.id ? 'bg-blue-bg' : 'hover:bg-panel2'}"
                  data-test-row={t.id}
                >
                  <span class="flex min-w-0 flex-1 flex-col">
                    <span class="font-medium break-words" data-test-row-name>{t.name}</span>
                    <span class="text-[13px] text-muted" data-test-row-count>{valuesLine(t.values)}</span>
                  </span>
                  {#if t.unit}<span class="num text-[13px] whitespace-nowrap text-muted" data-test-row-unit>{t.unit}</span>{/if}
                </a>
              {/each}
            </div>
          {:else}
            <p class="m-0 text-muted" data-empty>{l.empty ?? 'No test with that name. Try another word.'}</p>
          {/if}
        {/if}
      </section>
      {#if shown && !wide.current}
        <section class="rounded-card border border-line bg-panel p-3 desktop:p-3.5" data-card="test"><TestView {shown} {back} /></section>
      {/if}
    </div>
    {#if wide.current}
      <aside aria-label="The open test" class="sticky top-4 flex max-h-[calc(100dvh-2rem)] w-[400px] shrink-0 flex-col gap-3 overflow-y-auto" data-side>
        {#if shown}
          <section class="rounded-card border border-line bg-panel p-3.5" data-card="test"><TestView {shown} /></section>
        {:else}
          <p class="m-0 flex flex-col gap-1 rounded-card border border-dashed border-line p-6 text-muted" data-side-hint>
            <span class="font-medium text-text">Pick a test</span>
            <span>Its chart and history open here.</span>
          </p>
        {/if}
      </aside>
    {/if}
  </main>
{/if}

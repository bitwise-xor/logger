<script lang="ts">
  import ProblemCard from '#lib/components/ProblemCard.svelte';
  import GymDock from '#lib/components/gym/GymDock.svelte';
  import MedicalHeader from '#lib/components/medical/MedicalHeader.svelte';
  import ReportBox from '#lib/components/medical/ReportBox.svelte';
  import ReportRow from '#lib/components/medical/ReportRow.svelte';
  import { chipText, flagLetter, testsHref } from '#lib/medical.js';
  import { ReportsPage, setReportsPage } from '#lib/reportspage.svelte.js';
  import { untrack } from 'svelte';
  import { MediaQuery } from 'svelte/reactivity';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();

  // Medical's Reports tab (deploy 106): app.'s Medical page in the new look, every change saving in place. The card "Flagged in your
  // newest report" (a chip per flagged value, each opens that test), all the reports newest first, a report opens under its row on
  // phones and tablets and in a column beside the list from 1100 px (the address carries ?open=R12); its values correct with the
  // pencil (shown first, then Yes in the answer bar), and "Change date, title or notes".
  const page = setReportsPage(untrack(() => new ReportsPage(data.labs, data.open, data.undo)));
  $effect.pre(() => page.load(data.labs, data.open, data.undo));

  // from 1100 px (the layout's desktop width) the report sits beside the list
  const wide = new MediaQuery('min-width: 68.75rem', false);
  const l = $derived(page.labs);
  const open = $derived(page.open);
  // a report that is not in the list (an address typed by hand) opens above the list on phones and tablets
  const stray = $derived(!!l?.open && !l.reports.some((r) => r.id === l.open!.id));

  const head = 'm-0 text-[15px] font-semibold';
</script>

<svelte:head><title>Reports · Medical · Logger</title></svelte:head>

<MedicalHeader on="reports" />

{#snippet box(side: boolean)}
  {#if l?.open}<ReportBox report={l.open} {side} />{/if}
{/snippet}

{#if !l}
  <ProblemCard kind={data.problem ?? 'trouble'} appHref="{data.appUrl}/web/labs" />
{:else}
  <main class="flex flex-col gap-3 desktop:flex-row desktop:items-start desktop:gap-4">
    <div class="flex min-w-0 flex-col gap-3 desktop:flex-1">
      <section aria-labelledby="flagged-h" class="flex flex-col gap-2 rounded-card border border-line bg-panel p-3 desktop:p-3.5" data-card="flagged">
        {#if l.flagged}
          <div class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
            <h2 id="flagged-h" class={head} data-flagged-title>{l.flagged.heading}</h2>
            <p class="m-0 text-[13px] text-muted" data-flagged-meta><span class="num">{l.flagged.date_text}</span> · {l.flagged.title}</p>
          </div>
          {#if l.flagged.chips.length}
            <div class="flex flex-wrap gap-2" data-chips>
              {#each l.flagged.chips as c (c.test_id)}
                <a
                  href={testsHref({ t: c.test_id })}
                  class="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-amber bg-amber-bg px-3.5 text-text no-underline desktop:min-h-9"
                  data-chip={c.test_id}
                >
                  <span>{c.test}</span><span class="num">{c.value}</span>{#if flagLetter(c.flag)}<span class="text-xs font-semibold text-amber" title={c.flag_word ?? undefined}>{c.flag}</span>{/if}
                </a>
              {/each}
            </div>
          {:else if l.flagged.empty}
            <p class="m-0 text-muted" data-flagged-empty>{l.flagged.empty}</p>
          {/if}
          <p class="m-0 text-[13px] text-muted" data-flagged-hint>{l.flagged.hint}</p>
        {:else}
          <h2 id="flagged-h" class={head}>Flagged in your newest report</h2>
          <p class="m-0 text-muted" data-flagged-empty>Nothing flagged.</p>
        {/if}
      </section>

      {#if !wide.current && stray}<div class="overflow-hidden rounded-card border border-line bg-panel">{@render box(false)}</div>{/if}

      <section aria-labelledby="reports-h" class="flex flex-col overflow-hidden rounded-card border border-line bg-panel" data-card="reports">
        <div class="flex items-baseline justify-between gap-2 px-3 pt-3 pb-2 desktop:px-3.5">
          <h2 id="reports-h" class={head}>All reports</h2>
          <span class="text-[13px] text-muted">newest first</span>
        </div>
        {#if l.reports.length}
          <div
            class="hidden px-3 pb-1.5 text-xs font-medium tracking-wider text-muted uppercase tablet:grid tablet:grid-cols-[6.5rem_minmax(0,1fr)_auto_7rem_2.75rem_3.75rem] tablet:gap-x-3"
            aria-hidden="true"
            data-reports-head
          >
            <span>Date</span><span>Title</span><span class="invisible">lab</span><span>From</span><span class="text-right">Values</span><span class="text-right">Flagged</span>
          </div>
          <div class="flex flex-col border-t border-line [&>*+*]:border-t [&>*+*]:border-line" data-list>
            {#each l.reports as r (r.id)}
              <div data-report={r.id}>
                <ReportRow {r} />
                {#if !wide.current && open === r.id}{@render box(false)}{/if}
              </div>
            {/each}
          </div>
        {:else}
          <p class="m-0 border-t border-line p-3.5 text-muted" data-empty>{l.empty ?? 'No reports yet.'}</p>
        {/if}
      </section>

      <p class="m-0 text-[13px] text-muted" data-hint>{l.hint}</p>
    </div>
    {#if wide.current}
      <aside aria-label="The open report" class="sticky top-4 flex max-h-[calc(100dvh-2rem)] w-[400px] shrink-0 flex-col gap-3 overflow-y-auto" style:padding-bottom={page.bar ? '180px' : undefined} data-side>
        {#if l.open}
          <section class="rounded-card border border-line bg-panel p-3.5">{@render box(true)}</section>
        {:else}
          <p class="m-0 flex flex-col gap-1 rounded-card border border-dashed border-line p-6 text-muted" data-side-hint>
            <span class="font-medium text-text">Pick a report</span>
            <span>Its values and notes open here.</span>
          </p>
        {/if}
      </aside>
    {/if}
  </main>
{/if}

<GymDock answers={page} />

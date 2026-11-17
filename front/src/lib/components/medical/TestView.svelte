<script lang="ts">
  import Chart from '#lib/components/chart/Chart.svelte';
  import FlagPill from './FlagPill.svelte';
  import { reportLink, valuesLine, type Tests } from '#lib/medical.js';

  // One test (deploy 106, the mockup's test view), every word from the door: its name and "n values", the chart the chart part draws from
  // the door's description (the reference band from the newest value, the dots amber where the flag says so, a tap on a dot shows the
  // door's words) or, in the thin cases, the door's message in its place ("Only one value so far…", "All values are from one day…"), then
  // the history newest first (date and site, the value, its range, the flag, "Report"). Read only. `back`: the link "‹ All tests" (phones
  // and tablets, where the test is a view of its own); none beside the list on the PC.
  let { shown, back = null }: { shown: Tests; back?: string | null } = $props();
  const test = $derived(shown.test!);
  const card = $derived(shown.card);
</script>

<div class="flex min-w-0 flex-col gap-3" data-test={test.id}>
  {#if back}
    <a href={back} class="inline-flex min-h-11 items-center self-start text-blue no-underline" data-back>‹ All tests</a>
  {/if}
  <div class="flex items-baseline justify-between gap-2">
    <h2 class="m-0 text-[17px] font-semibold tracking-tight break-words" data-test-name>{test.name}</h2>
    <span class="text-[13px] whitespace-nowrap text-muted" data-test-count>{valuesLine(test.values)}</span>
  </div>
  {#if card?.chart}
    <div data-test-chart><Chart chart={card.chart} id="test" legend={card.legend} /></div>
  {:else if card?.note}
    <p class="m-0 rounded-lg bg-panel2 p-3 text-muted" data-thin>{card.note}</p>
  {/if}
  <h3 class="m-0 mt-1 text-xs font-medium tracking-wider text-muted uppercase">History, newest first</h3>
  <div class="flex flex-col [&>*+*]:border-t [&>*+*]:border-line" data-history>
    {#each shown.rows as r (r.id)}
      <div class="grid min-h-14 grid-cols-[minmax(0,1fr)_auto_2rem_auto] items-center gap-x-2.5 py-1.5" data-history-row={r.id}>
        <div class="flex min-w-0 flex-col">
          <span class="num text-[13px]" data-history-date>{r.date_text}</span>
          {#if r.site}<span class="text-[13px] break-words text-muted" data-history-site>{r.site}</span>{/if}
        </div>
        <div class="flex flex-col items-end text-right">
          <span class="num font-semibold" data-history-value>{r.value}</span>
          <span class="num text-[13px] text-muted" data-history-range>{r.range}</span>
        </div>
        <span class="flex justify-center" data-history-flag><FlagPill flag={r.flag} word={r.flag_word} /></span>
        <a href={reportLink(r.report_id)} class="inline-flex min-h-11 items-center px-1 text-blue no-underline desktop:min-h-9" data-history-report>Report</a>
      </div>
    {/each}
  </div>
</div>

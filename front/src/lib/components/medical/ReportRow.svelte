<script lang="ts">
  import type { ReportRow } from '#lib/medical.js';
  import { getReportsPage } from '#lib/reportspage.svelte.js';

  // A report of the list (the mockup's row): date, title, the kind pill (lab or imaging), who it is from (not on phones), the number of
  // values and the flagged ones (amber above 0). On phones the date and pill, the title and "8 values · 3 flagged" are three lines. A tap
  // opens the report (under its row on phones and tablets, in the side column from 1100 px); a second tap closes it.
  let { r }: { r: ReportRow } = $props();
  const page = getReportsPage();
  const open = $derived(page.open === r.id);
</script>

<button
  type="button"
  aria-expanded={open}
  class="grid min-h-14 w-full cursor-pointer items-center gap-x-3 gap-y-0.5 border-0 px-3 py-2.5 text-left text-text transition-colors duration-500 [grid-template-areas:'date_kind'_'title_title'_'counts_counts'] grid-cols-[minmax(0,1fr)_auto] tablet:[grid-template-areas:'date_title_kind_from_values_flagged'] tablet:grid-cols-[6.5rem_minmax(0,1fr)_auto_7rem_2.75rem_3.75rem] {open
    ? 'bg-blue-bg'
    : 'bg-transparent hover:bg-panel2'}"
  onclick={() => page.toggle(r.id)}
  data-report-row={r.id}
>
  <span class="num text-[13px] [grid-area:date]" data-report-date>{r.date_text}</span>
  <span class="justify-self-start [grid-area:kind]"><span class="rounded-chip bg-panel2 px-[7px] py-px text-xs font-medium text-muted" data-kind={r.kind}>{r.kind}</span></span>
  <span class="font-medium break-words [grid-area:title]" data-report-title>{r.title}</span>
  <span class="hidden truncate text-[13px] text-muted tablet:block [grid-area:from]" data-report-from>{r.provider ?? ''}</span>
  <span class="text-[13px] text-muted tablet:hidden [grid-area:counts]" data-report-counts
    >{r.values} {r.values === 1 ? 'value' : 'values'}{#if r.flagged}{' · '}<span class="text-amber">{r.flagged} flagged</span>{/if}</span
  >
  <span class="num hidden text-right text-[13px] tablet:block [grid-area:values]" data-report-values>{r.values}</span>
  <span class="num hidden text-right text-[13px] tablet:block {r.flagged ? 'text-amber' : 'text-muted'} [grid-area:flagged]" data-report-flagged>{r.flagged}</span>
</button>

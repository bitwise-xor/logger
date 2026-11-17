<script lang="ts">
  import FlagPill from './FlagPill.svelte';
  import { reportMeta, testsHref, valueNote, type OpenReport } from '#lib/medical.js';
  import { getReportsPage } from '#lib/reportspage.svelte.js';

  // The open report (deploy 106, the mockup's box), every word from the door: a row per value (the test's name, a link to its history; its
  // note; the value with its unit as printed; the range; the flag; a pencil of 44 px), the pencil's form (value, unit, range: Save is
  // shown first by the door, Yes in the answer bar), the notes, and "Change date, title or notes" (date, title, from, notes: shown first
  // too). An imaging report has no values: the door's words and its notes. A refusal or "Nothing changed." is said next to its form, which
  // keeps what was typed. `side`: in the PC's column (the title on top), else under its row.
  let { report, side = false }: { report: OpenReport; side?: boolean } = $props();
  const page = getReportsPage();
  const busy = (id: string) => !!page.busy[id];
  const limits = $derived(page.labs!.limits);

  const field = 'h-11 w-full min-w-0 rounded-lg border border-line bg-panel px-3 text-base text-text placeholder:text-muted desktop:h-9 desktop:text-sm';
  const btn = 'min-h-11 shrink-0 cursor-pointer rounded-lg px-4 font-medium disabled:opacity-60 desktop:min-h-9';
  const primary = `${btn} border-0 bg-text text-bg`;
  const ghost = `${btn} border border-line bg-panel text-text`;
  const label = 'm-0 text-xs font-medium tracking-wider text-muted uppercase';
</script>

{#snippet refusal(form: string)}
  {#if page.errs[form]}<p role="alert" class="m-0 rounded-lg bg-amber-bg px-2.5 py-2 text-[13px] text-amber" data-err={form}>{page.errs[form]}</p>{/if}
{/snippet}

<div class="flex flex-col gap-3 {side ? '' : 'border-t border-line bg-panel2 px-3 py-3 tablet:px-4'}" data-box={report.id}>
  <div class="flex items-start justify-between gap-2 {side ? '' : '-mb-2'}">
    <div class="flex min-w-0 flex-col gap-0.5">
      {#if side}<h2 class="m-0 text-[17px] font-semibold tracking-tight break-words" data-box-title>{report.title}</h2>{/if}
      <p class="m-0 text-[13px] text-muted" data-box-meta>{side ? [report.date_text, reportMeta(report), report.kind].join(' · ') : reportMeta(report)}</p>
    </div>
    <button
      type="button"
      aria-label="Close the report"
      class="-mt-1.5 -mr-2 flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent text-muted hover:text-text desktop:size-9"
      onclick={() => page.close()}
      data-box-close
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg>
    </button>
  </div>

  {#if report.values.length}
    <div class="flex flex-col [&>*+*]:border-t [&>*+*]:border-line" data-values>
      {#each report.values as v (v.id)}
        {@const note = valueNote(v)}
        {@const edit = page.editing === v.id}
        <div class="py-1.5 transition-colors duration-500 {page.fresh === v.id ? 'shadow-[inset_3px_0_0_var(--color-blue)] pl-2' : ''}" data-value-row={v.id} data-fresh={page.fresh === v.id ? '' : undefined}>
          <div class="grid min-h-12 grid-cols-[minmax(0,1fr)_auto_2rem_2.75rem] items-center gap-x-2.5">
            <a href={testsHref({ t: v.test_id })} class="flex min-h-11 min-w-0 flex-col justify-center text-text no-underline hover:underline" data-value-link>
              <span class="break-words text-blue" data-value-test>{v.test}</span>
              {#if note}<span class="text-[13px] break-words text-muted" data-value-note>{note}</span>{/if}
            </a>
            <div class="flex flex-col items-end text-right">
              <span class="num font-semibold break-words" data-value-text>{v.text}</span>
              <span class="num text-[13px] text-muted" data-value-range>{v.range}</span>
            </div>
            <span class="flex justify-center" data-value-flag><FlagPill flag={v.flag} word={v.flag_word} /></span>
            <button
              type="button"
              aria-label="Correct {v.test}"
              aria-expanded={edit}
              class="flex size-11 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent text-muted hover:text-text {edit ? 'text-text' : ''}"
              onclick={() => page.pencil(v)}
              data-pencil={v.id}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
                ><path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"></path></svg
              >
            </button>
          </div>
          {#if edit}
            <form
              method="POST"
              action="?/labs_value"
              class="m-0 mb-1.5 flex flex-col gap-2.5 rounded-lg border border-line bg-panel p-2.5"
              novalidate
              onsubmit={(e) => (e.preventDefault(), page.saveValue(v))}
              data-form="value"
            >
              <div class="grid grid-cols-3 gap-2">
                <label class="flex min-w-0 flex-col gap-1 text-xs text-muted">
                  Value
                  <input name="value" maxlength={limits.value_max} autocomplete="off" bind:value={page.draft.value} oninput={() => delete page.errs[`value:${v.id}`]} class="{field} num" data-edit="value" />
                </label>
                <label class="flex min-w-0 flex-col gap-1 text-xs text-muted">
                  Unit
                  <input name="unit" maxlength={limits.unit_max} autocomplete="off" bind:value={page.draft.unit} oninput={() => delete page.errs[`value:${v.id}`]} class="{field} num" data-edit="unit" />
                </label>
                <label class="flex min-w-0 flex-col gap-1 text-xs text-muted">
                  Range
                  <input name="ref" maxlength={limits.ref_max} autocomplete="off" bind:value={page.draft.ref} oninput={() => delete page.errs[`value:${v.id}`]} class="{field} num" data-edit="ref" />
                </label>
              </div>
              {@render refusal(`value:${v.id}`)}
              <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
                <button type="submit" class={primary} disabled={busy(`value:${v.id}`) || busy('confirm:labs_value')} data-save-value>Save</button>
                <button type="button" class={ghost} onclick={() => page.pencil(v)} data-cancel-value>Cancel</button>
                <span class="min-w-0 flex-1 basis-48 text-xs text-muted">{report.value_hint}</span>
              </div>
            </form>
          {/if}
        </div>
      {/each}
    </div>
  {:else if report.empty}
    <p class="m-0 text-muted" data-no-values>{report.empty}</p>
  {/if}

  {#if report.notes}
    <div class="flex flex-col gap-1 border-t border-line pt-3">
      <h3 class={label}>Notes</h3>
      <p class="m-0 whitespace-pre-line" data-report-notes>{report.notes}</p>
    </div>
  {/if}

  <div class="flex flex-col gap-2.5 border-t border-line pt-1.5">
    <button
      type="button"
      class="inline-flex min-h-11 cursor-pointer items-center self-start border-0 bg-transparent p-0 text-left text-blue desktop:min-h-9"
      aria-expanded={page.reportForm}
      onclick={() => page.toggleReportForm()}
      data-report-toggle>Change date, title or notes</button
    >
    {#if page.reportForm}
      <form method="POST" action="?/labs_report" class="m-0 flex flex-col gap-2.5" novalidate onsubmit={(e) => (e.preventDefault(), page.saveReport())} data-form="report">
        <label class="flex min-w-0 flex-col gap-1 text-xs text-muted">
          Date
          <input name="collected" type="date" bind:value={page.report.collected} oninput={() => delete page.errs.report} class="{field} num" data-edit="collected" />
        </label>
        <label class="flex min-w-0 flex-col gap-1 text-xs text-muted">
          Title
          <input name="title" maxlength={limits.title_max} autocomplete="off" bind:value={page.report.title} oninput={() => delete page.errs.report} class={field} data-edit="title" />
        </label>
        <label class="flex min-w-0 flex-col gap-1 text-xs text-muted">
          From
          <input name="provider" maxlength={limits.provider_max} autocomplete="off" bind:value={page.report.provider} oninput={() => delete page.errs.report} class={field} data-edit="provider" />
        </label>
        <label class="flex min-w-0 flex-col gap-1 text-xs text-muted">
          Notes
          <textarea
            name="notes"
            rows="3"
            maxlength={limits.notes_max}
            bind:value={page.report.notes}
            oninput={() => delete page.errs.report}
            class="min-h-20 w-full min-w-0 rounded-lg border border-line bg-panel px-3 py-2 text-base text-text desktop:text-sm"
            data-edit="notes"
          ></textarea>
        </label>
        {@render refusal('report')}
        <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
          <button type="submit" class={primary} disabled={busy('report') || busy('confirm:labs_report')} data-save-report>Save</button>
          <button type="button" class={ghost} onclick={() => page.toggleReportForm()}>Cancel</button>
          <span class="min-w-0 flex-1 basis-48 text-xs text-muted">{report.report_hint}</span>
        </div>
      </form>
    {/if}
  </div>
</div>

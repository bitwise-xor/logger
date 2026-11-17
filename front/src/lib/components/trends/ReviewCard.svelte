<script lang="ts">
  import CoachParts from '#lib/components/coach/CoachParts.svelte';
  import { doorLink, periodHref, startFields, type Review } from '#lib/week.js';
  import type { WeekPage } from '#lib/weekpage.svelte.js';

  // The Week review card (app.'s coach card on the Week page), in the door's words. Not offered (7 and 30 days): the blurb, the two
  // weeks to go to, the latest review's line. Offered: none (the intro, the button, the cost), working (the wait; the page asks
  // every 5 s and reads the week again when it is ready; after 5 minutes "taking longer" with Look again), done (the parts in the
  // door's order, the meta line, Review again, the links to app., the caution), failed (the door's words, the button again). The
  // button starts a paid review: disabled from the first press until the answer is in, never sent again by the page.
  let { review, page, appUrl, lookAgain }: { review: Review; page: WeekPage; appUrl: string; lookAgain: () => void } = $props();

  const fields = $derived(startFields(review, page.p));
  const primary =
    'inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg border-0 bg-text px-4 font-medium text-bg disabled:cursor-default disabled:opacity-60 desktop:min-h-10';
  const ghost =
    'inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg border border-line bg-panel px-3.5 font-medium text-text hover:bg-panel2 disabled:cursor-default disabled:opacity-60 desktop:min-h-10';
  const link = 'inline-flex min-h-11 items-center desktop:min-h-0';

  function submit(event: SubmitEvent) {
    event.preventDefault();
    void page.start();
  }
</script>

{#snippet button(label: string, cls: string)}
  {#if fields}
    <form method="POST" action="?/coach_start" onsubmit={submit} data-review-form>
      <input type="hidden" name="start" value={fields.start} />
      <input type="hidden" name="end" value={fields.end} />
      <input type="hidden" name="view_p" value={fields.view_p} />
      <button type="submit" class={cls} disabled={page.starting} aria-busy={page.starting} data-review-button>{label}</button>
    </form>
  {/if}
{/snippet}

<section
  aria-labelledby="review-h"
  class="flex flex-col gap-2.5 rounded-card border border-line bg-panel p-3 desktop:p-3.5"
  data-card="review"
  data-state={review.offered ? review.state : 'not-offered'}
>
  <div class="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
    <h2 id="review-h" class="m-0 text-[15px] font-semibold">{review.title}</h2>
    <span class="text-[13px] text-muted" data-review-small>{review.small}</span>
  </div>

  {#if !review.offered}
    {#if review.blurb}<p class="m-0 text-[13px] text-muted" data-review-blurb>{review.blurb}</p>{/if}
    {#if review.weeks?.length}
      <div class="flex flex-wrap gap-x-4" data-review-weeks>
        {#each review.weeks as w (w.p)}<a href={periodHref(w.p)} class={link} data-review-week={w.p}>{w.label}</a>{/each}
      </div>
    {/if}
    {#if review.latest}<p class="m-0 text-[13px] text-muted" data-review-latest>{review.latest.text}</p>{/if}
  {:else if review.state === 'working'}
    <div class="flex items-center gap-3 rounded-[10px] border border-dashed border-line p-3" role="status" data-review-wait>
      <span class="size-[22px] flex-none animate-spin rounded-full border-[2.5px] border-track border-t-blue" aria-hidden="true"></span>
      <span class="flex min-w-0 flex-col gap-0.5">
        <b class="font-medium" data-review-wait-head>{review.wait}</b>
        {#if review.wait_note}<span class="text-[13px] text-muted">{review.wait_note}</span>{/if}
      </span>
    </div>
    {#if page.slow}
      <p class="m-0 text-[13px] text-muted" data-review-slow>
        Taking longer than usual: look again in a few minutes.
        <button type="button" class="{link} cursor-pointer border-0 bg-transparent p-0 font-medium text-blue hover:underline" onclick={lookAgain} data-look-again
          >Look again</button
        >
      </p>
    {/if}
  {:else if review.state === 'done'}
    <CoachParts parts={review.parts} />
    {#if review.meta}<p class="num m-0 text-[13px] text-muted" data-review-meta>{review.meta.text}</p>{/if}
    <div class="flex flex-wrap items-center gap-x-4 gap-y-1">
      {#if review.button}{@render button(review.button, ghost)}{/if}
      {#each review.links as l (l.href)}<a href={doorLink(appUrl, l.href)} class={link} data-review-link>{l.label}</a>{/each}
    </div>
    {#if review.caution}<p class="m-0 border-t border-line pt-2 text-xs text-muted" data-review-caution>{review.caution}</p>{/if}
  {:else}
    {#if review.state === 'failed' && review.failed}
      <p class="m-0 rounded-[10px] border border-amber bg-amber-bg px-3 py-2" data-review-failed>{review.failed}</p>
    {/if}
    {#if review.intro}<p class="m-0" data-review-intro>{review.intro}</p>{/if}
    <div class="flex flex-col items-start gap-1">
      {#if review.button}{@render button(review.button, primary)}{/if}
      {#if review.cost}<span class="text-[13px] text-muted" data-review-cost>{review.cost}</span>{/if}
    </div>
  {/if}

  {#if page.said}
    <div
      role={page.said.tone === 'warning' ? 'alert' : 'status'}
      class="flex flex-col gap-0.5 rounded-[10px] px-3 py-2 text-[14px] {page.said.tone === 'warning' ? 'border border-amber bg-amber-bg' : 'border border-line bg-panel2'}"
      data-review-said={page.said.tone}
    >
      {#each page.said.lines as line, i (i)}<span class={i === 0 ? 'font-medium' : 'text-[13px]'}>{line}</span>{/each}
    </div>
  {/if}
</section>

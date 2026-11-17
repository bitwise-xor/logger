<script lang="ts">
  import CoachParts from '#lib/components/coach/CoachParts.svelte';
  import { arrowed, type Card } from '#lib/coach.js';
  import type { CoachRun } from '#lib/coachrun.svelte.js';
  import type { FieldValues } from '#lib/saver.js';
  import { doorLink } from '#lib/week.js';
  import type { Snippet } from 'svelte';

  // The Coach card of one day (deploy 109), in the door's words: Today's "Coach" and the Coach page's "Coach a day" (the same card; the
  // page puts its date field in `children`). none: the intro, the button, the cost line. working: the wait and its note (no button; the
  // page asks every 5 s and reads itself again when it is ready; after 5 minutes "taking longer" with Look again). done: the meta line,
  // the parts, the caution, "Coach me again". failed: the door's notice, then the intro and the button again. The button starts a paid
  // coaching: disabled from the first press until the answer is in, never sent again by the page. The door's words of the answer (a
  // refusal's reason too) are in the answer bar.
  let {
    card,
    run,
    fields,
    start,
    lookAgain,
    appUrl,
    title,
    links = false,
    children,
  }: {
    card: Card;
    run: CoachRun;
    fields: FieldValues | null;
    start: (fields: FieldValues) => void;
    lookAgain: () => void;
    appUrl: string;
    title: string;
    links?: boolean;
    children?: Snippet;
  } = $props();

  const primary =
    'inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg border-0 bg-text px-4 font-medium text-bg disabled:cursor-default disabled:opacity-60 desktop:min-h-10';
  const ghost =
    'inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg border border-line bg-panel px-3.5 font-medium text-text hover:bg-panel2 disabled:cursor-default disabled:opacity-60 desktop:min-h-10';
  const link = 'inline-flex min-h-11 items-center font-medium desktop:min-h-0';

  function submit(event: SubmitEvent) {
    event.preventDefault();
    if (fields) start(fields);
  }
</script>

{#snippet button(label: string, cls: string)}
  {#if fields}
    <form method="POST" action="?/coach_day" onsubmit={submit} class="m-0" data-coach-form>
      {#each Object.entries(fields) as [k, v] (k)}<input type="hidden" name={k} value={String(v)} />{/each}
      <button type="submit" class={cls} disabled={run.starting} aria-busy={run.starting} data-coach-button>{label}</button>
    </form>
  {/if}
{/snippet}

<section
  aria-labelledby="coach-h"
  class="flex flex-col gap-2.5 rounded-card border border-line bg-panel p-3 desktop:p-3.5"
  data-card="coach"
  data-state={card.state}
  data-day={card.start}
>
  <div class="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
    <h2 id="coach-h" class="m-0 text-[15px] font-semibold">{title}</h2>
    <span class="text-[13px] text-muted" data-coach-small>{card.small}</span>
  </div>

  {@render children?.()}

  {#if card.state === 'working'}
    <div class="flex items-center gap-3 rounded-[10px] border border-dashed border-line p-3" role="status" data-coach-wait>
      <span class="size-[22px] flex-none animate-spin rounded-full border-[2.5px] border-track border-t-blue" aria-hidden="true"></span>
      <span class="flex min-w-0 flex-col gap-0.5">
        <b class="font-medium" data-coach-wait-head>{card.wait}</b>
        {#if card.wait_note}<span class="text-[13px] text-muted" data-coach-wait-note>{card.wait_note}</span>{/if}
      </span>
    </div>
    {#if run.slow}
      <p class="m-0 text-[13px] text-muted" data-coach-slow>
        Taking longer than usual: look again in a few minutes.
        <button type="button" class="{link} cursor-pointer border-0 bg-transparent p-0 text-blue hover:underline" onclick={lookAgain} data-look-again
          >Look again</button
        >
      </p>
    {/if}
  {:else if card.state === 'done'}
    {#if card.meta}<p class="num m-0 text-[13px] text-muted" data-coach-meta>{card.meta.text}</p>{/if}
    <CoachParts parts={card.parts} />
    {#if card.caution}<p class="m-0 border-t border-line pt-2 text-xs text-muted" data-coach-caution>{card.caution}</p>{/if}
    <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
      {#if card.button}{@render button(card.button, ghost)}{/if}
      {#if card.cost}<span class="text-[13px] text-muted" data-coach-cost>{card.cost}</span>{/if}
    </div>
  {:else}
    {#if card.state === 'failed' && card.failed}
      <p class="m-0 rounded-[10px] border border-amber bg-amber-bg px-3 py-2" data-coach-failed>{card.failed}</p>
    {/if}
    {#if card.intro}<p class="m-0" data-coach-intro>{card.intro}</p>{/if}
    <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
      {#if card.button}{@render button(card.button, primary)}{/if}
      {#if card.cost}<span class="text-[13px] text-muted" data-coach-cost>{card.cost}</span>{/if}
    </div>
  {/if}

  {#if links && card.links.length}
    <div class="flex flex-wrap gap-x-4 gap-y-0" data-coach-links>
      {#each card.links as l (l.href)}<a href={doorLink(appUrl, l.href)} class="{link} text-blue" data-coach-link>{arrowed(l.label)}</a>{/each}
    </div>
  {/if}
</section>

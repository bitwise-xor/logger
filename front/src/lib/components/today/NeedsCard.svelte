<script lang="ts">
  import { dayOf, hm } from '#lib/format.js';
  import { needsCount, reviewText, type Answer, type Day } from '#lib/day.js';

  let { day }: { day: Day } = $props();

  const needs = $derived(day.needs);
  const count = $derived(needsCount(day));
  const checkinRows = $derived(
    needs.checkin
      ? (['mood', 'energy'] as const).map((k) => ({
          key: k,
          label: k === 'mood' ? 'Mood' : 'Energy',
          got: needs.checkin![k],
          words: needs.checkin!.scale[k],
        }))
      : [],
  );

  // Buttons as app. draws them (docs/API.md, Answer.style): the main one filled amber, plain ones outlined, quiet ones as text.
  const STYLE: Record<Answer['style'], string> = {
    primary: 'border-0 bg-amber text-on-amber',
    plain: 'border border-amber bg-transparent text-text',
    quiet: 'border-0 bg-transparent text-text underline-offset-2 hover:underline',
  };
  const btn = 'min-h-11 cursor-pointer rounded-lg px-4 font-medium desktop:min-h-9';
</script>

{#if count === 0}
  <p class="m-0 rounded-card border border-dashed border-line px-3 py-2.5 text-muted">Nothing needs you right now.</p>
{:else}
  <section aria-labelledby="needs-h" class="flex flex-col gap-2.5 rounded-card bg-amber-bg p-3 desktop:p-3.5" data-card="needs">
    <div class="flex items-center gap-2">
      <h2 id="needs-h" class="m-0 text-[15px] font-semibold text-amber">Needs you</h2>
      <span class="num rounded-chip bg-amber px-[7px] py-px text-xs font-medium text-on-amber" data-count>{count}</span>
    </div>
    <div class="flex flex-col gap-2.5 [&>*+*]:border-t [&>*+*]:border-amber/40 [&>*+*]:pt-2.5">

    {#each needs.questions as q (q.id)}
      <div class="flex flex-col gap-2">
        <span>{q.text}</span>
        {#if q.read_back}<span class="text-[13px] whitespace-pre-line text-muted">{q.read_back}</span>{/if}
        {#if q.lookup}
          <span class="num text-[13px] text-muted">
            {q.lookup.name} · per 100 {q.lookup.unit}: {Math.round(q.lookup.per_100.kcal)} kcal
          </span>
        {/if}
        {#if q.free}
          <input
            type={q.free.type}
            placeholder={q.free.placeholder}
            aria-label={q.free.placeholder}
            class="h-11 rounded-lg border border-line bg-panel px-3 text-base text-text desktop:h-9 desktop:text-sm"
          />
        {/if}
        <div class="flex flex-wrap gap-2">
          {#each q.answers as a (a.reply)}
            <button type="button" class="{btn} {STYLE[a.style]}">{a.label}</button>
          {/each}
          {#if q.refill}
            <button type="button" class="{btn} {STYLE.plain}">{q.refill.label}</button>
          {/if}
        </div>
      </div>
    {/each}

    {#each needs.not_read as m (m.id)}
      <div class="flex flex-col gap-2">
        <span>
          Not read yet{m.reading ? ', being read now' : ''}:
          {#if m.text}<q>{m.text}</q>{/if}
        </span>
        <span class="num text-[13px] text-muted">
          Sent {hm(m.received_at)}{m.tries ? ` · tried ${m.tries} ${m.tries === 1 ? 'time' : 'times'}` : ''}
        </span>
        <div class="flex flex-wrap gap-2">
          <button type="button" class="{btn} {STYLE.primary}">Try again</button>
          <button type="button" class="{btn} {STYLE.quiet}">Delete</button>
        </div>
      </div>
    {/each}

    {#if needs.review.length}
      <div class="flex flex-col gap-2">
        <span class="font-medium">To review</span>
        {#each needs.review as r (r.ref)}
          <div class="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span class="min-w-0 flex-1 basis-48">
              {#if r.day !== day.day}<span class="num text-muted">{dayOf(r.day)} </span>{/if}{reviewText(r)}
              {#if r.reason}<span class="text-[13px] text-muted"> · {r.reason}</span>{/if}
            </span>
            <span class="flex gap-2">
              <button type="button" class="{btn} {STYLE.plain}">Looks right</button>
              <button type="button" class="{btn} {STYLE.quiet}">Change</button>
            </span>
          </div>
        {/each}
        {#if needs.review.length >= 2}
          <div><button type="button" class="{btn} {STYLE.plain}">All {needs.review.length} look right</button></div>
        {/if}
      </div>
    {/if}

    {#if needs.checkin}
      <div class="flex flex-col gap-2">
        <span class="font-medium">
          {needs.checkin.day === day.today ? 'How was today?' : `How was yesterday, ${dayOf(needs.checkin.day)}?`}
        </span>
        {#each checkinRows as c (c.key)}
          {#if c.got}
            <span class="text-[13px]">{c.label} <span class="num">{c.got}</span> · {c.words[c.got - 1]}</span>
          {:else}
            <div class="flex flex-col gap-1.5">
              <span class="text-[13px] text-muted">{c.label}</span>
              <div class="grid grid-cols-5 gap-1.5">
                {#each c.words as w, i (w)}
                  <button
                    type="button"
                    aria-label="{c.label} {i + 1}, {w}"
                    class="flex min-h-11 cursor-pointer flex-col items-center justify-center rounded-lg border border-amber bg-transparent px-1 py-1 text-text"
                  >
                    <b class="num text-sm font-medium">{i + 1}</b>
                    <span class="text-[11px] leading-tight text-muted">{w}</span>
                  </button>
                {/each}
              </div>
            </div>
          {/if}
        {/each}
      </div>
    {/if}
    </div>
  </section>
{/if}

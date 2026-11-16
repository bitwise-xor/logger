<script lang="ts">
  import { dayOf, hm } from '#lib/format.js';
  import { needsCount, reviewText, type Answer, type Day, type Question } from '#lib/day.js';
  import { getToday } from '#lib/today.svelte.js';
  import { bodyDueLine } from '#lib/health.js';

  let { day, appUrl }: { day: Day; appUrl: string } = $props();
  const today = getToday();

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
  const btn = 'min-h-11 cursor-pointer rounded-lg px-4 font-medium disabled:cursor-default disabled:opacity-60 desktop:min-h-9';

  // "Look it up" (deploy 90), where app. shows it (webquestions.py: a food question of a typed line, tool "log", kind "food"): the
  // words in the field, or none (the door then looks up the question's word), go to /lookup; the food found is read back as a
  // new question under Needs you, answered with Yes or No as any other.
  const canLookUp = (q: Question) => q.tool === 'log' && q.kind === 'food';
  function lookUp(q: Question, event: MouseEvent) {
    const input = (event.currentTarget as HTMLButtonElement).form?.elements.namedItem('reply') as HTMLInputElement | null;
    void today.tap('lookup', `q:${q.id}`, { question_id: q.id, text: input?.value ?? '' }).then((a) => {
      if (a && a.tone === 'ok' && input) input.value = '';
    });
  }
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
          <!-- Typed words go to /answer as the reply. -->
          <form method="POST" action="?/answer" class="m-0 flex flex-wrap gap-2" data-reset onsubmit={today.submit('answer', `q:${q.id}`)}>
            <input type="hidden" name="question_id" value={q.id} />
            <input
              name="reply"
              type={q.free.type}
              inputmode={q.free.type === 'number' ? 'decimal' : undefined}
              step={q.free.type === 'number' ? 'any' : undefined}
              placeholder={q.free.placeholder}
              aria-label={q.free.placeholder}
              required
              class="h-11 min-w-0 flex-1 basis-40 rounded-lg border border-line bg-panel px-3 text-base text-text desktop:h-9 desktop:text-sm"
            />
            {#if q.free.unit}<span class="self-center text-[13px] text-muted">{q.free.unit}</span>{/if}
            <span class="flex gap-2">
              <button type="submit" class="{btn} {STYLE.plain}" disabled={today.busy[`q:${q.id}`]}>Send</button>
              {#if canLookUp(q)}
                <button type="button" class="{btn} {STYLE.plain}" disabled={today.busy[`q:${q.id}`]} onclick={(e) => lookUp(q, e)} data-lookup
                  >{today.busy[`q:${q.id}`] ? 'Looking…' : 'Look it up'}</button
                >
              {/if}
            </span>
          </form>
        {/if}
        <form method="POST" action="?/answer" class="m-0 flex flex-wrap gap-2" onsubmit={today.submit('answer', `q:${q.id}`)}>
          <input type="hidden" name="question_id" value={q.id} />
          {#each q.answers as a (a.reply)}
            <button type="submit" name="reply" value={a.reply} class="{btn} {STYLE[a.style]}" disabled={today.busy[`q:${q.id}`]}
              >{a.label}</button
            >
          {/each}
          {#if q.refill}
            <!-- "Correct it" / "Log again": the words go back into the logging box, to change and send again. -->
            <button type="button" class="{btn} {STYLE.plain}" onclick={() => today.refill(q.refill!.text)}>{q.refill.label}</button>
          {/if}
        </form>
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
          <form method="POST" action="?/held_retry" class="m-0" onsubmit={today.submit('held_retry', `held:${m.id}`)}>
            <input type="hidden" name="id" value={m.id} />
            <button type="submit" class="{btn} {STYLE.primary}" disabled={m.reading || today.busy[`held:${m.id}`]}
              >{today.busy[`held:${m.id}`] ? 'Reading…' : 'Try again'}</button
            >
          </form>
          <form method="POST" action="?/held_delete" class="m-0" onsubmit={today.submit('held_delete', `held:${m.id}`)}>
            <input type="hidden" name="id" value={m.id} />
            <button type="submit" class="{btn} {STYLE.quiet}" disabled={m.reading || today.busy[`held:${m.id}`]}>Delete</button>
          </form>
        </div>
      </div>
    {/each}

    {#if needs.body_due}
      {@const due = bodyDueLine(needs.body_due)}
      <!-- app.'s line at the top of To review (bodypage.today_line, deploy 92): Measure opens the Health page's body form, Not today
           hides it until the next health day. -->
      <div class="flex flex-wrap items-center gap-x-3 gap-y-2" data-body-due>
        <span class="flex min-w-0 flex-1 basis-48 flex-col">
          <span class="font-medium">{due.head}</span>
          <span class="num text-[13px] text-muted">{due.sub}</span>
        </span>
        <span class="flex items-center gap-2">
          <a href="/health?measure=1#body" class="{btn} {STYLE.primary} inline-flex items-center no-underline" data-body-measure>Measure</a>
          <form method="POST" action="?/body_skip" class="m-0" onsubmit={today.submit('body_skip', 'body_skip')}>
            <button type="submit" class="{btn} {STYLE.quiet}" disabled={today.busy.body_skip}>Not today</button>
          </form>
        </span>
      </div>
    {/if}

    {#if needs.review.length}
      <div class="flex flex-col gap-2">
        <span class="font-medium">To review</span>
        {#each needs.review as r (r.ref)}
          <div class="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span class="min-w-0 flex-1 basis-48">
              {#if r.day !== day.day}<span class="num text-muted">{dayOf(r.day)} </span>{/if}{reviewText(r)}
              {#if r.reason}<span class="text-[13px] text-muted"> · {r.reason}</span>{/if}
            </span>
            <span class="flex items-center gap-2">
              <form method="POST" action="?/review" class="m-0" onsubmit={today.submit('review', `review:${r.ref}`)}>
                <input type="hidden" name="action" value="ok" />
                <input type="hidden" name="ref" value={r.ref} />
                <button type="submit" class="{btn} {STYLE.plain}" disabled={today.busy[`review:${r.ref}`] || today.busy['review:all']}
                  >Looks right</button
                >
              </form>
              <!-- Changing an entry is app.'s for now (the Food day comes in step E). -->
              <a href="{appUrl}/web/" class="{btn} {STYLE.quiet} inline-flex items-center no-underline">Change</a>
            </span>
          </div>
        {/each}
        {#if needs.review.length >= 2}
          <!-- Clears only the items shown (app.'s "All N look right", webactions.review_all). -->
          <form method="POST" action="?/review" class="m-0" onsubmit={today.submit('review', 'review:all')}>
            <input type="hidden" name="action" value="all" />
            {#each needs.review as r (r.ref)}<input type="hidden" name="refs" value={r.ref} />{/each}
            <button type="submit" class="{btn} {STYLE.plain}" disabled={today.busy['review:all']}>All {needs.review.length} look right</button>
          </form>
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
            <form method="POST" action="?/checkin" class="m-0 flex flex-col gap-1.5" onsubmit={today.submit('checkin', `checkin:${c.key}`)}>
              <input type="hidden" name="type" value={c.key} />
              <input type="hidden" name="day" value={needs.checkin.day} />
              <span class="text-[13px] text-muted">{c.label}</span>
              <div class="grid grid-cols-5 gap-1.5">
                {#each c.words as w, i (w)}
                  <button
                    type="submit"
                    name="value"
                    value={i + 1}
                    disabled={today.busy[`checkin:${c.key}`]}
                    aria-label="{c.label} {i + 1}, {w}"
                    class="flex min-h-11 cursor-pointer flex-col items-center justify-center rounded-lg border border-amber bg-transparent px-1 py-1 text-text disabled:opacity-60"
                  >
                    <b class="num text-sm font-medium">{i + 1}</b>
                    <span class="text-[11px] leading-tight text-muted">{w}</span>
                  </button>
                {/each}
              </div>
            </form>
          {/if}
        {/each}
      </div>
    {/if}
    </div>
  </section>
{/if}

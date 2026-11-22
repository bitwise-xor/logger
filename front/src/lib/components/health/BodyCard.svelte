<script lang="ts">
  import { goto } from '$app/navigation';
  import Chart from '#lib/components/chart/Chart.svelte';
  import { MEASURES_FIELD, bodyDraft, bodyFields, bodyPost, bodySub, cm, cmField, dmy, healthHref, waistHeight, weightRate, type Body } from '#lib/health.js';
  import { getHealthPage } from '#lib/healthpage.svelte.js';

  // The Body measurements card (app.'s bodypage.card): when it was last measured and when it is due, Measure (the session form:
  // a cm field per shown tape measure with its hint, the last value as the placeholder), the table Now / Last / Start (Now opens
  // that session to change it), a chip per measure with its chart, waist ÷ height and the weekly weight rate. The settings
  // (interval, hidden measures, height) are Settings > Body (here since deploy 111): the card links there where app.'s does. The
  // measures are the door's, in its order (web item 58: the owner adds them in Settings > Body); nothing here names one, except
  // waist ÷ height, which the door works out.
  let { body, range }: { body: Body; range: number } = $props();
  const page = getHealthPage();

  const before = $derived(bodyDraft(body));
  let draft = $state<Record<string, string>>({});
  // The form's fields start from the session shown (again after a save or another session).
  $effect.pre(() => {
    draft = { ...before };
  });
  const fields = $derived(bodyFields(before, draft));
  const changed = $derived(Object.keys(fields).length > 0);
  const busy = $derived(!!page.busy.body);
  const past = $derived(body.day !== body.today);
  const chart = $derived(body.charts.find((c) => c.key === page.measure) ?? body.charts[0] ?? null);
  const wh = $derived(waistHeight(body));
  const rate = $derived(weightRate(body));
  // the height and the measures shown: Settings > Body here (deploy 111)
  const settings = '/settings/body';

  function save(event: SubmitEvent) {
    event.preventDefault();
    if (!changed) return;
    const clears = Object.entries(fields).some(([k, v]) => v === '' && before[k] !== '');
    void page.tap('body', 'body', { day: body.day, ...bodyPost(body, fields), ...(clears ? { clears: '1' } : {}) });
  }

  /** Measure: the form for today's session (another session was open: today's is read first). */
  function measure() {
    if (past) void goto(healthHref(range, { measure: true }), { reset: false });
    else page.measuring = true;
  }

  function close() {
    page.measuring = false;
    if (past) void goto(healthHref(range), { reset: false, replace: true });
  }

  const btn = 'inline-flex min-h-11 shrink-0 cursor-pointer items-center rounded-lg px-4 font-medium no-underline disabled:opacity-60 desktop:min-h-9';
  const field = 'num h-11 w-24 rounded-lg border border-line bg-panel px-3 text-right text-base text-text desktop:h-9 desktop:text-sm';
</script>

<section id="body" aria-labelledby="body-h" class="flex scroll-mt-4 flex-col gap-3 rounded-card border bg-panel px-3 py-3 desktop:px-3.5 {page.bodyFresh ? 'border-blue' : 'border-line'}" data-card="body">
  <div class="flex items-start gap-3">
    <div class="flex min-w-0 flex-1 flex-col gap-0.5">
      <h2 id="body-h" class="m-0 text-[15px] font-semibold">Body measurements</h2>
      <p class="m-0 text-[13px] text-muted" data-body-sub>{bodySub(body)}</p>
    </div>
    {#if page.measuring}
      <button type="button" class="{btn} border border-line bg-panel text-text" onclick={close}>Close</button>
    {:else}
      <button type="button" class="{btn} border-0 bg-text text-bg" onclick={measure} data-measure>Measure</button>
    {/if}
  </div>

  {#if page.measuring}
    <form method="POST" action="?/body" class="m-0 flex flex-col rounded-lg border border-line bg-panel2 px-3 py-2.5" onsubmit={save} data-body-form={body.day}>
      <input type="hidden" name="day" value={body.day} />
      <input type="hidden" name={MEASURES_FIELD} value={body.form.map((m) => m.key).join(',')} />
      <p class="m-0 pb-1.5 text-[13px] text-muted">{body.protocol}</p>
      {#if past}
        <p class="m-0 pb-1.5 text-[13px]" data-body-session><b>Changing the session of {dmy(body.day)}.</b> Clearing a value deletes it (asked once).</p>
      {/if}
      {#each body.form as m (m.key)}
        <label class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 border-t border-line py-2">
          <span class="flex min-w-0 flex-col leading-tight">
            <b class="font-medium">{m.label}</b>
            <span class="text-xs text-muted">{m.hint}</span>
          </span>
          <span class="flex items-center gap-1.5 text-muted">
            <input
              name={cmField(m.key)}
              inputmode="decimal"
              autocomplete="off"
              placeholder={m.last_cm === null ? '' : cm(m.last_cm)}
              aria-label="{m.label} in cm"
              bind:value={draft[m.key]}
              class={field}
            />
            cm
          </span>
        </label>
      {/each}
      <div class="flex gap-2 pt-2">
        <button type="submit" class="{btn} border-0 bg-text text-bg" disabled={busy || !changed}>Save</button>
        <button type="button" class="{btn} border border-line bg-panel text-text" onclick={close}>Cancel</button>
      </div>
    </form>
  {/if}

  {#if body.table.length}
    <div class="overflow-x-auto">
      <table class="w-full border-collapse text-sm" data-body-table>
        <thead>
          <tr class="text-xs text-muted">
            <th class="py-1.5 text-left font-medium">cm</th>
            <th class="py-1.5 text-right font-medium">Now</th>
            <th class="py-1.5 text-right font-medium">Last</th>
            <th class="py-1.5 text-right font-medium">Start</th>
          </tr>
        </thead>
        <tbody>
          {#each body.table as t (t.key)}
            <tr class="border-t border-line" data-measure-row={t.key}>
              <td class="py-0.5 font-medium">{t.label}</td>
              <td class="num py-0.5 text-right">
                <a
                  href={healthHref(range, { measure: true, mday: t.day })}
                  class="inline-flex min-h-11 items-center justify-end desktop:min-h-8"
                  aria-label="{t.label} {cm(t.cm)} cm on {dmy(t.day)}, change it"
                  data-now={t.key}>{cm(t.cm)}</a
                >
              </td>
              <td class="num py-0.5 text-right text-muted">{t.last_text ?? '–'}</td>
              <td class="num py-0.5 text-right text-muted">{t.start_text ?? '–'}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    <p class="m-0 text-xs text-muted">
      Last = change since the time before. Start = change since {body.first_day ? dmy(body.first_day) : '–'}. Tap a value to change it.
    </p>
  {/if}

  {#if body.charts.length && chart}
    <div class="flex flex-wrap gap-1.5" role="group" aria-label="Measure">
      {#each body.charts as c (c.key)}
        <button
          type="button"
          class="min-h-11 cursor-pointer rounded-full border px-3.5 text-[13px] desktop:min-h-8 {c.key === chart.key
            ? 'border-text bg-text text-bg'
            : 'border-line bg-panel text-text'}"
          aria-pressed={c.key === chart.key}
          onclick={() => (page.measure = c.key)}
          data-chip={c.key}>{c.label}</button
        >
      {/each}
    </div>
    <Chart chart={chart.chart} id="body-{chart.key}" />
  {/if}

  {#if wh}
    <p class="m-0 text-sm" data-waist-height>
      {#if 'noHeight' in wh}
        Waist ÷ height: add your height in <a href={settings}>Settings</a>.
      {:else}
        Waist ÷ height: <b class="num font-semibold">{wh.ratio}</b> (height {wh.height} cm, from <a href={settings}>Settings</a>). Under 0.5 is
        the common target.
      {/if}
    </p>
  {/if}
  {#if rate}
    <p class="m-0 text-sm" data-weight-rate>
      Weight: <b class="num font-semibold">{rate.kg}</b> a week over the last 4 weeks ({rate.pct} of body weight a week), from the 7-day averages.
    </p>
  {/if}
  <p class="m-0 text-xs text-muted">{body.hint}</p>
</section>

<script lang="ts">
  import { amountText } from '#lib/food.js';
  import { n } from '#lib/format.js';
  import {
    canSave,
    changeCount,
    changeLine,
    live,
    nameChanged,
    perText,
    rowNutrients,
    rowStatus,
    totals,
    totalText,
    typedAmount,
  } from '#lib/usual.js';
  import { getUsualPage } from '#lib/usualpage.svelte.js';
  import { tick } from 'svelte';

  const page = getUsualPage();
  const d = $derived(page.draft!);
  const isNew = $derived(d.mode === 'new');
  const orig = $derived(d.mode === 'edit' ? page.list?.find((u) => u.meal_id === d.meal_id) : undefined);
  const changes = $derived(changeCount(d));
  const now = $derived(totals(live(d)));
  const swapping = $derived(page.search?.for ? d.rows.find((r) => r.id === page.search!.for) : undefined);
  const busy = $derived(!!page.busy['usual:save'] || !!page.busy['usual:delete']);

  let searchEl: HTMLInputElement | null = $state(null);
  async function openSearch(forRow: string | null) {
    page.openSearch(forRow);
    await tick();
    searchEl?.focus();
  }

  function typed(id: string, event: Event) {
    const el = event.currentTarget as HTMLInputElement;
    const x = typedAmount(el.value);
    if (x === null) el.value = amountText(d.rows.find((r) => r.id === id)?.amount ?? 0);
    else page.setAmount(id, x);
  }

  const field = 'h-11 w-full rounded-lg border bg-panel px-3 text-[15px] text-text desktop:h-[38px]';
  const btn = 'min-h-11 cursor-pointer rounded-lg border border-line bg-panel px-3.5 text-text disabled:opacity-60 desktop:min-h-9 desktop:px-3';
  const primary = 'min-h-11 cursor-pointer rounded-lg border-0 bg-text px-[18px] font-medium text-bg disabled:opacity-45 desktop:min-h-9 desktop:px-4';
  const square = 'flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-line bg-panel p-0 text-lg text-text desktop:size-9 desktop:text-base';
  const tag = 'self-start rounded-full bg-blue-bg px-2 text-xs text-blue';
</script>

<!-- One usual meal open to change, or a new one (the mockup): the name, a row per food (− and +, Swap, remove), "+ Add a food" with
     a search of the catalogue, the total as it stands, then one Save for all the changes (with Undo), Cancel or Delete. Changed rows
     look changed until saved. -->
<section aria-labelledby="usual-title" class="flex flex-col gap-3 desktop:rounded-card desktop:border desktop:border-line desktop:bg-panel desktop:p-4" data-usual-editor={d.meal_id ?? 'new'}>
  <header class="flex flex-col gap-0.5">
    <button
      type="button"
      class="inline-flex min-h-11 cursor-pointer items-center self-start border-0 bg-transparent p-0 font-medium text-blue desktop:hidden"
      onclick={() => page.close()}>‹ Usual meals</button
    >
    <h1 id="usual-title" class="m-0 text-[26px] leading-[1.1] font-semibold tracking-tight break-words desktop:text-xl">
      {isNew ? 'New usual meal' : d.origName}
    </h1>
  </header>

  <div class="flex flex-col gap-1.5">
    <label for="usual-name" class="text-xs text-muted">Name</label>
    <input
      id="usual-name"
      type="text"
      maxlength="60"
      autocomplete="off"
      placeholder="e.g. Breakfast bowl"
      bind:value={d.name}
      oninput={() => (page.err = null)}
      class="{field} {nameChanged(d) ? 'border-blue' : 'border-line'}"
    />
    {#if nameChanged(d)}<span class={tag} data-status>Changed · was {d.origName}</span>{/if}
  </div>

  {#if isNew}
    <div role="group" aria-label="Meal or drink" class="grid grid-cols-2 gap-1.5">
      {#each [false, true] as drink (drink)}
        <button
          type="button"
          aria-pressed={d.drink === drink}
          class="min-h-11 cursor-pointer rounded-lg border border-line font-medium desktop:min-h-9 {d.drink === drink ? 'bg-text text-bg' : 'bg-panel text-text'}"
          onclick={() => (d.drink = drink)}>{drink ? 'Drink' : 'Meal'}</button
        >
      {/each}
    </div>
  {/if}

  <div class="flex flex-col gap-2">
    <h2 class="m-0 text-xs font-medium tracking-[0.06em] text-muted uppercase">Foods</h2>
    {#if !d.rows.length}<p class="m-0 text-muted">No foods yet. Add one below.</p>{/if}
    {#each d.rows as r (r.id)}
      {@const status = rowStatus(r)}
      {@const x = rowNutrients(r)}
      <div class="flex flex-col gap-1.5 rounded-lg border bg-panel px-2.5 py-2 {status ? 'border-blue' : 'border-line'} desktop:bg-panel2" data-usual-row={r.id}>
        <div class="flex items-baseline gap-2">
          <span class="min-w-0 flex-1 font-medium break-words {r.removed ? 'text-muted line-through' : ''}" data-row-food>{r.food}</span>
          <span class="num text-[13px] whitespace-nowrap text-muted" data-row-kcal>{x ? `${n(x.kcal)} kcal` : '–'}</span>
        </div>
        {#if status}<span class={tag} data-status>{status}</span>{/if}
        {#if r.removed}
          <button type="button" class="{btn} self-start" onclick={() => page.putBack(r.id)}>Put back</button>
        {:else}
          <div class="flex flex-wrap items-center gap-1.5">
            <span class="flex items-center gap-1.5">
              <button type="button" class={square} aria-label="Less {r.food}" onclick={() => page.step(r.id, -1)}>−</button>
              <input
                aria-label="Amount of {r.food} in {r.unit}"
                inputmode="decimal"
                autocomplete="off"
                value={amountText(r.amount)}
                onchange={(e) => typed(r.id, e)}
                class="num h-11 w-16 rounded-lg border border-transparent bg-transparent px-1 text-right text-base font-medium text-text focus:border-line desktop:h-9"
                data-row-amount
              />
              <span class="w-6 text-muted">{r.unit}</span>
              <button type="button" class={square} aria-label="More {r.food}" onclick={() => page.step(r.id, 1)}>+</button>
            </span>
            <span class="flex-1"></span>
            <button type="button" class={btn} onclick={() => openSearch(r.id)} aria-label="Swap {r.food}">Swap</button>
            <button type="button" class={square} aria-label="Remove {r.food}" onclick={() => page.remove(r.id)}>
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"
                ><path d="M4 4l8 8M12 4l-8 8"></path></svg
              >
            </button>
          </div>
        {/if}
      </div>
    {/each}

    {#if page.search}
      <div class="flex flex-col gap-2 rounded-lg border border-blue bg-panel2 p-2.5" data-usual-search>
        <label for="usual-q" class="text-xs text-muted">{swapping ? `Swap ${swapping.food} for` : 'Add a food'}</label>
        <div class="flex gap-1.5">
          <input
            id="usual-q"
            type="search"
            autocomplete="off"
            placeholder="Search the catalogue"
            bind:this={searchEl}
            value={page.q}
            oninput={(e) => page.find((e.currentTarget as HTMLInputElement).value)}
            onkeydown={(e) => e.key === 'Escape' && page.closeSearch()}
            class="{field} min-w-0 flex-1 border-line"
          />
          <button type="button" class={btn} onclick={() => page.closeSearch()}>Close</button>
        </div>
        {#if !page.q.trim()}
          <p class="m-0 text-[13px] text-muted">Type a name or a word, e.g. yogurt, milk or bread.</p>
        {:else if page.hits && !page.hits.length}
          <p class="m-0 text-[13px] text-muted">No food by that name in the catalogue.</p>
        {/if}
        {#each page.hits ?? [] as h (h.food_id)}
          <button
            type="button"
            class="flex min-h-12 w-full cursor-pointer flex-col items-start gap-0.5 rounded-lg border border-line bg-panel px-2.5 py-1.5 text-left text-text desktop:min-h-11"
            onclick={() => page.pick(h)}
            data-hit={h.food_id}
          >
            <span>{h.name}</span><span class="num text-xs text-muted">{perText(h)}</span>
          </button>
        {/each}
      </div>
    {:else}
      <button type="button" class="{btn} self-start" onclick={() => openSearch(null)} disabled={page.full} data-add-food>+ Add a food</button>
    {/if}
  </div>

  <div class="flex flex-col gap-0.5 border-t border-line px-0.5 py-2">
    <div class="flex justify-between gap-2"><span class="text-muted">Total</span><span class="num" data-usual-total>{totalText(now)}</span></div>
    {#if orig && changes > 0}
      <div class="num text-right text-xs text-muted" data-usual-was>was {totalText(orig.nutrients)}</div>
    {/if}
  </div>

  {#if page.err}
    <p role="alert" class="m-0 rounded-lg bg-amber-bg px-2.5 py-2 text-amber" data-usual-err>{page.err}</p>
  {/if}

  <div class="flex flex-wrap items-center gap-2">
    <button type="button" class={primary} disabled={busy || !canSave(d)} onclick={() => page.save()} data-usual-save>Save</button>
    <button type="button" class={btn} onclick={() => page.close()}>Cancel</button>
    <span class="flex-1"></span>
    {#if !isNew}
      <button type="button" class="{btn} bg-transparent text-muted" disabled={busy} onclick={() => page.remove_meal()} data-usual-delete>Delete</button>
    {/if}
  </div>
  <p class="m-0 text-xs text-muted" data-usual-changes>{changeLine(d)}</p>
</section>

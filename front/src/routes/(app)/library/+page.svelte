<script lang="ts">
  import ProblemCard from '#lib/components/ProblemCard.svelte';
  import GymDock from '#lib/components/gym/GymDock.svelte';
  import FoodBox from '#lib/components/library/FoodBox.svelte';
  import FoodRow from '#lib/components/library/FoodRow.svelte';
  import LibraryHeader from '#lib/components/library/LibraryHeader.svelte';
  import { catalogueHref, countLine } from '#lib/catalogue.js';
  import { CataloguePage, setCataloguePage } from '#lib/cataloguepage.svelte.js';
  import { untrack } from 'svelte';
  import { MediaQuery } from 'svelte/reactivity';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();

  // Library's Foods tab (deploy 105): app.'s Food > Catalogue in the new look, every change saving in place. The search (Enter, or a
  // short pause in typing), the door's filter chips and eight orders, the count, "+ New food" (the look-up), a row per food; a row
  // opens its box under it on phones and tablets and in a column beside the list from 1100 px (the address carries ?food=).
  const page = setCataloguePage(untrack(() => new CataloguePage(data.catalogue, data.item, data.view, data.gone, data.undo)));
  $effect.pre(() => page.load(data.catalogue, data.item, data.view, data.gone, data.undo));

  // from 1100 px (the layout's desktop width) the box sits beside the list
  const wide = new MediaQuery('min-width: 68.75rem', false);
  const c = $derived(page.cat);
  const open = $derived(page.view.food);
  // a box whose food is not in the list shown (an address typed by hand): above the list on phones and tablets
  const stray = $derived(!!page.item && !c?.rows.some((r) => r.id === page.item!.id));

  const field = 'h-11 w-full min-w-0 rounded-lg border border-line bg-panel px-3 text-base text-text placeholder:text-muted desktop:h-10 desktop:text-sm';
  const btn = 'min-h-11 shrink-0 cursor-pointer rounded-lg px-4 font-medium whitespace-nowrap disabled:opacity-60 desktop:min-h-10';
</script>

<svelte:head><title>Foods · Library · Logger</title></svelte:head>

<LibraryHeader on="foods" />

{#snippet gone()}
  <p role="alert" class="m-0 rounded-card border border-amber bg-amber-bg p-3 text-amber" data-gone>{page.gone}</p>
{/snippet}

{#snippet box(side: boolean)}
  {#if page.item}
    <FoodBox item={page.item} {side} />
  {/if}
{/snippet}

{#if !c}
  <ProblemCard kind={data.problem ?? 'trouble'} appHref="{data.appUrl}/web/food/catalogue" />
{:else}
  <div class="flex flex-col gap-2.5" data-tools>
    <div class="flex flex-col gap-2.5 desktop:flex-row desktop:items-center">
      <form
        method="GET"
        action="/library"
        role="search"
        class="m-0 min-w-0 desktop:flex-1"
        onsubmit={(e) => {
          e.preventDefault();
          page.searchNow();
        }}
      >
        <input type="hidden" name="f" value={c.filter} />
        <input type="hidden" name="s" value={c.sort} />
        <input
          type="search"
          name="q"
          maxlength="60"
          autocomplete="off"
          placeholder={c.placeholder}
          aria-label="Search foods"
          value={page.search}
          oninput={(e) => page.typed(e.currentTarget.value)}
          class={field}
          data-search
        />
      </form>
      <nav aria-label="Filter" class="-mx-3.5 overflow-x-auto px-3.5 desktop:mx-0 desktop:px-0" data-chips>
        <div class="flex w-max gap-1.5">
          {#each c.filters as f (f.key)}
            <a
              href={catalogueHref({ q: c.q, f: f.key, s: c.sort })}
              aria-current={f.on ? 'page' : undefined}
              data-sveltekit-reset="false"
              class="inline-flex min-h-11 items-center rounded-full border px-3.5 text-[13px] whitespace-nowrap no-underline desktop:min-h-10 {f.on
                ? 'border-text bg-text text-bg'
                : 'border-line bg-panel text-text'}"
              data-filter={f.key}>{f.label}</a
            >
          {/each}
        </div>
      </nav>
    </div>
    <div class="flex gap-2">
      <select aria-label="Sort" class="{field} flex-1 desktop:max-w-80" value={c.sort} onchange={(e) => page.go({ q: c.q, f: c.filter, s: e.currentTarget.value as typeof c.sort })} data-sort>
        {#each c.sorts as s (s.key)}<option value={s.key}>{s.label}</option>{/each}
      </select>
      <button type="button" class="{btn} border-0 bg-text text-bg" aria-expanded={page.adding} onclick={() => page.newFood()} data-new-food>+ New food</button>
    </div>
  </div>

  {#if page.adding}
    <form
      method="POST"
      action="?/lookup"
      class="m-0 flex flex-col gap-2.5 rounded-card border border-line bg-panel p-3 desktop:max-w-[720px] desktop:p-3.5"
      novalidate
      onsubmit={(e) => {
        e.preventDefault();
        void page.lookUp();
      }}
      data-new-form
    >
      <h2 class="m-0 text-[15px] font-semibold">New food</h2>
      <div class="flex flex-wrap gap-2">
        <input name="text" maxlength="200" autocomplete="off" placeholder="Name or barcode" aria-label="Name or barcode" bind:value={page.newText} oninput={() => delete page.errs.new} class="{field} flex-1 basis-48" data-new-text />
        <span class="flex gap-2">
          <button type="submit" class="{btn} border-0 bg-text text-bg" disabled={!!page.busy.new} aria-busy={!!page.busy.new} data-look-up
            >{page.busy.new ? 'Looking…' : 'Look up'}</button
          >
          <button type="button" class="{btn} border border-line bg-panel text-text" onclick={() => page.newFood()}>Cancel</button>
        </span>
      </div>
      {#if page.busy.new}<p role="status" class="m-0 text-[13px] text-muted" data-looking>Looking in USDA and Open Food Facts…</p>{/if}
      {#if page.errs.new}<p role="alert" class="m-0 rounded-lg bg-amber-bg px-2.5 py-2 text-[13px] text-amber" data-err="new">{page.errs.new}</p>{/if}
      <p class="m-0 text-xs text-muted">Looks in USDA and Open Food Facts and reads the values back before anything is added.</p>
    </form>
  {/if}

  <div class="flex items-center justify-between gap-2">
    <p class="m-0 text-[13px] text-muted" data-count>
      {countLine(c)}{#if c.more}<span> · {c.more}</span>{/if}
    </p>
    <!-- the words review (core item 24): every word of every food, to find a wrong one; its own page under Foods -->
    <a href="/library/words" class="inline-flex min-h-11 shrink-0 items-center text-[13px] whitespace-nowrap no-underline desktop:min-h-9" data-words-link>Review words ›</a>
  </div>

  <main class="flex flex-col gap-3 desktop:flex-row desktop:items-start desktop:gap-4">
    <div class="flex min-w-0 flex-col gap-3 desktop:flex-1">
      {#if !wide.current && page.gone}{@render gone()}{/if}
      {#if !wide.current && stray}<div class="overflow-hidden rounded-card border border-line bg-panel">{@render box(false)}</div>{/if}
      <section aria-label="Foods" class="flex flex-col overflow-hidden rounded-card border border-line bg-panel [&>*+*]:border-t [&>*+*]:border-line" data-list>
        {#each c.rows as r (r.id)}
          <div data-food={r.id}>
            <FoodRow {r} />
            {#if !wide.current && open === r.id}{@render box(false)}{/if}
          </div>
        {:else}
          <p class="m-0 p-3.5 text-muted" data-empty>{c.empty}</p>
        {/each}
      </section>
    </div>
    {#if wide.current}
      <aside aria-label="The open food" class="sticky top-4 flex max-h-[calc(100dvh-2rem)] w-[400px] shrink-0 flex-col gap-3 overflow-y-auto" style:padding-bottom={page.bar ? '180px' : undefined} data-side>
        {#if page.gone}
          {@render gone()}
        {:else if page.item}
          <section class="rounded-card border border-line bg-panel p-3.5">{@render box(true)}</section>
        {:else}
          <p class="m-0 flex flex-col gap-1 rounded-card border border-dashed border-line p-6 text-muted" data-side-hint>
            <span class="font-medium text-text">Pick a food</span>
            <span>Its values, words, units and barcode open here.</span>
          </p>
        {/if}
      </aside>
    {/if}
  </main>
{/if}

<GymDock answers={page} />

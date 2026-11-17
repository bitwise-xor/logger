<script lang="ts">
  import { perLine, type Item } from '#lib/catalogue.js';
  import { getCataloguePage } from '#lib/cataloguepage.svelte.js';

  // A food's box (deploy 105, app.'s Catalogue box in the mockup's order), every word from the door: the source line; "needs review"
  // with "Looks right"; the ten values per 100 g or ml (an unknown one empty, "unknown"; a recipe food's read only), the tick for the
  // past entries (off again after each save) and Save (shown first by the door: Yes in the answer bar); the words you call it (× and
  // Add); name and use (Drink, Hide, Save); the units (Add a unit); the barcode (Set); Close. A refusal or "Nothing changed." is said
  // next to its form, which keeps what was typed. `side`: in the PC's column (the name on top), else under its row.
  let { item, side = false }: { item: Item; side?: boolean } = $props();
  const page = getCataloguePage();
  const busy = (id: string) => !!page.busy[id];

  const field = 'h-11 w-full min-w-0 rounded-lg border border-line bg-panel px-3 text-base text-text placeholder:text-muted desktop:h-9 desktop:text-sm';
  const btn = 'min-h-11 shrink-0 cursor-pointer rounded-lg px-4 font-medium disabled:opacity-60 desktop:min-h-9';
  const primary = `${btn} border-0 bg-text text-bg`;
  const ghost = `${btn} border border-line bg-panel text-text`;
  const label = 'm-0 text-xs font-medium tracking-wider text-muted uppercase';
  const sec = 'm-0 flex flex-col gap-2.5 border-t border-line pt-3';
</script>

{#snippet refusal(form: string)}
  {#if page.errs[form]}<p role="alert" class="m-0 rounded-lg bg-amber-bg px-2.5 py-2 text-[13px] text-amber" data-err={form}>{page.errs[form]}</p>{/if}
{/snippet}

{#snippet sw(on: boolean, text: string, set: (v: boolean) => void, key: string)}
  <button type="button" role="switch" aria-checked={on} class="flex min-h-11 w-full cursor-pointer items-center gap-2.5 border-0 bg-transparent p-0 text-left text-text" onclick={() => set(!on)} data-switch={key}>
    <span aria-hidden="true" class="flex h-6 w-10 shrink-0 items-center rounded-full border border-line p-0.5 {on ? 'justify-end bg-text' : 'justify-start bg-panel'}">
      <span class="size-4.5 rounded-full {on ? 'bg-bg' : 'bg-muted'}"></span>
    </span>
    {text}
  </button>
{/snippet}

<div class="flex flex-col gap-3 {side ? '' : 'border-t border-line bg-panel2 px-3 py-3 tablet:px-4'}" data-box={item.id}>
  {#if side}
    <div class="flex items-baseline justify-between gap-2">
      <h2 class="m-0 text-[17px] font-semibold tracking-tight break-words" data-box-name>{item.name}</h2>
      <span class="num text-[13px] text-muted">{item.ref}</span>
    </div>
  {/if}
  <p class="m-0 text-[13px] text-muted" data-box-source>{item.source.text}</p>

  {#if item.needs_review}
    <div class="flex flex-wrap items-center gap-2 rounded-lg bg-amber-bg px-3 py-2" data-review-bar>
      <span class="min-w-0 flex-1 basis-40 text-[13px] text-amber">{item.review_reason ?? item.words.review}</span>
      <button type="button" class={primary} disabled={busy('review')} onclick={() => page.looksRight()} data-looks-right>{item.words.reviewed}</button>
    </div>
    {@render refusal('review')}
  {/if}

  <!-- the ten values -->
  <form method="POST" action="?/catalogue_values" class="m-0 flex flex-col gap-2.5" novalidate onsubmit={(e) => (e.preventDefault(), page.saveValues())} data-form="values">
    <h3 class={label}>Values {perLine(item)}</h3>
    {#if !item.values_editable}
      <p class="m-0 text-[13px] text-muted" data-recipe>Calculated from recipe {item.recipe}: change the recipe in the full app. Read only here.</p>
    {/if}
    <div class="grid grid-cols-2 gap-x-2.5 gap-y-2 {side ? '' : 'tablet:grid-cols-5'}">
      {#each item.values as v (v.key)}
        <label class="flex min-w-0 flex-col gap-1 text-xs text-muted">
          {v.label}
          <input
            name={v.key}
            type="text"
            inputmode="decimal"
            autocomplete="off"
            placeholder="unknown"
            readonly={!item.values_editable}
            bind:value={page.draft[v.key]}
            oninput={() => delete page.errs.values}
            class="{field} num {item.values_editable ? '' : 'bg-panel2 text-muted'}"
            data-value={v.key}
          />
        </label>
      {/each}
    </div>
    {#if item.values_editable}
      {#if item.past}
        <label class="flex min-h-11 cursor-pointer items-center gap-2.5 text-text desktop:min-h-9">
          <input type="checkbox" name="past" value="1" bind:checked={page.past} class="peer sr-only" data-past />
          <span
            aria-hidden="true"
            class="flex size-5 shrink-0 items-center justify-center rounded-[5px] border border-muted bg-panel text-transparent peer-checked:border-text peer-checked:bg-text peer-checked:text-bg peer-focus-visible:ring-2 peer-focus-visible:ring-blue"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L19 7"></path></svg>
          </span>
          <span>{item.past.text}</span>
        </label>
      {/if}
      {@render refusal('values')}
      <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
        <button type="submit" class={primary} disabled={busy('values') || busy('confirm:catalogue_values')} data-save-values>Save</button>
        <span class="min-w-0 flex-1 basis-48 text-xs text-muted">{item.words.values_hint}</span>
      </div>
    {/if}
  </form>

  <!-- the words you call it -->
  <form method="POST" action="?/catalogue_words" class={sec} novalidate onsubmit={(e) => (e.preventDefault(), page.addWord())} data-form="words">
    <h3 class={label}>Words you call it</h3>
    {#if item.aliases.length}
      <div class="flex flex-wrap gap-1.5" data-words>
        {#each item.aliases as w (w)}
          <span class="inline-flex items-center gap-0.5 rounded-full border border-line bg-panel pl-3 text-[13px]" data-word={w}>
            {w}
            <button
              type="button"
              aria-label="Remove {w}"
              class="flex size-11 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent text-muted hover:text-text disabled:opacity-60 desktop:size-8"
              disabled={busy(`words:${w}`)}
              onclick={() => page.removeWord(w)}
              data-word-remove={w}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg>
            </button>
          </span>
        {/each}
      </div>
    {:else}
      <p class="m-0 text-[13px] text-muted">{item.words.none}</p>
    {/if}
    {@render refusal('words')}
    <div class="flex gap-2">
      <input name="word" maxlength={item.limits.word_max} autocomplete="off" placeholder="Add a word" aria-label="Add a word" bind:value={page.word} oninput={() => delete page.errs.word} class={field} data-word-input />
      <button type="submit" class={ghost} disabled={busy('word')} data-word-add>Add</button>
    </div>
    {@render refusal('word')}
  </form>

  <!-- name and use -->
  <form method="POST" action="?/catalogue_basics" class={sec} novalidate onsubmit={(e) => (e.preventDefault(), page.saveBasics())} data-form="basics">
    <h3 class={label}>Name and use</h3>
    <input name="name" maxlength={item.limits.name_max} autocomplete="off" aria-label="Name" bind:value={page.name} oninput={() => delete page.errs.basics} class={field} data-basics-name />
    {@render sw(page.drink, 'Drink', (v) => (page.drink = v), 'drink')}
    {@render sw(page.hide, 'Hide', (v) => (page.hide = v), 'hide')}
    {@render refusal('basics')}
    <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
      <button type="submit" class={primary} disabled={busy('basics')} data-basics-save>Save</button>
      <span class="min-w-0 flex-1 basis-48 text-xs text-muted">{item.words.basics_hint}</span>
    </div>
  </form>

  <!-- the units -->
  <form method="POST" action="?/catalogue_unit" class={sec} novalidate onsubmit={(e) => (e.preventDefault(), page.addUnit())} data-form="unit">
    <h3 class={label}>Units</h3>
    {#if item.units.length}
      <ul class="m-0 flex list-none flex-col gap-1 p-0 text-[13px]" data-units>
        {#each item.units as u (u.unit)}<li class="num" data-unit={u.unit}>{u.text}</li>{/each}
      </ul>
    {/if}
    <div class="flex flex-wrap gap-2">
      <input name="unit" maxlength={item.limits.unit_max} autocomplete="off" placeholder="slice, piece, scoop, cup" aria-label="Unit name" bind:value={page.unit} oninput={() => delete page.errs.unit} class="{field} flex-1 basis-36" data-unit-name />
      <input name="grams" type="text" inputmode="decimal" autocomplete="off" placeholder={item.basis} aria-label="Weight in {item.basis}" bind:value={page.grams} oninput={() => delete page.errs.unit} class="{field} num w-20! flex-none" data-unit-grams />
      <button type="submit" class={ghost} disabled={busy('unit')} data-unit-add>Add a unit</button>
    </div>
    {@render refusal('unit')}
  </form>

  <!-- the barcode -->
  <form method="POST" action="?/catalogue_barcode" class={sec} novalidate onsubmit={(e) => (e.preventDefault(), page.setBarcode())} data-form="barcode">
    <h3 class={label}>Barcode</h3>
    <p class="num m-0 text-[13px] {item.barcode ? '' : 'text-muted'}" data-barcode>{item.barcode ?? item.words.none}</p>
    <div class="flex gap-2">
      <input name="barcode" inputmode="numeric" autocomplete="off" maxlength="40" placeholder="{item.limits.barcode_min} to {item.limits.barcode_max} digits" aria-label="Barcode" bind:value={page.barcode} oninput={() => delete page.errs.barcode} class="{field} num" data-barcode-input />
      <button type="submit" class={ghost} disabled={busy('barcode')} data-barcode-set>Set</button>
    </div>
    {@render refusal('barcode')}
  </form>

  <div class="border-t border-line pt-3">
    <button type="button" class={ghost} onclick={() => page.close()} data-box-close>Close</button>
  </div>
</div>

<script lang="ts">
  import { cards } from '#lib/usual.js';
  import { getUsualPage } from '#lib/usualpage.svelte.js';

  const page = getUsualPage();
  const list = $derived(cards(page.list ?? []));
</script>

<!-- A card per usual meal or drink (the mockup): name, foods with amounts, kcal and protein. Tap one to open it. -->
<section aria-label="Your usual meals and drinks" class="flex flex-col gap-2" data-card="usual-list">
  {#if !list.length}
    <p class="m-0 text-muted">No usual meals yet. Make one with "+ New usual meal", or save a meal of the Food day.</p>
  {/if}
  {#each list as c (c.meal_id)}
    {@const on = page.draft?.mode === 'edit' && page.draft.meal_id === c.meal_id}
    {@const fresh = page.fresh === c.meal_id}
    <button
      type="button"
      class="flex min-h-16 w-full cursor-pointer flex-col gap-1 rounded-card border px-3 py-2.5 text-left text-text transition-colors duration-[600ms] desktop:min-h-[60px] {on
        ? 'border-blue bg-blue-bg'
        : fresh
          ? 'border-blue bg-panel'
          : 'border-line bg-panel'}"
      aria-pressed={on}
      data-usual={c.meal_id}
      data-fresh={fresh ? '' : undefined}
      onclick={() => page.openMeal(c.meal_id)}
    >
      <span class="flex w-full items-baseline gap-2">
        <span class="min-w-0 flex-1 font-medium break-words" data-usual-name>{c.name}</span>
        {#if c.drink}<span class="shrink-0 rounded-full bg-blue-bg px-2 text-xs text-blue">Drink</span>{/if}
        <span class="num whitespace-nowrap" data-usual-kcal>{c.kcal}</span>
      </span>
      <span class="flex w-full items-baseline gap-2 text-[13px] text-muted">
        <span class="min-w-0 flex-1 break-words" data-usual-items>{c.items}</span>
        <span class="num whitespace-nowrap" data-usual-protein>{c.protein}</span>
      </span>
    </button>
  {/each}
</section>

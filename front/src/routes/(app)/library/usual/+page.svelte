<script lang="ts">
  import ProblemCard from '#lib/components/ProblemCard.svelte';
  import LibraryHeader from '#lib/components/library/LibraryHeader.svelte';
  import AnswerBar from '#lib/components/today/AnswerBar.svelte';
  import UsualCards from '#lib/components/usual/UsualCards.svelte';
  import UsualEditor from '#lib/components/usual/UsualEditor.svelte';
  import { countLine } from '#lib/usual.js';
  import { setUsualPage, UsualPage } from '#lib/usualpage.svelte.js';
  import { onMount, untrack } from 'svelte';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();

  // Deploy 87: the usual meals (the Food day's "Usual meals", and "Edit" by Today's usual chips); since deploy 105 Library's tab
  // /library/usual, under the Library header (/food/usual leads here). Phones and tablets
  // show the list or the open meal; from 1100 px the list on the left and the open meal on the right. Saves change the page in
  // place (src/lib/usualpage.svelte.ts).
  const page = setUsualPage(untrack(() => new UsualPage(data.usual, data.undo, data.open)));
  $effect.pre(() => page.load(data.usual, data.undo, data.open));
  onMount(() => {
    page.openFirst();
    void page.resend();
  });

  const editing = $derived(!!page.draft);
  const opened = $derived(page.draft ? `${page.draft.mode}:${page.draft.meal_id}` : '');

  // On a phone the open meal is its own screen: from its top.
  $effect(() => {
    if (opened && !page.wide) untrack(() => window.scrollTo({ top: 0 }));
  });

  // The answer bar floats above the tab bar on phones; the page leaves room for it (--dock, as on the Food day).
  let barHeight = $state(0);
  $effect(() => {
    document.documentElement.style.setProperty('--dock', `${barHeight}px`);
    return () => document.documentElement.style.removeProperty('--dock');
  });

  const primary = 'min-h-11 cursor-pointer rounded-lg border-0 bg-text px-[18px] font-medium text-bg desktop:min-h-9 desktop:px-4';
</script>

<svelte:head><title>Usual meals · Logger</title></svelte:head>

<LibraryHeader on="usual" hidden={editing} />

{#if page.list}
  <div class="flex-wrap items-center gap-3 desktop:flex {editing ? 'hidden' : 'flex'}">
    <p class="m-0 flex-1 text-[13px] text-muted" data-count>
      {countLine(page.list)} <span class="desktop:hidden">Tap one to change it.</span><span class="hidden desktop:inline">Pick one to change it.</span>
    </p>
    <button type="button" class="{primary} hidden desktop:inline-block" onclick={() => page.newMeal()} data-new-usual>+ New usual meal</button>
  </div>
{/if}

{#if !page.list}
  <ProblemCard kind={data.problem ?? 'trouble'} appHref="{data.appUrl}/web/food/usual" />
{:else}
  <main class="flex flex-col gap-3 desktop:flex-row desktop:items-start desktop:gap-4">
    <div class="flex-col gap-3 desktop:flex desktop:w-[400px] desktop:shrink-0 {editing ? 'hidden' : 'flex'}">
      <button type="button" class="{primary} w-full desktop:hidden" onclick={() => page.newMeal()} data-new-usual>+ New usual meal</button>
      <UsualCards />
    </div>
    <div class="min-w-0 flex-1 desktop:max-w-[640px]">
      {#if page.draft}
        {#key opened}<UsualEditor />{/key}
      {:else}
        <p class="m-0 hidden rounded-card border border-dashed border-line p-6 text-muted desktop:block">
          Pick a meal on the left to change it, or make a new one.
        </p>
      {/if}
    </div>
  </main>
{/if}

<!-- The answer bar: above the tab bar on phones, at the bottom right on the PC (as on the Food day). -->
<div
  bind:clientHeight={barHeight}
  class="pointer-events-none fixed inset-x-0 bottom-[var(--places-bar)] z-20 px-3.5 pb-2 desktop:static desktop:p-0"
>
  <AnswerBar answers={page} />
</div>

<script lang="ts">
  import ProblemCard from '#lib/components/ProblemCard.svelte';
  import GymDock from '#lib/components/gym/GymDock.svelte';
  import LibraryHeader from '#lib/components/library/LibraryHeader.svelte';
  import { catalogueHref } from '#lib/catalogue.js';
  import { setWordsPage, WordsPage } from '#lib/wordspage.svelte.js';
  import { countLine, emptyLine, groupByMonth, narrowedLine, sharedLabel, whenLine, wordsHref, WORDS_Q_MAX } from '#lib/words.js';
  import { untrack } from 'svelte';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();

  // Library > Foods > Words (core item 24): every word the logger knows for a food, to find a wrong one. The search (Enter, or a short
  // pause in typing) and the chip "On more than one food", the count, the words by month (newest first): the word, its food (a link
  // that opens the food's box in the Foods tab), the date and where it came from, an amber mark when other foods have it too, and
  // Remove, saved in place with Undo in the answer bar (the list is read again).
  const page = setWordsPage(untrack(() => new WordsPage(data.words, data.view, data.undo)));
  $effect.pre(() => page.load(data.words, data.view, data.undo));

  const w = $derived(page.words);
  const groups = $derived(w ? groupByMonth(w.rows) : []);
  const narrowed = $derived(narrowedLine(page.view));
  const field = 'h-11 w-full min-w-0 rounded-lg border border-line bg-panel px-3 text-base text-text placeholder:text-muted desktop:h-10 desktop:text-sm';
</script>

<svelte:head><title>Words · Library · Logger</title></svelte:head>

<LibraryHeader on="foods" />

{#if !w}
  <ProblemCard kind={data.problem ?? 'trouble'} appHref="{data.appUrl}/web/food/catalogue" />
{:else}
  <main class="flex w-full flex-col gap-3 desktop:max-w-[720px]">
    <div class="flex items-center">
      <a href="/library" class="inline-flex min-h-11 items-center text-[13px] text-muted no-underline hover:text-text desktop:min-h-9" data-back>‹ Foods</a>
    </div>

    <div class="flex flex-col gap-2.5" data-tools>
      <form
        method="GET"
        action="/library/words"
        role="search"
        class="m-0 min-w-0"
        onsubmit={(e) => {
          e.preventDefault();
          page.searchNow();
        }}
      >
        {#if page.view.shared}<input type="hidden" name="shared" value="1" />{/if}
        <input
          type="search"
          name="q"
          maxlength={WORDS_Q_MAX}
          autocomplete="off"
          placeholder="Search by word or food"
          aria-label="Search words"
          value={page.search}
          oninput={(e) => page.typed(e.currentTarget.value)}
          class={field}
          data-search
        />
      </form>
      <nav aria-label="Filter" class="-mx-3.5 overflow-x-auto px-3.5 desktop:mx-0 desktop:px-0" data-chips>
        <div class="flex w-max gap-1.5">
          <a
            href={wordsHref({ q: page.view.q, shared: !page.view.shared })}
            aria-current={page.view.shared ? 'true' : undefined}
            data-sveltekit-reset="false"
            class="inline-flex min-h-11 items-center rounded-full border px-3.5 text-[13px] whitespace-nowrap no-underline desktop:min-h-10 {page.view.shared
              ? 'border-text bg-text text-bg'
              : 'border-line bg-panel text-text'}"
            data-shared>On more than one food</a
          >
        </div>
      </nav>
    </div>

    <p class="m-0 text-[13px] text-muted" data-count>
      {countLine(w)}{#if narrowed}<span data-narrowed>{' ' + narrowed}</span>{/if}{#if w.count < w.total}<span>{` · the newest ${w.limit} are shown; search to find others`}</span>{/if}
    </p>

    {#each groups as g (g.month ?? 'unknown')}
      <section aria-labelledby="month-{g.month ?? 'unknown'}" class="flex flex-col gap-1.5" data-group={g.month ?? 'unknown'}>
        <h2 id="month-{g.month ?? 'unknown'}" class="m-0 text-xs font-medium tracking-wider text-muted uppercase" data-group-head>{g.label}</h2>
        <ul class="m-0 flex list-none flex-col overflow-hidden rounded-card border border-line bg-panel p-0 [&>*+*]:border-t [&>*+*]:border-line" data-list>
          {#each g.rows as r (`${r.food_id}:${r.word}`)}
            {@const also = sharedLabel(r.shared)}
            <li class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 py-1 pr-1.5 pl-3" data-word-row data-word={r.word} data-food={r.food_id}>
              <div class="flex min-w-0 flex-col gap-0.5 py-1.5">
                <span class="font-medium break-words" data-word-text>{r.word}</span>
                <a href={catalogueHref({ food: r.food_id })} class="relative z-10 -my-3.5 w-fit max-w-full py-3.5 text-[13px] break-words desktop:-my-1 desktop:py-1" data-food-link>{r.food}</a>
                <span class="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                  <span class="num" data-when>{whenLine(r)}</span>
                  {#if also}<span class="rounded-chip bg-amber-bg px-[7px] py-px font-medium text-amber" data-shared-mark>{also}</span>{/if}
                </span>
              </div>
              <button
                type="button"
                aria-label="Remove {r.word} from {r.food}"
                class="min-h-11 min-w-11 shrink-0 cursor-pointer rounded-lg border border-line bg-panel px-3.5 font-medium text-text disabled:opacity-60 desktop:min-h-9"
                disabled={!!page.busy[WordsPage.busyId(r)]}
                onclick={() => page.remove(r)}
                data-remove>Remove</button
              >
            </li>
          {/each}
        </ul>
      </section>
    {:else}
      <p class="m-0 rounded-card border border-line bg-panel p-3.5 text-muted" data-empty>{emptyLine(page.view)}</p>
    {/each}
  </main>
{/if}

<GymDock answers={page} />

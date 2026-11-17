<script lang="ts">
  import MoreHeader from '#lib/components/more/MoreHeader.svelte';
  import SearchBox from '#lib/components/more/SearchBox.svelte';
  import ProblemCard from '#lib/components/ProblemCard.svelte';
  import { ateHref, choreHref, countText, foodHref, GROUP_KEYS, searchable, testHref, thoughtsHref, workoutHref, type Search } from '#lib/search.js';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();

  // More's Search (deploy 108): app.'s Search without the thoughts. The field keeps the words; under it the door's five groups in its
  // order, each with its count ("15+" when cut) or a quiet "none"; every row opens its place in this app. Under two letters the page
  // says the door's hint. Thoughts are words: one quiet line sends them to the full app.
  const s = $derived<Search | null>(data.search);
  const q = $derived(data.q);
  const row = 'flex min-h-11 flex-col justify-center gap-px border-t border-line px-3 py-2 text-text no-underline hover:bg-panel2';
</script>

<svelte:head><title>Search · Logger</title></svelte:head>

<MoreHeader title="Search" />
<div class="desktop:max-w-[760px]"><SearchBox {q} /></div>

{#if !s}
  <ProblemCard kind={data.problem ?? 'trouble'} appHref="{data.appUrl}/web/search" />
{:else}
  <main class="flex min-w-0 flex-col gap-3 desktop:max-w-[760px]" data-search-results>
    {#if !s.searched || !searchable(q)}
      <p class="m-0 rounded-card border border-line bg-panel p-3 text-muted" data-hint>{s.hint}</p>
    {:else}
      <p class="m-0 text-[13px] text-muted" data-results-for>Results for “{q}”</p>
      {#each GROUP_KEYS as key (key)}
        {@const g = s[key]}
        {#if !g.rows.length}
          <div class="flex items-center justify-between gap-2 rounded-card border border-line bg-panel px-3 py-2.5 text-[13px] text-muted" data-group={key} data-none>
            <span>{g.title}</span>{' '}<span>none</span>
          </div>
        {:else}
          <section aria-labelledby="g-{key}" class="overflow-hidden rounded-card border border-line bg-panel" data-group={key}>
            <div class="flex items-center justify-between gap-2 px-3 pt-2.5 pb-1.5">
              <h2 id="g-{key}" class="m-0 text-[15px] font-semibold">{g.title}</h2>
              <span class="num rounded-full bg-chip px-2 text-xs text-chip-text" data-count>{countText(g)}</span>
            </div>
            {#if key === 'foods'}
              {#each s.foods.rows as r (r.food_id)}
                <a href={foodHref(q, r)} class="{row} !flex-row !items-center !justify-start !gap-2" data-row>
                  <span class="num text-[13px] text-muted">{r.id}</span>{' '}<span class="min-w-0 font-medium break-words">{r.name}</span>
                </a>
              {/each}
            {:else if key === 'ate'}
              {#each s.ate.rows as r (r.id)}
                <a href={ateHref(r)} class={row} data-row>
                  <span class="flex flex-wrap items-baseline gap-x-1.5"
                    ><span class="num text-[13px] text-muted">{r.day_text}</span>{' '}<span class="font-medium break-words">{r.food}</span>{' '}<span class="num text-[13px] text-muted">{r.amount_text}</span></span
                  >
                  {#if r.note}<span class="text-[13px] break-words text-muted">{r.note}</span>{/if}
                </a>
              {/each}
            {:else if key === 'workouts'}
              {#each s.workouts.rows as r (r.workout_id)}
                <a href={workoutHref(r)} class={row} data-row>
                  <span class="flex flex-wrap items-baseline gap-x-1.5"><span class="num text-[13px] text-muted">{r.day_text}</span>{' '}<span class="font-medium break-words">{r.split}</span></span>
                  <span class="text-[13px] break-words text-muted">{r.text}</span>
                </a>
              {/each}
            {:else if key === 'chores'}
              {#each s.chores.rows as r, i (`${r.chore_id}-${r.day}-${i}`)}
                <a href={choreHref(r)} class={row} data-row>
                  <span class="flex flex-wrap items-center gap-x-1.5 font-medium break-words"
                    >{r.label}{#if r.start}{' '}<span class="rounded-full bg-chip px-2 text-xs font-normal text-chip-text">starting point</span>{/if}</span
                  >
                  <span class="num text-[13px] text-muted">{r.day_text}</span>
                </a>
              {/each}
            {:else}
              {#each s.tests.rows as r (r.test_id)}
                <a href={testHref(r)} class={row} data-row><span class="font-medium break-words">{r.name}</span></a>
              {/each}
            {/if}
            {#if g.more}<p class="m-0 border-t border-line px-3 py-2 text-xs text-muted" data-more>The first {g.rows.length} are shown. Add a letter or two to narrow it down.</p>{/if}
          </section>
        {/if}
      {/each}
    {/if}
    {#if searchable(q)}
      <a href={thoughtsHref(data.appUrl, q)} class="flex min-h-11 items-center gap-1 text-[13px] text-muted" data-thoughts>Thoughts with “{q}” are searched in the full app ›</a>
    {/if}
  </main>
{/if}

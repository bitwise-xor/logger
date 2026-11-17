<script lang="ts">
  import AppTag from '#lib/components/more/AppTag.svelte';
  import SearchBox from '#lib/components/more/SearchBox.svelte';
  import ThemeButton from '#lib/components/ThemeButton.svelte';
  import { Button } from '#lib/components/ui/button/index.js';
  import { MORE_PLACES, morePlaceHref, SPACES, WORDS } from '#lib/places.js';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();

  // More (deploy 96, the Spaces menu; its own places since deploy 108): the search field, the Spaces (all live), a card with Coach,
  // Recent, Usage and Settings (all pages here since deploy 111: src/lib/places.ts MORE_PLACES), the
  // Words (ideas, private entries and gratitude stay in the full app until the journal app exists) and Sign out. Phones: one column
  // in that order; from 1100 px the rows, the Words and Sign out on the left, the Spaces on the right.
  const row = 'flex min-h-14 items-center gap-2.5 px-3 text-text no-underline hover:bg-panel2';
</script>

<svelte:head><title>More · Logger</title></svelte:head>

{#snippet chevron()}
  <svg aria-hidden="true" class="shrink-0 text-muted" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"
    ><path d="M6 4l4 4-4 4"></path></svg
  >
{/snippet}

<header class="flex items-center gap-2">
  <h1 class="m-0 flex-1 text-[26px] leading-[1.1] font-semibold tracking-tight desktop:text-[30px]">More</h1>
  <ThemeButton />
</header>

<main class="flex flex-col gap-3 desktop:grid desktop:max-w-[1100px] desktop:grid-cols-2 desktop:items-start desktop:gap-x-4 desktop:gap-y-4">
  <div class="desktop:col-span-2"><SearchBox /></div>

  <!-- the PC's right column: the Spaces (phones: first under the search) -->
  <div class="order-1 desktop:order-2 desktop:flex desktop:min-w-0 desktop:flex-col desktop:gap-4">
    <section aria-labelledby="spaces-h" class="overflow-hidden rounded-card border border-line bg-panel" data-spaces>
      <h2 id="spaces-h" class="m-0 px-3 pt-3 pb-1 text-xs font-medium tracking-wider text-muted uppercase">Spaces</h2>
      {#each SPACES as s, i (s.key)}
        {#if s.href}
          <a href={s.href} class="{row} {i ? 'border-t border-line' : ''}" data-space={s.key}>
            <span class="flex min-w-0 flex-1 flex-col">
              <span class="font-medium">{s.name}</span>
              <span class="text-[13px] text-muted">{s.sub}</span>
            </span>
            {@render chevron()}
          </a>
        {:else}
          <div aria-disabled="true" class="flex min-h-14 items-center gap-2.5 px-3 text-muted opacity-55 {i ? 'border-t border-line' : ''}" data-space={s.key} data-soon>
            <span class="flex-1">{s.name}</span>
            <span class="text-[13px]">soon</span>
          </div>
        {/if}
      {/each}
    </section>
  </div>

  <!-- the PC's left column: the rows, the Words, Sign out -->
  <div class="contents desktop:order-1 desktop:flex desktop:min-w-0 desktop:flex-col desktop:gap-4">
    <section aria-label="More places" class="order-2 overflow-hidden rounded-card border border-line bg-panel desktop:order-none" data-places-card>
      {#each MORE_PLACES as p, i (p.key)}
        <a
          href={morePlaceHref(p, data.appUrl)}
          class="{row} {i ? 'border-t border-line' : ''}"
          data-more-place={p.key}
          data-where={p.here ? 'here' : 'app'}
        >
          <span class="flex min-w-0 flex-1 flex-col">
            <span class="flex items-center gap-2 font-medium">{p.name}{#if !p.here}{' '}<AppTag />{/if}</span>
            <span class="text-[13px] text-muted">{p.sub}</span>
          </span>
          {@render chevron()}
        </a>
      {/each}
    </section>

    <section aria-labelledby="words-h" class="order-3 flex flex-col gap-2 rounded-card border border-dashed border-line p-3 desktop:order-none" data-words>
      <h2 id="words-h" class="m-0 text-xs font-medium tracking-wider text-muted uppercase">Words</h2>
      <p class="m-0 text-[13px] text-muted">Ideas, Private and Gratitude are in the full app until the journal app exists.</p>
      <div class="flex flex-wrap gap-x-4">
        {#each WORDS as w (w.key)}
          <a href="{data.appUrl}{w.app}" class="inline-flex min-h-11 items-center gap-1.5 font-medium" data-word={w.key}>{w.name} › <AppTag /></a>
        {/each}
      </div>
    </section>

    <form method="POST" action="/signout" class="order-4 m-0 desktop:order-none">
      <Button type="submit" variant="outline">Sign out</Button>
    </form>
  </div>
</main>

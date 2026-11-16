<script lang="ts">
  import ThemeButton from '#lib/components/ThemeButton.svelte';
  import { SPACES } from '#lib/places.js';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();

  // More (deploy 96, the Spaces menu): the Spaces as a list (Gym, Health, Habits; Home and Medical greyed until they move here),
  // then one line that the rest is in the full app. On the PC the rail has the Spaces too.
</script>

<svelte:head><title>More · Logger</title></svelte:head>

<header class="flex items-center gap-2">
  <h1 class="m-0 flex-1 text-[26px] leading-[1.1] font-semibold tracking-tight desktop:text-[30px]">More</h1>
  <ThemeButton />
</header>

<main class="flex flex-col gap-3 desktop:max-w-[560px]">
  <section aria-labelledby="spaces-h" class="flex flex-col gap-1.5">
    <h2 id="spaces-h" class="m-0 text-xs font-medium tracking-wider text-muted uppercase">Spaces</h2>
    <div class="overflow-hidden rounded-card border border-line bg-panel" data-spaces>
      {#each SPACES as s, i (s.key)}
        {#if s.href}
          <a
            href={s.href}
            class="flex min-h-14 items-center gap-2.5 px-3 text-text no-underline hover:bg-panel2 {i ? 'border-t border-line' : ''}"
            data-space={s.key}
          >
            <span class="flex min-w-0 flex-1 flex-col">
              <span class="font-medium">{s.name}</span>
              <span class="text-[13px] text-muted">{s.sub}</span>
            </span>
            <svg aria-hidden="true" class="shrink-0 text-muted" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"
              ><path d="M6 4l4 4-4 4"></path></svg
            >
          </a>
        {:else}
          <div aria-disabled="true" class="flex min-h-14 items-center gap-2.5 px-3 text-muted opacity-55 {i ? 'border-t border-line' : ''}" data-space={s.key} data-soon>
            <span class="flex-1">{s.name}</span>
            <span class="text-[13px]">soon</span>
          </div>
        {/if}
      {/each}
    </div>
  </section>
  <p class="m-0 rounded-card border border-dashed border-line p-3 text-muted" data-rest>
    The rest is in the <a href="{data.appUrl}/web/">full app</a>.
  </p>
</main>

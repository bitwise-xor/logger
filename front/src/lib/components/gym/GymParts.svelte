<script lang="ts">
  import { PARTS } from '#lib/gym.js';

  // The Gym's parts (the mockup's row under the title): Workout is this page; until deploy 97 the other five open app.'s tabs, "in
  // the full app" as the other links there. The row scrolls sideways inside itself when it does not fit; the page never does.
  let { appUrl, on = 'workout' }: { appUrl: string; on?: string } = $props();
</script>

<nav aria-label="Gym" class="relative -mx-3.5 overflow-x-auto px-3.5 desktop:mx-0 desktop:px-0" data-parts>
  <div class="flex w-max min-w-full gap-0.5 border-b border-line">
    {#each PARTS as p (p.key)}
      {#if p.key === on}
        <a
          href={p.href ?? '/gym'}
          aria-current="page"
          class="inline-flex min-h-11 items-center border-b-2 border-text px-3 text-sm font-medium whitespace-nowrap text-text no-underline desktop:min-h-10"
          data-part={p.key}>{p.label}</a
        >
      {:else}
        <a
          href="{appUrl}{p.app}"
          title="In the full app"
          class="inline-flex min-h-11 items-center gap-1 border-b-2 border-transparent px-3 text-sm font-medium whitespace-nowrap text-muted no-underline hover:text-text desktop:min-h-10"
          data-part={p.key}
          >{p.label}<span class="sr-only">, in the full app</span><span aria-hidden="true" class="text-xs">↗</span></a
        >
      {/if}
    {/each}
  </div>
</nav>

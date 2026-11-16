<script lang="ts">
  import { PARTS } from '#lib/gym.js';

  // The Gym's parts (the mockup's row under the title), each a page of this app (deploy 97); `on` is the one you are in. The row
  // scrolls sideways inside itself when it does not fit; the page never does.
  let { on = 'workout' }: { on?: string } = $props();
</script>

<nav aria-label="Gym" class="relative -mx-3.5 overflow-x-auto px-3.5 desktop:mx-0 desktop:px-0" data-parts>
  <div class="flex w-max min-w-full gap-0.5 border-b border-line">
    {#each PARTS as p (p.key)}
      <a
        href={p.href}
        aria-current={p.key === on ? 'page' : undefined}
        class="inline-flex min-h-11 items-center border-b-2 px-3 text-sm font-medium whitespace-nowrap no-underline desktop:min-h-10 {p.key === on
          ? 'border-text text-text'
          : 'border-transparent text-muted hover:text-text'}"
        data-part={p.key}>{p.label}</a
      >
    {/each}
  </div>
</nav>

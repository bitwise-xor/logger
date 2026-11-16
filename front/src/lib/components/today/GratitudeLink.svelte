<script lang="ts">
  import type { Day } from '#lib/day.js';

  let { day, href }: { day: Day; href: string } = $props();
</script>

<!-- A count only, never words; the list itself is app.'s /web/gratitude, with its own sign-in (the plan, question 4). -->
{#if !day.past}
  <a
    {href}
    class="flex min-h-[52px] items-center gap-2.5 rounded-card border border-line bg-panel px-3 text-text no-underline hover:text-text desktop:min-h-12 desktop:px-3.5"
    data-card="gratitude"
  >
    <span class="flex-1 font-medium">Gratitude</span>
    <span class="num text-muted">{day.gratitude.count}/{day.gratitude.goal}</span>
    <span class="font-medium text-blue">Write</span>
  </a>
{/if}

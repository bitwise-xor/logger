<script lang="ts">
  import type { Done } from '#lib/home.js';

  // "Recently done" (app.'s last card on Now): the last five, each with app.'s date and time (only the date for a job done earlier).
  let { recent }: { recent: Done[] } = $props();
</script>

{#if recent.length}
  <section aria-labelledby="recent-h" class="flex flex-col gap-1 rounded-card border border-line bg-panel p-3 desktop:p-3.5" data-card="recent">
    <h2 id="recent-h" class="m-0 pb-1 text-[15px] font-semibold">Recently done</h2>
    <ul class="m-0 flex list-none flex-col p-0">
      {#each recent as e (e.ids.join(','))}
        <li class="flex items-baseline justify-between gap-3 border-t border-line py-2 first:border-t-0" data-recent>
          <span class="min-w-0 break-words">{e.label}</span>
          <span class="num shrink-0 text-[13px] text-muted">{e.when}</span>
        </li>
      {/each}
    </ul>
  </section>
{/if}

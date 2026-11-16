<script lang="ts">
  import type { Week } from '#lib/week.js';

  // "Health and habits" (app.'s card): a row per thing logged in the period, in the door's order: its label, the value and the
  // door's detail small; the door's words when nothing was logged.
  let { week }: { week: Week } = $props();
</script>

<section aria-labelledby="health-h" class="flex flex-col gap-1 rounded-card border border-line bg-panel p-3 desktop:p-3.5" data-card="health">
  <h2 id="health-h" class="m-0 pb-1 text-[15px] font-semibold">Health and habits</h2>
  {#if week.health.length}
    <div class="flex flex-col">
      {#each week.health as h, i (`${h.key}:${i}`)}
        <div
          class="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] items-baseline gap-x-3 border-t border-line py-2 first:border-t-0 desktop:grid-cols-[minmax(0,1fr)_minmax(0,1.8fr)]"
          data-hrow={h.key}
        >
          <span class="min-w-0 break-words" data-hlabel>{h.label}</span>
          <span class="min-w-0 break-words">
            <strong class="num font-semibold" data-hvalue>{h.value}</strong>{#if h.detail}{' '}<span class="text-[13px] text-muted" data-hdetail>{h.detail}</span>{/if}
          </span>
        </div>
      {/each}
    </div>
  {:else}
    <p class="m-0 text-muted" data-health-none>{week.health_none}</p>
  {/if}
</section>

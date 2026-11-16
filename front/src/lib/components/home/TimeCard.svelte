<script lang="ts">
  import { chipsOf, pickHref, type Now } from '#lib/home.js';

  // "How much time have you got?" (app.'s _time_card): the door's time chips, each a link to Now with that time (the chosen one
  // highlighted), and "Pick a job for me" (the Pick page for it).
  let { now }: { now: Now } = $props();
</script>

<section aria-labelledby="time-h" class="flex flex-col gap-2.5 rounded-card border border-line bg-panel p-3 desktop:p-3.5" data-card="time">
  <h2 id="time-h" class="m-0 text-[15px] font-semibold">How much time have you got?</h2>
  <p class="m-0 text-[13px] text-muted">One job, picked for you. Stop when the timer ends, finished or not.</p>
  <div class="grid grid-cols-4 gap-1.5" role="group" aria-label="Time" data-chips>
    {#each chipsOf(now) as c (c.minutes)}
      <a
        href={c.href}
        aria-current={c.on ? 'true' : undefined}
        class="flex min-h-11 items-center justify-center rounded-full border px-2 text-sm font-medium whitespace-nowrap no-underline desktop:min-h-9 {c.on
          ? 'border-blue bg-blue-bg text-blue'
          : 'border-line bg-panel text-text hover:bg-panel2'}"
        data-chip={c.minutes}>{c.label}</a
      >
    {/each}
  </div>
  <a href={pickHref(now.minutes)} class="flex min-h-11 items-center justify-center rounded-lg bg-text font-medium text-bg no-underline desktop:min-h-9" data-pick
    >Pick a job for me</a
  >
</section>

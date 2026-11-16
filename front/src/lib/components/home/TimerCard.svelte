<script lang="ts">
  import { leftText } from '#lib/home.js';
  import { getNowPage } from '#lib/homepage.svelte.js';

  // The Timer card on Now (app.'s _timer_banner): the job's title, "12:41 left" counting each second while it runs ("(paused)" when
  // paused, "time is up" at the end) and "Open the timer" (the Pick page, which shows the open timer's job).
  const page = getNowPage();
  const t = $derived(page.now?.timer ?? null);
</script>

{#if t}
  <section aria-labelledby="timer-h" class="flex flex-col gap-2 rounded-card border border-line bg-panel p-3 desktop:p-3.5" data-card="timer">
    <div class="flex items-baseline justify-between gap-2">
      <h2 id="timer-h" class="m-0 text-[15px] font-semibold">Timer</h2>
      <span class="num text-[13px] {t.state === 'running' && page.left > 0 ? 'text-blue' : 'text-muted'}" data-left>{leftText(t.state, page.left)}</span>
    </div>
    <p class="m-0 font-medium" data-timer-title>{t.title}</p>
    <a href="/home/pick" class="flex min-h-11 items-center justify-center rounded-lg bg-text font-medium text-bg no-underline desktop:min-h-9" data-open-timer
      >Open the timer</a
    >
  </section>
{/if}

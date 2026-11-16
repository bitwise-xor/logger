<script lang="ts">
  import type { Answers } from '#lib/answers.svelte.js';
  import AnswerBar from '#lib/components/today/AnswerBar.svelte';

  // The answer bar of a Gym part that saves: above the tab bar on phones (the page leaves room for it: the layout's --dock), at the
  // bottom right on the PC, as on the Habits page.
  let { answers }: { answers: Answers } = $props();
  let barHeight = $state(0);
  $effect(() => {
    document.documentElement.style.setProperty('--dock', `${barHeight}px`);
    return () => document.documentElement.style.removeProperty('--dock');
  });
</script>

<div
  bind:clientHeight={barHeight}
  class="pointer-events-none fixed inset-x-0 bottom-[calc(52px+env(safe-area-inset-bottom))] z-20 px-3.5 pb-2 desktop:static desktop:p-0"
>
  <AnswerBar {answers} />
</div>

<script lang="ts">
  import { flagLetter, type Flag } from '#lib/medical.js';

  // A flag as the door gives it: H, L or A in an amber pill (with its word for a screen reader), otherwise a dash.
  let { flag, word = null }: { flag: Flag | undefined; word?: string | null } = $props();
  const letter = $derived(flagLetter(flag));
</script>

{#if letter}
  <span class="inline-flex min-h-6 min-w-7 items-center justify-center rounded-chip bg-amber-bg px-1.5 text-xs font-semibold text-amber" title={word ?? undefined} data-flag={letter}
    >{letter}{#if word}<span class="sr-only"> ({word})</span>{/if}</span
  >
{:else}
  <span class="text-muted" aria-label="no flag" data-flag="none">–</span>
{/if}

<script lang="ts">
  import { theme } from '#lib/theme.svelte.js';
</script>

<button
  type="button"
  onclick={() => theme.toggle()}
  aria-label={theme.current === 'dark' ? 'Switch to light' : 'Switch to dark'}
  title={theme.current === 'dark' ? 'Switch to light' : 'Switch to dark'}
  class="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-line bg-panel p-0 text-text hover:bg-panel2"
>
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
    <circle cx="12" cy="12" r="8"></circle>
    <path d="M12 4a8 8 0 0 0 0 16z" fill="currentColor"></path>
  </svg>
</button>

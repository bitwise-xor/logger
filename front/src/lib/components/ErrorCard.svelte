<script lang="ts">
  import { page } from '$app/state';
  import { errorWords } from '#lib/errorpage.js';

  // Web 66: the error pages' card (routes/(app)/+error.svelte and routes/+error.svelte). Plain words by status (src/lib/errorpage.ts);
  // "Back to Today" and "Try again" (the same address, loaded again from the server; a link, so it works without the script too).
  const words = $derived(errorWords(page.status));
  const pill = 'inline-flex min-h-11 items-center rounded-full px-4 font-medium no-underline desktop:min-h-9';
</script>

<svelte:head><title>{words.title} · Logger</title></svelte:head>

<div role="alert" class="flex flex-col gap-3 rounded-card border border-line bg-panel p-3.5 desktop:max-w-[720px]" data-error={page.status}>
  <h1 class="m-0 text-lg font-semibold tracking-tight">{words.title}</h1>
  <p class="m-0 text-muted">{words.text}</p>
  <div class="flex flex-wrap gap-2">
    <a href="/" class="{pill} bg-text text-bg">Back to Today</a>
    <a href={page.url.pathname + page.url.search} data-sveltekit-reload class="{pill} border border-line bg-panel text-text">Try again</a>
  </div>
</div>

<script lang="ts">
  import { page } from '$app/state';
  import { linksToApp, problemText, type ProblemKind, type Where } from '#lib/problems.js';

  // Step F: the plain message when the door is off, the core is down, or a read failed (src/lib/problems.ts says which words).
  // A link to app. where app. can help (not when the core is down: app. is the same core); "Try again" reloads the page.
  let { kind, where = 'page', appHref }: { kind: ProblemKind; where?: Where; appHref: string } = $props();
  const pill = 'inline-flex min-h-11 items-center rounded-full px-4 font-medium no-underline desktop:min-h-9';
</script>

<div role="alert" class="flex flex-col gap-3 rounded-card border border-amber bg-amber-bg p-3.5 desktop:max-w-[720px]" data-problem={kind}>
  <p class="m-0">{problemText(kind, where)}</p>
  <div class="flex flex-wrap gap-2 empty:hidden">
    {#if where !== 'signin'}
      <a href={page.url.pathname + page.url.search} data-sveltekit-reload class="{pill} bg-text text-bg">Try again</a>
    {/if}
    {#if linksToApp(kind)}
      <a href={appHref} class="{pill} border border-line bg-panel text-text">Open the full app</a>
    {/if}
  </div>
</div>

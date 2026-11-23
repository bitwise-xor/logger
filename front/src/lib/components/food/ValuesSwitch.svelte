<script lang="ts">
  import { foodMode } from '#lib/foodmode.svelte.js';
  import { onMount } from 'svelte';

  // Web 73: "Macros / All values" on the Food day. Which button looks pressed is CSS (`macros:`, set before first paint by
  // static/theme.js), so the page shows the chosen mode from the start; aria-pressed follows the stored choice.
  let { wide = false }: { wide?: boolean } = $props();
  // the stored choice, once in the browser (the server draws All values; the CSS already shows the chosen one)
  onMount(() => foodMode.sync());
  const base = 'min-h-11 cursor-pointer px-3.5 font-medium desktop:min-h-9';
  const on = 'bg-text text-bg';
  const off = 'bg-panel text-text';
</script>

<div class="flex items-center gap-2 {wide ? 'w-full' : ''}">
  {#if !wide}<span class="text-[13px] text-muted">Show</span>{/if}
  <div role="group" aria-label="Which values to show" class="flex divide-x divide-line overflow-hidden rounded-lg border border-line {wide ? 'w-full' : ''}" data-values-switch>
    <button
      type="button"
      class="{base} {wide ? 'flex-1' : ''} {off} macros:bg-text macros:text-bg"
      aria-pressed={foodMode.current === 'macros'}
      onclick={() => foodMode.set('macros')}
      data-mode="macros">Macros</button
    >
    <button
      type="button"
      class="{base} {wide ? 'flex-1' : ''} {on} macros:bg-panel macros:text-text"
      aria-pressed={foodMode.current === 'all'}
      onclick={() => foodMode.set('all')}
      data-mode="all">All values</button
    >
  </div>
</div>

<script lang="ts">
  import type { Snippet } from 'svelte';

  // The switch of Settings' tabs (deploy 111): a button with role "switch". With words (children) it is a whole row, the words on the
  // left and the knob on the right; without, the knob alone in a 44 px target, named by `label`. Blue when on (the mockup).
  let {
    on,
    label,
    disabled = false,
    onclick,
    children,
    ...rest
  }: { on: boolean; label?: string; disabled?: boolean; onclick: () => void; children?: Snippet; [k: `data-${string}`]: unknown } = $props();
</script>

<button
  type="button"
  role="switch"
  aria-checked={on}
  aria-label={children ? undefined : label}
  {disabled}
  {onclick}
  class="flex min-h-11 cursor-pointer items-center border-0 bg-transparent p-0 text-left text-text disabled:cursor-default disabled:opacity-60 {children
    ? 'w-full justify-between gap-2.5 desktop:min-h-10'
    : 'w-11 shrink-0 justify-center'}"
  {...rest}
>
  {#if children}<span class="min-w-0">{@render children()}</span>{/if}
  <span aria-hidden="true" class="flex h-[22px] w-[38px] shrink-0 items-center rounded-full p-[3px] {on ? 'justify-end bg-blue' : 'justify-start bg-track'}">
    <span class="size-4 rounded-full {on ? 'bg-on-blue' : 'bg-panel'}"></span>
  </span>
</button>

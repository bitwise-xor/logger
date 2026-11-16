<script lang="ts">
  import { cn, type WithElementRef } from '#lib/utils.js';
  import type { HTMLInputAttributes, HTMLInputTypeAttribute } from 'svelte/elements';

  type InputType = Exclude<HTMLInputTypeAttribute, 'file'>;

  type Props = WithElementRef<Omit<HTMLInputAttributes, 'type' | 'files'> & { type?: InputType }>;

  let {
    ref = $bindable(null),
    value = $bindable(),
    type,
    class: className,
    'data-slot': dataSlot = 'input',
    ...restProps
  }: Props = $props();
</script>

<!-- 16 px text below the tablet width, so iOS does not zoom the page when the field is tapped. -->
<input
  bind:this={ref}
  data-slot={dataSlot}
  class={cn(
    'min-h-11 w-full min-w-0 rounded-lg border border-input bg-panel px-3.5 text-base text-foreground transition-colors placeholder:text-muted disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive tablet:text-sm',
    className,
  )}
  {type}
  bind:value
  {...restProps}
/>

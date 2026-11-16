<script lang="ts" module>
  import { type VariantProps, tv } from 'tailwind-variants';
  import { cn, type WithElementRef } from '#lib/utils.js';
  import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';

  // Deck buttons: 44 px tall, 8 px radius, 500 weight. Amber is never a button colour.
  export const buttonVariants = tv({
    base: 'inline-flex min-h-11 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-transparent text-sm font-medium whitespace-nowrap no-underline transition-colors select-none disabled:pointer-events-none disabled:opacity-50 aria-disabled:cursor-default aria-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0',
    variants: {
      variant: {
        // The strongest neutral, for the one main action of a form.
        default:
          'bg-primary text-primary-foreground hover:bg-primary/85 hover:text-primary-foreground',
        // Row actions inside a panel.
        secondary:
          'border-line bg-secondary text-secondary-foreground hover:bg-chip hover:text-secondary-foreground aria-disabled:hover:bg-secondary',
        outline:
          'border-line bg-transparent text-foreground hover:bg-secondary hover:text-foreground aria-disabled:hover:bg-transparent',
        ghost:
          'bg-transparent text-muted hover:bg-secondary hover:text-foreground aria-disabled:hover:bg-transparent aria-disabled:hover:text-muted',
        // Blue is "live": joining the next event, the pressed state of a mode.
        live: 'bg-blue text-on-blue hover:bg-blue/85 hover:text-on-blue',
        link: 'text-blue hover:text-foreground aria-disabled:hover:text-blue',
      },
      size: {
        default: 'px-3.5',
        sm: 'px-3',
        lg: 'px-4',
        icon: 'size-11 p-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  });

  export type ButtonVariant = VariantProps<typeof buttonVariants>['variant'];
  export type ButtonSize = VariantProps<typeof buttonVariants>['size'];

  export type ButtonProps = WithElementRef<HTMLButtonAttributes> &
    WithElementRef<HTMLAnchorAttributes> & {
      variant?: ButtonVariant;
      size?: ButtonSize;
    };
</script>

<script lang="ts">
  let {
    class: className,
    variant = 'default',
    size = 'default',
    ref = $bindable(null),
    href = undefined,
    type = 'button',
    disabled,
    children,
    ...restProps
  }: ButtonProps = $props();
</script>

{#if href}
  <!-- The caller passes an address that is already resolved, or one outside the app. -->
  <!-- eslint-disable svelte/no-navigation-without-resolve -->
  <a
    bind:this={ref}
    data-slot="button"
    class={cn(buttonVariants({ variant, size }), className)}
    href={disabled ? undefined : href}
    aria-disabled={disabled}
    role={disabled ? 'link' : undefined}
    tabindex={disabled ? -1 : undefined}
    {...restProps}
  >
    {@render children?.()}
  </a>
  <!-- eslint-enable svelte/no-navigation-without-resolve -->
{:else}
  <button
    bind:this={ref}
    data-slot="button"
    class={cn(buttonVariants({ variant, size }), className)}
    {type}
    {disabled}
    {...restProps}
  >
    {@render children?.()}
  </button>
{/if}

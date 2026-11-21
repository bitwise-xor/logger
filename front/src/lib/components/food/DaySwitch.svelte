<script lang="ts">
  import { goto } from '$app/navigation';
  import { dayOf } from '#lib/format.js';
  import { askedDay } from '#lib/food.js';

  // The Food space's day switch (21.11.2026, idea 63): ‹, the day, ›, and a calendar button to jump to any day. The calendar is the
  // browser's own date field laid over the button (opacity 0): a tap opens its picker (showPicker where the browser has it), a day
  // picked leads to `hrefFor(day)`. A day after today is never offered (max). `text` replaces the day's words (Nutrients' periods).
  let {
    day,
    today,
    past,
    before,
    after,
    hrefFor,
    text = null,
    beforeLabel = 'The day before',
    afterLabel = 'The day after',
  }: {
    day: string;
    today: string;
    past: boolean;
    before: string;
    after: string | null;
    hrefFor: (day: string) => string;
    text?: string | null;
    beforeLabel?: string;
    afterLabel?: string;
  } = $props();

  let picker: HTMLInputElement | undefined = $state();
  const square =
    'flex size-11 shrink-0 items-center justify-center rounded-lg border border-line bg-panel p-0 text-lg text-text no-underline desktop:size-9 desktop:text-base';

  function open() {
    try {
      picker?.showPicker?.();
    } catch {
      // a browser that will not open it from here: the field itself takes the tap
    }
  }

  function picked(e: Event) {
    const v = askedDay((e.currentTarget as HTMLInputElement).value);
    if (v && v !== day) void goto(hrefFor(v > today ? today : v));
  }
</script>

<nav aria-label="Day" class="flex w-full items-center gap-2 desktop:w-auto" data-day-switch>
  <a href={before} class={square} aria-label={beforeLabel} data-day-before>‹</a>
  <span class="flex-1 text-center font-medium whitespace-nowrap desktop:flex-none desktop:px-1" data-day
    >{#if text}{text}{:else}{dayOf(day).slice(0, 4)}<span class="num">{dayOf(day).slice(4)}</span>{past ? '' : ' · today'}{/if}</span
  >
  {#if after}
    <a href={after} class={square} aria-label={afterLabel} data-day-after>›</a>
  {:else}
    <span class="{square} cursor-default text-muted opacity-50" aria-disabled="true" aria-label={afterLabel}>›</span>
  {/if}
  <label class="{square} relative cursor-pointer" title="Go to a day" data-day-pick>
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
      ><rect x="3.5" y="5" width="17" height="15.5" rx="2"></rect><path d="M3.5 10h17M8 3v4M16 3v4"></path></svg
    >
    <input
      bind:this={picker}
      type="date"
      max={today}
      value={day}
      aria-label="Go to a day"
      class="absolute -inset-px cursor-pointer opacity-0"
      onclick={open}
      onchange={picked}
    />
  </label>
</nav>

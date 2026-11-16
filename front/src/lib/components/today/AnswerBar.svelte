<script lang="ts">
  import { getToday } from '#lib/today.svelte.js';

  const today = getToday();
  const bar = $derived(today.bar);
  const btn = 'min-h-10 shrink-0 cursor-pointer rounded-md px-3.5 font-medium whitespace-nowrap disabled:opacity-60';
</script>

<!-- A save's answer (the mockup's Undo bar): its head, drawn as a warning when the tone says so; a read-back to confirm; Undo for
     15 minutes. Above the tab bar on phones, at the bottom right on the PC. -->
<div
  role="status"
  aria-live="polite"
  class="pointer-events-none fixed inset-x-3.5 bottom-[calc(60px+env(safe-area-inset-bottom))] z-20 flex justify-center desktop:inset-x-auto desktop:right-6 desktop:bottom-6 desktop:w-[440px]"
>
  {#if bar}
    {#key bar.id}
      <div
        class="pointer-events-auto flex w-full flex-col gap-1 rounded-lg py-1 pr-1 pl-3 shadow-lg {bar.tone === 'warning'
          ? 'border border-amber bg-amber-bg text-text'
          : 'bg-text text-bg'}"
        data-bar={bar.tone}
      >
        <div class="flex min-h-10 items-center gap-2.5">
          <span class="min-w-0 flex-1 truncate font-medium {bar.tone === 'warning' ? 'text-amber' : ''}" data-bar-head>{bar.head}</span>
          {#if bar.undo}
            <button
              type="button"
              class="{btn} border border-muted bg-transparent text-bg"
              disabled={today.busy.undo}
              onclick={() => today.undo()}>Undo</button
            >
          {/if}
          <button
            type="button"
            aria-label="Close"
            class="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent {bar.tone === 'warning'
              ? 'text-muted'
              : 'text-bg/70'}"
            onclick={() => today.closeBar()}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"
              ><path d="M6 6l12 12M18 6L6 18"></path></svg
            >
          </button>
        </div>
        {#each bar.lines as line, i (i)}
          <p class="m-0 max-h-40 overflow-y-auto pr-2 pb-1 text-[13px] whitespace-pre-line">{line}</p>
        {/each}
        {#if bar.confirm}
          {#if bar.confirm.readBack}<p class="m-0 pr-2 text-[13px] whitespace-pre-line">{bar.confirm.readBack}</p>{/if}
          <div class="flex gap-2 pt-1 pb-2">
            <button
              type="button"
              class="{btn} border-0 bg-amber text-on-amber"
              disabled={today.busy[`confirm:${bar.confirm.action}`]}
              onclick={() => today.confirm()}>{bar.confirm.label}</button
            >
            <button type="button" class="{btn} border border-amber bg-transparent text-text" onclick={() => today.closeBar()}
              >{bar.confirm.noLabel}</button
            >
          </div>
        {/if}
      </div>
    {/key}
  {/if}
</div>

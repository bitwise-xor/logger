<script lang="ts">
  import type { Answers } from '#lib/answers.svelte.js';
  import { tickFields, type ChecklistHabit } from '#lib/habits.js';

  // Today's habits as buttons, two per row on every width (the owner, 16.11.2026), as Today's Habits card and, since deploy 94, the
  // Habits page: tap to tick, tap a done one to take its last tick off. `answers` is the page's saves (Today's or the Habits page's);
  // a button is blocked while its save is on the way; `disabled` for a past day.
  let { habits, answers, disabled = false }: { habits: ChecklistHabit[]; answers: Answers; disabled?: boolean } = $props();
</script>

<div class="grid grid-cols-2 gap-x-4" data-habit-grid>
  {#each habits as h (h.name)}
    {@const fields = tickFields(h)}
    <form method="POST" action="?/habit" class="m-0" onsubmit={answers.submit('habit', `habit:${h.name}`)}>
      <input type="hidden" name="name" value={fields.name} />
      <input type="hidden" name="action" value={fields.action} />
      {#if fields.ref}<input type="hidden" name="ref" value={fields.ref} />{/if}
      <button
        type="submit"
        aria-pressed={h.complete}
        disabled={disabled || answers.busy[`habit:${h.name}`]}
        data-habit={h.name}
        class="flex min-h-12 w-full cursor-pointer items-center gap-2.5 border-0 border-t border-line bg-transparent px-0 py-1 text-left text-text disabled:cursor-default {disabled
          ? ''
          : 'disabled:opacity-60'} desktop:min-h-11"
      >
        <span
          aria-hidden="true"
          class="flex size-[22px] shrink-0 items-center justify-center rounded-full border-[1.5px] desktop:size-5 {h.complete
            ? 'border-text bg-text text-bg'
            : 'border-muted bg-transparent text-transparent'}"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"
            ><path d="M5 12.5l4.5 4.5L19 7.5"></path></svg
          >
        </span>
        <span class="min-w-0 flex-1 break-words">{h.label}</span>
        {#if h.target > 1}<span class="num text-xs text-muted">{h.done}/{h.target}</span>{/if}
        {#if h.avoid}<span class="text-xs text-muted">avoid</span>{/if}
      </button>
    </form>
  {/each}
</div>

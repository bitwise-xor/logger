<script lang="ts">
  import AnswerBar from '#lib/components/today/AnswerBar.svelte';
  import { getToday } from '#lib/today.svelte.js';

  let { appUrl }: { appUrl: string } = $props();
  const today = getToday();

  let field = $state<HTMLTextAreaElement | null>(null);
  let form = $state<HTMLFormElement | null>(null);
  let height = $state(0);

  $effect(() => {
    today.bindBox(field);
    return () => today.bindBox(null);
  });

  // Two lines at rest (the mockup's PC box, rows 2); it grows with its lines (each can be its own entry), then it scrolls.
  $effect(() => {
    void today.box;
    if (!field) return;
    field.style.height = 'auto';
    field.style.height = `${Math.min(field.scrollHeight + 2, matchMedia('(min-width: 68.75rem)').matches ? 200 : 120)}px`;
  });

  // On phones the box sits above the tab bar: the page leaves room for it (the layout's --dock).
  $effect(() => {
    document.documentElement.style.setProperty('--dock', `${height}px`);
    return () => document.documentElement.style.removeProperty('--dock');
  });

  function submit(event: SubmitEvent) {
    event.preventDefault();
    const words = today.box;
    if (!words.trim()) return;
    today.box = '';
    void today.log(words);
  }

  // Enter sends, Shift+Enter starts a new line.
  function keydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      form?.requestSubmit();
    }
  }
</script>

<!-- The logging box (step D, deploy 81): text only (the plan: no "Reads as", Voice, Barcode or Label here). Phones: above the tab
     bar, with the lines being read and the answer bar above it. The PC: at the top of the page, the lines being read under it;
     the answer bar sits at the bottom right. -->
<div
  bind:clientHeight={height}
  class="pointer-events-none fixed inset-x-0 bottom-[calc(52px+env(safe-area-inset-bottom))] z-20 flex flex-col desktop:pointer-events-auto desktop:static desktop:z-auto"
  data-logbox
>
  <div class="flex flex-col gap-2 px-3.5 pb-2 empty:hidden desktop:order-2 desktop:px-0 desktop:pt-2 desktop:pb-0">
    {#each today.reading as r (r.id)}
      <div
        class="pointer-events-auto grid min-h-11 grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-lg border border-blue bg-panel px-3 py-2 desktop:grid-cols-[48px_minmax(0,1fr)_auto] desktop:gap-3"
        data-reading
      >
        <span class="num text-xs text-muted">{r.at}</span>
        <span class="line-clamp-2 min-w-0 break-words">{r.text}</span>
        <span class="flex items-center gap-1.5 text-[13px] whitespace-nowrap text-blue">
          <span class="size-1.5 animate-pulse rounded-full bg-blue" aria-hidden="true"></span>being read
        </span>
      </div>
    {/each}
    <AnswerBar />
  </div>
  <form
    bind:this={form}
    method="POST"
    action="?/log"
    class="pointer-events-auto m-0 flex flex-col gap-1 border-t border-line bg-bg px-3.5 pt-2 pb-1.5 desktop:order-1 desktop:border-0 desktop:bg-transparent desktop:p-0"
    onsubmit={submit}
  >
    <div class="flex items-end gap-2">
      <label for="log-text" class="sr-only">What to log</label>
      <textarea
        bind:this={field}
        bind:value={today.box}
        id="log-text"
        name="text"
        rows="2"
        maxlength="4000"
        placeholder="What to log"
        autocomplete="off"
        enterkeyhint="send"
        onkeydown={keydown}
        class="min-h-[68px] min-w-0 flex-1 resize-none rounded-lg border border-line bg-panel px-3 py-[9px] text-base leading-6 text-text placeholder:text-muted focus-visible:border-blue focus-visible:outline-none tablet:text-sm"
      ></textarea>
      <button
        type="submit"
        class="h-11 shrink-0 cursor-pointer rounded-lg border-0 bg-text px-[18px] font-medium text-bg">Log</button
      >
    </div>
    <p class="m-0 text-xs text-muted">
      <span class="hidden desktop:inline">Enter logs, Shift and Enter starts a new line. Each line can be its own entry. </span>
      <a href="{appUrl}/web/" class="text-muted underline-offset-2 hover:underline">Barcode and label: full app</a>
    </p>
  </form>
</div>

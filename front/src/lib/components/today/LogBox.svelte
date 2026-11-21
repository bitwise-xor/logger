<script lang="ts">
  import AnswerBar from '#lib/components/today/AnswerBar.svelte';
  import ScanSheet from '#lib/components/today/ScanSheet.svelte';
  import { tabStorage, takeWords } from '#lib/recent.js';
  import { lastAmount, moved, picked, suggest, typedPart, type SuggestFood, type Suggestion } from '#lib/suggest.js';
  import { getToday } from '#lib/today.svelte.js';
  import { afterNavigate } from '$app/navigation';
  import { onMount, tick } from 'svelte';

  const today = getToday();
  let sheet = $state<ScanSheet | null>(null);

  // Voice (deploy 90, as app.'s microphone): only where the browser can turn speech into text; the words land in the box, to
  // check and send as usual. The browser asks for the microphone itself (compose: the page allows it for this origin only).
  type Recognition = {
    lang: string;
    interimResults: boolean;
    continuous: boolean;
    onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
    onerror: ((e: { error: string }) => void) | null;
    onend: (() => void) | null;
    start(): void;
    stop(): void;
  };
  let Speech = $state<(new () => Recognition) | null>(null);
  let listening = $state<Recognition | null>(null);
  let micNote = $state('');
  onMount(() => {
    const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
    Speech = w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
  });

  function speak() {
    if (listening) return listening.stop();
    if (!Speech) return;
    const rec = new Speech();
    rec.lang = navigator.language || 'en-US';
    rec.interimResults = true;
    rec.continuous = false;
    const before = today.box ? today.box.replace(/\s*$/, ' ') : '';
    micNote = '';
    closeList();
    rec.onresult = (e) => {
      today.box = before + Array.from(e.results, (r) => r[0]?.transcript ?? '').join('');
    };
    rec.onerror = (e) => {
      micNote = e.error === 'not-allowed' || e.error === 'service-not-allowed' ? 'The microphone is not allowed for this app.' : 'No speech heard.';
    };
    rec.onend = () => {
      listening = null;
      field?.focus();
    };
    listening = rec;
    try {
      rec.start();
    } catch {
      listening = null;
    }
  }

  let field = $state<HTMLTextAreaElement | null>(null);
  let form = $state<HTMLFormElement | null>(null);
  let height = $state(0);

  $effect(() => {
    today.bindBox(field);
    return () => today.bindBox(null);
  });

  // "Use again" on Recent (deploy 108) leaves a message's words in the tab's storage and comes here: they go into the box once, and the
  // storage is cleared (the box keeps what is already typed: this is a new page, so it is empty).
  onMount(() => {
    const words = takeWords(tabStorage());
    if (words && !today.box.trim()) today.refill(words);
  });

  // "+ Add food" on the Food day leads here (/#log-text): the box gets the cursor.
  afterNavigate(() => {
    if (location.hash === '#log-text') field?.focus();
  });

  // One line at rest (the owner, 16.11.2026; two since deploy 82); it grows with its lines (each can be its own entry), then it scrolls.
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
    closeList();
    const words = today.box;
    if (!words.trim()) return;
    today.box = '';
    void today.log(words);
  }

  // Food suggestions (deploy 117, app.'s rules: src/lib/suggest.ts): the foods are asked for once, on the box's first focus; a food that
  // cannot be read means no suggestions and nothing said. Only typing asks for them (the input event), never the microphone's words.
  let foods: SuggestFood[] | null = null;
  let asked = false;
  let shown = $state<Suggestion[]>([]);
  let sel = $state(-1);
  // Phones: the list opens above the box and the lines being read (the box sits at the bottom); the PC: under the words.
  let wide = $state(false);
  onMount(() => {
    const mq = matchMedia('(min-width: 68.75rem)');
    const set = () => (wide = mq.matches);
    set();
    mq.addEventListener('change', set);
    return () => mq.removeEventListener('change', set);
  });

  function loadFoods() {
    if (asked) return;
    asked = true;
    fetch('/foods/suggest', { headers: { accept: 'application/json' }, cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { foods?: unknown } | null) => (foods = Array.isArray(j?.foods) ? (j.foods as SuggestFood[]) : []))
      .catch(() => (foods = []));
  }

  function closeList() {
    shown = [];
    sel = -1;
  }

  function typed() {
    if (!field || !foods) return closeList();
    shown = suggest(foods, typedPart(field.value, field.selectionStart ?? field.value.length).q);
    sel = -1;
  }

  /** A suggestion picked: the part typed becomes its name and the amount eaten last, the cursor after it, the box keeps the focus. */
  async function pick(s: Suggestion) {
    const el = field;
    if (!el) return;
    const next = picked(el.value, el.selectionStart ?? el.value.length, s.food);
    closeList();
    today.box = next.value;
    await tick();
    el.focus();
    el.setSelectionRange(next.caret, next.caret);
  }

  // Enter sends, Shift+Enter starts a new line. With suggestions shown: the arrows mark one, Enter or Tab picks the marked one
  // (Enter with none marked sends the line), Escape closes them.
  function keydown(event: KeyboardEvent) {
    if (shown.length && !event.isComposing) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        sel = moved(sel, shown.length, event.key === 'ArrowDown');
        return;
      }
      if ((event.key === 'Enter' || event.key === 'Tab') && sel >= 0) {
        event.preventDefault();
        void pick(shown[sel]!);
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        closeList();
        return;
      }
    }
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      form?.requestSubmit();
    }
  }
</script>

{#snippet list()}
  {#if shown.length}
    <!-- The suggestions (deploy 117): a tap or click picks one without the box losing the focus. -->
    <ul
      id="log-suggest"
      role="listbox"
      aria-label="Foods"
      class="pointer-events-auto absolute z-30 m-0 flex max-h-[45dvh] list-none flex-col overflow-y-auto rounded-lg border border-line bg-panel p-1 shadow-lg {wide
        ? 'inset-x-0 top-full mt-1'
        : 'inset-x-3.5 bottom-full mb-1.5'}"
      data-suggest
    >
      {#each shown as s, i (s.food.food_id)}
        <!-- svelte-ignore a11y_click_events_have_key_events (the keys are the box's: arrows, Enter, Tab, Escape) -->
        <li
          id="log-suggest-{i}"
          role="option"
          tabindex="-1"
          aria-selected={i === sel}
          class="flex min-h-11 cursor-pointer items-center gap-2 rounded-md px-2.5 {i === sel ? 'bg-blue-bg' : 'hover:bg-panel2'} desktop:min-h-9"
          onmousedown={(e) => {
            // as app.: picked on the press itself, before the box could lose the focus (a phone's tap too)
            e.preventDefault();
            void pick(s);
          }}
          data-suggestion={s.food.food_id}
        >
          <span class="min-w-0 flex-1 truncate"
            ><b class="font-medium">{s.food.name}</b>{#if s.word}<span class="text-muted"> · {s.word}</span>{/if}</span
          >
          <span class="num shrink-0 text-xs text-muted">{lastAmount(s.food).trim()}</span>
        </li>
      {/each}
    </ul>
  {/if}
{/snippet}

<!-- The logging box (step D, deploy 81); since deploy 90 with Scan (barcode, label photo: ScanSheet.svelte) and, where the browser
     can, the microphone. Phones: above the tab
     bar, with the lines being read and the answer bar above it. The PC: at the top of the page, the lines being read under it;
     the answer bar sits at the bottom right. -->
<div
  bind:clientHeight={height}
  class="pointer-events-none fixed inset-x-0 bottom-[var(--places-bar)] z-20 flex flex-col desktop:pointer-events-auto desktop:static desktop:z-auto"
  data-logbox
>
  {#if !wide}{@render list()}{/if}
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
    <AnswerBar answers={today} />
  </div>
  <form
    bind:this={form}
    method="POST"
    action="?/log"
    data-survives-reload
    class="pointer-events-auto m-0 flex flex-col gap-1 border-t border-line bg-bg px-3.5 pt-2 pb-1.5 desktop:order-1 desktop:border-0 desktop:bg-transparent desktop:p-0"
    onsubmit={submit}
  >
    <div class="flex items-end gap-2">
      <label for="log-text" class="sr-only">What to log</label>
      <div class="relative flex min-w-0 flex-1">
      <textarea
        bind:this={field}
        bind:value={today.box}
        id="log-text"
        name="text"
        rows="1"
        maxlength="4000"
        placeholder="What to log"
        autocomplete="off"
        enterkeyhint="send"
        role="combobox"
        aria-autocomplete="list"
        aria-controls="log-suggest"
        aria-expanded={shown.length > 0}
        aria-activedescendant={sel >= 0 ? `log-suggest-${sel}` : undefined}
        onkeydown={keydown}
        onfocus={loadFoods}
        oninput={typed}
        onblur={closeList}
        class="min-h-11 w-full min-w-0 flex-1 resize-none rounded-lg border border-line bg-panel px-3 py-[9px] text-base leading-6 text-text placeholder:text-muted focus-visible:border-blue focus-visible:outline-none tablet:text-sm"
      ></textarea>
      {#if wide}{@render list()}{/if}
      </div>
      {#if Speech}
        <button
          type="button"
          aria-label={listening ? 'Stop listening' : 'Speak'}
          aria-pressed={!!listening}
          title={micNote || (listening ? 'Listening… tap to stop' : 'Speak: the words go into the box')}
          class="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg border p-0 {listening
            ? 'border-blue bg-blue-bg text-blue'
            : 'border-line bg-panel text-text'}"
          onclick={speak}
          data-mic
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
            ><rect x="9" y="3" width="6" height="11" rx="3"></rect><path d="M5 11a7 7 0 0 0 14 0M12 18v3"></path></svg
          >
        </button>
      {/if}
      <button
        type="button"
        aria-label="Scan"
        title="Scan a barcode or a label"
        class="flex h-11 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-line bg-panel px-2.5 text-text desktop:px-3"
        onclick={() => sheet?.open()}
        data-scan-open
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"
          ><path d="M4 7V5h3M17 5h3v2M20 17v2h-3M7 19H4v-2M8 9v6M11 9v6M14 9v6M17 9v6"></path></svg
        >
        <span class="hidden font-medium tablet:inline">Scan</span>
      </button>
      <button
        type="submit"
        class="h-11 shrink-0 cursor-pointer rounded-lg border-0 bg-text px-[18px] font-medium text-bg">Log</button
      >
    </div>
    {#if micNote}<p class="m-0 text-xs text-amber" data-mic-note>{micNote}</p>{/if}
    <p class="m-0 hidden text-xs text-muted desktop:block">Enter logs, Shift and Enter starts a new line. Each line can be its own entry.</p>
  </form>
</div>
<ScanSheet bind:this={sheet} />

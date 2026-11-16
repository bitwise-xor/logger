<script lang="ts">
  import { cameraProblem, hasCamera, shrink, startScanner } from '#lib/camera.js';
  import { stepped } from '#lib/food.js';
  import { loginHref } from '#lib/next.js';
  import {
    afterBarcode,
    afterLabel,
    afterOff,
    cleanCode,
    closesSheet,
    CODE_RULE,
    failedWords,
    MAX_PHOTO_BYTES,
    MAX_PHOTOS,
    nowHm,
    TOO_LARGE,
    typedNumber,
    VALUE_FIELDS,
    type LabelForm,
    type ReadAnswer,
    type Step,
  } from '#lib/scan.js';
  import { getToday } from '#lib/today.svelte.js';
  import type { SaveAnswer } from '#lib/day.js';
  import { goto } from '$app/navigation';

  // The scan sheet (deploy 90), app.'s scanner in the new look: the camera reads a barcode (or the digits are typed), a food of
  // the catalogue is logged as an Again chip; an unknown one is looked up on Open Food Facts or read from one to three photos of
  // its label; the values are checked in a form and added (src/lib/scan.ts has the rules, src/lib/camera.ts the browser parts).
  // The browser asks this app's routes (/scan/barcode, /scan/off, /scan/label); "Log" and "Add to my foods" are Today's saves.
  const today = getToday();

  let dialog = $state<HTMLDialogElement | null>(null);
  let video = $state<HTMLVideoElement | null>(null);
  let step = $state<Step>({ kind: 'start' });
  let message = $state('');
  let live = $state(false);
  let digits = $state('');
  let code = $state<string | null>(null);
  let photos = $state<{ id: number; blob: Blob; url: string }[]>([]);
  let form = $state<LabelForm | null>(null);
  let amount = $state('');
  let time = $state('');
  let busy = $state(false);
  let stopCamera: (() => void) | null = null;
  let photoIds = 0;
  let opened = 0;

  export function open() {
    reset();
    opened += 1;
    dialog?.showModal();
    void camera(opened);
  }

  function reset() {
    stop();
    for (const p of photos) URL.revokeObjectURL(p.url);
    [step, message, digits, code, photos, form, amount, time, busy] = [{ kind: 'start' }, '', '', null, [], null, '', '', false];
  }

  function stop() {
    stopCamera?.();
    stopCamera = null;
    live = false;
  }

  async function camera(round: number) {
    if (!hasCamera() || !video) {
      message = 'No camera here: type the digits.';
      return;
    }
    const starting = 'Starting the camera…';
    message = starting;
    // the camera's words replace only "Starting the camera…", never what typed digits or a photo said meanwhile
    const say = (words: string) => {
      if (round === opened && message === starting) message = words;
    };
    try {
      const s = await startScanner(video, (c) => void find(c));
      // closed, opened again, or a photo picked meanwhile (the camera is for one user at a time): stop it again
      if (round !== opened || !dialog?.open || step.kind !== 'start') return s();
      stopCamera = s;
      live = true;
      say('Hold the barcode inside the frame.');
    } catch (e) {
      say(cameraProblem(e));
    }
  }

  /** The browser asks this app's route; a signed-out answer leads to the sign-in, as a save does. */
  async function ask(url: string, init?: RequestInit): Promise<{ ok: boolean; status: number; body: Record<string, unknown> | null }> {
    let res: Response;
    try {
      res = await fetch(url, { cache: 'no-store', credentials: 'same-origin', ...init });
    } catch {
      return { ok: false, status: 0, body: { message: 'No connection to Logger (offline?). Try again.' } };
    }
    const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (res.status === 401) void goto(loginHref(location.pathname + location.search));
    return { ok: res.ok, status: res.status, body };
  }

  async function find(found: string) {
    const c = cleanCode(found);
    if (!c) {
      message = CODE_RULE;
      return;
    }
    stop();
    code = c;
    digits = c;
    form = null;
    step = { kind: 'busy', words: `Barcode ${c}…` };
    message = '';
    const r = await ask(`/scan/barcode?code=${c}`);
    if (!r.ok || !r.body) {
      step = { kind: 'start' };
      message = failedWords(r.status, r.body);
      return;
    }
    step = afterBarcode(c, r.body as never);
    if (step.kind === 'found') {
      amount = String(+step.food.amount.toFixed(1));
      time = nowHm();
      message = 'In your catalogue:';
    } else message = `Barcode ${c}.`;
  }

  function typed(event: SubmitEvent) {
    event.preventDefault();
    void find(digits);
  }

  async function lookOff() {
    if (!code) return;
    const c = code;
    step = { kind: 'busy', words: 'Asking Open Food Facts…' };
    message = '';
    const r = await ask(`/scan/off?code=${c}`);
    if (!r.ok || !r.body) {
      step = { kind: 'unknown', code: c };
      message = `${failedWords(r.status, r.body)} Or use Photo of the label.`;
      return;
    }
    const next = afterOff(c, r.body as ReadAnswer);
    showForm(next.step);
    message = next.message;
  }

  function showForm(next: Step) {
    step = next;
    if (next.kind === 'form') {
      form = next.form;
      amount = '';
      time = nowHm();
    }
  }

  // "Photo of the label" and "+ Add a photo": the camera stops first (a phone gives the camera to one user at a time); each photo
  // is made smaller here and shown as a thumbnail; nothing is sent before "Read the label".
  async function pick(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const files = [...(input.files ?? [])];
    input.value = '';
    if (!files.length) return;
    stop();
    for (const f of files) {
      if (photos.length >= MAX_PHOTOS) break;
      const blob = await shrink(f);
      if (blob.size > MAX_PHOTO_BYTES) {
        message = TOO_LARGE;
        continue;
      }
      photos = [...photos, { id: ++photoIds, blob, url: URL.createObjectURL(blob) }];
      message = '';
    }
    if (photos.length) {
      form = null;
      step = { kind: 'photos', problem: null };
    }
  }

  function remove(id: number) {
    const p = photos.find((x) => x.id === id);
    if (p) URL.revokeObjectURL(p.url);
    photos = photos.filter((x) => x.id !== id);
    if (!photos.length) step = code ? { kind: 'unknown', code } : { kind: 'start' };
  }

  async function read() {
    if (!photos.length) return;
    step = { kind: 'busy', words: 'Reading the label… (a few seconds)' };
    message = '';
    const body = new FormData();
    for (const p of photos) body.append('photo', p.blob, 'label.jpg');
    const r = await ask('/scan/label', { method: 'POST', body });
    if (!r.ok || !r.body) {
      step = { kind: 'photos', problem: failedWords(r.status, r.body) };
      return;
    }
    const next = afterLabel(code, r.body as ReadAnswer);
    showForm(next.step);
    message = next.message;
  }

  /** "Log" and "Add to my foods": Today's saves; once saved the sheet closes and the answer bar has Undo. */
  async function save(action: 'again' | 'labeladd', fields: Record<string, string>) {
    busy = true;
    message = '';
    let a: SaveAnswer | null = null;
    try {
      a = await today.tap(action, `scan:${action}`, fields);
    } finally {
      busy = false;
    }
    if (closesSheet(a)) return dialog?.close();
    // Refused (or not saved): the sheet says why, and what was typed stays.
    const bar = today.bar;
    message = a ? [a.head, a.reason].filter(Boolean).join(' ') : bar ? [bar.head, ...bar.lines].join(' ') : 'Not saved; try again.';
    if (a || bar) today.closeBar();
  }

  function logFound(event: SubmitEvent) {
    event.preventDefault();
    if (step.kind !== 'found') return;
    void save('again', { food_id: String(step.food.food_id), amount: amount.trim().replace(',', '.'), time });
  }

  function addFood(event: SubmitEvent) {
    event.preventDefault();
    const fields: Record<string, string> = {};
    new FormData(event.currentTarget as HTMLFormElement).forEach((v, k) => {
      if (typeof v === 'string') fields[k] = v;
    });
    void save('labeladd', fields);
  }

  function more(dir: 1 | -1) {
    const v = typedNumber(amount);
    amount = String(stepped(v === null || Number.isNaN(v) ? 0 : v, 1, dir));
  }

  const field = 'h-11 min-w-0 rounded-lg border border-line bg-panel px-3 text-base text-text desktop:h-9 desktop:text-sm';
  const square = 'flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-line bg-panel p-0 text-lg text-text desktop:size-9';
  const btn = 'inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg px-4 font-medium disabled:cursor-default disabled:opacity-60 desktop:min-h-9';
  const primary = `${btn} border-0 bg-text text-bg`;
  const plain = `${btn} border border-line bg-panel text-text`;
  const label = 'flex flex-col gap-1 text-xs text-muted';
</script>

{#snippet photoButton(text: string, main: boolean)}
  <!-- A label with a file input: the phone offers its camera (capture), a PC its files. -->
  <label class="{main ? primary : plain} relative focus-within:outline-2 focus-within:outline-blue" data-photo-pick>
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
      ><path d="M4 8h3l2-3h6l2 3h3v11H4z"></path><circle cx="12" cy="13" r="3.5"></circle></svg
    >
    {text}
    <input class="sr-only" type="file" accept="image/*" capture="environment" multiple onchange={pick} onclick={stop} />
  </label>
{/snippet}

<dialog
  bind:this={dialog}
  aria-labelledby="scan-title"
  onclose={reset}
  class="m-0 h-dvh max-h-none w-full max-w-none border-0 bg-bg p-0 text-text backdrop:bg-black/50 tablet:m-auto tablet:h-fit tablet:max-h-[90dvh] tablet:w-[520px] tablet:rounded-card tablet:border tablet:border-line"
  data-scan
>
  <div class="flex h-full flex-col">
    <div class="flex items-center gap-2 border-b border-line px-3.5 py-1.5">
      <h2 id="scan-title" class="m-0 flex-1 text-[17px] font-semibold">Scan a barcode</h2>
      <button type="button" aria-label="Close" class="flex size-11 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent text-muted" onclick={() => dialog?.close()}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"></path></svg>
      </button>
    </div>

    <div class="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3.5 pt-3 pb-[calc(16px+env(safe-area-inset-bottom))]">
      <div class="overflow-hidden rounded-lg bg-black {live ? '' : 'hidden'}">
        <!-- svelte-ignore a11y_media_has_caption -->
        <video bind:this={video} playsinline muted class="block aspect-[4/3] max-h-[38dvh] w-full object-cover"></video>
      </div>

      <p class="m-0 min-h-5 text-[13px] text-muted empty:hidden" aria-live="polite" data-scan-msg>{message}</p>

      <form class="m-0 flex gap-2" onsubmit={typed}>
        <label for="scan-code" class="sr-only">Barcode digits</label>
        <input
          id="scan-code"
          bind:value={digits}
          inputmode="numeric"
          autocomplete="off"
          placeholder="or type the digits"
          class="{field} num flex-1"
        />
        <button type="submit" class={plain}>Find</button>
      </form>

      {#if step.kind === 'busy'}
        <p class="m-0 flex items-center gap-2 text-blue" data-scan-busy>
          <span class="size-1.5 animate-pulse rounded-full bg-blue" aria-hidden="true"></span>{step.words}
        </p>
      {:else if step.kind === 'found'}
        <form class="m-0 flex flex-col gap-2.5 rounded-lg border border-line bg-panel p-3" onsubmit={logFound} data-scan-found>
          <b class="text-[15px]">{step.food.name}</b>
          <div class="flex items-center gap-2">
            <label for="scan-amount" class="w-12 shrink-0 text-xs text-muted">Amount</label>
            <button type="button" class={square} aria-label="Less" onclick={() => more(-1)}>−</button>
            <input id="scan-amount" bind:value={amount} inputmode="decimal" required autocomplete="off" class="{field} num w-0 flex-1 text-center" />
            <button type="button" class={square} aria-label="More" onclick={() => more(1)}>+</button>
            <span class="w-6 text-muted">{step.food.unit}</span>
          </div>
          <div class="flex items-center gap-2">
            <label for="scan-time" class="w-12 shrink-0 text-xs text-muted">Time</label>
            <input id="scan-time" type="time" bind:value={time} required class="{field} num w-32" />
            <span class="flex-1"></span>
            <button type="submit" class={primary} disabled={busy}>Log</button>
          </div>
        </form>
      {:else if step.kind === 'unknown'}
        <div class="flex flex-col gap-2 rounded-lg border border-line bg-panel p-3" data-scan-unknown>
          <span>Not in your catalogue yet.</span>
          <div class="flex flex-wrap gap-2">
            <button type="button" class={primary} onclick={lookOff}>Look it up on Open Food Facts</button>
            {@render photoButton('Photo of the label', false)}
          </div>
        </div>
      {:else if step.kind === 'photos'}
        <div class="flex flex-col gap-2.5" data-scan-photos>
          <span class="text-[13px] text-muted">The name and the nutrition table can be on separate photos: up to {MAX_PHOTOS}, read together.</span>
          <ul class="m-0 flex list-none flex-wrap gap-2 p-0">
            {#each photos as p, i (p.id)}
              <li class="relative size-24 overflow-hidden rounded-lg border border-line bg-panel" data-photo>
                <img src={p.url} alt="Label photo {i + 1}" class="size-full object-cover" />
                <button
                  type="button"
                  aria-label="Remove photo {i + 1}"
                  class="absolute top-0 right-0 flex size-11 cursor-pointer items-start justify-end border-0 bg-transparent p-1"
                  onclick={() => remove(p.id)}
                >
                  <span class="flex size-6 items-center justify-center rounded-full bg-black/70 text-white">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"></path></svg>
                  </span>
                </button>
              </li>
            {/each}
          </ul>
          {#if step.problem}
            <p class="m-0 rounded-lg border border-amber bg-amber-bg px-3 py-2 text-[13px]" data-scan-problem>{step.problem} Replace a photo or add one, then read again.</p>
          {/if}
          <div class="flex flex-wrap gap-2">
            <button type="button" class={primary} onclick={read}>Read the label</button>
            {#if photos.length < MAX_PHOTOS}{@render photoButton('+ Add a photo', false)}{/if}
          </div>
          <span class="text-xs text-muted">Claude reads the values; you check them before anything is saved.</span>
        </div>
      {:else if step.kind === 'form' && form}
        <form class="m-0 flex flex-col gap-3 rounded-lg border border-line bg-panel p-3" onsubmit={addFood} data-label-form>
          <input type="hidden" name="source" value={form.source} />
          <input type="hidden" name="barcode" value={form.barcode} />
          <label class={label}>Name<input name="name" value={form.name} maxlength="120" minlength="2" required autocomplete="off" class={field} /></label>
          <label class={label}
            >Per 100
            <select name="basis" value={form.basis} class="{field} cursor-pointer">
              <option value="g">g</option>
              <option value="ml">ml (a drink)</option>
            </select>
          </label>
          <div class="grid grid-cols-2 items-end gap-x-2.5 gap-y-2.5">
            {#each VALUE_FIELDS as v (v.key)}
              <label class={label}
                >{v.label}{v.needed ? '' : ' (optional)'}
                <input name={v.key} value={form.values[v.key]} inputmode="decimal" required={v.needed} pattern={'\\d+([.,]\\d+)?'} autocomplete="off" class="{field} num" />
              </label>
            {/each}
          </div>
          {#if form.note}<p class="m-0 text-[13px] text-muted" data-label-note>{form.note}</p>{/if}
          <div class="grid grid-cols-2 gap-2.5">
            <label class={label}>Log now (optional)<input name="amount" bind:value={amount} inputmode="decimal" placeholder="amount in {form.basis}" pattern={'\\d+([.,]\\d+)?'} autocomplete="off" class="{field} num" /></label>
            <label class={label}>Time<input name="time" type="time" bind:value={time} class="{field} num" /></label>
          </div>
          <div><button type="submit" class={primary} disabled={busy}>Add to my foods</button></div>
        </form>
      {/if}

      {#if step.kind === 'start' || step.kind === 'found'}
        <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
          {@render photoButton('Photo of the label', false)}
          <span class="text-xs text-muted">For a food without a barcode, or one not found. You check the values before anything is saved.</span>
        </div>
      {/if}
    </div>
  </div>
</dialog>

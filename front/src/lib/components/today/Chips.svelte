<script lang="ts">
  import { againFields, becomesLine, ready, startPicks, usualFields, type ItemPick } from '#lib/chipbox.js';
  import { plain } from '#lib/format.js';
  import { chipNames, type Day } from '#lib/day.js';
  import { parseAmount, stepped } from '#lib/food.js';
  import type { SaveAnswer } from '#lib/day.js';
  import { getToday } from '#lib/today.svelte.js';

  let { day }: { day: Day } = $props();
  const today = getToday();

  // As app.: up to 12 Again chips, the first 8 on a phone (todaypage.AGAIN, AGAIN_PHONE); then the usual meals.
  const again = $derived(day.chips.again.slice(0, 12));
  const names = $derived(chipNames(again.map((a) => a.name)));

  // Deploy 117: each chip is one pill with two parts. The name logs at once, as before; the amount (an Again chip) or "…" (a usual
  // meal) opens a box under the chips to log it with another amount, at another time, or only some of the meal's foods. One box
  // at a time; a save that went through closes it. The saved usual meal stays as it is.
  let open = $state<string | null>(null);
  let amount = $state('');
  let time = $state('');
  let picks = $state<ItemPick[]>([]);
  const openAgain = $derived(open ? (again.find((a) => `a${a.food_id}` === open) ?? null) : null);
  const openUsual = $derived(open ? (day.chips.usual.find((u) => `u${u.meal_id}` === open) ?? null) : null);

  function toggleAgain(a: Day['chips']['again'][number]) {
    if (open === `a${a.food_id}`) return void (open = null);
    open = `a${a.food_id}`;
    amount = String(a.amount);
    time = '';
  }

  function toggleUsual(u: Day['chips']['usual'][number]) {
    if (open === `u${u.meal_id}`) return void (open = null);
    open = `u${u.meal_id}`;
    picks = startPicks(u.items);
    time = '';
  }

  /** A save that went through closes the box; a refusal or a read-back stays in the answer bar, the box open. */
  const done = (a: SaveAnswer | null) => {
    if (a && a.tone === 'ok' && !a.confirm) open = null;
  };

  function logAgain(event: SubmitEvent) {
    event.preventDefault();
    const a = openAgain;
    if (!a || parseAmount(amount) === null) return;
    void today.tap('again', `again:${a.food_id}`, againFields(a.food_id, amount, time)).then(done);
  }

  function logUsual(event: SubmitEvent) {
    event.preventDefault();
    const u = openUsual;
    if (!u || !ready(picks)) return;
    void today.tap('usual', `usual:${u.meal_id}`, usualFields(u.meal_id, picks, time)).then(done);
  }

  const pill = 'flex max-w-full items-stretch overflow-hidden rounded-full border bg-panel';
  const part = 'flex min-h-11 cursor-pointer items-center border-0 bg-transparent text-text disabled:opacity-60 desktop:min-h-9';
  const label = 'w-[52px] shrink-0 text-xs text-muted desktop:w-16';
  const field = 'h-11 min-w-0 rounded-lg border border-line bg-panel px-3 text-base text-text desktop:h-9 desktop:text-sm';
  const square = 'flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-line bg-panel p-0 text-lg text-text desktop:size-9';
  const btn = 'min-h-11 cursor-pointer rounded-lg px-4 font-medium disabled:opacity-60 desktop:min-h-9';
  const box = 'm-0 flex flex-col gap-2.5 rounded-lg border border-blue bg-panel2 px-3 pt-2.5 pb-3 desktop:px-3.5';
</script>

{#snippet when()}
  <div class="flex items-center gap-2">
    <label for="chip-time" class={label}>Time</label>
    <input id="chip-time" name="time" type="time" bind:value={time} class="{field} num w-32" />
    <span class="text-xs text-muted">{time ? '' : 'Empty: now'}</span>
  </div>
{/snippet}

{#snippet buttons(busy: boolean, off: boolean)}
  <div class="flex gap-2">
    <button type="submit" class="{btn} border-0 bg-text text-bg" disabled={busy || off}>Log</button>
    <button type="button" class="{btn} border border-line bg-panel text-text" onclick={() => (open = null)}>Cancel</button>
  </div>
{/snippet}

{#if !day.past && (again.length || day.chips.usual.length)}
  <div class="flex flex-col gap-2" data-card="chips">
    <div aria-label="Log again with one tap" role="group" class="flex flex-wrap gap-1.5">
      {#each again as a, i (a.food_id)}
        {@const id = `a${a.food_id}`}
        <form method="POST" action="?/again" class="m-0 max-w-full {i >= 8 ? 'hidden desktop:flex' : 'flex'}" onsubmit={today.submit('again', `again:${a.food_id}`)}>
          <input type="hidden" name="food_id" value={a.food_id} />
          <input type="hidden" name="amount" value={a.amount} />
          <div class="{pill} {open === id ? 'border-blue' : 'border-line'}" data-chip={id}>
            <button type="submit" class="{part} min-w-0 pr-2 pl-3.5" disabled={today.busy[`again:${a.food_id}`]} title="Log {a.name} {plain(a.amount)} {a.unit} now">
              <span class="truncate">+ {names[i]}</span>
            </button>
            <button
              type="button"
              class="{part} num min-w-11 shrink-0 justify-center border-l border-line pr-3 pl-2 text-xs whitespace-nowrap text-muted"
              aria-expanded={open === id}
              aria-controls={open === id ? 'chip-box' : undefined}
              aria-label="Change the amount of {a.name}"
              onclick={() => toggleAgain(a)}
              data-chip-amount>{plain(a.amount)} {a.unit}</button
            >
          </div>
        </form>
      {/each}
      {#each day.chips.usual as u (u.meal_id)}
        {@const id = `u${u.meal_id}`}
        <form method="POST" action="?/usual" class="m-0 flex max-w-full" onsubmit={today.submit('usual', `usual:${u.meal_id}`)}>
          <input type="hidden" name="meal_id" value={u.meal_id} />
          <div class="{pill} {open === id ? 'border-blue' : 'border-line'}" data-chip={id}>
            <button type="submit" class="{part} min-w-0 pr-2 pl-3.5" disabled={today.busy[`usual:${u.meal_id}`]} title="Log {u.name} now, as saved"
              ><span class="truncate">+ {u.name}</span></button
            >
            <button
              type="button"
              class="{part} min-w-11 shrink-0 justify-center border-l border-line pr-3 pl-2 text-muted"
              aria-expanded={open === id}
              aria-controls={open === id ? 'chip-box' : undefined}
              aria-label="Choose the foods and amounts of {u.name}"
              onclick={() => toggleUsual(u)}
              data-chip-more>…</button
            >
          </div>
        </form>
      {/each}
      {#if day.chips.usual.length}
        <!-- deploy 87: the usual meals are changed on their own page -->
        <a href="/library/usual" class="inline-flex min-h-11 items-center px-1.5 text-[13px] font-medium desktop:min-h-9" aria-label="Edit usual meals" data-usual-edit>Edit</a>
      {/if}
    </div>

    {#if openAgain}
      {@const a = openAgain}
      <!-- An Again chip's box: the amount with − and +, a time (empty: now), Log = the again save. -->
      <form method="POST" action="?/again" id="chip-box" class={box} onsubmit={logAgain} data-chip-box="again">
        <input type="hidden" name="food_id" value={a.food_id} />
        <p class="m-0 font-medium break-words">{a.name}</p>
        <div class="flex items-center gap-2">
          <label for="chip-amount" class={label}>Amount</label>
          <button type="button" class={square} aria-label="Less" onclick={() => (amount = String(stepped(parseAmount(amount) ?? 0, 1, -1)))}>−</button>
          <input
            id="chip-amount"
            name="amount"
            inputmode="decimal"
            autocomplete="off"
            required
            bind:value={amount}
            class="{field} num w-0 flex-1 text-center desktop:w-28 desktop:flex-none"
          />
          <button type="button" class={square} aria-label="More" onclick={() => (amount = String(stepped(parseAmount(amount) ?? 0, 1, 1)))}>+</button>
          <span class="w-7 shrink-0 text-muted">{a.unit}</span>
        </div>
        {@render when()}
        {@render buttons(!!today.busy[`again:${a.food_id}`], parseAmount(amount) === null)}
      </form>
    {:else if openUsual}
      {@const u = openUsual}
      <!-- A usual meal's box: each food with a tick and its amount, what the ticked ones become, a time; Log = the usual save with
           only the ticked foods and these amounts. -->
      <form method="POST" action="?/usual" id="chip-box" class={box} onsubmit={logUsual} data-chip-box="usual">
        <input type="hidden" name="meal_id" value={u.meal_id} />
        <p class="m-0 font-medium break-words">{u.name}</p>
        <ul class="m-0 flex list-none flex-col gap-1 p-0">
          {#each picks as p, k (p.item_id)}
            {@const item = u.items[k]}
            {#if item}
              <li class="flex items-center gap-2" data-chip-item={item.item_id}>
                <label class="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-2.5 desktop:min-h-9">
                  <input type="checkbox" name="item_id" value={item.item_id} bind:checked={p.on} class="h-11 w-5 shrink-0 cursor-pointer accent-blue desktop:h-9" />
                  <span class="min-w-0 break-words {p.on ? '' : 'text-muted'}">{item.food}</span>
                </label>
                <input
                  name="amount"
                  inputmode="decimal"
                  autocomplete="off"
                  aria-label="Amount of {item.food}"
                  disabled={!p.on}
                  bind:value={p.amount}
                  class="{field} num w-20 shrink-0 text-right disabled:opacity-60 desktop:w-24"
                />
                <span class="w-7 shrink-0 text-muted">{item.unit}</span>
              </li>
            {/if}
          {/each}
        </ul>
        <div class="flex items-baseline gap-2">
          <span class={label}>Becomes</span>
          <span class="num flex-1" data-chip-becomes>{becomesLine(u.items, picks)}</span>
        </div>
        {@render when()}
        {@render buttons(!!today.busy[`usual:${u.meal_id}`], !ready(picks))}
      </form>
    {/if}
  </div>
{/if}

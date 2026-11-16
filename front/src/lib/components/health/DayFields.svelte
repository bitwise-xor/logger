<script lang="ts">
  import type { Column, Draft } from '#lib/health.js';

  // A day's eight values as fields (deploy 92), for the open row on phones and tablets: a label (and its small words) and the
  // field, the blood pressures as upper / lower. `draft` is changed in place (the row's own state).
  let { columns, draft = $bindable(), day }: { columns: Column[]; draft: Draft; day: string } = $props();

  const field = 'num h-11 min-w-0 rounded-lg border border-line bg-panel px-3 text-base text-text';
  const unit: Record<string, string> = { weight: 'kg', sugar: 'mg/dL' };
</script>

<div class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2">
  {#each columns as c (c.row)}
    {@const id = `hd-${day}-${c.row}`}
    <label for={c.kind === 'pair' ? `${id}_1` : id} class="flex min-w-0 flex-col leading-tight">
      <span>{c.label}{c.kind === 'pair' && c.sub ? ` ${c.sub}` : ''}</span>
      {#if c.sub && c.kind !== 'pair'}<span class="text-xs text-muted">{c.sub}</span>{/if}
    </label>
    <span class="flex items-center justify-end gap-1.5">
      {#if c.kind === 'pair'}
        <input id="{id}_1" name="{c.row}_1" inputmode="numeric" autocomplete="off" placeholder="–" aria-label="{c.label} {c.sub}, upper" bind:value={draft[`${c.row}_1`]} class="{field} w-[68px] text-center" />
        <span class="text-muted">/</span>
        <input id="{id}_2" name="{c.row}_2" inputmode="numeric" autocomplete="off" placeholder="–" aria-label="{c.label} {c.sub}, lower" bind:value={draft[`${c.row}_2`]} class="{field} w-[68px] text-center" />
      {:else if c.kind === 'time'}
        <input {id} name={c.row} type="time" bind:value={draft[c.row]} class="{field} w-[150px]" />
      {:else}
        <input {id} name={c.row} inputmode="decimal" autocomplete="off" placeholder="–" bind:value={draft[c.row]} class="{field} w-[88px] text-center" />
        {#if unit[c.row]}<span class="w-11 text-[13px] text-muted">{unit[c.row]}</span>{:else}<span class="w-11"></span>{/if}
      {/if}
    </span>
  {/each}
</div>

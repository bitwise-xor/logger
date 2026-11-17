<script lang="ts">
  import { goto } from '$app/navigation';
  import MoreHeader from '#lib/components/more/MoreHeader.svelte';
  import ProblemCard from '#lib/components/ProblemCard.svelte';
  import { Button } from '#lib/components/ui/button/index.js';
  import { canUseAgain, keepWords, notReadText, openDayHref, privateLabel, tabStorage, wordsOf, type Message } from '#lib/recent.js';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();

  // More's Recent (deploy 108): app.'s Recent page. The last 50 messages by day: time, where it came from, the words (a private entry
  // only as "Private" with its label), what it saved, "Use again" (the words go into Today's logging box through the tab's storage,
  // never the address) and "Open day". Not-read messages stay on Today: a line above says how many.
  const r = $derived(data.recent);

  function useAgain(m: Message) {
    if (keepWords(tabStorage(), m.again)) void goto('/');
  }
  const pill = 'inline-flex items-center rounded-full px-2 text-xs whitespace-nowrap';
</script>

<svelte:head><title>Recent · Logger</title></svelte:head>

<MoreHeader title="Recent" />

{#if !r}
  <ProblemCard kind={data.problem ?? 'trouble'} appHref="{data.appUrl}/web/recent" />
{:else}
  <main class="flex min-w-0 flex-col gap-3 desktop:max-w-[760px]" data-recent>
    {#if r.not_read > 0}
      <a href="/" class="flex min-h-11 items-center gap-2 rounded-[10px] bg-amber-bg px-3 py-2 text-[13px] font-medium text-amber no-underline" data-not-read>
        <span>{notReadText(r.not_read)}</span>{' '}<span class="font-semibold underline underline-offset-[3px]">› Today</span>
      </a>
    {/if}
    {#each r.days as d (d.day)}
      <section aria-labelledby="d-{d.day}" class="flex flex-col gap-1.5" data-day={d.day}>
        <h2 id="d-{d.day}" class="m-0 text-xs font-medium tracking-wider text-muted uppercase">{d.head}</h2>
        <div class="overflow-hidden rounded-card border border-line bg-panel [&>*+*]:border-t [&>*+*]:border-line">
          {#each d.messages as m, i (m.id ?? `p-${d.day}-${i}`)}
            {@const words = wordsOf(m)}
            {@const day = openDayHref(m)}
            <div class="flex flex-col gap-1.5 px-3 py-2.5" data-message={m.private ? 'private' : m.id}>
              <div class="flex flex-wrap items-center gap-2">
                <span class="num text-[13px] text-muted" data-time>{m.time}</span>{' '}
                <span class="{pill} {m.channel === 'claude-chat' || m.channel === 'mcp' ? 'bg-blue-bg text-blue' : 'bg-chip text-chip-text'}" data-channel>{m.channel_label}</span>
              </div>
              {#if m.private}
                <p class="m-0 text-[13px] text-muted" data-private-label>{privateLabel(m)}</p>
              {:else}
                {#if words}<p class="m-0 font-medium break-words" data-words>{words}</p>{/if}
                {#if m.saved.length}
                  <ul class="m-0 flex list-none flex-col gap-1 p-0" data-saved>
                    {#each m.saved as x, j (j)}
                      <li class="flex items-baseline gap-2 text-[13px]"><span class="{pill} bg-chip text-chip-text">{x.kind}</span>{' '}<span class="min-w-0 break-words">{x.text}</span></li>
                    {/each}
                  </ul>
                {:else}
                  <p class="m-0 text-[13px] text-muted" data-none>{r.none}</p>
                {/if}
                {#if canUseAgain(m) || day}
                  <div class="flex flex-wrap gap-1.5">
                    {#if canUseAgain(m)}<Button type="button" variant="outline" onclick={() => useAgain(m)} data-use-again>Use again</Button>{/if}
                    {#if day}<Button href={day} variant="outline" data-open-day>Open day</Button>{/if}
                  </div>
                {/if}
              {/if}
            </div>
          {/each}
        </div>
      </section>
    {:else}
      <p class="m-0 rounded-card border border-line bg-panel p-3 text-muted" data-empty>{r.empty}</p>
    {/each}
    <p class="m-0 text-[13px] text-muted">{r.small}. Private entries show only their kind.</p>
  </main>
{/if}

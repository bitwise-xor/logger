<script lang="ts">
  import ProblemCard from '#lib/components/ProblemCard.svelte';
  import { CHORE_GONE, editHref, zoneLine } from '#lib/homeparts.js';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();

  // A chore's own page (deploy 100; app.'s render_chore): "‹ Zones", the name, the meta line, the steps, the how-to line, "Edit" (to Edit
  // zones with this chore's form open) and "Last done": the last ten dates ("(starting point)" for a starting point) with "usually every
  // N days"; a whole-flat chore per zone, each with its interval and minutes (or "not done here"). The door's words throughout. An unknown
  // chore says so on the page. Nothing saves here, so there is no answer bar.
  const c = $derived(data.chore);
  const back = 'inline-flex min-h-11 items-center self-start text-blue no-underline hover:underline';
</script>

<svelte:head><title>{c ? `${c.name} · Home` : 'Home chore'} · Logger</title></svelte:head>

<a href="/home/zones" class={back} data-back>‹ Zones</a>

{#if data.problem}
  <ProblemCard kind={data.problem} appHref="{data.appUrl}/web/home" />
{:else if !c}
  <section class="flex flex-col gap-1 rounded-card border border-line bg-panel p-3 desktop:max-w-[720px] desktop:p-3.5" data-card="gone">
    <p class="m-0 text-muted" data-empty>{CHORE_GONE}</p>
  </section>
{:else}
  <main class="flex flex-col gap-3 desktop:max-w-[720px] desktop:gap-4">
    <section class="flex flex-col gap-2 rounded-card border border-line bg-panel p-3 desktop:p-3.5" data-card="chore" data-chore={c.chore_id}>
      <h1 class="m-0 text-[26px] leading-[1.1] font-semibold tracking-tight break-words desktop:text-[30px]" data-name>{c.name}</h1>
      <p class="m-0 text-[13px] text-muted" data-meta>{c.meta}</p>
      {#if c.steps.length}
        <ol class="m-0 flex flex-col gap-1 pl-5" data-steps>
          {#each c.steps as s, i (i)}<li>{s}</li>{/each}
        </ol>
      {/if}
      {#if c.howto}<p class="m-0 text-[13px] text-muted" data-howto>{c.howto}</p>{/if}
      <a
        href={editHref(c.chore_id)}
        class="inline-flex min-h-11 items-center self-start rounded-lg border border-line bg-panel px-4 font-medium text-text no-underline hover:bg-panel2 desktop:min-h-9"
        data-edit>Edit</a
      >
    </section>

    <section aria-labelledby="last-h" class="flex flex-col gap-2 rounded-card border border-line bg-panel p-3 desktop:p-3.5" data-card="last">
      <h2 id="last-h" class="m-0 text-[15px] font-semibold">Last done</h2>
      {#if c.zones}
        <ul class="m-0 flex list-none flex-col p-0" data-zones>
          {#each c.zones as z (z.zone_id)}
            {@const l = zoneLine(z)}
            <li class="flex flex-col gap-0.5 border-t border-line py-2 first:border-t-0 first:pt-0" data-zone={z.zone_id}>
              <span class="break-words"
                ><b class="font-medium" data-zone-name>{l.name}</b> <span class="text-[13px] text-muted" data-zone-extra>{l.extra}</span></span
              >
              <span class="num text-[13px] text-muted" data-zone-dates>{l.dates}</span>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="num m-0 break-words" data-dates>{c.last_text}</p>
        {#if c.usually}<p class="m-0 text-[13px] text-muted" data-usually>{c.usually}</p>{/if}
      {/if}
    </section>
  </main>
{/if}

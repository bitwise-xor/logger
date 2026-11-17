<script lang="ts">
  import ProblemCard from '#lib/components/ProblemCard.svelte';
  import GymDock from '#lib/components/gym/GymDock.svelte';
  import MedicalHeader from '#lib/components/medical/MedicalHeader.svelte';
  import MedRow from '#lib/components/medical/MedRow.svelte';
  import { runningLine } from '#lib/medical.js';
  import { MedsPage, setMedsPage } from '#lib/medspage.svelte.js';
  import { onMount, untrack } from 'svelte';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();

  // Medical's Medication tab (deploy 106): "Add a course" (one sentence through Today's typed line, read back in the answer bar with Yes and
  // No), the card "Medication" with "n running" and a row per course in the door's order (the pencil, End), the door's empty words and the
  // hint under the list. Every change saves in place.
  const page = setMedsPage(untrack(() => new MedsPage(data.meds, data.undo)));
  $effect.pre(() => page.load(data.meds, data.undo));
  onMount(() => void page.resend());

  const m = $derived(page.meds);
  const field = 'h-11 w-full min-w-0 rounded-lg border border-line bg-panel px-3 text-base text-text placeholder:text-muted desktop:h-10 desktop:text-sm';
  const head = 'm-0 text-[15px] font-semibold';
</script>

<svelte:head><title>Medication · Medical · Logger</title></svelte:head>

<MedicalHeader on="meds" />

{#if !m}
  <ProblemCard kind={data.problem ?? 'trouble'} appHref="{data.appUrl}/web/labs/meds" />
{:else}
  <main class="flex flex-col gap-3 desktop:max-w-[760px]">
    <section aria-labelledby="add-h" class="flex flex-col gap-2.5 rounded-card border border-line bg-panel p-3 desktop:p-3.5" data-card="add">
      <h2 id="add-h" class={head}>Add a course</h2>
      <form
        method="POST"
        action="?/log"
        class="m-0 flex gap-2"
        novalidate
        onsubmit={(e) => {
          e.preventDefault();
          void page.add();
        }}
        data-add-form
      >
        <input
          name="text"
          maxlength="4000"
          autocomplete="off"
          placeholder="started vitamin D 1000 IU daily"
          aria-label="Add a course"
          bind:value={page.text}
          oninput={() => delete page.errs.add}
          class={field}
          data-add-text
        />
        <button
          type="submit"
          class="min-h-11 shrink-0 cursor-pointer rounded-lg border-0 bg-text px-5 font-medium whitespace-nowrap text-bg disabled:opacity-60 desktop:min-h-10"
          disabled={!!page.busy.add}
          aria-busy={!!page.busy.add}
          data-add>{page.busy.add ? 'Reading…' : 'Add'}</button
        >
      </form>
      {#if page.busy.add}<p role="status" class="m-0 text-[13px] text-muted" data-reading>Reading your sentence…</p>{/if}
      {#if page.errs.add}<p role="alert" class="m-0 rounded-lg bg-amber-bg px-2.5 py-2 text-[13px] text-amber" data-err="add">{page.errs.add}</p>{/if}
    </section>

    <section aria-labelledby="meds-h" class="flex flex-col overflow-hidden rounded-card border border-line bg-panel" data-card="meds">
      <div class="flex items-baseline justify-between gap-2 px-3 pt-3 pb-2 desktop:px-3.5">
        <h2 id="meds-h" class={head}>Medication</h2>
        <span class="text-[13px] text-muted" data-running-count>{runningLine(m)}</span>
      </div>
      {#if m.meds.length}
        <div class="flex flex-col border-t border-line [&>*+*]:border-t [&>*+*]:border-line" data-list>
          {#each m.meds as c (c.id)}<MedRow m={c} hint={m.form_hint} />{/each}
        </div>
      {:else}
        <p class="m-0 border-t border-line p-3.5 text-muted" data-empty>{m.empty ?? 'No medication recorded.'}</p>
      {/if}
    </section>

    <p class="m-0 text-[13px] text-muted" data-hint>A new course is one sentence, read back before it is saved. Today's box takes it too.</p>
  </main>
{/if}

<GymDock answers={page} />

<script lang="ts">
  import GymDock from '#lib/components/gym/GymDock.svelte';
  import ProblemCard from '#lib/components/ProblemCard.svelte';
  import SettingsHeader from '#lib/components/settings/SettingsHeader.svelte';
  import Switch from '#lib/components/settings/Switch.svelte';
  import { S } from '#lib/components/settings/styles.js';
  import { settingsAppPath } from '#lib/places.js';
  import type { SettingsCoach } from '#lib/settings.js';
  import { SettingsPage } from '#lib/settingspage.svelte.js';
  import { untrack } from 'svelte';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();

  // Settings > Coach (deploy 111; every "Your goals" link leads here, week.ts GOALS_HERE): "My goals" and "How to coach me" (the door's
  // max length), the parts of the day coaching and the week review as switches, Save; a refusal ("Keep at least one part of the day
  // coaching.") next to the form; then the door's facts, "How the coach works".
  const page = untrack(() => new SettingsPage<SettingsCoach>('coach', data.read, '/settings/coach'));
  $effect.pre(() => page.load(data.read));
  const c = $derived(page.read);

  const formOf = (r: SettingsCoach | null) => ({
    goals: r?.goals ?? '',
    style: r?.style ?? '',
    on: Object.fromEntries((r?.kinds ?? []).flatMap((k) => k.parts.map((p) => [`${k.kind}:${p.key}`, p.on]))) as Record<string, boolean>,
  });
  // the form as the read has it (the page's load, also on the server, and after a save went through)
  let form = $state(untrack(() => formOf(data.read)));
  let filled = untrack(() => data.read);
  $effect.pre(() => {
    if (data.read !== filled) form = formOf((filled = data.read));
  });

  function save(event: SubmitEvent) {
    event.preventDefault();
    if (!c) return;
    const parts = (kind: string) => c.kinds.find((k) => k.kind === kind)?.parts.filter((p) => form.on[`${kind}:${p.key}`]).map((p) => p.key) ?? [];
    void page.tap('settings_coach', 'coach', { goals: form.goals, style: form.style, parts: '1', day: parts('day'), week: parts('week') }).then((a) => {
      if (a && a.outcome !== 'rejected') form = formOf(page.read);
    });
  }
  const area = 'min-h-24 w-full min-w-0 resize-y rounded-lg border border-line bg-panel2 px-3 py-2 text-base text-text desktop:text-sm';
</script>

<svelte:head><title>Coach · Settings · Logger</title></svelte:head>

<SettingsHeader on="coach" />

{#if !c}
  <ProblemCard kind={data.problem ?? 'trouble'} appHref="{data.appUrl}{settingsAppPath('coach')}" />
{:else}
  <main class={S.main}>
    <form method="POST" action="?/settings_coach" class={S.card} onsubmit={save} data-form="coach">
      <h2 class={S.h2}>Coach</h2>
      <label class={S.fieldLabel}>
        My goals
        <textarea name="goals" rows="4" maxlength={c.max} bind:value={form.goals} class={area} data-field="goals"></textarea>
      </label>
      <label class={S.fieldLabel}>
        How to coach me
        <textarea name="style" rows="4" maxlength={c.max} bind:value={form.style} class={area} data-field="style"></textarea>
      </label>
      <p class="{S.note} -mt-1">Tone, length, focus, what to leave out.</p>
      {#each c.kinds as k (k.kind)}
        <h3 class="{S.label} pt-1">{k.title}</h3>
        <div class="flex flex-col" data-kind={k.kind}>
          {#each k.parts as p (p.key)}
            <Switch on={!!form.on[`${k.kind}:${p.key}`]} onclick={() => ((form.on[`${k.kind}:${p.key}`] = !form.on[`${k.kind}:${p.key}`]), page.refuse('coach', null))} data-part="{k.kind}:{p.key}"
              >{p.label}</Switch
            >
          {/each}
        </div>
      {/each}
      {#if page.errs.coach}<p class={S.refusal} role="alert" data-refusal>{page.errs.coach}</p>{/if}
      <div><button type="submit" class={S.primary} disabled={!!page.busy.coach}>Save</button></div>
    </form>

    <section class={S.quiet} aria-labelledby="how-h" data-facts>
      <h2 id="how-h" class={S.h2}>How the coach works</h2>
      <ul class="{S.note} m-0 flex flex-col gap-1 pl-[18px]">
        {#each c.facts as f, i (i)}<li>{f}</li>{/each}
      </ul>
    </section>
  </main>
{/if}

<GymDock answers={page} />

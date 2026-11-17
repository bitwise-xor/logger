<script lang="ts">
  import ThemeButton from '#lib/components/ThemeButton.svelte';
  import { MEDICAL_TABS, type MedicalTab } from '#lib/places.js';

  // The title "Medical" with the theme button and the tabs Reports · Tests over time · Medication (deploy 106, as Library's tabs): each tab
  // is its own page of this app; `on` is the one you are in.
  let { on }: { on: MedicalTab } = $props();
  const tab = 'inline-flex min-h-11 items-center gap-1 border-b-2 px-3 text-sm font-medium whitespace-nowrap no-underline desktop:min-h-10';
</script>

<header class="flex flex-col gap-1.5" data-medical-header>
  <div class="flex items-center gap-2">
    <h1 class="m-0 flex-1 text-[26px] leading-[1.1] font-semibold tracking-tight desktop:text-[30px]">Medical</h1>
    <ThemeButton />
  </div>
  <nav aria-label="Medical" class="relative -mx-3.5 overflow-x-auto px-3.5 desktop:mx-0 desktop:px-0" data-tabs>
    <div class="flex w-max min-w-full gap-0.5 border-b border-line">
      {#each MEDICAL_TABS as t (t.key)}
        <a
          href={t.href}
          aria-current={t.key === on ? 'page' : undefined}
          class="{tab} {t.key === on ? 'border-text text-text' : 'border-transparent text-muted hover:text-text'}"
          data-tab={t.key}>{t.label}</a
        >
      {/each}
    </div>
  </nav>
</header>

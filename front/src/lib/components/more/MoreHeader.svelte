<script lang="ts">
  import ThemeButton from '#lib/components/ThemeButton.svelte';

  // The header of Search, Recent and Usage (deploy 108): a back chevron to More, the title, the theme button.
  let { title }: { title: string } = $props();
</script>

<header class="flex items-center gap-1.5" data-more-header>
  <a
    href="/more"
    aria-label="Back to More"
    title="Back to More"
    class="-ml-3 flex size-11 shrink-0 items-center justify-center rounded-lg text-text no-underline hover:bg-panel2 desktop:ml-0"
    data-back
  >
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"
      ><path d="M10 3.5L5.5 8l4.5 4.5"></path></svg
    >
  </a>
  <h1 class="m-0 min-w-0 flex-1 text-[26px] leading-[1.1] font-semibold tracking-tight desktop:text-[30px]">{title}</h1>
  <ThemeButton />
</header>

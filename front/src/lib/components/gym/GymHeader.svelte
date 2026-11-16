<script lang="ts">
  import ThemeButton from '#lib/components/ThemeButton.svelte';
  import GymParts from './GymParts.svelte';

  // The title "Gym" with the theme button and the row of parts, the same on every part of the Gym; `on` is the part you are in.
  let { on }: { on: string } = $props();
</script>

<header class="flex flex-col gap-1.5">
  <div class="flex items-center gap-2">
    <h1 class="m-0 flex-1 text-[26px] leading-[1.1] font-semibold tracking-tight desktop:text-[30px]">Gym</h1>
    <ThemeButton />
  </div>
  <GymParts {on} />
</header>

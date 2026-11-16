<script lang="ts">
  import ThemeButton from '#lib/components/ThemeButton.svelte';
  import { Button } from '#lib/components/ui/button/index.js';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();
</script>

<svelte:head><title>Today · Logger</title></svelte:head>

<header class="flex items-center gap-2.5">
  <div class="flex min-w-0 flex-1 flex-col gap-0.5">
    <h1 class="m-0 text-[26px] leading-[1.1] font-semibold tracking-tight desktop:text-[30px]">Today</h1>
    <span class="text-[13px] text-muted">{data.dayLine}</span>
  </div>
  <ThemeButton />
  <form method="POST" action="/signout" class="m-0">
    <Button type="submit" variant="outline">Sign out</Button>
  </form>
</header>

<main class="flex flex-col gap-3">
  <section class="rounded-card border border-line bg-panel p-3.5">
    <h2 class="m-0 mb-1 text-[15px] font-semibold">Signed in</h2>
    <p class="m-0 text-muted">
      This is the new front end's first step. Today's cards come next; until then, log in the
      <a href="{data.appUrl}/web/">full app</a>.
    </p>
  </section>
</main>

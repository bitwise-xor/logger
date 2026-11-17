<script lang="ts">
  import CoachParts from '#lib/components/coach/CoachParts.svelte';
  import type { CoachItem } from '#lib/coach.js';

  // An open coaching of the list (deploy 109): its parts in the door's words and the caution under them. A day's and a week's alike.
  let { item }: { item: CoachItem } = $props();
</script>

<div class="flex flex-col gap-2.5" data-coach-open={item.id}>
  <CoachParts parts={item.parts} />
  {#if item.caution}<p class="m-0 text-xs text-muted" data-coach-caution>{item.caution}</p>{/if}
</div>

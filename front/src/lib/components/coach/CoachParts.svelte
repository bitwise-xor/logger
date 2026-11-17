<script lang="ts">
  import { mealLine, partWarns } from '#lib/coach.js';
  import type { Part } from '#lib/week.js';

  // The parts of a coaching, in the door's order and words (deploy 109, shared by Trends' Week review, the Coach list and the day card):
  // a note (style "note": For your doctor) in a quiet box, a numbered list (Focus for next week), a list, and the day coaching's next
  // meal (style "meal": its title, why, and the kcal, protein, carbs and fat line). A part whose tone is "warn" (To improve) is drawn
  // in amber, as the mockup; every other tone looks like no tone.
  let { parts }: { parts: Part[] } = $props();
</script>

<div class="flex flex-col gap-2.5" data-review-parts data-parts>
  {#each parts as part (part.key)}
    {#if part.style === 'note'}
      <p class="m-0 rounded-[10px] border border-line bg-panel2 px-3 py-2 text-[14px]" data-part={part.key}>{part.text}</p>
    {:else if part.style === 'meal' && part.meal}
      <div class="flex flex-col gap-1" data-part={part.key}>
        <h3 class="m-0 text-[13px] font-semibold">{part.title}</h3>
        <div class="flex flex-col gap-1 rounded-[10px] border border-line bg-panel2 p-2.5" data-meal>
          <b class="font-medium" data-meal-title>{part.meal.title}</b>
          {#if part.meal.why}<span class="text-[13px] text-muted" data-meal-why>{part.meal.why}</span>{/if}
          <span class="num text-[13px]" data-meal-macros>{mealLine(part.meal)}</span>
        </div>
      </div>
    {:else}
      {@const warn = partWarns(part)}
      <div class="flex flex-col gap-0.5 {warn ? 'border-l-[3px] border-amber pl-2.5' : ''}" data-part={part.key} data-tone={part.tone ?? undefined}>
        <h3 class="m-0 text-[13px] font-semibold {warn ? 'text-amber' : ''}">{part.title}</h3>
        {#if part.style === 'numbered'}
          <ol class="m-0 flex list-decimal flex-col gap-0.5 pl-5 {warn ? 'marker:text-amber' : ''}">{#each part.items as item, i (i)}<li>{item}</li>{/each}</ol>
        {:else}
          <ul class="m-0 flex list-disc flex-col gap-0.5 pl-5 {warn ? 'marker:text-amber' : ''}">{#each part.items as item, i (i)}<li>{item}</li>{/each}</ul>
        {/if}
      </div>
    {/if}
  {/each}
</div>

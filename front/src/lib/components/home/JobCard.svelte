<script lang="ts">
  import { jobOf, overNote, type HomePick, type Job } from '#lib/home.js';

  // The job of the Pick page (app.'s hojob card): the zone and the age as pills, "Job 2 of 5" when several fit, the title, the steps
  // numbered, the how-to, and the note when the job is over the time.
  let { pick, job }: { pick: HomePick; job: Job } = $props();
  const of = $derived(jobOf(pick));
  const note = $derived(overNote(job));
</script>

<section aria-labelledby="job-h" class="flex flex-col gap-2 rounded-card border border-line bg-panel p-3 desktop:p-3.5" data-card="job">
  <div class="flex flex-wrap items-center gap-1.5">
    <span class="inline-flex items-center rounded-full bg-chip px-2.5 py-0.5 text-xs whitespace-nowrap text-chip-text" data-pill="zone">{job.zone}</span>
    <span class="inline-flex items-center rounded-full bg-chip px-2.5 py-0.5 text-xs whitespace-nowrap text-chip-text" data-pill="age">{job.age_text}</span>
    {#if of}<span class="text-[13px] text-muted" data-of>{of}</span>{/if}
  </div>
  <h2 id="job-h" class="m-0 text-lg font-semibold tracking-tight break-words desktop:text-xl" data-job>{job.title}</h2>
  {#if job.steps.length}
    <ol class="m-0 flex flex-col gap-1 pl-5" data-steps>
      {#each job.steps as s, i (i)}<li>{s}</li>{/each}
    </ol>
  {/if}
  {#if job.howto}<p class="m-0 text-[13px] text-muted" data-howto>{job.howto}</p>{/if}
  {#if note}<p class="m-0 text-[13px] text-muted" data-over>{note}</p>{/if}
</section>

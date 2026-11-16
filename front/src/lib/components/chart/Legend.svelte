<script lang="ts">
  // A chart's colour keys and words (deploy 92; app.'s "legend" with its "key" classes): key "a" or "b" a dot in that series'
  // colour, "line b" a short line, "ref" and "ref r" a dashed line (grey, amber), "sq d" and "sq h" squares (a band, a light one).
  let { items }: { items: { key: string; text: string }[] } = $props();
</script>

<p class="legend m-0 mt-1.5 text-[13px] leading-relaxed text-muted">
  {#each items as k, i (i)}<i class="key {k.key}" aria-hidden="true"></i>{k.text}{' '}{/each}
</p>

<style>
  .key {
    display: inline-block;
    width: 0.7rem;
    height: 0.7rem;
    border-radius: 50%;
    margin: 0 0.3rem 0 0.6rem;
    vertical-align: -0.05rem;
    background: var(--track);
  }
  .key:first-child {
    margin-left: 0;
  }
  .key.a {
    background: var(--chart-a);
  }
  .key.b {
    background: var(--chart-b);
  }
  .key.c {
    background: var(--muted);
  }
  .key.w {
    background: var(--chart-warn);
  }
  .key.line {
    height: 0.2rem;
    border-radius: 1px;
    vertical-align: 0.15rem;
  }
  .key.sq {
    border-radius: 3px;
  }
  .key.sq.d {
    background: var(--chart-a);
  }
  .key.sq.h,
  .key.sq.band {
    background: var(--chart-soft);
    box-shadow: inset 0 0 0 1px var(--chart-a);
  }
  .key.ref {
    height: 0;
    border-top: 2px dashed var(--muted);
    background: none;
    border-radius: 0;
    width: 0.9rem;
    vertical-align: 0.2rem;
  }
  .key.ref.r {
    border-top-color: var(--chart-warn);
  }
  .key.ref.t {
    border-top-color: var(--chart-a);
  }
</style>

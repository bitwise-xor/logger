<script lang="ts">
  // The search field (deploy 108): a plain GET form to /search?q= (no script needed), on More and on the Search page, which keeps the words.
  let { q = '' }: { q?: string } = $props();
</script>

<form method="GET" action="/search" role="search" class="m-0" data-search-form>
  <label for="more-q" class="sr-only">Search</label>
  <input
    id="more-q"
    type="search"
    name="q"
    value={q}
    maxlength="80"
    placeholder="Search foods, meals, workouts, chores, tests"
    autocomplete="off"
    enterkeyhint="search"
    class="h-11 w-full min-w-0 rounded-lg border border-line bg-panel px-3 text-base text-text placeholder:text-muted focus-visible:border-blue focus-visible:outline-none desktop:h-10 desktop:text-sm"
    data-search
  />
</form>

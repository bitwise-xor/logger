# Where these tokens come from

`tokens.css` and `theme.css` are copies of the hub's design tokens: `~/hub/packages/tokens/` at hub commit `a1c62ed`
(14.11.2026), copied on 16.11.2026 unchanged. A shared package cannot work across the two repos, so a change in the hub is
copied here by hand (and this note updated).

sha256 at the copy:

- `tokens.css` f13d50e6871538dd5bb75916bcb7a0dddbcd355cc977b14e30be96a126d662f0
- `theme.css` 0934ac48776fd41415532763b076fbc7ecc7e6baa74eb0d157247ea4379fb418

The Button and Input components in `src/lib/components/ui/` and `src/fonts.css` are copied from the hub's `apps/web` at the
same commit (shadcn-svelte, neutral base colour, styled to the tokens).

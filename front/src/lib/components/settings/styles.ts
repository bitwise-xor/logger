/**
 * The few class lists Settings' tabs share (deploy 111), so the seven pages look alike: a card, its heading, a quiet line, a field,
 * the buttons (44 px on phones and tablets), a refusal next to its form, a small table.
 */
export const S = {
  card: 'flex min-w-0 flex-col gap-2.5 rounded-card border border-line bg-panel p-3',
  quiet: 'flex min-w-0 flex-col gap-2 rounded-card border border-dashed border-line p-3',
  h2: 'm-0 text-[15px] font-semibold',
  label: 'm-0 text-xs font-medium tracking-wider text-muted uppercase',
  note: 'm-0 text-[13px] text-muted',
  field: 'h-11 w-full min-w-0 rounded-lg border border-line bg-panel2 px-3 text-base text-text desktop:h-10 desktop:text-sm',
  /** A short field with its own width (w-16, w-20): the same look without w-full. */
  short: 'h-11 min-w-0 rounded-lg border border-line bg-panel2 px-3 text-base text-text desktop:h-10 desktop:text-sm',
  fieldLabel: 'flex min-w-0 flex-col gap-1 text-xs text-muted',
  primary: 'inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg border-0 bg-text px-4 font-medium text-bg disabled:cursor-default disabled:opacity-60 desktop:min-h-9',
  plain: 'inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg border border-line bg-panel px-4 font-medium text-text hover:bg-panel2 disabled:cursor-default disabled:opacity-60 desktop:min-h-9',
  refusal: 'm-0 text-[13px] font-medium text-amber',
  table: 'w-full border-collapse text-[13px] [&_td]:border-b [&_td]:border-line [&_td]:px-1.5 [&_td]:py-[7px] [&_td]:text-right [&_td]:whitespace-nowrap [&_td:first-child]:pl-0 [&_td:first-child]:text-left [&_td:last-child]:pr-0 [&_th]:border-b [&_th]:border-line [&_th]:px-1.5 [&_th]:py-1.5 [&_th]:text-right [&_th]:text-xs [&_th]:font-medium [&_th]:whitespace-nowrap [&_th]:text-muted [&_th:first-child]:pl-0 [&_th:first-child]:text-left [&_th:last-child]:pr-0 [&_tr:last-child_td]:border-b-0',
  tag: 'inline-flex items-center rounded-[5px] border border-line px-1.5 font-mono text-[11px] leading-[18px] font-normal whitespace-nowrap text-muted',
  pill: 'inline-flex items-center rounded-full bg-blue-bg px-2 py-px text-xs font-normal whitespace-nowrap text-blue',
  /** The page under the header: one column; on the PC 640 px, or 1000 px for the wide tabs (Food targets, Today page). */
  main: 'flex w-full min-w-0 flex-col gap-3 desktop:max-w-[640px]',
  wide: 'flex w-full min-w-0 flex-col gap-3 desktop:max-w-[1000px]',
};

// The container's health check (compose.yaml): this server runs. It does not call the core.
// Since deploy 92 the Health page lives at the same path (+page.svelte here): SvelteKit gives a browser (Accept: text/html) the
// page and its form posts the page's actions; the check's fetch (Accept: */*) gets this plain "ok", as before.
export const GET = () => new Response('ok', { headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' } });

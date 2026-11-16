// The container's health check (compose.yaml): this server runs. It does not call the core.
export const GET = () => new Response('ok', { headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' } });

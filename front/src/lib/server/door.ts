/**
 * The door client: the only way this app reaches Logger's core. It calls the JSON door `/api/v1` (docs/API.md) at
 * `http://logger-v2-core:8000` over the Docker network, with the service token in `X-Front-Token` and, once signed in,
 * the owner's session as a bearer token.
 *
 * It passes on no browser headers: a call takes a path, a session and a body, never a request or headers, and builds its
 * own few headers. So no cookie, `X-Forwarded-*`, `CF-*` or `User-Agent` of the browser ever reaches the core (the door
 * answers 404 to proxy headers, and the browser's user agent travels only as a field of the sign-in body). The global
 * `fetch` is used, not SvelteKit's `event.fetch`, which would copy the browser's cookies onto same-site calls.
 *
 * Plain TypeScript with no SvelteKit import, so the tests can hand it a fake `fetch`.
 */

export type Fetch = (input: URL, init: RequestInit) => Promise<Response>;

export interface DoorConfig {
  /** The core's address inside Docker: http://logger-v2-core:8000 (the door accepts only that Host). */
  url: string;
  /** FRONT_TOKEN, the same value the core has. Empty: the door is off, nothing is called. */
  token: string;
  fetch?: Fetch;
  /** How long a call may take. /log can wait for the AI for about 40 s, so it passes its own. */
  timeoutMs?: number;
}

export interface CallOptions {
  /** The owner's session token (the session cookie); left out for the sign-in. */
  session?: string | null;
  /** Sent as JSON. */
  body?: Record<string, unknown>;
  query?: Record<string, string | undefined>;
  timeoutMs?: number;
}

export interface DoorAnswer<T> {
  status: number;
  body: T;
  /** X-Session-Expires: the session's end (ISO, UTC), sent on every signed-in answer. */
  expiresAt: string | null;
}

/** The door's error codes (docs/API.md), plus three of this client: door_off, unreachable, unreadable. */
export class DoorError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'DoorError';
  }
}

export const DEFAULT_TIMEOUT_MS = 15_000;

// A path under /api/v1: lower-case words and slashes only, so no "..", query, host or scheme can slip in.
const PATH = /^(\/[a-z0-9_-]+)+$/;

export async function call<T>(
  config: DoorConfig,
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  options: CallOptions = {},
): Promise<DoorAnswer<T>> {
  if (!config.token) throw new DoorError(0, 'door_off', 'The new front end is not switched on yet.');
  if (!PATH.test(path)) throw new DoorError(0, 'bad_path', `Not a door path: ${path}`);

  const url = new URL(`/api/v1${path}`, config.url);
  for (const [name, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined && value !== '') url.searchParams.set(name, value);
  }

  // Built here and nowhere else: these are the only headers the core ever gets from this app.
  const headers: Record<string, string> = { 'X-Front-Token': config.token, Accept: 'application/json' };
  if (options.session) headers.Authorization = `Bearer ${options.session}`;
  let body: string | undefined;
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }

  let response: Response;
  try {
    response = await (config.fetch ?? fetch)(url, {
      method,
      headers,
      body,
      redirect: 'error',
      cache: 'no-store',
      signal: AbortSignal.timeout(options.timeoutMs ?? config.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });
  } catch {
    throw new DoorError(0, 'unreachable', 'The logger is not answering right now.');
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    throw new DoorError(response.status, 'unreadable', 'The logger answered in a way this page cannot read.');
  }
  if (!response.ok) {
    const err = (json ?? {}) as { error?: unknown; message?: unknown };
    throw new DoorError(
      response.status,
      typeof err.error === 'string' ? err.error : 'server_error',
      typeof err.message === 'string' ? err.message : 'The logger could not do that.',
    );
  }
  return { status: response.status, body: json as T, expiresAt: response.headers.get('X-Session-Expires') };
}

/** The door with its settings bound: door.get('/day', session, {day}), door.post('/water', session, {...}). */
export function makeDoor(config: DoorConfig) {
  return {
    get: <T>(path: string, session: string | null, query?: CallOptions['query']) =>
      call<T>(config, 'GET', path, { session, query }),
    post: <T>(path: string, session: string | null, body: Record<string, unknown>, timeoutMs?: number) =>
      call<T>(config, 'POST', path, { session, body, timeoutMs }),
    del: <T>(path: string, session: string | null) => call<T>(config, 'DELETE', path, { session }),
  };
}

export type Door = ReturnType<typeof makeDoor>;

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
  /** Sent as multipart/form-data instead (deploy 90: the label photos for POST /food/label); fetch sets its boundary. */
  form?: FormData;
  query?: Record<string, string | undefined>;
  timeoutMs?: number;
}

export interface DoorAnswer<T> {
  status: number;
  body: T;
  /** X-Session-Expires: the session's end (ISO, UTC), sent on every signed-in answer. */
  expiresAt: string | null;
}

/** The door's error codes (docs/API.md), plus four of this client: door_off, unreachable (nothing sent), no_answer (sent, no answer), unreadable. */
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

/** The one fetch of a door call: the checks, the few headers this app builds, the timeout; a network failure is `unreachable` or `no_answer`. */
async function send(config: DoorConfig, method: 'GET' | 'POST' | 'DELETE', path: string, options: CallOptions, accept: string): Promise<Response> {
  if (!config.token) throw new DoorError(0, 'door_off', 'The new front end is not switched on yet.');
  if (!PATH.test(path)) throw new DoorError(0, 'bad_path', `Not a door path: ${path}`);

  const url = new URL(`/api/v1${path}`, config.url);
  for (const [name, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined && value !== '') url.searchParams.set(name, value);
  }

  // Built here and nowhere else: these are the only headers the core ever gets from this app.
  const headers: Record<string, string> = { 'X-Front-Token': config.token, Accept: accept };
  if (options.session) headers.Authorization = `Bearer ${options.session}`;
  let body: string | FormData | undefined;
  if (options.form !== undefined) {
    body = options.form;
  } else if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }

  try {
    return await (config.fetch ?? fetch)(url, {
      method,
      headers,
      body,
      redirect: 'error',
      cache: 'no-store',
      signal: AbortSignal.timeout(options.timeoutMs ?? config.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });
  } catch (error) {
    // Web 65 (21.11.2026): the connection refused or the core's name not found means nothing reached the core, so nothing was saved
    // (`unreachable`). A timeout or a connection dropped after the call went out leaves it open whether the core got it (`no_answer`).
    if (notSent(error)) throw new DoorError(0, 'unreachable', 'The logger is not answering right now.');
    throw new DoorError(0, 'no_answer', 'The logger did not answer in time.');
  }
}

/** Network errors that come before anything is sent: no connection was made (Node's fetch puts the reason in `cause.code`). */
const NOT_SENT = new Set(['ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', 'EHOSTUNREACH', 'ENETUNREACH', 'UND_ERR_CONNECT_TIMEOUT']);

/** Whether a failed fetch certainly sent nothing: its cause (or every cause of several tried addresses) is one of NOT_SENT. */
export function notSent(error: unknown): boolean {
  const codes = (e: unknown): string[] => {
    if (!e || typeof e !== 'object') return [];
    const x = e as { code?: unknown; errors?: unknown; cause?: unknown };
    if (typeof x.code === 'string') return [x.code];
    if (Array.isArray(x.errors)) return x.errors.flatMap(codes);
    return [];
  };
  const found = codes((error as { cause?: unknown } | null)?.cause);
  return found.length > 0 && found.every((c) => NOT_SENT.has(c));
}

/** A door error's JSON as a DoorError (the door answers its errors as JSON everywhere, the export too). */
async function errorOf(response: Response): Promise<DoorError> {
  let json: unknown;
  try {
    json = await response.json();
  } catch {
    return new DoorError(response.status, 'unreadable', 'The logger answered in a way this page cannot read.');
  }
  const err = (json ?? {}) as { error?: unknown; message?: unknown };
  return new DoorError(
    response.status,
    typeof err.error === 'string' ? err.error : 'server_error',
    typeof err.message === 'string' ? err.message : 'The logger could not do that.',
  );
}

export async function call<T>(
  config: DoorConfig,
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  options: CallOptions = {},
): Promise<DoorAnswer<T>> {
  const response = await send(config, method, path, options, 'application/json');
  if (!response.ok) throw await errorOf(response);
  let json: unknown;
  try {
    json = await response.json();
  } catch {
    throw new DoorError(response.status, 'unreadable', 'The logger answered in a way this page cannot read.');
  }
  return { status: response.status, body: json as T, expiresAt: response.headers.get('X-Session-Expires') };
}

/** A file the door answers with (deploy 111: POST /export's ZIP): its bytes and the headers that say what it is. */
export interface DoorFile {
  status: number;
  bytes: ArrayBuffer;
  contentType: string | null;
  disposition: string | null;
  expiresAt: string | null;
}

/**
 * A POST answered with a file, not JSON (only POST /export, docs/API.md): the same token, session, timeout and errors as `call`
 * (an error is the door's JSON); a JSON answer where a file was asked for is `unreadable`.
 */
export async function callFile(config: DoorConfig, path: string, options: CallOptions = {}): Promise<DoorFile> {
  const response = await send(config, 'POST', path, options, 'application/zip, application/json');
  if (!response.ok) throw await errorOf(response);
  const contentType = response.headers.get('Content-Type');
  if (!contentType || /json/i.test(contentType)) throw new DoorError(response.status, 'unreadable', 'The logger answered in a way this page cannot read.');
  let bytes: ArrayBuffer;
  try {
    bytes = await response.arrayBuffer();
  } catch {
    throw new DoorError(0, 'unreachable', 'The logger is not answering right now.');
  }
  return { status: response.status, bytes, contentType, disposition: response.headers.get('Content-Disposition'), expiresAt: response.headers.get('X-Session-Expires') };
}

/** The door with its settings bound: door.get('/day', session, {day}), door.post('/water', session, {...}). */
export function makeDoor(config: DoorConfig) {
  return {
    get: <T>(path: string, session: string | null, query?: CallOptions['query']) =>
      call<T>(config, 'GET', path, { session, query }),
    post: <T>(path: string, session: string | null, body: Record<string, unknown>, timeoutMs?: number) =>
      call<T>(config, 'POST', path, { session, body, timeoutMs }),
    del: <T>(path: string, session: string | null) => call<T>(config, 'DELETE', path, { session }),
    /** A multipart POST (deploy 90: the label photos, read by the AI, so it passes its own time). */
    postForm: <T>(path: string, session: string | null, form: FormData, timeoutMs?: number) =>
      call<T>(config, 'POST', path, { session, form, timeoutMs }),
    /** A POST answered with a file (deploy 111: the export's ZIP, made in up to a minute). */
    postFile: (path: string, session: string | null, body: Record<string, unknown>, timeoutMs = 60_000) =>
      callFile(config, path, { session, body, timeoutMs }),
  };
}

export type Door = ReturnType<typeof makeDoor>;

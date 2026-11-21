// The door client against a faked network: the token header, no browser headers, errors, the session's end.
import { describe, expect, it } from 'vitest';
import { call, DoorError, type Fetch, makeDoor } from './door.js';

const TOKEN = 'f'.repeat(40);
const SESSION = 's'.repeat(43);
const URL_ = 'http://logger-v2-core:8000';

interface Seen {
  url: URL;
  init: RequestInit;
  headers: Record<string, string>;
}

function fake(status = 200, body: unknown = { v: 1 }, headers: Record<string, string> = {}) {
  const seen: Seen[] = [];
  const fetch: Fetch = async (url, init) => {
    seen.push({ url, init, headers: { ...(init.headers as Record<string, string>) } });
    return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json', ...headers },
    });
  };
  return { fetch, seen };
}

describe('the door client', () => {
  it('sends the service token and nothing of the browser', async () => {
    const net = fake();
    await call({ url: URL_, token: TOKEN, fetch: net.fetch }, 'GET', '/day', { session: SESSION });
    const [c] = net.seen;
    expect(c!.url.href).toBe('http://logger-v2-core:8000/api/v1/day');
    expect(c!.url.host).toBe('logger-v2-core:8000'); // the Host the door accepts
    expect(c!.headers).toEqual({
      'X-Front-Token': TOKEN,
      Accept: 'application/json',
      Authorization: `Bearer ${SESSION}`,
    });
    expect(c!.init.method).toBe('GET');
    expect(c!.init.redirect).toBe('error');
    expect(c!.init.body).toBeUndefined();
  });

  it('has no way to pass on headers, even when a caller tries', async () => {
    const net = fake();
    const sneaky = {
      session: SESSION,
      headers: { cookie: 'a=b', 'x-forwarded-for': '1.2.3.4', 'cf-ray': 'x', 'user-agent': 'Browser' },
    };
    await call({ url: URL_, token: TOKEN, fetch: net.fetch }, 'GET', '/day', sneaky as never);
    const names = Object.keys(net.seen[0]!.headers).map((n) => n.toLowerCase());
    expect(names.sort()).toEqual(['accept', 'authorization', 'x-front-token']);
  });

  it('leaves out the bearer for the sign-in, and sends a body as JSON', async () => {
    const net = fake(201, { v: 1, token: SESSION });
    await makeDoor({ url: URL_, token: TOKEN, fetch: net.fetch }).post('/session', null, { password: 'p', code: '1' });
    const [c] = net.seen;
    expect(c!.headers).toEqual({ 'X-Front-Token': TOKEN, Accept: 'application/json', 'Content-Type': 'application/json' });
    expect(c!.init.method).toBe('POST');
    expect(JSON.parse(c!.init.body as string)).toEqual({ password: 'p', code: '1' });
  });

  it('puts the query on the address, without empty values', async () => {
    const net = fake();
    await makeDoor({ url: URL_, token: TOKEN, fetch: net.fetch }).get('/food/day', SESSION, { day: '2026-01-31', x: '' });
    expect(net.seen[0]!.url.search).toBe('?day=2026-01-31');
  });

  it('calls nothing while the door is off (no token)', async () => {
    const net = fake();
    await expect(call({ url: URL_, token: '', fetch: net.fetch }, 'GET', '/day')).rejects.toMatchObject({
      code: 'door_off',
    });
    expect(net.seen).toHaveLength(0);
  });

  it.each(['/../web/', '//evil.example/x', 'http://evil.example/', '/day?x=1', '/Day', ''])(
    'calls no path outside the door: %s',
    async (path) => {
      const net = fake();
      await expect(call({ url: URL_, token: TOKEN, fetch: net.fetch }, 'GET', path)).rejects.toMatchObject({
        code: 'bad_path',
      });
      expect(net.seen).toHaveLength(0);
    },
  );

  it("passes on the door's error code and message", async () => {
    const net = fake(401, { v: 1, error: 'signed_out', message: 'Sign in again.' });
    const err = await call({ url: URL_, token: TOKEN, fetch: net.fetch }, 'GET', '/day', { session: SESSION }).catch(
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(DoorError);
    expect(err).toMatchObject({ status: 401, code: 'signed_out', message: 'Sign in again.' });
  });

  it('says so when the core does not answer', async () => {
    const down: Fetch = async () => {
      throw new TypeError('fetch failed');
    };
    // No reason given: it is not known whether the call went out (Web 65).
    await expect(call({ url: URL_, token: TOKEN, fetch: down }, 'GET', '/day')).rejects.toMatchObject({ status: 0, code: 'no_answer' });
  });

  it('tells a connection that was never made (nothing sent) from one that got no answer (Web 65)', async () => {
    const failing = (cause: unknown): Fetch => async () => {
      throw new TypeError('fetch failed', { cause });
    };
    for (const code of ['ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', 'EHOSTUNREACH', 'UND_ERR_CONNECT_TIMEOUT']) {
      await expect(call({ url: URL_, token: TOKEN, fetch: failing({ code }) }, 'POST', '/water')).rejects.toMatchObject({ code: 'unreachable' });
    }
    // Several addresses tried, every one refused (Node puts them in an AggregateError's errors).
    await expect(
      call({ url: URL_, token: TOKEN, fetch: failing({ errors: [{ code: 'ECONNREFUSED' }, { code: 'ECONNREFUSED' }] }) }, 'POST', '/water'),
    ).rejects.toMatchObject({ code: 'unreachable' });
    // Dropped after the call went out: the core may have saved it.
    for (const cause of [{ code: 'ECONNRESET' }, { code: 'UND_ERR_SOCKET' }, { errors: [{ code: 'ECONNREFUSED' }, { code: 'ECONNRESET' }] }, null]) {
      await expect(call({ url: URL_, token: TOKEN, fetch: failing(cause) }, 'POST', '/water')).rejects.toMatchObject({ code: 'no_answer' });
    }
  });

  it('with the real fetch: a closed port is unreachable, a server that never answers is no_answer', async () => {
    const { createServer } = await import('node:net');
    const closed = await new Promise<number>((resolve) => {
      const srv = createServer();
      srv.listen(0, '127.0.0.1', () => {
        const port = (srv.address() as { port: number }).port;
        srv.close(() => resolve(port));
      });
    });
    await expect(call({ url: `http://127.0.0.1:${closed}`, token: TOKEN }, 'POST', '/water', { body: {} })).rejects.toMatchObject({ code: 'unreachable' });
    const silent = createServer(() => undefined); // takes the connection and never answers
    const port = await new Promise<number>((resolve) => silent.listen(0, '127.0.0.1', () => resolve((silent.address() as { port: number }).port)));
    try {
      await expect(call({ url: `http://127.0.0.1:${port}`, token: TOKEN, timeoutMs: 100 }, 'POST', '/water', { body: {} })).rejects.toMatchObject({
        code: 'no_answer',
      });
    } finally {
      silent.close();
    }
  });

  it('gives up after its time', async () => {
    const hang: Fetch = (_url, init) =>
      new Promise((_resolve, reject) => init.signal?.addEventListener('abort', () => reject(init.signal?.reason)));
    await expect(call({ url: URL_, token: TOKEN, fetch: hang, timeoutMs: 20 }, 'GET', '/day')).rejects.toMatchObject({
      code: 'no_answer',
    });
  });

  it('says so when the answer is not JSON', async () => {
    const net = fake(502, '<html>Bad gateway</html>');
    await expect(call({ url: URL_, token: TOKEN, fetch: net.fetch }, 'GET', '/day')).rejects.toMatchObject({
      status: 502,
      code: 'unreadable',
    });
  });

  it("hands back the session's end from X-Session-Expires", async () => {
    const end = '2026-12-16T09:00:00+00:00';
    const net = fake(200, { v: 1, signed_in: true }, { 'X-Session-Expires': end });
    const answer = await makeDoor({ url: URL_, token: TOKEN, fetch: net.fetch }).get('/session', SESSION);
    expect(answer).toEqual({ status: 200, body: { v: 1, signed_in: true }, expiresAt: end });
  });

  it('sends DELETE for the sign-out', async () => {
    const net = fake(200, { v: 1, outcome: 'signed_out' });
    await makeDoor({ url: URL_, token: TOKEN, fetch: net.fetch }).del('/session', SESSION);
    expect(net.seen[0]!.init.method).toBe('DELETE');
    expect(net.seen[0]!.headers.Authorization).toBe(`Bearer ${SESSION}`);
  });

  it('sends the label photos as multipart, with no JSON content type, and its own time (deploy 90)', async () => {
    const net = fake(200, { v: 1, ok: true });
    const form = new FormData();
    form.append('photo', new Blob([new Uint8Array([255, 216, 255])], { type: 'image/jpeg' }), 'label.jpg');
    form.append('photo', new Blob([new Uint8Array([255, 216, 255])], { type: 'image/jpeg' }), 'label.jpg');
    const r = await makeDoor({ url: URL_, token: TOKEN, fetch: net.fetch }).postForm('/food/label', SESSION, form, 60_000);
    expect(r.body).toEqual({ v: 1, ok: true });
    const seen = net.seen[0]!;
    expect(seen.url.pathname).toBe('/api/v1/food/label');
    expect(seen.init.method).toBe('POST');
    expect(seen.init.body).toBe(form);
    expect(seen.headers).toEqual({ 'X-Front-Token': TOKEN, Accept: 'application/json', Authorization: `Bearer ${SESSION}` });
  });
});

// Deploy 111: the export's ZIP, the one answer that is not JSON.
describe('a file from the door (POST /export)', () => {
  const zip = new Uint8Array([0x50, 0x4b, 0x05, 0x06, ...new Array(18).fill(0)]);
  function fileNet(status = 200, body: BodyInit = zip, headers: Record<string, string> = {}) {
    const seen: Seen[] = [];
    const fetch: Fetch = async (url, init) => {
      seen.push({ url, init, headers: { ...(init.headers as Record<string, string>) } });
      return new Response(body, { status, headers });
    };
    return { fetch, seen };
  }

  it('sends the token and the bearer as every call, the body as JSON, a minute to make it, and hands back the bytes and headers', async () => {
    const net = fileNet(200, zip, {
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="logger-export-17.11.2026.zip"',
      'X-Session-Expires': '2026-12-17T10:00:00+00:00',
    });
    const f = await makeDoor({ url: URL_, token: TOKEN, fetch: net.fetch }).postFile('/export', SESSION, { private: false });
    const [c] = net.seen;
    expect(c!.url.href).toBe('http://logger-v2-core:8000/api/v1/export');
    expect(c!.headers).toEqual({ 'X-Front-Token': TOKEN, Accept: 'application/zip, application/json', Authorization: `Bearer ${SESSION}`, 'Content-Type': 'application/json' });
    expect(c!.init.method).toBe('POST');
    expect(c!.init.body).toBe('{"private":false}');
    expect(new Uint8Array(f.bytes)).toEqual(zip);
    expect(f.contentType).toBe('application/zip');
    expect(f.disposition).toBe('attachment; filename="logger-export-17.11.2026.zip"');
    expect(f.expiresAt).toBe('2026-12-17T10:00:00+00:00');
  });

  it('turns the door\'s JSON error into a DoorError, and a JSON answer where a file was asked for into unreadable', async () => {
    const err = fileNet(500, JSON.stringify({ error: 'server_error', message: 'The export could not be made.' }), { 'Content-Type': 'application/json' });
    await expect(makeDoor({ url: URL_, token: TOKEN, fetch: err.fetch }).postFile('/export', SESSION, {})).rejects.toMatchObject({ status: 500, code: 'server_error' });
    const out = fileNet(401, JSON.stringify({ error: 'signed_out', message: 'Sign in again.' }), { 'Content-Type': 'application/json' });
    await expect(makeDoor({ url: URL_, token: TOKEN, fetch: out.fetch }).postFile('/export', SESSION, {})).rejects.toMatchObject({ code: 'signed_out' });
    const json = fileNet(200, '{"v":1}', { 'Content-Type': 'application/json' });
    await expect(makeDoor({ url: URL_, token: TOKEN, fetch: json.fetch }).postFile('/export', SESSION, {})).rejects.toMatchObject({ code: 'unreadable' });
  });

  it('is off without the token and unreachable when the network fails, as every call', async () => {
    await expect(makeDoor({ url: URL_, token: '' }).postFile('/export', SESSION, {})).rejects.toMatchObject({ code: 'door_off' });
    const down: Fetch = async () => {
      throw new TypeError('fetch failed');
    };
    await expect(makeDoor({ url: URL_, token: TOKEN, fetch: down }).postFile('/export', SESSION, {})).rejects.toBeInstanceOf(DoorError);
  });
});

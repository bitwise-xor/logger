// A stand-in for the core's JSON door (docs/API.md), for the page tests and the screenshots: the sign-in, the session and
// GET /day. Password "test", code "123456". GET /day answers with tests/samples/day.json, a real answer of the door that
// tests/test_front_samples.py writes (and checks against the door's shape on every Python test run). It also checks what the real door checks: the token, the Host-free
// call (no proxy headers) and the bearer. Usage: node tests/standin/door.mjs [port]  (FRONT_TOKEN from the environment)
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';

const port = Number(process.argv[2] ?? 8099);
const token = process.env.FRONT_TOKEN ?? '';
const sessions = new Set();
const PROXY = ['cf-ray', 'cf-connecting-ip', 'cf-visitor', 'x-forwarded-for', 'x-forwarded-host', 'x-forwarded-proto', 'forwarded', 'x-real-ip'];
const ends = () => new Date(Date.now() + 30 * 86400_000).toISOString();

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers });
  res.end(JSON.stringify({ v: 1, ...body }));
}

createServer(async (req, res) => {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  const seen = Object.keys(req.headers).sort().join(' ');
  console.log(`${req.method} ${req.url}  headers: ${seen}`);
  if (!token || req.headers['x-front-token'] !== token || PROXY.some((h) => h in req.headers)) {
    return send(res, 404, { error: 'not_found', message: 'Not found.' });
  }
  const bearer = (req.headers.authorization ?? '').replace(/^Bearer /, '');
  if (req.url === '/api/v1/session' && req.method === 'POST') {
    const body = JSON.parse(raw || '{}');
    if (body.password !== 'test' || body.code !== '123456') {
      return send(res, 401, { error: 'wrong_credentials', message: 'Wrong password or code.' });
    }
    const t = randomBytes(32).toString('base64url');
    sessions.add(t);
    return send(res, 201, { token: t, device: body.device ?? randomBytes(32).toString('base64url'), expires_at: ends() });
  }
  if (!sessions.has(bearer)) return send(res, 401, { error: 'signed_out', message: 'Sign in again.' });
  if (req.url === '/api/v1/session' && req.method === 'GET') {
    return send(res, 200, { signed_in: true, sid: '00000000-0000-0000-0000-000000000000', expires_at: ends() }, { 'X-Session-Expires': ends() });
  }
  if (req.url.startsWith('/api/v1/day') && req.method === 'GET') {
    const sample = JSON.parse(readFileSync(new URL('../samples/day.json', import.meta.url), 'utf8'));
    return send(res, 200, sample, { 'X-Session-Expires': ends() });
  }
  if (req.url === '/api/v1/session' && req.method === 'DELETE') {
    sessions.delete(bearer);
    return send(res, 200, { outcome: 'signed_out' });
  }
  return send(res, 404, { error: 'not_found', message: 'Not found.' });
}).listen(port, () => console.log(`stand-in door on ${port}`));

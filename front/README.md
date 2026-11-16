# The new front end (`logger.`)

A trial of Logger in the hub's look (SvelteKit, Svelte 5, Tailwind 4, shadcn-svelte neutral, the hub's tokens and Geist), at
`https://logger.19hospitalroad.fyi`, on the same live data as the web app at `app.`, which stays complete. Planned in the plan
doc's Current tab, "Plan: the SvelteKit front end (16.11.2026)", in six steps (deploys 78 to 83). Step A (deploy 78): this
skeleton, the sign-in and an empty Today.

## How it fits

Browser -> Caddy (`logger.`, home network and tailnet only; never in the Cloudflare tunnel) -> this container
`logger-v2-front` (port 3000, `proxy` network only) -> the core's JSON door `http://logger-v2-core:8000/api/v1`
(`docs/API.md`) -> the database. The browser never talks to the door; this container never touches the database.

- `src/lib/server/door.ts`: the door client. It sends `X-Front-Token` and, signed in, the session as a bearer; it passes on no
  browser headers.
- `src/lib/server/session.ts`, `signin.ts`: two `__Host-` cookies, httpOnly and Secure (the session, renewed from the
  door's `X-Session-Expires`; the device, which outlasts a sign-out).
- `src/routes/login`: password and authenticator code (the web app's own checks and limits). `src/routes/(app)`: the
  signed-in pages; the layout checks the session with the door on every page.
- `src/lib/tokens/`: the hub's tokens, copied (`SOURCE.md` says from where and when).
- `src/env.ts`: the settings (`DOOR_URL`, `FRONT_TOKEN`, `APP_URL`); `ORIGIN` and the memory cap are in `compose.yaml`.

## Commands (no Node on the VM: everything runs in the pinned Node container)

- `tools/front-pnpm install`, `tools/front-pnpm test` (vitest), `tools/front-pnpm check` (svelte-check), `tools/front-pnpm build`
- Screenshots (390 and 1280 px, dark and light) against the stand-in door, in the pinned Playwright container:
  build the image, run it on a throwaway network with `tests/standin/door.mjs` (password `test`, code `123456`) and
  `ORIGIN=http://localhost:3000` published on 127.0.0.1:3000, then `tools/front-screens http://localhost:3000 tests/screens/out`.
- Deploy: `tools/deploy-front.sh <N>` (the core: `tools/deploy.sh`). Rollback of deploy N:
  `docker tag logger-v2-front:front-fixesN logger-v2-front:pilot; docker compose up -d front`.

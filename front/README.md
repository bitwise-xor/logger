# The new front end (`logger.`)

A trial of Logger in the hub's look (SvelteKit, Svelte 5, Tailwind 4, shadcn-svelte neutral, the hub's tokens and Geist), at
`https://logger.19hospitalroad.fyi`, on the same live data as the web app at `app.`, which stays complete. Planned in the plan
doc's Current tab, "Plan: the SvelteKit front end (16.11.2026)", in six steps (deploys 78 to 83). Step A (deploy 78): this
skeleton, the sign-in and an empty Today. Step B (deploy 79): Today read-only from `GET /api/v1/day`, all its cards. Step C
(deploy 80): the taps save in place (water, Again and usual chips, habits, check-in, review, Health card, question buttons,
Try again / Delete for a message not read yet, Undo). Step D (deploy 81): the logging box.

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
- `src/lib/day.ts`: the door's Day shape and what Today makes of it (header line, kcal left, the timeline with meal labels, the
  Health card, what needs you); `src/lib/format.ts`: numbers and times as app. writes them (halves rounded to even, as Python).
  The cards are in `src/lib/components/today/`. The timeline leaves out the Health card's entries and the habit ticks.
- Saving in place (step C): every tap is a form posting to a form action of Today (`src/routes/(app)/+page.server.ts`);
  `src/lib/server/saves.ts` says which door route each calls with which body. In the browser `src/lib/saver.ts` posts the
  form with fetch: a new `key` per tap, only the newest answer counts when saves overlap, and a tap that meets a gone session
  is kept (sessionStorage, 10 minutes) and sent again with its key after the sign-in. `src/lib/today.svelte.ts` puts the
  answer's fresh day on screen (a new row gets a blue edge) and its head, tone, read-back (Yes = the same tap with
  `confirmed`) and Undo in the answer bar (`components/today/AnswerBar.svelte`; after a reload from GET /day's `undo`).
- The logging box (step D): `src/lib/components/today/LogBox.svelte`, above the tab bar on phones and at the top on the PC,
  text only (Enter sends, Shift+Enter is a new line; "Barcode and label: full app" links to app.). A line goes to the form
  action `log` (the door's `/log`, keyed, 60 s); `Today.log` shows a blue "being read" row meanwhile (a private or gratitude
  line as "Private line", never its words), then the answer as for a tap: the receipt with Undo, a held line or a question
  under Needs you, a look-up's `result`, "Saved privately." and nothing else. A typed line's read-back is a question under
  Needs you (the door's `/log` takes no `confirmed`). "Correct it" on a question and an answer's `refill` put the words back
  into the box. A line's answer is never dropped for a tap made while it was read (`SLOW` in `saver.ts`). Signed out
  mid-save, the line and its key are sent again after the sign-in; one kept over 10 minutes comes back into the box instead,
  and so do words that got no answer (sent again, they keep their key: `src/lib/logbox.ts`).
- `src/lib/tokens/`: the hub's tokens, copied (`SOURCE.md` says from where and when).
- `src/env.ts`: the settings (`DOOR_URL`, `FRONT_TOKEN`, `APP_URL`); `ORIGIN` and the memory cap are in `compose.yaml`.

## Commands (no Node on the VM: everything runs in the pinned Node container)

- `tools/front-pnpm install`, `tools/front-pnpm test` (vitest), `tools/front-pnpm check` (svelte-check), `tools/front-pnpm build`
- Page tests and screenshots (390 and 1280 px, dark and light) against the stand-in door, in the pinned Playwright container
  (`tests/screens/shoot.mjs` checks the numbers against the sample and throws on a difference):
  1. the stand-in on the host: `docker run -d --rm --name logger-front-standin --network host -e FRONT_TOKEN=<32+ characters>
     -v "$PWD/front":/work:ro -w /work <the Node image of tools/front-pnpm> node tests/standin/door.mjs 8099`
     (password `test`, code `123456`);
  2. `tools/front-pnpm build`, then `FRONT_PORTS=1 FRONT_ENV="DOOR_URL=http://host.docker.internal:8099 FRONT_TOKEN=<the same>
     ORIGIN=http://localhost:3000" tools/front-pnpm preview`;
  3. `tools/front-screens http://localhost:3000 tests/screens/out http://localhost:8099` (the last: the stand-in, which the
     checks reset before each run and sign out once, to see a tap sent again after the sign-in).
- The stand-in's `GET /day` starts as `tests/samples/day.json`, a real answer of the door for an invented day; its saves answer
  in the shape of `tests/samples/save.json` (a real "saved" and "needs_confirmation" answer, without their day) and change the
  day a little, as the core would; `/log` answers from `tests/samples/log.json` (real answers of a typed line: saved, a
  question, a change read back, a look-up, private, held), after a moment's "reading" (`door.mjs` says which words do what;
  POST `/standin/ai-down` and `/standin/ai-up` make it hold lines). `tests/test_front_samples.py` checks on every Python run that the samples still have the
  door's shape; after a change of the door, write it again with
  `WRITE_FRONT_SAMPLES=1 .venv/bin/python -m pytest -q tests/test_front_samples.py` and commit the diff.
- Deploy: `tools/deploy-front.sh <N>` (the core: `tools/deploy.sh`). Rollback of deploy N:
  `docker tag logger-v2-front:front-fixesN logger-v2-front:pilot; docker compose up -d front`.

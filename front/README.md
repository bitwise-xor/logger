# The new front end (`logger.`)

A trial of Logger in the hub's look (SvelteKit, Svelte 5, Tailwind 4, shadcn-svelte neutral, the hub's tokens and Geist), at
`https://logger.19hospitalroad.fyi`, on the same live data as the web app at `app.`, which stays complete. Planned in the plan
doc's Current tab, "Plan: the SvelteKit front end (16.11.2026)", in six steps (planned as deploys 78 to 83; they became 78 to
85 with two fixes at the owner's word). Step A (deploy 78): this
skeleton, the sign-in and an empty Today. Step B (deploy 79): Today read-only from `GET /api/v1/day`, all its cards. Step C
(deploy 80): the taps save in place (water, Again and usual chips, habits, check-in, review, Health card, question buttons,
Try again / Delete for a message not read yet, Undo). Step D (deploy 81): the logging box. Step E (deploy 84): the Food day.
Step F (deploy 85): polish (plain messages when the core is down or the door is off, back to your page after a sign-in, phone,
tablet and PC width). Then the trial runs (below). Deploy 87: the Usual meals page. Deploy 88: Today shows each food's and meal's macros, a pie of the day's kcal from protein, carbs and fat in the Energy card (app.'s macro colours, `--macro-*` in `app.css`), a one-line logging box that grows, and two habits per row.

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
- The Food day (step E): `src/routes/(app)/food` (`?day=yyyy-mm-dd` for an earlier day, a later one is today; `?open=f<id>`
  opens a row), reached from the Energy card's "Food day" and from a food row on Today (it opens that row). `src/lib/food.ts`:
  the four total tiles, the rows by meal (newest first, the drinks last, as Today's timeline: `newestFirst` in `day.ts`), the day
  switch and what a changed amount becomes; the cards in `src/lib/components/food/`. A row opens to change its amount (− and +),
  unit (the food's units from `GET /food/entry`, through `src/routes/(app)/food/entry/+server.ts`), time and food (another one
  from the catalogue, by its exact name), to add or remove its note, or to delete it: the form actions `food_entry` and
  `food_note` (`saves.ts`, `view: "food"` with the day shown), an odd value read back first (Yes = `confirmed`), Undo in the
  answer bar. The answer bar and the taps on their way are shared with Today (`src/lib/answers.svelte.ts`; the Food day's state
  is `src/lib/foodday.svelte.ts`). The logging box stays on Today ("+ Add food" leads to it); usual meals open in app.
- When the door cannot be asked (step F): `src/lib/problems.ts` tells three cases apart and words them for a page, a save and the
  sign-in. The door off (its 404 `not_found` to everything, or no `FRONT_TOKEN` here): app. still works, so the message links
  there. The core down (no answer: `unreachable`): app. is the same core, so it says to try again in a minute, with no link.
  Anything else (`server_error`, an answer this app cannot read): try again, or app. Today and the Food day show the message
  in place of the day (`components/ProblemCard.svelte`, with "Try again", which reloads), and the session cookie stays, so the
  page is back as soon as the door is. A save says "Not saved." with the same words (and "Open the full app" when the door is
  off). The sign-in page asks the door once before you type (GET /session without a session: its 401 is the good answer) and
  says the same above the form. Only a gone session (401 `signed_out`) leads to the sign-in page.
- After a sign-in, back to the page you were on: `?next=` on the sign-in page (`src/lib/next.ts` takes only a path of this app;
  anything else, the sign-in and sign-out pages included, is Today), e.g. `/login?next=%2Ffood%3Fday%3D2026-01-30`.
- Widths: below 1100 px (phones and tablets) the tab bar is at the bottom and the page is one column; from 1100 px (`desktop:`)
  the rail on the left and Today in two columns, up to 1440 px. Tap targets are 44 px on phones and tablets; the logging box
  and the answer bar leave room at the bottom (`--dock`), so they cover nothing.
- `src/lib/tokens/`: the hub's tokens, copied (`SOURCE.md` says from where and when).
- `src/env.ts`: the settings (`DOOR_URL`, `FRONT_TOKEN`, `APP_URL`); `ORIGIN` and the memory cap are in `compose.yaml`.

## Commands (no Node on the VM: everything runs in the pinned Node container)

- `tools/front-pnpm install`, `tools/front-pnpm test` (vitest), `tools/front-pnpm check` (svelte-check), `tools/front-pnpm build`
- Page tests and screenshots (390, 800 and 1280 px, dark and light) against the stand-in door, in the pinned Playwright container
  (`tests/screens/shoot.mjs` checks the numbers against the sample and throws on a difference):
  1. the stand-in on the host: `docker run -d --rm --name logger-front-standin --network host -e FRONT_TOKEN=<32+ characters>
     -v "$PWD/front":/work:ro -w /work <the Node image of tools/front-pnpm> node tests/standin/door.mjs 8099`
     (password `test`, code `123456`);
  2. `tools/front-pnpm build`, then `FRONT_PORTS=1 FRONT_ENV="DOOR_URL=http://host.docker.internal:8099 FRONT_TOKEN=<the same>
     ORIGIN=http://localhost:3000" tools/front-pnpm preview`;
  3. `tools/front-screens http://localhost:3000 tests/screens/out http://localhost:8099` (the last: the stand-in, which the
     checks reset before each run and sign out once, to see a tap sent again after the sign-in). Restart the preview after each
     build. The checks also play the core down and the door off (below), look for sideways scroll and tap targets under 44 px
     on phones and tablets, and sign in from `/food?day=…` to see that page come back.
- The stand-in's `GET /day` starts as `tests/samples/day.json`, a real answer of the door for an invented day; its saves answer
  in the shape of `tests/samples/save.json` (a real "saved" and "needs_confirmation" answer, without their day) and change the
  day a little, as the core would; `/log` answers from `tests/samples/log.json` (real answers of a typed line: saved, a
  question, a change read back, a look-up, private, held), after a moment's "reading" (`door.mjs` says which words do what;
  POST `/standin/ai-down` and `/standin/ai-up` make it hold lines). The Food day: `GET /food/day` is today's day above with the
  notes of `tests/samples/food.json` (real answers of the door: the day, the day before, an entry with its units, a change and a
  note), an earlier day is that file's day before, and `/food/entry` and `/food/note` change the day as the core would (an
  amount over 2000 g is read back first: a stand-in rule, to try the confirm). Deploy 87: `GET /usual` is
  `tests/samples/usual.json`'s list and three more meals made from the samples' foods, `GET /foods?q=` a catalogue of the
  samples' foods with `per_100`, and `/usual/meal`, `/usual/new` and `/usual/from_meal` change the list as the core would (its
  checks and words), with Undo. Step F: POST `/standin/core-down` (every
  door call gets no answer), `/standin/door-off` (every door call answers 404 `not_found`) and `/standin/up` (or `/standin/reset`). `tests/test_front_samples.py` checks on every Python run that the samples still have the
  door's shape; after a change of the door, write it again with
  `WRITE_FRONT_SAMPLES=1 .venv/bin/python -m pytest -q tests/test_front_samples.py` and commit the diff.
- Deploy: `tools/deploy-front.sh <N>` (the core: `tools/deploy.sh`). Rollback of deploy N:
  `docker tag logger-v2-front:front-fixesN logger-v2-front:pilot; docker compose up -d front`.

## The trial

From deploy 85 the trial runs: the owner uses `logger.` for Today and the Food day on the phone and the PC, next to `app.`,
which stays complete and is where everything else lives (Trends, Library, More, Settings, notifications; usual meals also
here since deploy 87). What to
look for: anything that differs from `app.` (numbers, a save that does not show up there), anything slow or unclear, and how the
two compare on the phone. Notes go into the plan doc; the decision about the rest of the app comes after it.
- If the front end misbehaves: roll back (`docker tag logger-v2-front:front-fixesN logger-v2-front:pilot; docker compose up -d
  front`) or stop it (`docker compose stop front`); `app.` does not depend on it. Switching the door off (empty `FRONT_TOKEN` in
  `.env`, one restart of the core) shows "switched off" on `logger.`.

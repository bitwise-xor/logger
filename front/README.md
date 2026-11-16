# The new front end (`logger.`)

A trial of Logger in the hub's look (SvelteKit, Svelte 5, Tailwind 4, shadcn-svelte neutral, the hub's tokens and Geist), at
`https://logger.19hospitalroad.fyi`, on the same live data as the web app at `app.`, which stays complete. Planned in the plan
doc's Current tab, "Plan: the SvelteKit front end (16.11.2026)", in six steps (planned as deploys 78 to 83; they became 78 to
85 with two fixes at the owner's word). Step A (deploy 78): this
skeleton, the sign-in and an empty Today. Step B (deploy 79): Today read-only from `GET /api/v1/day`, all its cards. Step C
(deploy 80): the taps save in place (water, Again and usual chips, habits, check-in, review, Health card, question buttons,
Try again / Delete for a message not read yet, Undo). Step D (deploy 81): the logging box. Step E (deploy 84): the Food day.
Step F (deploy 85): polish (plain messages when the core is down or the door is off, back to your page after a sign-in, phone,
tablet and PC width). Then the trial runs (below). Deploy 87: the Usual meals page. Deploy 88: Today shows each food's and meal's macros, a pie of the day's kcal from protein, carbs and fat in the Energy card (app.'s macro colours, `--macro-*` in `app.css`), a one-line logging box that grows, and two habits per row. Deploy 90: scan, label photo, look-up and voice in the logging box (step 1a of the move to `logger.`, below). Deploy 92: the Health page with body measurements (step 1b, below). Deploy 94: the Habits page (step 1c, below). Deploy 96: the Gym's Workout page, the Gym card on Today and the Spaces menu (step 2, below). Deploy 97: Gym's other five parts (below). Deploy 99: Home's Now and Pick pages with the timer, the Home card on Today and Home in the Spaces menu (step 3, below). Deploy 100: Home's other four pages (Zones, History, a chore's page, Edit zones).

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
  text (Enter sends, Shift+Enter is a new line; since deploy 90 also Scan and the microphone, below). A line goes to the form
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
- The scan sheet (deploy 90, the move's step 1a; the door's routes came with deploy 89): "Scan" in the logging box opens
  `src/lib/components/today/ScanSheet.svelte`, a dialog (full height on phones, above the tab bar and the box). The back camera
  reads EAN-13, EAN-8, UPC-A and UPC-E with app.'s zxing file (`static/zxing.min.js`, Apache 2.0, loaded on first use), or the
  digits are typed (8 to 14). A food of the catalogue: its last amount (− and +), a time, "Log" = the `again` save. Not in it:
  "Look it up on Open Food Facts" or "Photo of the label" (one to three photos of one package, made smaller in the browser as
  app.'s `shrink`: 1600 px, JPEG 0.85; thumbnails, each removable; read together; a failed read keeps them). Either fills a form
  to check (name, per 100 g or ml, kcal, protein, fat, carbs, the optional four, the reader's note, an amount and time to log it
  now); "Add to my foods" = the `labeladd` save (keyed; nothing is saved before it). The browser asks this app's routes
  `src/routes/(app)/scan/barcode`, `/off` and `/label` (`src/lib/server/scan.ts`: the photos checked as the door checks them,
  then passed on as multipart by `door.postForm`, 60 s; never kept); `BODY_SIZE_LIMIT` is 13 MB (`compose.yaml`). The rules are
  `src/lib/scan.ts`, the browser parts `src/lib/camera.ts`. "Look it up" sits on a food question of a typed line under Needs
  you (tool `log`, kind `food`, where app. shows it): the `lookup` save, read back as a new question answered with Yes or No.
  The microphone shows only where the browser has speech recognition; its words go into the box. Headers: `Permissions-Policy:
  camera=(self), microphone=(self)`, and the CSP allows `blob:` for images and media (the thumbnails, the camera).
- The Health page (deploy 92, the move's step 1b; the door's routes came with deploy 91): `src/routes/(app)/health`, from the
  Health card's "Health" link on Today. `?range=7|30|90` (30 without), `?all=1` every day of the range, `?measure=1` the body
  form open (`&mday=yyyy-mm-dd` an older session; Today's "Measure" and the table's Now lead there, `#body`). The load asks
  GET /health and GET /body together. Six charts (one column on phones, two from the tablet width): the door's five chart
  descriptions and the sleep times, drawn by the chart part (below). The entries, newest first (14, or all): on phones and
  tablets a row per day that opens to change (as a food row), from 1100 px app.'s table with a field per value; one Save per
  day sends only the changed rows (`health_day`: `src/lib/health.ts` has the rules, `healthValues` the door's `values`). A
  cleared value is asked first (Yes = `confirm_delete`), an odd one read back (Yes = `confirmed`): `HealthPage.yes` in
  `src/lib/healthpage.svelte.ts` (the shared answer bar got a `yes()` hook). The body card (`components/health/BodyCard.svelte`):
  last measured and due, Measure (a cm field per shown measure, the last value as the placeholder, only the changed ones sent:
  `body`), Now / Last / Start, a chip per measure with its chart, waist ÷ height and the weekly weight rate; the body settings
  stay at app. (the Settings link). A save's answer brings the read it changed (`view` "health" with the range and all, or
  "body"; Undo the one of the save it undoes). A new weight more than 5 kg from the last is the logger's own question: the bar
  says it waits under Needs you on Today. On Today: "Body measurements due" (`needs.body_due`) at the top of the review items,
  counted in Needs you as app. counts it with its To review items, with Measure and "Not today" (`body_skip`). The container's
  health check shares the path: `+server.ts` in the same folder answers the check's fetch, a browser gets the page.
- The Habits page (deploy 94, the move's step 1c; the door's routes came with deploy 93): `src/routes/(app)/habits`, from the Habits
  card's "Habits" link on Today and the Health page's last line. `?show=tracked|untracked|retired|all` (tracked without) is the filter of
  "Your habits". Today's ticks with "n of N done" (`components/today/HabitGrid.svelte`, shared with Today's card, two per row; the
  existing `habit` save asked for `view: "habits"`); the last 30 days: per tracked habit its label, "full/30" (or "n/30 without") and a
  strip of 30 squares that are not buttons; the habit's row opens its calendar in weeks, Monday first, cells of at least 44 px
  (`HabitCalendar.svelte`), where a day tap ticks or unticks it (`habit_day`; a twice-a-day habit shows "1/2"; a habit the read marks
  not editable opens read-only with a line why), Undo in the answer bar. "Your habits": the filter with counts, the habits by group with
  the stats line and the actions the read allows (Track or Untrack, Edit, Retire or Bring back, Delete asked once, then `confirmed`) and
  "+ New habit" (`habits_manage`): no Undo there, and a refusal is said next to its form, which keeps the words. Every tap has a new key
  and its button is blocked while it is on its way; `habit_day` is never sent again by the page, not even after a sign-in
  (`NEVER_RESENT` in `saver.ts`: the door does not replay a re-sent day tick). `src/lib/habits.ts` has the plain rules (weeks, cells,
  forms, counts), `habitspage.svelte.ts` the state. Hiding and ordering habits on Today and the reminders stay at app. (a line with a
  link to Settings). From 1100 px the ticks and the 30 days are on the left and "Your habits" on the right. The stand-in answers
  `/habits`, `/habit/day` and `/habits/manage` from `tests/samples/habits.json` and changes the data as the core would (POST
  `/standin/slow` slows day taps, `/standin/locked` marks Medication not editable); `SHOOT_ONLY=habits` (passed to the Playwright container with `-e`) runs only that page's checks.
- The Gym's Workout page (deploy 96, the move's step 2; the door's routes came with deploy 95): `src/routes/(app)/gym`, from Today's
  Gym card ("Open today's workout"), the More page and the PC rail. The title "Gym" with its parts (Workout · Plan · Progress · History ·
  Exercises · Activity; the row scrolls sideways inside itself; since deploy 97 all six are pages of this app, `GymParts.svelte`). Today's day of the split with its status, the chips to pick another day or Free workout (`gym_pick`, no Undo)
  and the "why" line; a row per exercise (`components/gym/GymRow.svelte`): the round button logs the read's ready numbers in one tap
  (`gym_tick`), takes a done exercise off (`gym_remove` with `exercise_id`: all of today's rows, as app.), or, where the read says
  the numbers are not ready, opens the row; the row opens to − and + (and typing) with the read's steps and limits, "Log" or "Add
  another row", and × per logged row (`gym_remove` with `set_id`). A tick and a remove have Undo; the logged row gets the blue edge.
  A tick's numbers are checked first in the door's words (`problem` in `src/lib/gym.ts`, a refusal in the answer bar); "+ Add
  exercise" (`gym_new`, `today: true`; a refusal next to the form, which keeps the words). "Other exercises (n)" folded, "This
  week's split" and "Last 4 weeks" (`GymSide.svelte`): under the list on phones and tablets, a right column of 340 px from 1100 px.
  Only `gym_tick` takes a key (a new one per tap); a button is blocked while its save is on the way, and no gym save is ever sent
  again by the page, also not after a sign-in (`NEVER_RESENT` in `saver.ts`). `src/lib/gym.ts` has the plain rules,
  `gympage.svelte.ts` the state. Today's Gym card (`components/today/GymCard.svelte`, from `day.gym`; none on a past day) sits under
  the day: today's day, the last workout, the 14 squares, "Last week n · this week n", "Open today's workout". The stand-in answers
  GET `/gym` and POST `/gym/tick`, `/gym/remove`, `/gym/pick`, `/gym/new` from `tests/samples/gym.json` and changes the data as the
  core would (Undo of a tick or a remove; POST `/standin/slow` slows ticks too); `SHOOT_ONLY=gym` runs only these checks.
- Gym's other five parts (deploy 97, step 2's last page deploy): `/gym/plan`, `/gym/exercises`, `/gym/progress?x=`, `/gym/activity?day=`
  and `/gym/history`, each from the parts row (the part you are in highlighted, no "full app" marks; Workout's "Edit" by "This week's
  split" goes to Plan). Plan (`PlanPage` in `planpage.svelte.ts`, `components/gym/PlanDay.svelte`, `PlanItem.svelte`): how the day is
  picked with the week's done days, a card per active day (two columns from 1100 px) with sets and reps per exercise (not cardio),
  up and down, take off (the only save of these parts with Undo), "+ Add exercise", "Rename or remove", "+ New workout day" and
  "Removed days" with Bring back. Exercises (`ExercisesPage`): kind, "also: words", use, Rename, Retire or Bring back, "+ New
  exercise" (open while the list is empty; not put on a day). A refusal is said next to its form, which keeps what was typed. Progress:
  the chips, the top number, the chart (the chart part), the last 6 sessions and "Workouts per week" as bars (`WeekBars.svelte`, from
  `per_week`); Activity (read only): the guide while the watch has sent nothing, else the day with its links, tiles, night, the watch's
  workouts and three 7-day charts; History: the last 60 workouts as cards with their anchors (`#w<id>`). None of the saves takes a key
  at the door; a button is blocked while its save is on the way and no gym save is ever sent again by the page, also not after a
  sign-in (`mayResend` in `saver.ts` refuses every `gym_` action). Plain rules: `src/lib/gymplan.ts`, `gymread.ts`; saves in
  `saves.ts` (`PLAN_SAVES`, `EXERCISES_SAVES`). The stand-in answers the five reads and the plan and exercise actions, changing the
  data as the core would (POST `/standin/watch-none`: no watch data; `/standin/gym-empty`: no exercises or days; `/standin/week-done`;
  `/standin/slow` slows every gym save); `SHOOT_ONLY=gymparts` runs only these checks.
- Home's first pages (deploy 99, the move's step 3; the door's routes came with deploy 98): `src/routes/(app)/home` (Now, `?min=`) and
  `/home/pick` (`?min=&n=`), from Today's Home card, the More page and the PC rail. Now: the title with the tabs Now · Zones · History
  (all three are pages of this app since deploy 100), then in app.'s order the timer card
  when a timer is open ("N:SS left" counting each second, "(paused)", "time is up", "Open the timer"), "How much time have you got?"
  (the chips are links to `?min=`; "Pick a job for me"), "This week", "Longest since last done" (six rows: the tick circle, "Chore ·
  Zone", "age · interval" in the door's words, minutes; "N hidden for today") and "Recently done"; from 1100 px This week and Recently
  done in a right column of 340 px. A tick (`home_tick`, keyed) fills at once with the blue edge, its button blocked while it is on its
  way; the answer bar has the door's words and Undo; the six rows keep their places after a save (`keepOrder`), so a second tap takes
  the tick back (the door's tick toggles). Pick: the job card (zone and age pills, "Job i of N", steps, how-to, the over note), the clock
  ("MM:00" and Start timer without a timer), Done, Another job, Not today, "Done it earlier?" (Yesterday, 2 days ago, a date) and "Also
  fits"; with a timer (its job and minutes come from the door) the clock counts down in the browser from the read's seconds left (every
  quarter second), the screen kept on by the browser's wake lock while it runs (asked again when the page comes back into view, let go
  at zero or when leaving), Pause or Resume, Done, "Done, next job" (running with 3 minutes or more left), Stop timer; at zero, without
  a reload, "Time is up · well done", Pause and "Done, next job" go and "Stop timer" reads "Finished"; no sound. When the page comes
  back into view it reads again (the end lives on the server). Every button saves in place (`home_start`, `home_pause`, `home_resume`,
  `home_stop`, `home_pickdone`, `home_picknext`, `home_skip`, `home_earlier`; `PICK_SAVES`); a refusal is said next to its button;
  "Done" ends on Now with its answer bar and Undo carried over; Not today and Done it earlier? stay on Pick with the next job. Only tick,
  pickdone, picknext and earlier take a key, and no Home save is ever sent again by the page, also not after a sign-in (`mayResend`
  refuses every `home_` action). Today's Home card (`components/today/HomeCard.svelte`, from `day.home`; none when it is null) sits
  right after Habits: "this week N of goal", "Waiting longest" with the label and "age · interval" (or "Nothing else is waiting
  today."), "N hidden for today", "15 minutes" and "Open Home". Plain rules: `src/lib/home.ts`; state: `homepage.svelte.ts`;
  components: `components/home/`. The stand-in answers `/home`, `/home/pick`, `Day.home` and the Pick and tick saves from
  `tests/samples/home.json` (POST `/standin/home-running`, `/standin/home-ending`, `/standin/home-paused`, `/standin/home-closed`,
  `/standin/home-empty`); `SHOOT_ONLY=home` runs only these checks.
- Home's other four pages (deploy 100, step 3's last page deploy): `/home/zones`, `/home/history?n=`, `/home/chore?id=` and `/home/edit`, from the tabs
  (the Zones tab is lit on Zones, Edit zones and, as a link back, a chore's page), "Show all N chores" and a chore's name (on Now, in a zone card, on
  a whole-flat chore's head); no mark for the full app is left on Home except the Storage zone's "sorting jobs in Todoist ›" (app.'s page). **Zones**
  (`ZonesPage` in `homezones.svelte.ts`, `components/home/StartCard`, `FlatCard`, `ZoneCard`): "Edit zones"; "When did you last do these?" (only when the
  door lists jobs: per job its label and interval and the chips This week, This month, Longer ago, Don't know = `home_startpoint`, keyed, Undo; the row
  leaves at once and comes back if refused; "N more jobs after these."); "Whole flat": per chore its name (its page), the per-zone line, "All done"
  (`home_alldone`, keyed, Undo; "All done ✓" once every zone is done today, a second tap takes it back) and tiles four to a row, tinted as the door
  says, a tap = `home_tick` (a second tap takes it back); a card per zone, folded or open as the door says (kept across saves), "N chores · oldest ...",
  rows as on Now (interval first, then the age), "no recurring chores". A tile and the same pair's row are one tap (both show it at once). From
  1100 px the starting points and Whole flat in the left column and the zone cards beside them. **History** (`HistoryPage`): "+ Add one done earlier"
  (a select of the door's jobs, a date between `earlier_days` ago and yesterday, `home_earlier`, keyed, Undo; a refusal next to the form), "Ticked lately"
  with "last N", a heading per day, rows with time (blank for a dated one), label, how and × (`home_remove`, no key, Undo; the row leaves at once),
  "Show more" (`?n=`) while the door says there is more, "Nothing ticked yet". **A chore's page**: "‹ Zones", name, meta, steps, how-to, "Edit" (to
  `/home/edit#chore-ID`, that chore's form open), "Last done" with "(starting point)" and "usually every N days", per zone for a whole-flat chore;
  an unknown or missing id says "That chore is not in the list." on the page (readGym's `missing`: the door's 404 `no_entry` or 400). Nothing saves
  there. **Edit zones** (`EditPage` in `homeedit.svelte.ts`, `components/home/edit/`): "Weekly goal" (`home_goalset`), "Whole flat", a card per zone
  (retired ones too, greyed, "· retired"), a chore opens its form (name, Where, every N days, minutes, steps one per line, how-to, other words =
  `home_choreedit`), "Retire" / "Bring back" (`home_choreactive`, `home_zoneactive` with "History stays."), "Per zone" for an active whole-flat chore
  (`home_chorezones`: the whole table, a zone left unticked is off, blank = the chore's own), "Rename or change the zone" (`home_zoneedit`),
  "+ New chore", "+ New zone" (`home_chorenew`, `home_zonenew`). None of these has Undo or a key; the forms are not checked by the browser
  (`novalidate`): the door's refusals (a name in use, a number out of range, ...) are said next to the form in the door's words and what was typed
  stays; only what the door would answer with a plain 400 is checked first (a number that is not whole, too many or too long lines or words:
  `choreProblem`, `zoneProblem` in `homeparts.ts`, with the limits of the read). Numbers are kept as typed text. No Home save is ever sent again by
  the page (`mayResend` refuses every `home_` action; `NEVER_RESENT` lists the keyed ones). Also: on Pick the three buttons of a timer no longer wrap
  at 390 px ("Stop timer" on its own row). Plain rules and the saves' fields: `src/lib/homeparts.ts`; saves in `saves.ts` (`ZONES_SAVES`,
  `HISTORY_SAVES`, `EDIT_SAVES`). The stand-in now keeps Home's zones and chores as Edit zones' sample has them and changes them as the core would
  (the pairs are worked out from them; History from the sample's rows): POST `/standin/home-many` (70 more history rows), `/standin/home-nohistory`,
  `/standin/home-bare` (two zones with no chore, one of them Storage); `SHOOT_ONLY=homeparts` runs only these checks.
- The Spaces menu (deploy 96): `src/lib/places.ts` says where a page belongs. The PC rail: Today, Trends, Library, then "Spaces"
  (Gym, Health, Habits, Home since deploy 99; the one you are in highlighted), then More. Phones and tablets keep four tabs; More is the page `/more`
  (`src/routes/(app)/more`): the Spaces as a list (Medical greyed, "soon"; Home since deploy 99), then one line that the rest is in the full app.
  On a Space's page the More tab is highlighted. Trends and Library stay greyed. Deploy 96 also fixed two things on the Habits page:
  after a day tick the open calendar is scrolled above the answer bar (phones and tablets), and app.'s "in the calendar below" is
  worded "in Last 30 days" (`helpText` in `habits.ts`).
- The chart part (deploy 92; for Trends and Gym too): `components/chart/Chart.svelte` draws a chart description of the door
  (`ChartData` in `src/lib/chart.ts`: `start`, `days`, `series` of `line`, `dot`, `ring`, `bar` with points `[day, value,
  text, base]`, and `lines`, `min`, `max`, `prefix`, `unit`, `decimals`, `band`, `pointLabels`, `xAtPoints`, `years`) as SVG,
  app.'s `drawChart` ported: `<Chart chart={…} legend={…} />`. The mouse shows a mark's text, a tap shows it in a box. The
  geometry is plain functions with tests (`chartLayout`, `niceTicks`, `nearestHit`, `tipBox`); colour keys `a`, `b`, `c`,
  `w`, `r` and the legend's `key` classes use `--chart-a`, `--chart-b`, `--chart-soft`, `--chart-warn` (`src/app.css`, dark
  and light). `components/chart/ClockRows.svelte` draws rows across 0 to 24 h (`clockLayout`: bands and ticks in minutes);
  `Legend.svelte` the colour keys alone. Nothing in them knows about health.
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
  checks and words), with Undo. Deploy 90: the scan routes from `tests/samples/scan.json` (`door.mjs` says which code and how many
  photos give which answer; POST `/standin/label-unreadable` fails the next read; a typed line with "mystery" asks a food
  question, to try "Look it up"). Step F: POST `/standin/core-down` (every
  door call gets no answer), `/standin/door-off` (every door call answers 404 `not_found`) and `/standin/up` (or `/standin/reset`). Deploy 92: GET
  `/health` and `/body` from `tests/samples/health.json` (range 7 and 90 cut or widen the sample's charts), POST `/health/day`
  and `/body` change the data as the core would (a clear asked first, an odd weight or sugar and a body jump of 4 cm read back,
  keyed, Undo), `/body/skip` takes Today's due line away (`door.mjs` says which values do what). `tests/test_front_samples.py` checks on every Python run that the samples still have the
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

# The new front end (`logger.`)

A trial of Logger in the hub's look (SvelteKit, Svelte 5, Tailwind 4, shadcn-svelte neutral, the hub's tokens and Geist), at
`https://logger.19hospitalroad.fyi`, on the same live data as the web app at `app.`, which stays complete. Planned in the plan
doc's Current tab, "Plan: the SvelteKit front end (16.11.2026)", in six steps (planned as deploys 78 to 83; they became 78 to
85 with two fixes at the owner's word). Step A (deploy 78): this
skeleton, the sign-in and an empty Today. Step B (deploy 79): Today read-only from `GET /api/v1/day`, all its cards. Step C
(deploy 80): the taps save in place (water, Again and usual chips, habits, check-in, review, Health card, question buttons,
Try again / Delete for a message not read yet, Undo). Step D (deploy 81): the logging box. Step E (deploy 84): the Food day.
Step F (deploy 85): polish (plain messages when the core is down or the door is off, back to your page after a sign-in, phone,
tablet and PC width). Then the trial runs (below). Deploy 87: the Usual meals page. Deploy 88: Today shows each food's and meal's macros, a pie of the day's kcal from protein, carbs and fat in the Energy card (app.'s macro colours, `--macro-*` in `app.css`), a one-line logging box that grows, and two habits per row. Deploy 90: scan, label photo, look-up and voice in the logging box (step 1a of the move to `logger.`, below). Deploy 92: the Health page with body measurements (step 1b, below). Deploy 94: the Habits page (step 1c, below). Deploy 96: the Gym's Workout page, the Gym card on Today and the Spaces menu (step 2, below). Deploy 97: Gym's other five parts (below). Deploy 99: Home's Now and Pick pages with the timer, the Home card on Today and Home in the Spaces menu (step 3, below). Deploy 100: Home's other four pages (Zones, History, a chore's page, Edit zones). Deploy 102: Trends' Week tab with the Week review; the Trends tab is live (below). Deploy 103: Trends' Charts and Insights tabs (step 4 done). Deploy 105: Library (the Library tab live). Deploy 106: Medical, a live Space with Reports, Tests over time and Medication (below). Deploy 105: Library (Foods, Usual meals, Habits, Exercises; the Library tab is live, below).

## How it fits

Browser -> Caddy (`logger.`, home network and tailnet only; never in the Cloudflare tunnel) -> this container
`logger-front` (port 3000, `proxy` network only) -> the core's JSON door `http://logger-core:8000/api/v1`
(`docs/API.md`) -> the database. The browser never talks to the door; this container never touches the database.

- `src/lib/server/door.ts`: the door client. It sends `X-Front-Token` and, signed in, the session as a bearer; it passes on no
  browser headers.
- `src/lib/server/session.ts`, `signin.ts`: two `__Host-` cookies, httpOnly and Secure (the session, renewed from the
  door's `X-Session-Expires`; the device, which outlasts a sign-out).
- `src/routes/login`: password and authenticator code (the web app's own checks and limits). `src/routes/(app)`: the
  signed-in pages; the layout checks the session with the door on every page.
- `src/lib/server/read.ts` (web item 72): the one read of the door for a page's load and the layout, `readDoor` (one read) and
  `readDoors` (several at once): the session renewed, a gone session to the sign-in page and back (`next`), any other trouble as a
  plain problem kind the page draws. Where pages differ it is an option: `notThere` (a 404 `no_entry` or a 400 as `missing`, the
  default, or as trouble: the older pages, Trends, Settings), `required` (an answer without its read is trouble), `together` (the
  Health page's two reads fail together; otherwise each answers for itself, as Trends' Charts). `readSettings` is Settings' tabs.
- `src/lib/day.ts`: the door's Day shape and what Today makes of it (header line, kcal left, the timeline with meal labels, the
  Health card, what needs you); `src/lib/format.ts`: numbers and times as app. writes them (halves rounded to even, as Python).
  The cards are in `src/lib/components/today/`. The timeline leaves out the Health card's entries and the habit ticks.
- Saving in place (step C): every tap is a form posting to a form action of Today (`src/routes/(app)/+page.server.ts`);
  `src/lib/server/saves.ts` says which door route each calls with which body. In the browser `src/lib/saver.ts` posts the
  form with fetch: a new `key` per tap, only the newest answer counts when saves overlap, and a tap that meets a gone session
  is kept (sessionStorage, 10 minutes) and sent again with its key after the sign-in. A tap that went out and got no answer (Web 65:
  the browser's wait, 20 s or 65 s for the saves the AI reads, a little longer than the server's for the door, ran out, the network
  dropped, or the server says the door did not answer in time: `no_answer` in `door.ts`, `unsure` in the answer) may have been saved:
  its key is kept for 10 minutes with a fingerprint of the tap (`logger-unanswered`, sessionStorage, never the words), the same tap
  again goes with that key and the door answers with the first answer, and the bar says "It may have been saved: try again, it will
  not be saved twice" (a save without a key, or one the core does not replay: a Habits page's day tap, its list forms, an untick:
  "reload the page to look before you try again"; `replays` in `problems.ts`). "Nothing was saved" only where that is
  certain: the phone offline before the send, the core's connection refused or its name not found, or an error of the door.
  **How each save behaves is one table** (web item 72): `src/lib/saverules.ts`, `SAVE_RULES`, one row per form action with its
  door path, its `key` (`none`; `replays`: the core answers a re-sent key with the first answer; `replays_tick`: the same but for an
  untick; `not_replayed`: a key goes along but the core does not replay it), `resend` (kept and sent again after a sign-in; only a
  keyed save), `long` (60 s at the server, 65 s in the browser), `slow` (its answer is never dropped for a newer tap's: the AI's
  saves), `coaching` (the paid start's own "no answer" words) and `pages` (at least one; `SAVE_PAGES` says which addresses each page
  is). Made from it: `KEYED`, `NEVER_RESENT`, `mayResend`, `SLOW`, `waitMs` in `saver.ts`, `replays` in `problems.ts`, and in
  `saves.ts` each save's path, key and timeout (`SAVES`) and every page's action list (`TODAY_SAVES`, `FOOD_SAVES`, …). **To add a
  save:** a row in `SAVE_RULES` (its pages named; the type check fails on none, and on `resend` without a key), its body (and check,
  or read first) under the same name in `BODIES` in `saves.ts` (the type check fails when the two sets of names differ), a page's
  `formActions(<its list>, …)` if the page is new (and the page in `SAVE_PAGES`), and its line in
  `src/lib/server/savebehaviour.test.ts`, which holds every save's behaviour as it was on 22.11.2026 and the three saves where the
  front sends a key the core does not use (`held_retry`, `held_delete`, `habits_manage`: harmless, see there). `src/lib/today.svelte.ts` puts the
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
  opens a row), reached from the Energy card's "Food day" (since deploy 117 a food row on Today opens in place instead). `src/lib/food.ts`:
  the four total tiles, the rows by meal (newest first, the drinks last, as Today's timeline: `newestFirst` in `day.ts`), the day
  switch and what a changed amount becomes; the cards in `src/lib/components/food/`. A row opens to change its amount (− and +),
  unit (the food's units from `GET /food/entry`, through `src/routes/(app)/food/entry/+server.ts`), time and food (another one
  from the catalogue, by its exact name), to add or remove its note, or to delete it: the form actions `food_entry` and
  `food_note` (`saves.ts`, `view: "food"` with the day shown), an odd value read back first (Yes = `confirmed`), Undo in the
  answer bar. The answer bar and the taps on their way are shared with Today (`src/lib/answers.svelte.ts`; the Food day's state
  is `src/lib/foodday.svelte.ts`). The logging box stays on Today ("+ Add food" leads to it); usual meals open in app.
- Today's food parts (deploy 117). Each food in Your day is one line: time, name with its amount (the portion's words after it),
  then protein, fat, carbs and kcal in four columns that stand under the meal's totals ("P 32", "F 14", "C 60", "420 kcal") on the
  meal's line (`timeline` in `day.ts`). A tap opens the row in place with the Food day's editor (`FoodEditor.svelte` takes a host,
  `src/lib/foodhost.ts`, which the Food day and Today both are; they share the entry cache; on Today the note comes with the entry);
  Today's form actions `food_entry` and `food_note` answer with the fresh Today. Each chip is one pill with two parts: the name
  logs at once; an Again chip's amount, or a usual meal's "…", opens a box under the chips (`src/lib/chipbox.ts`): another
  amount and a time (`again` with `time`), or a usual meal's foods ticked and their amounts with what they become (`usual` with
  `items` and `time`; the saved meal stays as it is). The logging box suggests foods after two letters, with app.'s rules
  (`src/lib/suggest.ts`, from `GET /foods/suggest` through `src/routes/(app)/foods/suggest`, read once on the first focus; none
  when it cannot be read): above the box on phones, under it on the PC. Card order: phones Needs you, Energy, chips, Your day,
  Habits, Health, Gym, Home, Coach, Gratitude; the PC has the chips and Your day on the left, the rest on the right in that order.
  The stand-in answers `GET /foods/suggest` (POST `/standin/suggest-off` makes it fail); `SHOOT_ONLY=todayparts` runs these checks.
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
  sign-in (no gym save is marked `resend` in `saverules.ts`). Plain rules: `src/lib/gymplan.ts`, `gymread.ts`; saves in
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
  pickdone, picknext and earlier take a key, and no Home save is ever sent again by the page, also not after a sign-in (no Home save
  is marked `resend` in `saverules.ts`). Today's Home card (`components/today/HomeCard.svelte`, from `day.home`; none when it is null) sits
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
  an unknown or missing id says "That chore is not in the list." on the page (`readDoor`'s `missing`, `src/lib/server/read.ts`: the door's 404 `no_entry` or 400). Nothing saves
  there. **Edit zones** (`EditPage` in `homeedit.svelte.ts`, `components/home/edit/`): "Weekly goal" (`home_goalset`), "Whole flat", a card per zone
  (retired ones too, greyed, "· retired"), a chore opens its form (name, Where, every N days, minutes, steps one per line, how-to, other words =
  `home_choreedit`), "Retire" / "Bring back" (`home_choreactive`, `home_zoneactive` with "History stays."), "Per zone" for an active whole-flat chore
  (`home_chorezones`: the whole table, a zone left unticked is off, blank = the chore's own), "Rename or change the zone" (`home_zoneedit`),
  "+ New chore", "+ New zone" (`home_chorenew`, `home_zonenew`). None of these has Undo or a key; the forms are not checked by the browser
  (`novalidate`): the door's refusals (a name in use, a number out of range, ...) are said next to the form in the door's words and what was typed
  stays; only what the door would answer with a plain 400 is checked first (a number that is not whole, too many or too long lines or words:
  `choreProblem`, `zoneProblem` in `homeparts.ts`, with the limits of the read). Numbers are kept as typed text. No Home save is ever sent again by
  the page (no Home save is marked `resend` in `saverules.ts`; `NEVER_RESENT` lists the keyed ones). Also: on Pick the three buttons of a timer no longer wrap
  at 390 px ("Stop timer" on its own row). Plain rules and the saves' fields: `src/lib/homeparts.ts`; saves in `saves.ts` (`ZONES_SAVES`,
  `HISTORY_SAVES`, `EDIT_SAVES`). The stand-in now keeps Home's zones and chores as Edit zones' sample has them and changes them as the core would
  (the pairs are worked out from them; History from the sample's rows): POST `/standin/home-many` (70 more history rows), `/standin/home-nohistory`,
  `/standin/home-bare` (two zones with no chore, one of them Storage); `SHOOT_ONLY=homeparts` runs only these checks.
- Trends' Week tab (deploy 102, the move's step 4; the door's routes came with deploy 101): `src/routes/(app)/trends` (`?p=7|last|30|this`, 7
  without or for anything else), from the Trends tab (a link since 102, lit on every `/trends` path: `placeOf` in `places.ts`). The title with
  the tabs Week · Charts · Insights (`components/trends/TrendsTabs.svelte`, `TRENDS_TABS` in `src/lib/week.ts`; all three are pages of this app since deploy 103), the four periods (links), the header line, the empty state
  (`empty_text`); then on phones and tablets the Week review, Food (four tiles: the meter's 100% line at 80% of the track, amber only for the
  door's warn level), Health and habits, Foods that count most (five rows, "Show all N") and The days (seven rows, "Show all N", "partly"); from
  1100 px Food, Health and habits and The days in the middle and the review and the foods in a 380 px column. The door's food charts are on the
  Charts tab (below). The Week review card (`ReviewCard.svelte`) in the door's words for its five states (not offered, none,
  working, done, failed). Its button is the form action `coach_start` (`saves.ts`: POST /coach/start, kind "week", the card's start and end,
  view "week" with view_p, 60 s): no key, never sent again by the page (not after a network error, not after a sign-in: `mayResend` refuses
  `coach_`), the button disabled from the press until the answer is in (`OneStart` in `week.ts`, state in `weekpage.svelte.ts`); the answer's
  head or refusal is said in the card. While a review is read the browser asks `src/routes/(app)/coach/status` (GET /coach/status; since deploy 109 shared with the Coach page and Today) every 5 s
  (`StatusPoll`), reads the week again in place (`invalidateAll`) when it is over, and after 5 minutes stops with "Taking longer than usual" and
  "Look again". The stand-in answers GET `/week`, `/coach/status` and POST `/coach/start` from `tests/samples/week.json` (POST
  `/standin/week?last=…&this=…&monday=1&latest=1&limit=1&foods=8&polls=n&fail=1` sets the states; GET `/standin/week-starts` counts the
  starts); `SHOOT_ONLY=trends` runs only these checks (the variable must reach the container: `docker run -e SHOOT_ONLY=…`; `tools/front-screens`
  does not pass it). Also on the Habits page: on the PC the page leaves room for the answer bar while it shows, so an open calendar's last week can
  be scrolled clear of it.
- Trends' Charts and Insights tabs (deploy 103, the move's step 4 done; read only, no save): `/trends/charts` (`?range=7|30|90`, 30 without or for anything
  else; `?x=<exercise id>`, a bad one dropped) and `/trends/insights`. Charts: the tabs, ONE range switch (links "7 days · 30 days · 90 days" that keep
  `x`; it drives Food, Health and Body, not Gym), the door's header words (`title`, `small` of GET /food/trends), then four sections: **Food** (the
  door's four cards, Calories, Protein, Fat, Carbs: title, stat parts, `Chart.svelte` with the door's description as it is, the legend; the card
  is `components/chart/ChartCardView.svelte`, which `HealthCharts` now uses too), **Health** (`HealthCharts` as on `/health`, with `twoFrom="desktop"`:
  one column up to the tablet width, two from 1100 px; the five charts and the sleep times), **Body** (`components/trends/BodyCharts.svelte`: a chart
  per measure from GET /body, three to a row from 1100 px; with none: "No measurements yet." with a link to the Health page and the door's `hint`),
  **Gym** (`ExerciseChips`, `ProgressCard` and `WeekBars`, shared with `/gym/progress`; the chips are links `?range=…&x=…` on this page; a line that
  it is the last 8 weeks whatever the range says). The four reads go together and each answers for itself (`readDoors` in `src/lib/server/read.ts`: a gone
  session still goes to the sign-in); a failing one shows its section's plain message (`ProblemCard`) and the others are drawn, all four failing
  the same way say it once. Insights (`?days=90|180|365`, 90 without or for anything else; web item 50): the range chips "90 days · 180 days · 365 days" built like
  Charts' (`insightRangeLinks`), the door's `small` line, the nine cards in the door's order (`InsightCard`: title, the corner chip in a
  neutral colour, the door's sentence with its two averages bold, `InsightBars`: a bar per group from `left` to `left + width` percent of its
  track, the first in `--chart-a`, the second in `--chart-b`, a thin line for zero when it is not at the left, then the door's `caveat` as a
  muted 13 px line when there is one), a card that waits is dashed with the
  door's "Not enough days yet" words and, smaller, its "It counts …" sentence (`waitParts` in `src/lib/trendscharts.ts`), and the door's note;
  one column up to the tablet width, two from 1100 px (three from 1500 px). Plain rules and the door's shapes: `src/lib/trendscharts.ts`. The
  stand-in answers GET `/food/trends` (the three ranges of `tests/samples/food_trends.json`, a bad range 400) and `/insights`
  (`tests/samples/insights.json` for every `days`, with that range's header line; a bad `days` 400); POST `/standin/trends?fail=food,health,body,gym,insights` makes those reads answer 500, POST `/standin/body-none`
  leaves no body session; `SHOOT_ONLY=trends` runs these checks too.
- Library (deploy 105, the move's step 5; the door's routes came with deploy 104): the Library tab is a link (lit on every `/library` path:
  `placeOf`), the title "Library" with the tabs Foods · Usual meals · Habits · Exercises (`components/library/LibraryHeader.svelte`,
  `LIBRARY_TABS` in `places.ts`), each its own page. **Foods** (`/library`, `?q=&f=all|drinks|new|review&s=<one of the eight orders>&food=N12`;
  `src/lib/catalogue.ts` the door's shapes and plain rules, `cataloguepage.svelte.ts` the state): GET /food/catalogue and, with `food`, GET
  /food/item at once (a 404 says "That food is not there any more." in place of the box, the list stays); the search (the door's placeholder;
  Enter, or 400 ms after the last key, keeping the focus: `goto` with `replace` and `reset: false`), the door's chips and eight orders, the
  count and the door's limit note, a row per food (`FoodRow.svelte`: ref, name, "review" and "drink", the words, kcal · P · F · C per 100 g or
  ml; from the tablet width Eaten, Last, Added); a row opens its box (`FoodBox.svelte`) under it on phones and tablets and in a 400 px column
  beside the list from 1100 px (Svelte's `MediaQuery`); a second tap or Close closes it. The box, in the door's words: the source line, the
  review bar with "Looks right" (`catalogue_reviewed`), the ten values (unknown = empty, "unknown"; a recipe food read only) with the door's
  "Also recalculate …" tick (off again after each save) and Save (`catalogue_values` with only the changed values: the door reads it back,
  the answer bar's "Yes, change" sends it again with `confirmed`, No drops it), the words (× and Add: `catalogue_words`), Name and use (name,
  Drink, Hide, Save: `catalogue_basics`; hidden, the box closes and the row goes), the units (`catalogue_unit`), the barcode
  (`catalogue_barcode`). Every save sends `view: "catalogue"` with view_q, view_f, view_s, view_food and puts the fresh Catalogue and box on
  screen; a refusal and "Nothing changed." are said next to their form, which keeps what was typed (a known value cleared, a value or a
  unit's weight that is not a number are said before sending, in app.'s words). None has a key or Undo, and none is ever sent again by the
  page (none is marked `resend` in `saverules.ts`). "+ New food": "Name or barcode" and "Look up" = Today's `lookup` save with view catalogue (the button
  says "Looking…"); its question's read-back comes in the answer bar with Yes and No (`yes()`/`no()` of `Answers`: the question's `answer`
  through POST /answer, view catalogue); Yes shows the new row with a blue edge (the door's Undo takes it out again). **Usual meals** moved to
  `/library/usual` unchanged in function (`/food/usual` redirects there with its query, 302; Today's Edit and the Food day link here; the
  search is `/library/usual/foods`). **Habits** (`/library/habits?show=`): the Habits page's "Your habits" card (`HabitsPage` with the path,
  `chips(h, base)`), the `habits_manage` saves, a line with the link to app.'s Settings; one column of 720 px at most (the Habits Space keeps
  its page). **Exercises** (`/library/exercises`): the Gym's list (`ExerciseList.svelte`, shared with `/gym/exercises`; `ExercisesPage` with
  the path). The stand-in answers GET `/food/catalogue`, `/food/item` and POST `/food/catalogue/<action>`, `/lookup` and `/answer` with view
  catalogue from `tests/samples/catalogue.json` (the samples' lists come out byte for byte); `SHOOT_ONLY=library` runs these checks. Also: the
  footer reads "Medical, Settings and the rest are in the full app"; `usual.test.ts` no longer has svelte-check errors.
- Library > Foods > Words (core item 24, 22.11.2026; the door's `GET /food/words`): the words review, `/library/words` (`?q=` the word or the food's
  name, at most 60 characters; `?shared=1` the chip "On more than one food"). Not a fifth tab (the four already scroll sideways on a phone): a
  link "Review words ›" beside the Foods count, and on the page "‹ Foods" with the Foods tab still lit (`LibraryHeader on="foods"`, `placeOf`
  lights Library for every `/library` path). The count line ("213 words", "1 word"; "4 words on more than one food", "2 words matching
  “bread”"; "500 of 650 words" with a line when the door cut the list at its 500), then the words by month under a small heading ("November
  2026"; "Earlier, date unknown" for a word with no date), newest first as the door sorts them: the word, the food's name as a link to its box
  in the Foods tab (`catalogueHref`), "12.11. · added in chat" (or "on the web", "by hand", "came with the food" when no change row says), an
  amber "also on 1 other food" when `shared` is above 1, and Remove (44 px). Remove is the Catalogue's `catalogue_words` save (`act` remove) asked
  for `view: "words"` with the page's search and chip (`WORDS_SAVES`, `viewFields` in `words.ts`): the answer brings the list again and the
  door's Undo of that word in the answer bar (only a save asked for this view has an Undo; the Foods tab's has none); a refusal or "Nothing
  changed." is said in the bar. `src/lib/words.ts` has the plain rules (address, groups, labels; `words.test.ts`), `wordspage.svelte.ts` the
  state (`WordsPage`, as the Catalogue's search). The stand-in answers GET `/food/words` and the save from `tests/samples/food_words.json` (POST
  `/standin/words-undated`: the words that came with their food have no date, which the door never answers today; `/standin/words-many`: 520
  more, for the cut list); `SHOOT_ONLY=words` runs these checks.
- **Medical** (deploy 106, step 5 continued; a live Space: the PC rail's Spaces group, `/more`, the More tab lit on every `/medical` page; `SPACES`
  has `href: '/medical'` and `MEDICAL_TABS` the tabs; the footer and More now say "Settings and the rest are in the full app"). Header "Medical" with
  Reports · Tests over time · Medication, each its own page (`MedicalHeader`; `src/lib/medical.ts` has the types, addresses, row lines and form rules
  with tests, the door's `/labs`, `/labs/tests`, `/labs/meds`; nothing of a value, test or medicine is logged). **Reports** (`/medical`, `?open=R12`): the
  flagged card (a chip per flagged value, each to `/medical/tests?t=`), all reports newest first, a report opens under its row on phones and tablets and
  in a column from 1100 px (`ReportBox`): a row per value (name linking to its test, note, value, range, flag, pencil), the pencil's form (value, unit,
  range: `labs_value` with only the changed fields, shown first, "Yes, change" in the answer bar sends it again with `confirmed`, No drops it), the notes
  and "Change date, title or notes" (`labs_report`, the same way). A refusal or "Nothing changed." is amber next to its form and keeps what was typed.
  **Tests over time** (`/medical/tests`, `?q=`, `?t=`), read only: the search (Enter or a pause, focus kept), the door's list, one test (phones and tablets:
  its own view with "‹ All tests", keeping q; from 1100 px beside the list) with the chart part drawing the door's chart object (band, dots by flag, a tap
  shows the door's words) or the thin-case message, and the history with "Report" to `/medical?open=R<id>`. The page reads the list and, with `t`, the
  test (two calls: the door's list is empty while a test is open); a search with one match opens it by itself and "‹ All tests" then goes to the list
  without q. **Medication** (`/medical/meds`): "Add a course" sends the sentence through Today's `log` save (same saver, answer bar and line keys) with
  view `labs_meds`; the read-back of its question comes in the bar with Yes and No (`answer` with the same view); the card with "n running" and a row per
  course in the door's order (pencil: `labs_med` act save, dates as date inputs, an empty stop = running; End: act end, "Yes, end it today"). None of
  `labs_value`, `labs_report`, `labs_med` has a key or Undo, and none is ever sent again by the page (none is marked `resend` in `saverules.ts`). The stand-in serves
  the three reads and the saves from `tests/samples/labs.json` (R1 to R3's values are invented; flags follow a range rule; POST `/standin/labs-empty`,
  `/standin/labs-novalues`, `/standin/labs-oneday`, `/standin/labs-end?id=1`); `SHOOT_ONLY=medical` runs these checks. All pages carry `Cache-Control:
  no-store` (`hooks.server.ts`, every response).
- More, Search, Recent and Usage (deploy 108; the door's routes came with deploy 107; read only, no save): `/more` has the search field (a plain GET form to
  `/search?q=`), the Spaces, a card with Coach, Recent, Usage and Settings, a quiet "Words" card (Ideas, Private and Gratitude link to app., each marked
  "app.") and Sign out (Today keeps its own); on the PC the rows, the Words and Sign out are on the left and the Spaces on the right. Settings
  still opens app. (its row carries a small "app." tag): `MORE_PLACES` in `src/lib/places.ts` has `here: null` for it, set to `'/settings'` with deploy 111, below (Coach is
  `'/coach'` since deploy 109, below). `placeOf()` lights More on `/search`, `/recent`, `/usage` and (deploy 109) `/coach` (phone bar and PC rail). Each of the three has
  a header with a back chevron to `/more` and the theme button, and a failed read shows `ProblemCard` with app.'s own page. **Search** (`?q=`,
  `src/lib/search.ts`): the door's five groups in its order with its titles and a count ("15+" when `more`), "none" for an empty group, the door's `hint` under
  two letters; a food opens in Library (`?q=&food=N<id>`), a meal on its Food day (`?day=&open=f<id>`), a workout on the Gym's History (`?w=<id>#w<id>`:
  the History page passes `w`, digits only, to the door, so an older workout has its card, marked), a chore on its page, a lab test on Tests over time
  (`?t=`); one quiet line sends thoughts to app. (`/web/search?q=`), none are searched here. **Recent** (`src/lib/recent.ts`): the days and messages, a private
  entry as the "Private" pill and its saved label only, "Use again" keeps the words in the tab's sessionStorage (`logger-use-again`, never the address) and goes
  to Today, whose logging box takes them once and clears them; "Open day" is `/food?day=`; an amber line when messages are not read yet. **Usage**
  (`?r=7|30|all`, `src/lib/usage.ts`): the door's range chips, the four tiles, "Cost per day" as the door's stacked bars through the chart part (Haiku grey,
  Sonnet and Opus two blues, the door's legend), "By kind" with the All row and notes, the most expensive messages, the note. The stand-in answers GET `/search`
  (the samples of `search.json`; "many" is a group cut at 15), `/recent`, `/usage` and `/gym/history?w=` (an unknown id comes as an older workout; POST
  `/standin/recent-none`, `/standin/usage-empty`); `SHOOT_ONLY=more` runs these checks (the variable must reach the container: `docker run -e SHOOT_ONLY=more`).
- Coach (deploy 109; the door's routes came with deploy 107): `/coach` (`?f=all|days|weeks`, `?day=yyyy-mm-dd`; `src/lib/coach.ts`) is More's Coach row (it has no
  "app." tag any more; `MORE_PLACES` in `places.ts`, More lit on `/coach`) with the back chevron and a failed read as `ProblemCard` with app.'s `/web/coach`. Top card
  "Coach a day": a date field (the door's `day`, none after today; another day reloads with `?day=`) and the door's card of that day in its four states (none: the intro,
  the button, the cost line; working: the wait and its note, no button; done: the meta line, the parts, the caution, "Coach me again"; failed: the notice, then the
  button). Then the chips All, Days and Weeks (links, keeping `day`), the list (heading, a "day" or "week" pill, the first line, the meta line; a row opens in place on
  phones and tablets and in a 460 px column beside the list from 1100 px; one at a time), the door's month line and note, and "Your goals ›". The door's `empty` words
  when nothing is there. `CoachParts.svelte` draws the parts of every coaching (Trends' Week review too, unchanged to look at): a note, a numbered list, a list, a day
  coaching's next meal (title, why, the kcal, protein, carbs and fat line) and `tone` "warn" (To improve) in amber. **Today's Coach card** (`day.coach`, null = no card, the
  Settings switch) is the same card without the date field, after the Home card on phones and last of the cards in the right column on the PC, with "All coachings ›"
  and "Your goals ›". **The button costs real money each time (about 6 cents), so it is sent once per press and never again by itself**: the form action `coach_day`
  (`saves.ts`: POST /coach/start, kind "day", the day twice, 60 s, no key; its pages in `saverules.ts` are Today and Coach: `TODAY_SAVES`, `COACH_SAVES`) is posted by the
  Saver, `OneStart` plus the busy flag (`coachrun.svelte.ts`; the button is also disabled) take a second press while one is on its way, `mayResend()` is false and `UNSURE` is
  set for `coach_` actions (`saver.ts`: nothing is kept for after a sign-in, nothing is retried after a network error, which says the coaching may have started). The answer
  brings the fresh Today (view "day") or Coach page (view "coach", `view_f`, `view_day`); its words, a refusal's reason too, are in the answer bar. While a card is working
  the page asks `src/routes/(app)/coach/status` (GET /coach/status, one route for Trends, the Coach page and Today: `coachpoll.svelte.ts`) every 5 s and reads itself again in
  place; after 5 minutes "Taking longer than usual" with Look again. The door's `/web/...` links are mapped in ONE function, `doorLink()` in `week.ts` (`/web/coach` is `/coach`,
  `?f=weeks` kept; Your goals stays app.'s `/web/settings?tab=coach` until Settings is here: `GOALS_HERE` is the one-line switch for deploy 111); Trends' "All coachings" opens the
  Coach page. The stand-in answers GET `/coach` (the lists of `tests/samples/coach.json`; days 13.11. working, 14.11. done, 15.11. failed, any other none), `coach` in GET `/day`,
  POST `/coach/start` kind "day" and `/coach/status` (POST `/standin/coach?polls=n&fail=1&limit=1&empty=1&off=1&day=…&state=…`; GET `/standin/coach-starts` counts the starts);
  `SHOOT_ONLY=coach` runs these checks (the variable must reach the container: `docker run -e SHOOT_ONLY=coach`).
- Settings (deploy 111; the door's routes came with 110): `/settings` (redirects to `/settings/targets`) with seven tabs, each its own page:
  `/settings/targets`, `/today`, `/body`, `/coach`, `/devices`, `/notifications`, `/export` (`SETTINGS_TABS` in `places.ts`; More's Settings row,
  More lit; `SettingsHeader.svelte`: back to More, the theme button, the tabs scrolling sideways inside their row on phones). Each reads GET
  `/settings/<tab>` (`readSettings` in `server/read.ts`; a failed read is `ProblemCard` with app.'s `/web/settings?tab=…`) and saves through form actions
  (`saves.ts`: `settings_targets`, `settings_today`, `settings_today_reset`, `settings_height`, `settings_body`, `settings_body_measure`, `settings_coach`, `settings_device`,
  `settings_others`, `settings_nudges`, `push_off`, `push_test`; no key, no Undo, never sent again by the page, none in Today's actions), each answer
  bringing the tab's fresh read (`settingspage.svelte.ts`). A form's refusal stands next to it in the door's words (a field that is no number is
  checked first, in app.'s words: `settings.ts`); the Today page tab saves every tap at once (a switch or an arrow posts the whole group; the list is the
  door's fresh read); "Show everything again" and "Sign out all others" are asked first in the answer bar. Export's Download is a plain form POST to
  `/settings/export/download` (`+server.ts`: the door's POST /export through `door.postFile`, the ZIP handed through with the door's Content-Type and
  Content-Disposition and no-store; a failure goes back to the tab with `?failed=1`). Core 37 (21.11.2026): ticking "Include private and
  gratitude entries" shows a field for the authenticator code, sent with the download (`exportCode` in `settings.ts`); the door's refusal
  of the code (a wrong or missing one, too many tries) comes back to the tab in the door's words, carried in a cookie read once
  (`__Host-logger-export-refused`, `?refused=1`; never the words in the address), the box still ticked. The stand-in takes `123456`. The "This device" card came with deploy 112 (below). Also with 111: no footer line any more; Habits, Library > Habits, Health's height and every
  "Your goals" (`GOALS_HERE`) open Settings here; Today hides the To review items (one line instead) and the Gratitude card when `day.shown` says so.
  Web 58 (22.11.2026): Settings > Body lists the body measures in the door's order (`measures`), each row with its landmark and range,
  the shown switch (saved with "Due every" by Save), up and down (saved at once) and Edit, which opens the form in place (name, where to
  measure, lowest and highest cm, other words as a comma list; Save, Cancel, Remove asked first in the answer bar and disabled with the
  door's `hints.remove` for a measure with values); "+ Add a measure" opens it empty with the door's `suggestions` as chips that fill it;
  one form at a time (`settings_body_measure`, `measureBody` in `settings.ts`: the measure's key travels as `measure`, since `key` is
  the page's re-send key). The front has no list of measures any more: the Health card's Measure form names its fields `cm_<key>` and
  lists them in `measures` (`bodyValues`, `bodyPost` in `health.ts`), and Today's "Change" link sends any measurement that is not one of
  the Health page's rows (`HEALTH_ROW_TYPES` in `day.ts`) to the body form. The stand-in answers `/settings/body_measure` with the
  core's checks and words (a clash with a few other types' names and words, the suggestions Neck and Calf); the samples have six
  measures (Neck added in Settings > Body).
  Web 70 (21.11.2026): the Nudges form and its save take the nudges from the door's list, never from a list written here, so a nudge the
  core adds later shows and saves: `settings_nudges` reads GET `/settings/notify` first (`before` in `saves.ts`; its failure says nothing
  was saved) and sends only the listed nudges' switches and hours, hours outside the door's min and max refused in plain words
  (`nudgesBody` in `settings.ts`). POST `/standin/settings?newnudge=1` adds such a nudge to the stand-in.
  The stand-in answers the seven reads and the saves from `tests/samples/settings.json`, POST `/export` with a small ZIP made there (POST
  `/standin/settings?export_fail=1&shown=0&noshown=1&nopush=1`; GET `/standin/push-tests`, `/standin/exports`); `SHOOT_ONLY=settings` runs these checks
  (the variable must reach the container: `docker run -e SHOOT_ONLY=settings`).
- The home-screen app and notifications from logger. (deploy 112). `static/manifest.webmanifest` ("Logger", id/start_url/scope "/",
  standalone, the dark background; app.'s icons copied to `static/`: icon-192/512.png, any and maskable, apple-touch-icon.png) and the
  head tags in `src/app.html` (manifest, apple-touch-icon, the apple-/mobile-web-app metas, two theme-color metas that `static/theme.js`
  and `lib/theme.svelte.ts` set to the chosen theme's background). `static/sw.js` is a plain worker as small as app.'s: push shows the
  core's `{title, body, url, tag}` (icon /icon-192.png); a tap opens a logger. page in an open logger. window (focus, then `navigate`;
  else a new window) and another address (the gratitude list at app.) in a new window as it came; `skipWaiting`/`clients.claim` so a
  new version takes over and open pages can be moved; no fetch handler, no caching, nothing offline. It is a static file, NOT SvelteKit's
  `src/service-worker` (none exists, so nothing registers it): it is registered only by "Turn on" in Settings > Notifications. That
  card, "This device" (`components/settings/ThisDevice.svelte`, the rules in `lib/pushdevice.ts`, which takes the browser's parts as
  arguments): not possible (no notifications in this browser, an iPhone outside the Home Screen app, the door's `public_key` null),
  blocked, off ("Turn on": the permission, `/sw.js` registered for "/" and ready, the subscription with the door's key, then the form
  action `push_subscribe`, which checks the shape and adds the browser's User-Agent before the door's `/push/subscribe`; refused or
  failed: the browser's subscription is ended again), on ("On since …", "Turn off on this device": `push_off` and the browser's
  unsubscribe). The CSP says `worker-src 'self'; manifest-src 'self'`. Static files come from adapter-node with an ETag and no
  Cache-Control (the browser checks a worker script for changes itself). Tests: `pushdevice.test.ts` (the states, the key, the order with
  fakes), `sw.test.ts` (sw.js run with a fake `self`); the stand-in answers POST `/push/subscribe` as the core (POST
  `/standin/settings?nothis=1&nokey=1`; GET `/standin/push-subscribed`); the screens check the files signed out, the tags, the manifest as
  Chromium reads it, no worker before a press, the real `/sw.js` registering under the real CSP, and the card with the browser's parts
  stubbed in the page (an iPhone's User-Agent). A real push cannot be sent from the test container: check on a phone.
- The Spaces menu (deploy 96): `src/lib/places.ts` says where a page belongs. The PC rail: Today, Trends, Library, then "Spaces"
  (Gym, Health, Habits, Home since deploy 99; the one you are in highlighted), then More. Phones and tablets keep four tabs; More is the page `/more`
  (`src/routes/(app)/more`): the Spaces as a list (Home since deploy 99, Medical since deploy 106: every Space is live).
  On a Space's page the More tab is highlighted. Trends and Library stayed greyed (Trends is live since deploy 102, its three tabs since 103; Library since 105). Deploy 96 also fixed two things on the Habits page:
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
- The hub's frame (20.11.2026): the hub (`HUB_ORIGIN`, `https://hub.19hospitalroad.fyi` without it) may show the
  signed-in pages in a frame: their CSP says `frame-ancestors 'self'` and the hub, and they have no X-Frame-Options
  (`src/lib/server/frame.ts`, called by `hooks.server.ts`). The sign-in, sign-out, Settings (it signs out devices) and every other
  answer keep `frame-ancestors 'none'` and `X-Frame-Options: DENY`. `?compact=1` is the compact view for it: `static/theme.js` sets
  `html.compact` before the first paint, and `src/app.css` hides the places (tab bar, rail) and every `[data-chrome]` part (Today's
  theme button and Sign out); the logging box and the answer bars move down to where the tab bar was (`--places-bar`). It is kept
  for the tab in sessionStorage and used again only inside a frame, so links and reloads in the frame stay compact; `?compact=0`
  ends it. Same data, same actions. The hub frames `https://logger.19hospitalroad.fyi/?compact=1`. The cookies are unchanged: the
  hub and `logger.` are one site, so the strict session cookie goes with the frame's requests. `SHOOT_ONLY=compact` runs its checks.
- **The Food space** (21.11.2026): Food is the first Space (`SPACES`, the rail and More; `placeOf` files `/food` and everything under it
  there, so the More tab is lit on phones), with the tabs Day · Nutrients · Notes (`FOOD_TABS`, `components/food/FoodHeader.svelte`
  with short links to Library > Foods and Usual meals; a `?day=` is carried from Day to Nutrients and back by `foodTabHref`). **Day**
  (`/food`): the Food day as before, its day switch now `components/food/DaySwitch.svelte` (‹, the day, › and a calendar button: the
  browser's date field laid over it, `showPicker`, never after today; idea 63), and a one-line note per meal: "Add note" (pencil) on the
  meal's line, the note under the line in the muted style of a food's note, a tap opens one field with Save, Remove, Cancel (the form
  action `food_mealnote`, the door's `POST /food/mealnote`, no key, no Undo; a refusal is said in the field); a meal note whose meals
  are all gone shows as "Note on this day" (`day_note`, saved as meal 0). Trends > Week > "The days" link to their Food day (idea 63).
  Every value on the Day tab (web 73, 23.11.2026): a switch "Macros / All values" (`components/food/ValuesSwitch.svelte`; All values at
  first, Macros kept on the device by `src/lib/foodmode.svelte.ts` and set before first paint by `static/theme.js` as
  `html[data-food-values]`; each mode's parts are the CSS variants `allvalues:` and `macros:` of `app.css`, so there is no flash). All
  values: six more tiles under the four (saturated fat, sugar, added sugar, fibre, salt, caffeine: "at least" and "n foods without a
  value" in amber when entries have none), the PC table with ten value columns (the amount under the name; "of which" values muted; a
  box that scrolls sideways when they do not fit, about 1100 to 1200 px), on phones a three-by-three grid under each row (hidden while
  it is open). Both modes: a total after each meal ("Meal 3 total": a row on the PC, a card on phones; the kcal on the meal's line is
  gone here, not on Today), and the day against the daily budget (the targets in force that day, the door's `lines`): on the PC four
  closing rows "Day total", "Daily budget", "Difference", "Difference in %", on phones the Day total card
  (`components/food/FoodDayTotal.svelte`); an opened row on phones shows "Every value" as eaten and per 100 g or ml
  (`components/food/EveryValue.svelte`, from the row's `values` and GET `/food/entry`'s `per_100`; not in `FoodEditor.svelte`, which
  Today shares). The rules (number formats, "?" and "≥" in amber for unknown values, the signed difference and its percent, "–" without
  a budget) are in `src/lib/foodvalues.ts` with tests.
  **Nutrients** (`/food/nutrients?day=&days=1|7|30`, idea 64; `src/lib/nutrients.ts` the door's shapes and plain rules with tests): the
  switch (‹ and › move a whole period) and the 1 / 7 / 30 days chips; the ten lines in the door's order, each a button: value and
  target, a bar where there is a target (protein, fat, carbs and their "of which" in the macro colours, the rest in the ink), the gap in
  words ("93 g to go", "30 g left", "6 g over", "reached": over is said in words, not a colour, as the tiles), a total made with foods
  without a value reads "at least 7.2 g" with "2 foods without a value" in amber, salt with its sodium in mg; a tap sorts the foods (and
  "… by meal" on one day) by their share of that nutrient ("Sugar 16 g · 32%", unknown last). The foods: a two-line row each (name and
  amount; kcal · P · F · C, or the share with a thin bar); a tap opens every value as eaten and per 100 g or ml (sodium under salt,
  "unknown" where none), the source, "Open in Library › Foods" and, on one day, "Open on the Day tab". One column on phones, two from
  1100 px. **Notes** (`/food/notes`, `src/lib/foodnotes.ts`): every meal and food note of the last 90 days by day, each row leading to that
  day's Day tab (a meal's note to `#meal-N`, a food's note with `?open=`); empty: how to add one. The stand-in answers GET
  `/food/nutrients`, `/food/notes` and POST `/food/mealnote` from `tests/samples/food_space.json` (POST `/standin/notes-empty`), the Food
  day's meals with their notes (web 73: each row's every value, the meals' sums and the day's lines worked out as the core does);
  `SHOOT_ONLY=foodspace` runs these checks, both modes of the Day tab included.
- Today for an earlier day (Web 69, 21.11.2026): `/?day=yyyy-mm-dd` (the door's `GET /day?day=`; a later day or one that is not a date
  is today). Under the heading the Food space's day switch (`DaySwitch.svelte`: ‹, the day, ›, the calendar); on an earlier day
  the heading says "Yesterday" or "n days ago", with "Back to today" and a line that habits and health values are only shown and a
  food opens on that day's Food day (`/food?day=&open=f<id>`, which links back: "On Today"). As app.'s Today for an earlier day
  (`todaypage.py`) and the door's flags (`past`; questions, messages not read, the body line, the Gym and Home cards come only for
  today): no logging box, chips, glass of water, ticks, health fields, To review items or Gratitude card; the Coach card works for
  any day. A save there (Undo, the Coach card) brings that day back (`view_day`, `Today.extra`); a tap kept for after a sign-in is
  sent again only from today. `todayHref`, `todayDayLinks`, `daysAgo` in `src/lib/day.ts`. The stand-in's `GET /day?day=` an
  earlier day is today's rows with the door's past-day rules; `SHOOT_ONLY=earlier` runs these checks.
- A sign that a page is loading (Web 68, 21.11.2026): a thin bar at the top of the `(app)` layout while a navigation takes longer
  than 150 ms (SvelteKit's `navigating`; `.loading-bar` in `app.css`, standing still with reduced motion), and
  `data-sveltekit-preload-data="tap"` on the body (`app.html`): a page's read starts when the finger goes down. One global
  `prefers-reduced-motion` rule in `app.css` stops every animation and transition and smooth scrolling (the Habits page's own
  smooth scroll asks too). The stand-in's POST `/standin/slow-reads?ms=n` slows its reads; `SHOOT_ONLY=loading` runs these checks.
- Back on the screen (Web 67, 21.11.2026): the `(app)` layout reads the page again (`invalidateAll`) when it becomes visible after
  being hidden for a minute or more (`src/lib/comeback.ts`), unless a save is on its way (`savesInFlight` in `saver.ts`), a text
  field has the focus or holds words typed since it was drawn and not sent (outside the logging box's form, `data-survives-reload`: its words live in Today's state),
  something is open (`aria-expanded="true"`: a food row's editor would close, Today's `load()` closes it) or a read-back waits in
  the answer bar (`data-holds-reload`); then at the next return. Home > Pick keeps its own handler (on every return, for the timer).
  `SHOOT_ONLY=comeback` plays an absence in the page (visibilityState and Date.now).
- Error pages (Web 66, 21.11.2026): `src/routes/(app)/+error.svelte` inside the app's layout (the rail or the tab bar stay: the
  home-screen app has no back button) and `src/routes/+error.svelte` for an error outside it (the sign-in page, the layout's own
  check), both the card `components/ErrorCard.svelte`: plain words by status (`src/lib/errorpage.ts`: "Not found", "Something went
  wrong"), "Back to Today" and "Try again" (the same address, read again). An address no page has goes through
  `src/routes/(app)/[...rest]` (the session is checked first, then the 404 in the layout; never framed by the hub). `handleError` in
  `hooks.server.ts` logs the kind of error and the route id only (`src/lib/server/errors.ts`), never words, values or addresses.
  `SHOOT_ONLY=errors` runs these checks.
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
     ORIGIN=http://localhost:3000 HUB_ORIGIN=http://localhost:3999" tools/front-pnpm preview` (the
     last for the hub's frame: the checks make a stand-in hub there);
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
  door call gets no answer), `/standin/lose-answer` (Web 65: the next keyed save is saved and its answer dropped), `/standin/door-off` (every door call answers 404 `not_found`) and `/standin/up` (or `/standin/reset`). Deploy 92: GET
  `/health` and `/body` from `tests/samples/health.json` (range 7 and 90 cut or widen the sample's charts), POST `/health/day`
  and `/body` change the data as the core would (a clear asked first, an odd weight or sugar and a body jump of 4 cm read back,
  keyed, Undo), `/body/skip` takes Today's due line away (`door.mjs` says which values do what). `tests/test_front_samples.py` checks on every Python run that the samples still have the
  door's shape; after a change of the door, write it again with
  `WRITE_FRONT_SAMPLES=1 .venv/bin/python -m pytest -q tests/test_front_samples.py` and commit the diff.
  `src/lib/samples.test.ts` holds each sample against the interface that types it, at compile time: `tools/front-pnpm check` fails on a field
  the type names and the sample lacks, or the sample has and the type does not (`v`, the door's version, is left out); run it after writing samples.
- Deploy: `tools/deploy-front.sh <N>` (the core: `tools/deploy.sh`). Rollback of deploy N:
  `docker tag logger-front:front-fixesN logger-front:pilot; docker compose up -d front`.

## The trial

From deploy 85 the trial runs: the owner uses `logger.` for Today and the Food day on the phone and the PC, next to `app.`,
which stays complete and is where everything else lives (Trends, Library, More, Settings, notifications; usual meals also
here since deploy 87). What to
look for: anything that differs from `app.` (numbers, a save that does not show up there), anything slow or unclear, and how the
two compare on the phone. Notes go into the plan doc; the decision about the rest of the app comes after it.
- If the front end misbehaves: roll back (`docker tag logger-front:front-fixesN logger-front:pilot; docker compose up -d
  front`) or stop it (`docker compose stop front`); `app.` does not depend on it. Switching the door off (empty `FRONT_TOKEN` in
  `.env`, one restart of the core) shows "switched off" on `logger.`.

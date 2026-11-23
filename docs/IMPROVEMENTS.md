# Web app: improvements and feature ideas

Written 27.10.2026 from a read of the web app's code (`core/app/web*.py`, the page modules, `static/app.css`,
`static/app.js`) and the plan doc "Logger: status and web app plan". The pages were not opened in a browser for
this list, so layout points are read from the stylesheet, not seen. Nothing here is decided: each item is an idea.
Before building one, plan it in the doc first (with a clickable mockup for a new page).

Size: S = about an hour, M = about half a day, L = a day or more. Rough guesses.

## Priorities (reviewed 21.11.2026, after deploy 117 and the move to logger.)

From a review of the whole app on 21.11.2026: the core, the new front end (`front/`), the tests, the deploy scripts and the
running of it, plus the two idea lists and the open tasks and ideas about the Logger saved in the app itself. Core items are in
`docs/CORE-IMPROVEMENTS.md` (new ones: 32 to 40, section 10). New web items are 65 to 72 (section 9 below). Nothing is decided.
Size: S about an hour, M about half a day, L a day or more.

**Rounds 1 to 3 below are done and live since 21.11.2026** (core deploys 121 and 122, front deploy 123), and of the features the Food
space with web 64 (deploy 120). What is left: the features from web 50 on, and the tidying. Done since, on 22.11.2026: web 50 Insights with sleep, web 57 the Home timer's notification, web 45 last week's summary, core 24 the words review, core 13 removing the pilot tools, web 49 a waiting question's nudge and a reminder time per habit, web 58 editing the body measures. Web 38 (minutes for practices) and 43 (medication reminders) are not wanted for now (the owner, 22.11.2026): leave them until asked.

**Round 1: nothing saved twice (about a day).** Each can put a wrong or double entry into the data.

1. **Core 32 AI errors are caught as such** (S): a timeout of the AI during a food look-up or a label photo undoes the whole save.
2. **Core 34 A waiting message is saved once** (S): a slow read can be taken a second time after 10 minutes.
3. **Core 33 A Todoist task is made once** (M): the rest of core 2; a retry can add the same task again.
4. **Web 65 A tap that got no answer is sent again with the same key** (S-M): on a weak phone network a retry can log twice.

**Round 2: the doors and the deploy (about half a day).**

5. **Core 35 The hub's token** (S), **core 36 the connector's sign-in** (S), **core 37 the private export** (S): see the core list.
6. **Core 38 Deploy guard** (S): stop when the dump fails, a dump name per deploy, refuse a deploy that is not pushed.
7. **Core 12 Update alerts** (S): nothing tells the owner about new versions.

**Round 3: the phone app at logger. (about half a day).**

8. **Web 66 An error page in the app's layout** (S): item 26 again, for logger.
9. **Web 67 Today reads the day again when the app comes back to the screen** (S).
10. **Web 68 A sign that a page is loading** (S).
11. **Web 63 Jump to a day in the food history** (S), with **web 69 Today for an earlier day** (S).
12. **Web 70 A new kind of nudge saves from logger.** (S): needed before any of item 49.

**Then features, in order:** 64 every food detail (M); 50 Insights with sleep (M, core only now: logger. draws any card the door
sends); 57 a notification when the Home timer ends (S-M, push works at logger. now); 45 digest as a weekly notification (M);
core 24 words review, in Library > Foods (S-M); 49 the rest of the nudges (S-M); 58 + 56 T2 edit the body measures (now M-L:
core, door and front); 38 minutes for practices (M); 43 medication reminders (M, only if wanted).

**Then tidying, in order:** core 13 remove the pilot tools (S-M; done 22.11.2026, deploy 136); core 16 one handler per question kind (S-M); core 39 the AI
cost look (S, with core 3); web 71 the door's types checked against the samples (M); web 72 one place for how each save behaves
(M; done 22.11.2026, deploy 139); core 40 docs and leftovers (S; done 22.11.2026, deploy 138). All tidying items are done.

**Owner decisions that block the largest clean-up:** where Ideas and Todoist, Private and the Gratitude list live (logger. or
the journal app; `front/src/lib/places.ts` says they wait for the journal app). Until then app. stays, and with it about 5,000
to 6,000 lines of the old web app and about 276 of its tests. Also still open: ending the v1 fallback, GitHub's run as the
check before a deploy (core 38 covers it), whether the repo stays public.

**Changed since 05.11.:** core 9 (connection pool) is done; core 28 step 2 (parallel tests) is dropped (a full run takes about
3 minutes); 18 (link thoughts) moves to the journal app; core 25 (Telegram) is parked (notifications work at logger.); 15, 7, 9
and 22 are done; core 31 (watch sleep) is complete in the code and waits for the phone's setting.

## Earlier priorities (reviewed 05.11.2026, after deploy 62)

Re-ranked against the app after deploys 59 to 62: the day follows the wake-up (sleep cycle, naps, Sleep times chart), and the export,
the water target and gym and home in Search are live. Ranked by value for the effort. Nothing is decided: plan each one in the doc's
Current tab first. Size: S about an hour, M about half a day, L a day or more.

**Web, top 10 (in order):**

1. **48 "All look right"** (done, deploy 64): one tap clears the whole review box.
2. **26 Error page in the app's layout** (done, deploy 64): today an error shows a bare page.
3. **50 More Insights** (done 22.11.2026, in the code; the deploy follows): sleep length against mood, energy, calories and blood pressure, late food and caffeine against sleep, a caveat for weak differences and 90, 180 or 365 days.
4. **58 + 56 T2 Edit the body measures** (done 22.11.2026, in the code; the deploy follows): add, rename and reorder them in Settings > Body, neck and calf included (one change for both).
5. **49 More nudges** (S-M; in part done, deploy 67: check-in and evening blood pressure): "your watch says you're up, log it?", a question open for a day.
6. **45 Digest** (M): a short daily or weekly summary sent to the owner (the export part is done; coaching on demand covers some of it).
7. **38 Minutes for practices** (M): Shoonya, meditation, study as minutes, not only a tick.
8. **57 A notification when the Home timer ends** (done 22.11.2026, in the code; the deploy follows): "Time is up" with the job's name, from a thread of the core that looks every 10 seconds, on by default in Settings > Notifications.
9. **43 Medication schedule with reminders** (M): only if wanted.
10. **18 Link thoughts** (M).

**Combined top 10 with the core list (Claude's recommendation, in order):**

1. Core 30 Safe parallel sessions (done, deploy 64)
2. Web 48 "All look right" (done, deploy 64)
3. Web 26 Error page (done, deploy 64)
4. Core 31 Check the watch's sleep import (S)
5. Core 16 One handler per question kind (S-M)
6. Core 13 Remove the pilot tools (S-M; done in the code 22.11.2026)
7. Web 50 More Insights with sleep (M)
8. Web 58 + 56 T2 Edit the body measures (M)
9. Web 49 More nudges (S-M; in part done, deploy 67)
10. Core 24 Words review (S)

The first six are small and make everything after them safer or quicker; 7 to 9 build on the sleep and body data now logged.

**Look at later:** core 3, the second-read data, around mid-November.
**Parked or dropped:** 42 and 16 lab report upload (owner, 02.11.2026: "not interested at the moment"), 35 swipe (not needed), 41 weight
trend (dropped), 44 photo on a food entry (disk), 47 home-screen shortcuts (iOS limits), 51 server-side voice (only if Safari's fails),
20/21 chat usual meal and exchange log (no ask since 29.10.), core 6 shorter prompt (not worth it now).
**Done since 04.11.:** check-in and evening blood pressure nudges (49 in part, deploy 67, 08.11.), polish round from Claude's look at the app (deploy 66, 08.11.: chip and pencil one unit with short names, quick chips first on phones, the macro table fits a phone, a food's amount never splits, a usual meal logged at once is one line that opens, Insights in grams and without "-0"), Again chips in one tap, with a pencil for amount and time (deploy 65, 08.11.; 46, one-tap usual meals, was done on 02.11. but not marked), 48 "All look right" and 26 error page in the app's layout (deploy 64, 08.11.), the Health card's Bed and Woke up log the next sleep 12 h after the wake-up instead of moving the last one (bug, deploy 63, 06.11.), 59 to 62 sleep cycle (deploy 59, 05.11.), 45 export part + core 19 (60), 40 water target (61), gym workouts and
home chores in Search (62); before that: Home page round 2 (53, 57), 52 coaching (51), 29 + core 26 Usage page (50), 53, 54, 55 and the
Medical name (49), 37 mood and energy (44), 46 one-tap usual meals (43), 56 body measurements T1 (46), the Home page (47, 48).

## Status (31.10.2026; the first build run of 29.10. is described in `docs/reports/web-app-2026-10-29.md`)

- **02.11.2026 (deploy 36, commit a35becf):** 12 Again chips on the PC (8 on phones); a food's words under its name in the catalogue and a Close button on the open food's box; suggestions treat ü/ö/ä/ß as ue/oe/ae/ss, show the word a food was found by, most recently eaten first; **36 (sleep hours) done in part:** "slept 7 h 05 min" with Woke up on Today and a 7-day average line on the Health Sleep chart (no colours, no target: the owner's choice; the Week page already had the average night). **41 (weight trend) dropped:** the Health page already has the 7-day average. Answers: artifact https://claude.ai/artifact/9pxSQY2DD55er5y51jMm51 (db `answers`).
- **31.10.2026, the three "frictionless" rounds (details in HANDOVER section 000):** the whole web app restyled (Inter, soft cards, icons, light/dark switch, phone tab bar with the entry box pinned above it); Today for any day (date picker, earlier days read-only) with the macro donut and share table; Undo bar; food entries change at once (no "Yes" question); food editor in place on Today; Again chips; food suggestions in the entry box; a 2-line entry box on the PC; the Recent page; notifications ("nudges") through web push (Settings > Notifications); voice input (microphone in the entry box); the barcode scanner (zxing) with Open Food Facts look-up and **photos of nutrition labels read by Claude**; the Insights page. Item 17 (barcode by camera) is done by this.
- **Open ideas after those rounds:** section 8 below (items 35 to 52; 52 = coaching, added 02.11.2026). The user's answers on 31.10. are in the private artifact https://claude.ai/artifact/9rHgvRxZWG7tV2LdXxdQhg (swipe: not needed; sleep hours and mood/energy: "save it for the next version").
- **Not yet checked on the user's real iPhone:** a real notification (needs Logger on the home screen, iOS 16.4+), the microphone in the home-screen app. The barcode scanner and the label photo were tried by the user and work.

## Status (29.10.2026, end of the first build run)

- **Done and deployed:** 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 19, 22, 23, 26 (the unknown-page screen; the error page is not done), 27 (titles, skip link, labelled menus), 30, 31, 32, 33, 34.
- **Open:** 16 (lab upload on the web), 18 (link thoughts): no answers yet. (17, barcode by camera, was built on 31.10.) 25 (one helper for the host check) and the error page of 26 are code tidying, not started.
- **Habits page, 30.10.2026:** the page lists every habit with a Track switch, Retire / Bring back, Delete (never-used only) and a New habit form; Wake-up and Bedtime are times, not habits (migration 017; Health card "Now" button). See `docs/reports/habits-page-2026-10-30.md`.
- **On the core list, not here:** 20, 21, 24, 28, 29 (see `docs/CORE-IMPROVEMENTS.md`).

## 0. Your additions (28.10.2026)

| # | Idea | What is there now | Size |
|---|---|---|---|
| 30 | Easy definition of usual meals and usual drinks: a "New usual meal" form on the Usual meals tab where you pick foods or drinks and their amounts directly, with a Meal / Drink switch | A usual meal can only be made from a meal you already logged ("Save as usual meal" on the Food log). The database already knows usual drinks (`usual_meals.is_drink`), but the web app has no way to make one | M |
| 31 | A separate Habits page: today's habits as big one-click buttons, the calendar of the last 30 days (moved off the Health page), and a click on a past day's square to tick or untick that day | Habits are ticked on Today; the 30-day calendar is on the Health page and cannot be clicked | M |
| 32 | Choose which habits show on Today (add or remove them), and their order | Today shows every habit marked `on_checklist` in the database; changing that needs SQL. To decide in the plan: does "not on Today" also hide a habit from the Habits page and the Sheet's Habits tab, or only from Today? | S-M |
| 33 | Sort the food catalogue: most eaten (all time or last 30 days), last eaten, date added, kcal per 100 g, protein per 100 g, name | The catalogue is always sorted by most eaten (all time), then by name; the filters (All, Drinks, Added in the last 14 days, Needs review) cannot be combined with another order | S |
| 34 | Customize the Today page: add and remove its items (habits, the Health card's rows such as blood sugar or wake-up, the usual-meal buttons, the review box), reorder them, and bring them back later. Saved per user in the database, with "Reset to default" | Today shows a fixed set. Widens item 32 (which habits show) to the whole page; plan the two together, and decide whether a hidden item is also hidden elsewhere (Habits page, Sheet) or only on Today | M |

## 1. Quick wins (small, used every day)

| # | Idea | Why | Size |
|---|---|---|---|
| 1 | Show "Saving..." and disable the Log button while the AI reads the message | A message waits a few seconds for the AI with no sign that anything is happening. The idempotency key already stops a double save, but you cannot see that it is working | S |
| 2 | Keep the typed text when nothing was saved | When the AI does not answer ("Nothing was saved; try again"), the box comes back empty and the message has to be typed again. Put it back in the box (the "Correct it" button already does this) | S |
| 3 | Stay on the page you logged from | The entry box is on every page, but every message sends you back to Today (`/web/log` always redirects to `/web/`) | S |
| 4 | An Undo button on the reply after "Saved." | The chat can undo the last entry; the web reply cannot. `commands._undo` already exists | S-M |
| 5 | Change a food entry straight from Today | Today's food rows are read-only; a change means going to Food, finding the day and opening the entry. Link each row to its edit panel on the Food log | S |
| 6 | Make the web app behave like an iPhone app (a progressive web app): its own icon on the home screen, opening full-screen without Safari's bars. Needs: an app icon set and favicon; a web app manifest (name, colours, "standalone"); the iPhone meta tags (apple-touch-icon, status bar); `manifest-src 'self'` in the content security policy (today `default-src 'none'` blocks it); the files served under `/web/static/` (Caddy passes only `/` and `/web/*`, and `web.py` serves only `app.css` and `app.js`). Best together with items 7 to 9 (chart values by tap, a shorter phone menu, bigger tap targets). Asked for 28.10.2026, not now. Plan in the doc first, with a small icon design | Added to the iPhone home screen today, the app gets a generic icon and may open inside a Safari-style tab. Limits to state in the plan: no push notifications (the app is only on the home network and tailnet), it opens only on home Wi-Fi or with Tailscale on, the home-screen app keeps its own 30-day sign-in | S-M |
| 7 | Tap to see a chart value on the phone | Chart values show only on mouse hover (SVG `<title>`), so on the phone a point cannot be read | S-M |

## 2. Phone layout

| # | Idea | Why | Size |
|---|---|---|---|
| 8 | A shorter menu on the phone: Today, Food, Health, Ideas and "More" (Questions with its badge, Private, Labs, Usage); or a bottom tab bar | Eight links wrap into two or three rows above the page on a narrow screen | S-M |
| 9 | Bigger tap targets for the small buttons (the small Save buttons, icons, chips) | Several buttons are about 24 px high; about 44 px is the usual minimum for touch | S |

## 3. New views of data you already have

| # | Idea | Why | Size |
|---|---|---|---|
| 10 | Food trends chart on the Food log: kcal and protein per day against the target over 7 / 30 / 90 days, with the weekly average | The Food log date range is a table only; the Sheet has charts, the web app has none for food | M |
| 11 | Target lines on the Health charts (BP 130/80 and 140/90, sugar 100 and 126, sleep 7 h and 6 h, the Sheet's colours) | Left out on 26.10. "for now"; the limits are already decided for the Sheet | S |
| 12 | A Weekly summary page like the Sheet's: averages against targets, habits, weight change, sleep, top foods | One place for the week without opening the Sheet | M-L |
| 13 | One search box for everything (food entries, thoughts, labs, tasks; private entries only on the Private page) | Today each page has its own filter or search | M |

## 4. Settings and editing on the web (instead of NocoDB)

| # | Idea | Why | Size |
|---|---|---|---|
| 14 | A Settings page: daily food targets (`food_targets`), checklist habits (add, rename, daily count, retire; which ones show on Today is item 32) | These can only be changed in the database today | M-L |
| 15 | Todoist: set or change a due date | The page shows due dates but cannot change them | S-M |
| 16 | Labs: paste a lab report or upload a PDF on the Labs page (the chat's `lab_report`, shown first, then Yes) | Lab reports can only come in through the chat | M |
| 17 | Barcode from the phone camera on the Catalogue | Left for later on 26.10.; typing 13 digits on the phone is slow | M |
| 18 | Link thoughts to each other | Receipts already show v1's "link candidates", but linking is not built | M |

## 5. Backlog already agreed (HANDOVER section 6)

| # | Idea | Size |
|---|---|---|
| 19 | Date picker in the Private page's Gratitude tab (`privatepage._gratitude` already takes `day=`) | S |
| 20 | The chat saving a usual meal (plan in the doc first) | M |
| 21 | An exchange log of the chat, with a web page to read it (plan in the doc first) | M |

## 6. Safety and housekeeping (under the hood)

| # | Idea | Why | Size |
|---|---|---|---|
| 22 | A list of signed-in devices with "sign out this device" and "sign out all others" | A session lasts 30 days; a lost phone stays signed in until then | S-M |
| 23 | Lock out failed sign-ins per device, not for everyone | After too many failed attempts the sign-in is locked for every device, so anyone on the home network or tailnet could lock you out for a while | S |
| 24 | Run page reads and the session check off the server's main loop | While a page is built, a chat message waits. Fine for one user; matters more once Telegram comes | S |
| 25 | One helper for the 12 copies of "app host only, signed in, else to the login" in `web.py` | Less code, and a new page cannot forget a check | S |
| 26 | A friendly "not found" page and an error page inside the app's layout | Unknown `/web/` paths show a plain "Not Found" | S |
| 27 | Small accessibility fixes: a label on the main menu, a "skip to content" link | Screen readers and keyboard use | S |

## 7. Cost (outside the web app, found 27.10.)

| # | Idea | Why | Size |
|---|---|---|---|
| 28 | Check that prompt caching works (it is switched on, but the audit log cannot show whether it is used; see `docs/CORE-IMPROVEMENTS.md` items 3 to 6 for AI cost) | Each AI call sends about 7,000 input tokens, mostly the same prompt every time; input is about 98% of the tokens | S |
| 29 | **Done 04.11.2026, deploy 50.** Token counts for food lookups and lab reports on the Usage page | Known gap: only model and cost are recorded for them | S |

## 8. Open ideas after the 31.10.2026 rounds

Collected from the user's list of 30.10.2026 and the answers on 31.10.2026. Nothing here is started. Plan each one in the doc first (a clickable mockup for a new page).

| # | Idea | Notes | Size |
|---|---|---|---|
| 35 | Swipe left/right to change the day on Today and the Food log (phone) | The user answered "not needed" on 31.10.; parked. Today already has arrows and a date field | S |
| 36 | Sleep hours: from Bed to Woke up, on the Today Health card ("7 h 35 min"), as a Health page chart with a 7-day average (amber under 7 h, red under 6 h, like the Sheet), and on the Week page | User: "save it for the next version". The data exists (bed and wake events; the Health page already shows the bed time of the night before) | M |
| 37 | Mood and energy check-in: 1 to 5 buttons in a small card on Today and in chat ("mood 4, energy 3") | User: "next version". Undecided: which scales (mood and energy, or also stress), once in the evening or morning and evening. Would feed the Insights page and could be a nudge | M |
| 38 | **Not now (the owner's choice, 22.11.2026): not to be built until asked.** Minutes for practices (Shoonya, meditation, study) as minutes, not only a tick | A twice-a-day count already works as a habit target | M |
| 39 | Activity: steps or walk minutes, typed or from the phone health export | The `health-export` channel already carried 23 messages | M |
| 40 | Water as its own daily target with a bar on Today; done 05.11.2026, deploy 61 | Drinks are logged already; needs a target per day | S |
| 41 | Weight trend: 7-day average, weekly change, an optional goal weight | Smooths day-to-day jumps; the Health chart already has a 7-day average line | S-M |
| 42 | Lab report upload with trends (item 16): photo or PDF read by Claude, shown to check, then saved | The label-photo flow (`labelread.py`, `webfood.label_add`) is the pattern: read, check, add | L |
| 43 | **Not now (the owner's choice, 22.11.2026): not to be built until asked.** Medication schedule: dose and time with a reminder | The nudge code (`nudges.py`, web push) can carry it | M |
| 44 | A photo attached to a food entry (a memory aid when the amount was a guess) | Needs somewhere to keep photos (disk is at about 82%) | M-L |
| 45 | **Done 22.11.2026 (deploys 128 and 129):** last week's summary as a phone notification, once a week (`weekdigest.py`, a nudge of `nudges.due`): on the first logging day of the week, `week_after` hours after waking (1 by default, 0.5 to 12; on Tuesday when Monday had no wake-up, never twice for one week: the `push_sent` kind names the week, `week-YYYYMMDD` of last week's Monday), inside the usual quiet hours. Title "Last week · 16.11. to 22.11.", one line from the Week page's numbers, shares and changes only (no absolute health value on a locked screen): "6 of 7 days logged · kcal 94 %, protein 88 % of target · weight −0.4 kg · habits 71 %", a part without data left out; a week without a day with food sends nothing and is marked as done. A tap opens the Week page for last week (`/web/week?p=last`, logger. `/trends?p=last`). The switch "Last week's summary, on the first day of the week, [1] hours after waking" (nudge `week`, on by default) at both addresses: logger.'s Nudges form draws it from the door's list. A daily digest and Telegram are not part of it (core item 25). A daily or weekly digest, and an export of everything logged (CSV or JSON); export done 05.11.2026, deploy 60 | Same as core items 17 and 19 | M |
| 46 | **Done 02.11.2026** (commit 9733b06; marked here on 08.11.). One-tap usual meals: a tap logs the meal with its saved weights, the editor stays for changes. **Again chips in one tap too: done 08.11.2026, deploy 65** | "+ Food 60 g" logs the amount used last, now; the pencil opens amount and time first; the same food within 30 minutes asks | S |
| 47 | Phone home-screen shortcuts that open straight at Log food or Weight | iOS limits what a web app can offer; check what works | S |
| 48 | "All look right" on the review box | One button for a whole list of items that are fine | S |
| 49 | More nudges. **In part done 08.11.2026, deploy 67:** mood and energy not in yet (on, 12 h after waking) and evening blood pressure (off until chosen, 13 h), both in Settings > Notifications. **Done 22.11.2026 (deploys 132 and 133):** a question waiting for a day and a reminder time per habit. Still open: Telegram as a second channel (core item 25, parked) | Today's nudges: no weight, habits open, nothing logged for N hours, all counted from the wake-up time | S-M |
| 50 | **Done 22.11.2026 (deploys 124 and 125):** six more questions (food close to bedtime and that night's sleep, 50 mg of caffeine or more in the 8 h before bed and that night's sleep, short nights against that day's calories (complete, fully logged days only, the Week page's rule), morning systolic blood pressure, mood and energy), the cards with a statement before the waiting ones, a caveat when the difference is under half the usual spread or a group has fewer than 8 days, and on logger. a range switch of 90, 180 or 365 days (`GET /insights?days=`; app.'s page stays at 90). No steps question yet: there is no watch data. Insights: more questions as the data grows (mood, steps, sleep once item 36 exists), and a longer range | Today's three cards need about 4 days in each group; the user's data had 1 day with a long gap after food | M |
| 51 | Voice without the browser's speech recognition (record on the phone, convert on the server) if Safari's recognition is missing in the home-screen app | Only if the microphone button does not show or does not work there | M-L |
| 52 | **Done 04.11.2026, deploy 51.** Coaching: "Coach me" on Today (any day of the date picker) and "Review this week" on the Week page, by Claude Opus 5.5 at high effort, on demand | The user's idea of 02.11.2026; details below. The chat can already coach when asked; this makes it one tap and keeps each coaching | M |
| 53 | **Done 04.11.2026, deploy 49.** One calorie total on Today: the macro pie's centre (`todaypage._macro_block`, `_pie(..., middle)`) shows the day's kcal from `v_food_day` (the Calories card's number) instead of the kcal worked out from the macros (4 × protein + 4 × carbs + 9 × fat). The shares stay from the macros. The table's Total row keeps its macro total, labelled "from macros", with a short note that labels count fibre (2 kcal/g in the EU) and rounding differently. A test for both numbers; check at phone width | Found 03.11.2026: the card said 897 kcal and the pie 888 for 02.11. The biggest gaps were high-fibre rolls (label 205, macros 190) and avocado (label 144, macros 161, its carbs apparently counting fibre). The data is right; two ways of counting showed two totals | S |
| 54 | **Done 04.11.2026, deploy 49** (tabs Thoughts and Todoist kept; "Labs and medication" became "Medical" in the same deploy). Rename "Ideas and tasks" to "Ideas": the PC menu (`web.py` links), the page heading and the browser tab title (`ideaspage._tabs`), the CSS comment, tests (`test_webideas.py`, `test_webdevices.py`). The address `/web/ideas` stays; the phone tab bar already says "Ideas". Open: the tab names inside (Thoughts / Todoist) and whether Todoist stays here | The page is called "Ideas and tasks" on the PC and "Ideas" on the phone | S |
| 55 | **Done 04.11.2026, deploy 49** (no page; every open question on Today; the count on the Today link). Rethink the Questions page, which is rarely used. Data 26.10. to 02.11.: 23 questions (7 add-this-food after a look-up, 6 make-this-change, 5 which-food, 2 log-again, 2 new food, 1 which task), all answered, none expired, 16 within 2 minutes (median about 1 minute), about one a day since 30.10. Suggestion: drop the page from the menu; Today shows every open question (`webquestions.today_section`, now 3); the count badge moves to the Today link; `/web/questions` and the look-up's way back (`webfood` "lookup") go to Today | A page of its own under More with a red count; Today shows the newest 3 | S |
| 56 | **Done 03.11.2026, deploy 46.** Body measurements T1 (spec `docs/specs/body-measurements-spec.md` on the branch `docs/body-measurements-spec`; plan and the owner's answers in the doc, Current tab): waist, hips, chest, upper arm and thigh in cm (migration 024: log_types rows and the dated `body_height`); typed pairs read without the AI (`tape.py`, also inches); read-backs for a second value on a health day (yes replaces it), a jump of 4 cm or more and out of range; the Health card after the charts (`bodypage.py`: table Now / Last / Start, chips with a chart, waist ÷ height, weight rate, Measure form via `?measure=1`); "Body measurements due" in To review 28 days after the last session, once woken up, with Not today; Settings > Body (height from a date, interval, shown measures); a Week line and one Recent line per session. Not in the Sheet (owner). Later: T2 (neck, calf, body-fat estimate), T3 fitness tests. Since 22.11.2026 (item 58) T2's neck and calf are added by the owner in Settings > Body at logger. (two suggestions in its add form); the body-fat estimate is still open | – | M |
| 57 | **Done 22.11.2026 (deploys 126 and 127):** a thread of the core (`hometimer.py`, started beside the clean-up; the core is one uvicorn process) claims every 10 seconds the timers that ended in the last 10 minutes with one UPDATE (`home_timers.notified_at`, migration 036), commits, then sends "Time is up" with the job's name and minutes (the minutes alone when the job is gone) to every device, opening Home > Pick (`/web/home/pick`, logger. `/home/pick`), tag `home_timer`, with a 10-minute TTL and high urgency; a paused timer has no end, a resumed one is announced at its new end, "Done, next job" keeps the end, a timer closed before its end or already announced never is, a failed send is not repeated, and nothing comes late after the core was down. The switch "When the Home timer ends" (nudge `home_timer`, on by default, under the master switch; no quiet hours, no once a day) at both addresses: the door lists it with `hours` and `after` null, and logger.'s Nudges form draws and saves a switch alone. A notification when the Home pick timer ends (web push at the timer's end time) | Today the page says "Time is up" only when it is open; a locked phone shows nothing (agreed on 03.11.2026 as later). Needs a scheduler more precise than the 5-minute cron | S-M |
| 58 | **Done 22.11.2026 (deploys 134 and 135):** the body measures are log_types rows marked `body_measure` (migration 038; `body.measures`, `names`, `labels` replace `TAPE`, `NAMES`, `LABEL`), and Settings > Body at logger. lists them in order, each with its landmark and range, the shown switch, up and down, and Edit in place (name, where to measure, lowest and highest cm, other words as a comma list; Save, Cancel, Remove), with "+ Add a measure" and the suggestions Neck and Calf as chips that fill the form (the door's `POST /settings/body_measure`: add, edit, move, remove; no Undo, as the other Settings saves). A new measure's key is made from its name once and never changes, so its values stay; its name, key and words must not be a name, label or word of any other log type (active or not), refused by name ("“Belly” is already a word for the measure Waist: choose another."); a measure with values cannot be removed, only hidden. A new measure is read in typed lines like the five ("neck 38.5", in cm or inches, with the same read-backs), and the Health card, its Measure form, the charts' chips, Today's due line, the Week and Recent lines, the coach's vitals and app.'s pages draw whatever measures there are (waist stays special only for waist ÷ height). Edit the body measures in Settings > Body: add a body part (name, where to measure, range in cm, typed words), rename one, change the order (asked 04.11.2026) | Today the five measures are fixed in code (`body.TAPE`) and migration 024 (log_types rows: range, aliases); Settings > Body can only hide them and change the interval. A rename changes the label only, the key stays, so history is kept. One-off additions without this: a migration and one `TAPE` line (about 1 hour). Overlaps T2 of item 56 (neck, calf) | M |
| 59 | **Done 05.11.2026, deploy 59** (migration 029, `cycle.py`). Sleep cycle 1: the day follows the wake-up. SQL `log_day()` is now the day of the last wake-up in the 18 hours before (`food_day`), else the 05:00 rule, so every page's "today" changes at the wake-up. Health entries take the same day (`cycle.entry_day`; a wake-up in the same message counts), and entries logged before their wake-up was move to its day (`v1_log._move_health`). Recent and the open questions group by it too | Found 05.11.2026: a wake-up between midnight and 05:00 was filed under its own date, but until 05:00 the pages showed the day before, so neither the wake-up nor the bed time appeared. Food already followed the wake-up; weight and other health entries did not. Matters for an irregular sleep cycle | S |
| 60 | **Done 05.11.2026, deploy 59.** Sleep cycle 2: dates for a drifting cycle. SQL `wake_day()`: a wake-up's own calendar date, or the next date when an earlier wake-up already has that date. A date the cycle skips stays an empty day (decided by the session: honest, and nothing else to build) | Two wake-ups on one date (01:00 and 23:00) gave "already logged" (`v1_log._ONCE_PER_DAY`); a cycle can skip a date (23:50 on day 1, then 00:30 on day 3). A label is at most one date ahead of the clock | M |
| 61 | **Done 05.11.2026, deploy 59.** Sleep cycle 3: naps and broken nights. A wake-up less than 12 hours after the last one, or after less than 3 hours of sleep, asks first: a new day, or up from a nap or a night waking (buttons on Today; "nap" in the chat). New type `nap`: counts as sleep (view `v_sleeps`), starts no day, and a bed before it no longer pairs with the next wake-up (`v_sleep`, Health, nudges). Not a habit (Habits page, Sheet) | A 2-hour sleep or getting up in the night would have started a new day and split the food, totals and check-in. A "lay awake" note was left out: a nap or a thought covers it | M |
| 62 | **Done 05.11.2026, deploy 59.** Sleep cycle 4: see the drift. Health page "Sleep times": one row per date with the clock across (up to 30 days), sleep bars split at midnight, naps lighter, a tick for a wake-up without a bed time, so a moving cycle shows as a diagonal band. Today: "Your watch says you got up hh:mm · Use it" when the watch's sleep ended in the last 12 hours and nothing was typed for it (`cycle.watch_wake`), and the Woke up row shows "awake 9 h 20 min" and the day's naps | Bed and wake times were only listed. No watch sleep data had arrived by 05.11.2026, so the watch line is tested with sample data only | S-M |
| 63 | **Done 21.11.2026 (deploy 120):** the Food space's day switch has a calendar button (a date field) beside ‹ and ›, and "The days" link to their Food day. Jump to a day in the food history at logger.: a date field in the Food day's day switch (next to ‹ and ›), and the rows of Trends > Week > "The days" open that Food day (asked 17.11.2026) | Today an earlier day is reached only by tapping ‹ once per day (`/food?day=yyyy-mm-dd` already works as an address); "The days" shows each day's totals but its rows lead nowhere. Front end only: the door's `GET /food/day?day=` takes any day. | S |
| 64 | **Done 21.11.2026 (deploy 120):** the Food space's Nutrients tab (a day, 7 or 30 days; the door's `GET /food/nutrients`), unknown values marked "at least … · n foods without a value". A page with every tracked detail of the food at logger., not only kcal, protein, fat and carbs: sugar, added sugar, saturated fat, fibre, salt (asked 17.11.2026) | The data is there: every food and every entry carries `sat_fat`, `sugar_total`, `sugar_added`, `fibre` and `sodium_mg` (migration 006), with targets for them and a count of entries where a value is not known; the pages and the door show the four main values only. To decide when it is planned: per day (the Food day's foods with all columns, day totals against the targets), per period (Trends), or both; how to show foods whose value is unknown, so a total is not read as complete. Needs the door's food reads widened and a new page or tab; a mockup first. | M |

## 9. New after the review of 21.11.2026 (the front end at logger.)

| # | Idea | What is there now | Size |
|---|---|---|---|
| 65 | **Done 21.11.2026 (deploy 123):** a tap that went out and got no answer keeps its key for 10 minutes and the same tap again goes with it, so the door answers with the first answer (`saver.ts`; the door client tells `no_answer` from a connection never made); the browser waits 20 s (65 s for the AI's saves), a little longer than the server; the words say "it may have been saved" (to look first for the saves the core does not replay: a Habits page day tap, its list forms, an untick), "Nothing was saved" only where it is certain; a test checks `KEYED` against the server's list. A tap that got no answer is sent again with the same key, and the message says "it may have been saved" | The browser makes a new key for every send (`saver.ts` `send`) and says "Nothing was saved; try again" after a network error; the server says the same after 15 s without an answer from the door (`door.ts`, `problems.ts`). The save may have gone through, so the next tap can log water or a chip twice | S-M |
| 66 | **Done 21.11.2026 (deploy 123):** `(app)/+error.svelte` in the layout (an unknown address through `(app)/[...rest]`) and a root one, "Not found" or "Something went wrong" with Back to Today and Try again; `handleError` logs the kind and the route id only. An error page in the app's layout (`+error.svelte`), with the tab bar | None exists: an unknown address or a failed read shows SvelteKit's bare page, and the home-screen app has no back button | S |
| 67 | **Done 21.11.2026 (deploy 123):** the `(app)` layout reads the page again after a minute or more away (`comeback.ts`), not while a save is on its way, words are typed or an editor or a read-back is open; Home > Pick keeps its own. Today reads the day again when the app comes back to the screen (`visibilitychange`) | Only Home > Pick listens for it; a home-screen app left open overnight shows yesterday, and there is no pull to refresh | S |
| 68 | **Done 21.11.2026 (deploy 123):** a thin bar after 150 ms of a navigation, preload on tap (`app.html`), and one global `prefers-reduced-motion` rule (animations, transitions, smooth scrolling). A sign that a page is loading (a thin bar from `navigating`), and preload on touch | A tab tap waits for the door with nothing on screen | S |
| 69 | **Done 21.11.2026 (deploy 123):** Today takes `?day=` with the Food space's day switch; an earlier day without the logging box, chips, water glass, ticks, health fields, To review and Gratitude (as app. and the door's flags), "Back to today", its foods leading to that Food day, which links back. Today for an earlier day: a date in Today's heading | The door takes `GET /day?day=`; the front never sends it (app. had the date picker) | S |
| 70 | **Done 21.11.2026 (deploy 123):** the Nudges save reads the door's list first and sends only its keys, hours inside the door's min and max (`nudgesBody`); `NUDGE_KEYS` and `NUDGE_HOURS` are gone. The nudges' keys and hours come from the door's list | The page draws the door's list, but the server sends only the keys written into `settings.ts` and `saves.ts`: a new nudge would show and not save | S |
| 71 | **Done 22.11.2026 (22.11.2026: types and tests only, nothing to deploy):** `front/src/lib/samples.test.ts` holds each of the 22 sample files, reads and save answers, against the interface that types it (`shape<Day>()(sample.day)`: the sample with its literal unions widened, since a JSON import has none, must fit the type, and may name no key the type does not), so `tools/front-pnpm check` fails on a renamed, dropped or retyped field, or one the type does not know; a few run-time checks name each answer's top-level keys. It found one gap: `LabValue` lacked the door's `ref_low` and `ref_high` (added; no page draws them). The door's types checked against the samples (`satisfies` in the tests, so the type check fails on a renamed field) | The types are hand-written copies of `docs/API.md`; reads are cast without a check; the Python sample test compares keys only | M |
| 72 | **Done 22.11.2026 (deploy 139):** `front/src/lib/saverules.ts` holds one row per save (`SAVE_RULES`: the door path, its `key`, `resend`, `long`, `slow`, `coaching` and its `pages`, at least one, the type check failing on none), and `KEYED`, `NEVER_RESENT`, `mayResend`, `SLOW`, `waitMs`, `replays` and every page's action list (`TODAY_SAVES` named per row, no longer every save not named elsewhere) are made from it; the bodies stay in `saves.ts` under the same names (the type check fails when the names differ). `src/lib/server/savebehaviour.test.ts`, written first, holds each save's behaviour as it was, and passed unchanged before and after; nothing behaves differently. It found three saves where the front sends a key the core does not use (`held_retry`, `held_delete`, `habits_manage`), each harmless and kept. One read helper, `src/lib/server/read.ts` (`readDoor`, `readDoors`, `readSettings`), replaces readGym, readEach and the try/catch copied into the layout and eight pages, each page's own handling an option (`notThere`, `required`, `together`). One place for how each save behaves (keyed, may be sent again, unsure, slow), and one read helper | `KEYED` in `saver.ts` is a hand copy of the server's list; `TODAY_SAVES` takes every save not named elsewhere; three read helpers and six hand-written copies of the same try/catch | M |

Smaller, to take along: reduced motion is not honoured; field borders are fainter than 3:1 (`--line`, `--input`); a chart's
values cannot be reached by keyboard; no offline page, and text typed in the logging box is lost when the app is closed;
GitHub runs the unit tests and the type check but no build and no browser checks.

### 52. Coaching (02.11.2026; done 04.11.2026, deploy 51, with the owner's answers: cards + Coach page, no thoughts, on demand only, My goals in Settings > Coach)

- **Day coach** (button on Today, for the day shown): what went well, what to improve, the next meal (from foods the user actually eats,
  fitted to the protein, carbs, fat and kcal left against that day's targets, and the time of day), and gaps in the log (no weight yet, ...).
- **Week review** (button on the Week page): the week against the targets, trends in weight, blood pressure, fasting sugar and sleep,
  habits kept and missed, best and hardest days, one or two focus points for next week. It may also read that week's daily coachings.
- **Model:** claude-opus-5-5, effort high (the user's choice), only when a button is pressed. Estimates, not measured: 20 to 60 s per
  coaching (show "Coaching..." while it works; the provider's 60 s timeout needs to be longer for this), about 5 to 20 cents a day coaching,
  10 to 40 cents a week review. Cost shown on the Usage page as its own kind (audit_log).
- **Saved:** each coaching kept in a new table (day or week, text, model, cost, time), shown again without a new call; "Coach me again" asks
  for a fresh one.
- **Health caution:** comment only on what was logged, no medical advice; say when something is worth raising with the doctor.
- **Goals:** a short "My goals" text in Settings that the coach reads every time (without it, it can only coach against the targets).
- **Undecided (ask the user):** (1) buttons on Today and Week, or a Coach page under More with all past coachings; (2) whether the coach sees
  thoughts and ideas (private and gratitude entries left out by default); (3) on demand only, or also a Sunday-evening week review as a
  notification (that would also cover the digest, item 45 / core 17); (4) the user's goals, or the Settings field for them.
- **Data to give it:** the day's (or week's) food entries by meal with macros and targets, habits, health values (weight, BP, sugar, bed and
  wake times), the last 7 days for context, the catalogue's frequently eaten foods for the next-meal suggestion.

## Suggested order

Replaced on 02.11.2026 by "Priorities" at the top (the old order, items 1 to 14, is all done).

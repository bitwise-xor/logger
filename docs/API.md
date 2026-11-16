# The JSON door `/api/v1` (for the new front end)

Since deploys 75 and 76 (16.11.2026); deploy 77 (16.11.2026) made the changes of the door's review (marked "since 77");
deploy 78 removed the old field names that 77 kept for one deploy; deploy 86 added the usual-meal editor; deploy 89 the scanner, the label photo and the look-up; deploy 91 the Health page and body measurements; deploy 93 the Habits page. The front end that calls it: `front/` (`front/README.md`).
Code: `core/app/api.py` (the door, the saves), `core/app/reads.py` (the reads).
Tests: `tests/test_api_door.py`, `tests/test_api_reads.py`, `tests/test_api_saves.py`, `tests/test_api_shape.py` (77),
`tests/test_api_usual.py` (86), `tests/test_api_scan.py` (89), `tests/test_api_health.py` (91), `tests/test_api_habits.py` (93).

The door is for one caller only: the new front end's own server, from inside Docker. The browser never calls it.
The live web app at `app.` does not use it and did not change.

## Who may call it

Every route checks these in order. Steps 1 to 3 all fail the same way (404 `not_found`), so the door is invisible to anyone else.

1. **The door is on:** `FRONT_TOKEN` is set in `.env` (passed by `compose.yaml`), 32 characters or more. Unset: every path answers 404.
2. **From inside Docker:** the `Host` header is exactly `logger-v2-core:8000`, and there is no Cloudflare or proxy header
   (`cf-ray`, `cf-connecting-ip`, `cf-visitor`, `x-forwarded-for`, `x-forwarded-host`, `x-forwarded-proto`, `forwarded`, `x-real-ip`).
   Caddy's `app.` site forwards only `/` and `/web/*`, so `/api/` never arrives through it.
3. **The front end's service token:** header `X-Front-Token: <FRONT_TOKEN>` (compared in constant time).
4. **The owner's session** (every route but the sign-in): `Authorization: Bearer <session token>`. Missing, wrong, expired or
   signed out: 401 `signed_out`.

A session of `app.` never works here, and a session made here never works as `app.`'s cookie (`web_sessions.front`, migration 031).

The front end reads these as plain messages (since deploy 85, `front/src/lib/problems.ts`): 404 `not_found` = the door is off
(it links to `app.`), no answer at all = the core is down, 401 `signed_out` = sign in again; anything else = try again.

## Every answer

- JSON, `"v": 1` in every body, `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`.
- Signed-in calls carry `X-Session-Expires: <ISO time, UTC>`: the session's end. A session in use renews like a page view
  (once a day the end moves to 30 days from now); the front end can renew its own cookie from this header.
- Errors: `{"v": 1, "error": "<code>", "message": "<plain text>"}`. Codes: `not_found` 404, `signed_out` 401,
  `wrong_credentials` 401, `too_many_tries` 429, `bad_request` 400, `too_large` 413 (body over 64 KB), `no_entry` 404,
  `server_error` 500. Only `POST /food/label` takes a larger body (up to three photos, see below).
- Request bodies are a JSON object. Values: numbers, ISO 8601 times in Europe/Berlin with the offset (`2026-01-31T08:05:00+01:00`),
  dates as `yyyy-mm-dd`, durations in minutes. Display strings are the front end's job.

## Sign-in

| Route | Body | Answer |
|---|---|---|
| `POST /api/v1/session` (no bearer) | `password`, `code` (authenticator), `device` (optional: the token this browser got last time), `user_agent` (the browser's, for Settings > Devices) | 201 `{token, device, expires_at}`; 401 `wrong_credentials`; 429 `too_many_tries` |
| `GET /api/v1/session` | | `{signed_in: true, sid, expires_at}` |
| `DELETE /api/v1/session` | | `{outcome: "signed_out"}` |

The checks are the web app's own (`web.sign_in`): the same failure limit (5 in 15 minutes), pooled per trusted device (a browser that
signed in before counts its own failures; all others share one pool, together with `/web/login`), each code once. The front end keeps
`token` and `device` in its own cookies; only their hashes are stored. Sessions show under Settings > Devices as "… · new front end".

## Reads

### `GET /api/v1/day?day=yyyy-mm-dd` → `{"day": Day, "undo": Undo}`

Today without `day`; an earlier day as asked; a later day is today. Built on `todaypage.load`, `webquestions.load`, `held.rows` and the
gratitude count. No Home or Coach cards; the Gym card since 95 (`gym`).

```
Day = {
  day, today, past,
  header:  {wake_at, slept_minutes, awake_minutes, naps: [{bed_at, wake_at, minutes}], next_sleep, watch_wake_at},
  needs: {
    questions: [Question],                              // today only; every open question, newest first
    not_read:  [{id, received_at, text, tries, needs_you, reading}],   // messages kept but not read yet (today only)
    review:    [{ref, kind, label, day, reason, at, logged_at, thought_type, area, type, v1, v2, unit}],
    checkin:   null | {day, mood, energy, scale: {mood: [5 words], energy: [5 words]}},
    body_due:  null | {last, days}                      // (91) "Body measurements due": the last session (yyyy-mm-dd) and how many days ago
  },
  energy:  {totals: {kcal, protein, fat, carbs}, targets: {…same, null if none}, meals: [{meal, label, nutrients}]},
  water:   {ml, target_ml, glass_ml},
  chips:   {again: [{food_id, name, amount, unit}],
            usual: [{meal_id, name, nutrients, items: [{item_id, food, amount, unit, nutrients}]}]},
  rows:    [Row],                                       // food and health together, in time order, unknown times last
  health:  [{row, label, sub, type, period, unit, ref, v1, v2, at, last_at}],   // the Health card, shown rows in the chosen order
  habits:  [{name, label, done, target, complete, avoid, last_tick}],
  gratitude: {count, goal},                             // a count only, never words
  gym: null | {last_workout, day_label, days: [{day, on, today}], n14, last_week, this_week, text}
                                                        // (95) Today's Gym card (gympage.today_data); null for a past day, as app.:
                                                        // the last workout's day, today's day of the split ("Day 1 · Push", "Free
                                                        // workout", or null without a split), the last 14 days oldest first, n14
                                                        // of them with a workout, the weeks' counts and app.'s line
                                                        // ("Last week 3 workouts · this week none yet")
}
Row (food)   = {ref: "f<id>", kind: "food", meal, at, time_known, food, food_id, amount, unit, portion_text,
                nutrients: {kcal, protein, fat, carbs}, usual_meal: null | {id, name}}
Row (health) = {ref: "m<id>" | "e<id>", kind: "measurement" | "event", type, label, at, time_known, v1, v2, unit, period, needs_review}
Question     = {id, tool, kind, asked_at, open_until, message, text, read_back,
                answers: [{reply, label, style: "primary" | "plain" | "quiet"}],
                free: null | {placeholder, type: "text" | "number", unit},
                lookup: null | {name, source: "usda" | "off", per_100: {kcal, protein, fat, carbs}, unit: "g" | "ml"},
                refill: null | {label: "Correct it" | "Log again", text}}
Undo         = null | {token, head, expires_at}         // the session's Undo, the same as in the last save's answer
```

- `meal`: 1, 2, … by the 2-hour rule; 0 = the day's drinks. `ref` values are stable: the saves take them.
- `health[].ref` is the entry a correction changes; `null` = nothing logged yet. Twelve hours after the wake-up, Woke up and Bed are
  for the next sleep: `ref` null, the last time in `last_at` (`header.next_sleep` true). Bed's `at` is the night's bed time, an entry of
  the logging day before (since 77). Blood pressure: `v1` is the upper (systolic), `v2` the lower (diastolic) value.
- `habits[].last_tick` is the tick an untick removes.
- `Question.answers` are buttons: send the `reply` to `/answer`; `style` is how app. draws it: `primary` the main one, `plain`, `quiet`
  (Skip, No, Cancel). `free`: a field whose words go to `/answer`. `refill`: a button with `label` that puts `text` back in the log box.
  `read_back`: show before the answers. `lookup.per_100` is per 100 g, or per 100 ml for a drink (`unit`).
- A question about private entries, or whose `message` names one, has `text` "Not shown here: …" and `message`, `refill` and `read_back`
  null.
- `review[].at` is when it happened (ISO; a thought: when it was logged; null when the time is not known), `logged_at` when it was
  logged (since 77; until 77 `at` was the logged time; the old `time`, hh:mm of an event, is gone since 78).
- `undo` (since 77): the session's Undo while it lasts, so the Undo bar can stay after a reload.
- A thought to review comes with `thought_type` and `area`, never its words (`label` null).
- `needs.body_due` (91): app.'s line in Today's To review card (`body.due`, `bodypage.today_line`): today only, after the wake-up, when
  the last tape-measure session is `interval_days` (Settings > Body, 28) or more ago; `last` and `days` both null before the first
  session ("not measured yet"); null after "Not today" (`POST /body/skip`) until the next health day. "Measure" opens the body form.

### `GET /api/v1/food/day?day=` → `{"food_day": FoodDay, "undo": Undo}`

```
FoodDay = {day, today, past, rows: [Row (food) + note], meals: [{meal, label, nutrients}], totals, targets}
```

Built on `foodpage._day_rows`.

### `GET /api/v1/food/entry?ref=f<id>` → `{"entry": {...}}`

`{ref, day, food_id, food, amount, unit, at, time_known, note, units: [{unit, in_basis}]}`. `units`: the food's own unit first
(`in_basis` 1), then its other units with how much of the base unit one is ("slice", 35). Unknown: 404 `no_entry`.

### `GET /api/v1/usual` → `{"usual": [Usual], "undo": Undo}` (86)

Every usual meal and drink by name, also those hidden from Today's chips (`reads.usual`, the query of app.'s Usual meals tab):

```
Usual = {meal_id, name, drink, nutrients: {kcal, protein, fat, carbs},
         items: [{item_id, food_id, food, amount, unit, nutrients}]}      // chips.usual's shape plus drink and food_id
```

Items in their order; `amount` in the food's `unit` (g, or ml for a drink).

### `GET /api/v1/foods?q=` → `{"foods": [{food_id, name, unit, drink, per_100: {kcal, protein, fat, carbs}}]}` (86)

Up to 20 active foods for the words (the Catalogue's search: name, one of its words, N number or barcode), most eaten first; no
`q` = the 20 most eaten. To pick a food for a usual meal; `per_100` is per 100 g, or per 100 ml (`unit`).

### `GET /api/v1/foods/barcode?code=` → `{code, food}` (89)

The scanner: the active catalogue food with this barcode (`webfood.scanned`, app.'s own scanner), or `food: null`.
`code`: 8 to 14 digits; spaces and dashes are left out; anything else is 400 `bad_request` ("A barcode is 8 to 14 digits."). A
12-digit UPC-A code also finds its EAN-13 (the same with a 0 in front), and the reverse.

```
food = null | {food_id, name, unit: "g" | "ml", amount}     // amount: the last amount eaten, 100 when it was never eaten
```

A found food is logged through `POST /again` (`food_id`, `amount`); no route of its own.

### `GET /api/v1/foods/off?code=` → Open Food Facts' values to check (89)

`webfood.off_values` (app.'s "Look it up" in the scanner); nothing is saved. The same code rule as above (400 otherwise).

```
{ok: true, name, brand, basis: "g" | "ml", note,
 values: {kcal, protein, fat, carbs, sat_fat, sugar_total, fibre, salt_g}}    // per 100 g or ml; a value it does not know is null
{ok: false, reason}                                    // not in Open Food Facts, not all its values, or it did not answer
```

The form fills from this; its Add is `POST /food/labeladd` with `source: "off"`.

### `GET /api/v1/health?range=7|30|90&all=1` → `{"health": Health, "undo": Undo}` (91)

app.'s Health page as data (`healthpage.load`, `charts`, `times_data`: app.'s page draws the same). `range` 30 when not given; another
value is 400 `bad_request` ("range must be 7, 30 or 90."). `all=1`: a row for every day of the range, else the last 14.

```
Health = {
  today, start,                       // the range: start .. today
  range, ranges: [7, 30, 90], all, days_in_range, shown_days: 14,
  oldest_day,                         // a save takes a day from here (today − 365) to today
  columns: [{row, label, sub, type, period, kind}],   // the row's order: weight, bp_morning, bp_evening, sugar, bed, wake, mood, energy
                                                      // kind: "number" | "pair" (blood pressure: upper, lower) | "time" (hh:mm)
  days: [{day, values: {<row>: null | HValue}, slept_minutes}],   // newest first
  charts: [Chart],                    // weight, bp, sugar, sleep, mood (in this order)
  times: Times                        // the sleep-times chart
}
HValue = {ref, v1, v2, time, at}      // ref: the entry a change goes to (m<id> or e<id>); numbers in v1 (v2: blood pressure's lower);
                                      // bed and wake: time "hh:mm" and at (ISO); bed is the night's, the evening before
Chart  = {id, title, small,           // small: the grey words after the title ("mmHg") or null
          stat: [{text, bold}],       // the line under the title, in parts ("80.4 kg" bold, " last · ", …)
          chart: {start, days, series: [{mark, cls, pts}], label, lines?, min?, max?, unit?, decimals?},
          legend: [{key, text}]}      // key: the colour key's class (a, b, line b, ref, ref r)
Times  = {days, empty, title, small, legend,
          rows: [{date, label, bands: [{from, to, nap, tip}], ticks: [{at, nap, tip}]}]}
```

- `chart` is exactly what app. puts into `data-chart` for its `drawChart` (`core/app/static/app.js`), so the page ports that one
  drawing function: `start` the first day (yyyy-mm-dd) and `days` the length; a series' `mark` is `line`, `dot` (filled), `ring`
  (blood pressure in the evening) or `bar` (sleep), `cls` its colour (`a`, `b`), `pts` `[day index from start, value, hover text]`
  (a line's points have no text); `lines` the dashed reference lines `[value, "w" (grey) | "r" (amber), label]` (blood pressure
  130/80 and 140/90, sugar 100 and 126, sleep 7 h and 6 h); `min`/`max` a fixed bottom or top (sleep from 0; mood 1 to 5); `unit` after
  the axis numbers (" h"); `decimals` of the axis (weight 1).
- `times`: a row per calendar date, oldest first (at most 30), the clock across 0 to 24 h; `from`, `to` and `at` in minutes from that
  date's midnight (0 to 1440). A sleep over midnight is a band on each of its two rows; `nap` = a nap or a night waking (lighter);
  a tick is a wake-up without a bed time. `label`: the date on the row's left (the last row and Mondays; every row in 7 days), else
  null. `empty`: no bed or wake-up times at all ("No bed and wake-up times in this range yet.").
- `slept_minutes`: bed to wake-up of that day's wake-up, null without both (or 24 hours or more).

### `GET /api/v1/body?day=yyyy-mm-dd&range=7|30|90` → `{"body": Body, "undo": Undo}` (91)

The Body measurements card (`bodypage.load`, `table`, `chart_data`). `day`: the session the form shows and changes (today without
it; a later day is today); `range` (30): the charts show the sessions in it, or every session when fewer than 2 are in it. app.'s
`measure` (the form open) and `bx` (which measure's chart) are the page's own state: every chart comes, one per measure.

```
Body = {
  today, day, last_measured,          // yyyy-mm-dd, null before the first session
  due_text,                           // "due now", "next due in 3 days", "next due in about 4 weeks"; null before the first session
  interval_days, hidden: [keys],      // Settings > Body (read only here; changed at app.)
  jump_cm: 4, protocol, hint,         // the form's line on how to measure; the line under the card (typing it in the Log bar)
  form: [{key, label, hint, ref, cm, last_cm, min, max}],   // the shown measures in order: waist, hips, chest, upper_arm, thigh
                                      // cm: the session's value (ref its entry) or null; last_cm: the last value before the
                                      // session (the field's placeholder); min, max: the usual range (outside it is read back)
  table: [{key, label, ref, cm, day, last, start, last_text, start_text}],   // Now / Last / Start: each measure's newest value
                                      // and its change since the time before and since first_day (null with one value);
                                      // the *_text as app. writes them ("+1.5", "−2.0", "±0")
  first_day,
  charts: [{key, label, chart}],      // as Health's chart, with pointLabels and xAtPoints (the dates of the points on the axis)
  waist_height: null | {waist_cm, day, height_cm, ratio},   // the newest waist ÷ the height of that day; height_cm and ratio
                                      // null without a height ("add your height in Settings"); under 0.5 is the common target
  weight_rate:  null | {kg_week, pct_week, sign}            // the 7-day average weight now against 4 weeks before, a week;
                                      // sign "+", "−" or "±" (under 0.005 kg); null without weighings in both weeks
}
```

### `GET /api/v1/habits?show=tracked|untracked|retired|all` → `{"habits": Habits, "undo": Undo}` (93)

app.'s Habits page as data (`habitspage.load`, `todo`, `calendar`, `sections`, `stats`: app.'s page draws the same). `show` is the
filter of "Your habits" (`tracked` when not given; another value is 400 `bad_request`: "show must be tracked, untracked, retired or
all."); today's ticks and the calendar do not depend on it.

```
Habits = {
  today, start, days: 30,             // the calendar: start .. today
  edit_from,                          // the oldest day a save changes (today − 35); the calendar shows 30, a five-week one can use 35
  checklist: {done, total,            // "n of N done": a habit to avoid is not counted
              habits: [{name, label, done, target, complete, avoid, last_tick}]},   // every tracked habit, in Today's order
                                      // (the Habits page ignores Settings > Today page's hidden ones, as app. does);
                                      // last_tick: the tick an untick removes (POST /habit), null without one today
  calendar: [{name, label, target, avoid, full, editable,       // a tracked habit; full: the days done (avoid: the days without)
              days: [{day, n, state, text}]}],                  // oldest first, 30 days, today last
  show, help,                         // the filter and app.'s line under it
  shows: [{key, label, count}],       // tracked, untracked, retired, all
  list: [{group, label,               // the groups with habits in this filter (intake, practice, learning, daily, behaviour)
          habits: [{name, label, group, target, order, avoid, state, ticks, days30, last_day, stats, can_track, can_delete}]}],
  groups: [{key, label}], default_group: "practice",   // for a new habit
  limits: {label_max: 40, target_min: 1, target_max: 10, order_max: 999}
}
```

- A calendar day: `n` ticks of that day against the habit's `target`; `state`: `done` (n at least target), `partly` (some, fewer), `none`;
  for a habit to avoid `logged` (n above 0, "it happened") or `none`. `text` is app.'s hover text: "done", "1 of 2", "not logged",
  "2 logged", "none". `editable: false` = a time (Wake-up): no save (none is listed today).
- A list row: `state` is `tracked`, `untracked` (active, not on Today) or `retired`; `target` times a day; `order`; `avoid`: the aim;
  `ticks` all ticks ever, `days30` the days of the last 30 with one, `last_day`; `stats` is app.'s line ("12 of the last 30 days · last
  13.11.", "Never ticked", "Last ticked 02.08."). `can_track`: Track on or off works (not for a retired habit); `can_delete`: no history,
  so Delete works. Edit and Retire (or Bring back, for `retired`) always work.
- Wake-up and Bedtime are times, not habits: never listed. Hiding and ordering habits on Today and the reminders stay at app.
  (Settings > Today page, Habits): no route here.

### `GET /api/v1/gym` → `{"gym": Workout, "undo": Undo}` (95)

app.'s Gym › Workout tab as data (`gympage.load`, `workout_list`, `row_data`, `daypick_data`, `split_card_data`, `weeks_data`: app.'s tab
draws the same).

```
Workout = {
  today, title,                       // "Day 2 · Pull", "Free workout" or "Today’s workout" (no split)
  started_at, done, status,           // the first tick's time (null before), exercises done today, app.'s "started 17:05 · 3 done"
                                      // or "not started: the first tick starts it"
  has_split, day: null | {day_id, name, label}, free, picked_by_hand,
  chips: [{day_id, label, on}],       // every active day, then Free workout (day_id null); [] without a split ("No split yet: make
                                      // one on the Plan tab"); POST /gym/pick with the chip's day_id
  why,                                // the line under the chips ("Your 2nd workout this week: the first day not done yet. …"), null without a split
  exercises: [GymRow],                // app.'s order: the day's exercises in the plan's order (a retired one only when done today),
                                      // then others done today; without a day (Free workout, no split) every active exercise
  other: [GymRow],                    // the rest, under "Other exercises (n)" (closed)
  empty, hint,                        // the line when exercises is [] ("No exercises on this day yet: add them on the Plan tab."),
                                      // the hint under the list (null when there is nothing)
  week_split: [{day_id, label, exercises, done, today}],   // "This week’s split": exercises as one line, done the date this week (or null)
  weeks: {good, weeks: [{start, label, n, days: [{day, on, today, later}]}]},   // the last 4 weeks, Monday first; good: weeks with 2+
  retired: [names],                   // "+ Add exercise": a retired one of the same name comes back with its history
  fields: {weights|bodyweight|cardio: [{name, label, step, min, max}]},   // the − / + of each kind (gympage.FIELDS)
  numbers,                            // gym.NUMBERS, the refusal of a number out of range
  kinds: [{key, label}]               // weights "Weights", bodyweight "Bodyweight", cardio "Machine cardio"
}
GymRow = {exercise_id, name, kind, active,
  done, logged: [Set],                // today's rows; done: the circle is ticked (a tap = POST /gym/remove {exercise_id}: all of them)
  values: {sets, reps, kg, minutes, km},   // the numbers the editor opens with and the circle logs: today's last row, else the last
                                      // session's heaviest, else the plan's sets × reps (first time), else 3 × 8, 3 × 10 or 20 min
  ready,                              // values are complete: one tap logs them (POST /gym/tick with them); else "set the numbers first"
  text,                               // the line under the name: today's rows, or the numbers the circle logs, or "first time: set the numbers"
  up_kg,                              // weights done today heavier than the last session: the difference ("+2.5 kg"), else null
  last: null | {day, rows: [Set]}, last_text,   // "Last Tue 04.11.: 3 × 8 at 60 kg" or "Not done before · plan 3 × 10"
  plan: null | {item_id, sets, reps}, // on today's day of the split (sets, reps null: no plan numbers)
  open}                               // the editor starts opened: an exercise never done without complete numbers (on a day of
                                      // the split only the first such one; in "other" never)
Set = {set_id, sets, reps, kg, minutes, km, text}   // a logged row; text "3 × 8 at 60 kg", "3 × 12", "25 min · 3.2 km"
```

### `GET /api/v1/gym/plan` → `{"gym_plan": Plan, "undo": Undo}` (95)

```
Plan = {
  today, how,                         // "How the day is picked" (app.'s paragraph)
  week,                               // "This week: Day 1 · Push on Mon done. Today: Day 2 · Pull." (null without a split)
  done: [{day_id, label, day}],       // the days done this week (before today) and the date
  day: null | {day_id, name, label}, free,
  days: [{day_id, name, label, today,                 // the active days in order (Day 1, Day 2, …)
          items: [{item_id, exercise_id, name, kind, active, sets, reps, text}],   // text "Weights · plan 3 × 10", "… · retired";
                                                                                   // cardio has no plan numbers (set when logged)
          can_add: [{exercise_id, name}]}],           // the active exercises not on the day ("+ Add exercise")
  removed: [{day_id, name}],          // "Removed days", Bring back
  limits: {name_max: 40, sets_min: 1, sets_max: 50, reps_min: 1, reps_max: 500}
}
```

### `GET /api/v1/gym/exercises` → `{"gym_exercises": Exercises, "undo": Undo}` (95)

```
Exercises = {
  active,                             // "n active"
  exercises: [{exercise_id, name, kind, kind_label, words, active, workouts, last_day, use, meta}],
                                      // the list's order, retired ones too (active false: "Bring back"); use "12 workouts, last 04.11."
                                      // or "not done yet"; meta app.'s whole line "Weights · also: bench · 12 workouts, last 04.11."
  kinds: [{key, label}], limits: {name_max: 60, words_max: 10, word_max: 40}
}
```

### `GET /api/v1/gym/progress?x=<exercise id>` → `{"gym_progress": Progress, "undo": Undo}` (95)

app.'s Progress tab (`gympage.progress`, `per_week`). `x` an exercise done at least once; without it, or an exercise never done,
the most recently done one (as app.); `x` not digits is 400 `bad_request` ("x must be an exercise's id.").

```
Progress = {
  today, start, weeks: 8,             // the chart's 8 weeks: start .. today
  per_week: {weeks: [{start, n}], top, good},   // workouts per week, oldest first (the Mondays); top: the bars' top (3 at least);
                                      // good: weeks with 2+ ("5 of 8 weeks with 2+"). app. draws it as an SVG; here the data
  exercises: [{exercise_id, name, on}],         // the chips: every exercise done, the most recently done first
  exercise: null | {exercise_id, name, kind},   // null: nothing logged yet ("Nothing to show yet: tick exercises on the Workout tab")
  unit, title,                        // kg "top weight", reps "most reps in a set", min "longest session"
  top, top_reps, top_text,            // the last session's best: the heaviest set (and its reps), the most reps, the longest; "62.5 kg"
  change,                             // "+5 kg since 22.09.", "−2 reps since …", "same as …", "one session so far", "no sessions in the last 8 weeks"
  one_rep_max,                        // weights: the estimated 1-rep max (kg, whole), else null
  sub,                                // "Top set 62.5 kg × 8 · estimated 1-rep max ≈ 79 kg" or "Last session Tue 04.11."
  chart: null | Chart.chart,          // as drawChart takes it: series line and dot, pts [day index, value, "Tue 04.11.: 3 × 8 at 60 kg"],
                                      // decimals 1; null: no session in the 8 weeks ("No sessions in the last 8 weeks.")
  recent: [{day, text, rows: [Set]}]  // the last 6 sessions, newest first
}
```

### `GET /api/v1/gym/history` → `{"gym_history": {"workouts": [...]}, "undo": Undo}` (95)

The last 60 workouts, newest first (`gympage.history`): `{workout_id, anchor, day, split_day_id, split, started_at, ended_at, when,
exercises: [{exercise_id, name, kind, text, rows: [Set]}]}`. `anchor` "w<id>" (app.'s card id: a search result links to it); `split` the
day's name or "Free workout"; `ended_at` the last tick (there is no Finish button); `when` "17:05–18:10" or "17:05"; `text` the
exercise's rows as one line.

### `GET /api/v1/gym/activity?day=yyyy-mm-dd` → `{"gym_activity": Activity, "undo": Undo}` (95)

app.'s Activity tab, read only (`activitypage.load`, `setup`): one calendar day of the watch's data (today without `day`; a later day is
today; not a date: 400 "day must be yyyy-mm-dd."). app. shows the Activity tab once any watch data has come.

```
Activity = {
  has_data,                           // false: no watch data at all yet; then only setup, the rest null or []
  setup: null | {title, token_set, intro, steps: [[{text, code}]], note},   // the set-up guide's words; code: drawn as code
  today, day, label,                  // "Today", "Yesterday" or "Mon 16.11."
  prev_day, next_day,                 // the arrows (next_day null on today)
  tiles: [{key, label, value, unit, text, avg7, sub}],   // steps, sleep (the night before, hours), active energy, exercise
                                      // minutes, distance, floors, resting heart rate, heart rate variability; text "2 000", "100 kcal",
                                      // "7 h 15 min", "–" without a value; sub "7-day avg 2 000" (steps, resting heart rate), "night before"
  sleep: null | {hours, text, in_bed_from, in_bed_to, in_bed, stages: [{key, label, hours, text}], stages_text,
                 typed: null | {bed_at, wake_at, hours}, typed_text},   // the night before; typed: the times typed in the Logger
  workouts: [{name, start_at, end_at, minutes, kcal, hr_avg, km, meta, matches}],   // matches: the Logger's workout of that day
                                      // ("Day 2 · Pull", "Free workout") when it started within 3 hours, else null
  charts: [{id, title, chart}]        // steps, sleep, rhr: 7 days ending on day, as drawChart takes them
}
```

## The label photo: `POST /api/v1/food/label` (89)

One to three photos of ONE package (the name and the nutrition table often need two), read together in one AI call
(`labelread.read`, Claude Sonnet). Nothing is saved; the photos are not kept (one cost row in the audit log: the AI's tokens and
the number of photos, never the photo or the values).

- Body: `multipart/form-data`, the field `photo` once, twice or three times; each JPEG, PNG, WebP or GIF (its part's content
  type), at most 8 MB. This route only is exempt from the 64 KB cap: the whole body may be up to 3 × 8 MB + 64 KB, cut off while
  it is read (also without a Content-Length).
- Refusals (HTTP errors, nothing reaches the AI): 400 `bad_request` "No photo came with the request." / "At most 3 photos." /
  "A photo must be JPEG, PNG, WebP or GIF." / "A photo is empty." / "Send the photos as multipart/form-data, in the field photo."
  (also a body that is not readable multipart); 413 `too_large` "A photo is too large: at most 8 MB each, 3 photos.".
- Answer (200):

```
{ok: true, name, brand, basis: "g" | "ml", note,       // name, brand: as printed, or null; note: one sentence to check, or null
 values: {kcal, protein, fat, sat_fat, carbs, sugar_total, fibre, salt_g}}    // per 100 g or ml; not on the label: null
{ok: false, reason}                                    // not readable ("Try a sharper photo …"), or the AI did not answer
```

The page should make its photos smaller before sending (a few hundred KB each is plenty for a label): the AI service takes a
limited request size, and three photos of 8 MB would be too much for it (not tested against the live service).

## Saves (`POST`)

Each calls the same function as the live form and passes `key` (a new random string per action, the same on a re-send) where that
function takes one, so a re-sent request saves once (`replayed: true`).

| Route | Body | Calls |
|---|---|---|
| `/api/v1/log` | `text`, `key` | `logbook.log` (synchronous: it can wait for the AI up to about 40 s; then `held`, the words kept) |
| `/api/v1/again` | `food_id`, `amount`, `time` (hh:mm, optional = now), `key` | `webfood.again` |
| `/api/v1/usual` | `meal_id`, `key`; optional `items: [{item_id, amount}]` (only these, with these amounts) and `time` | `webactions.usual` |
| `/api/v1/water` | `key`, `ml` (optional, 50 to 2000; default 250) | `webfood.water` |
| `/api/v1/habit` | `name`, `action`: `tick` or `untick`, `ref` (the tick, optional: today's last), `key` | `webactions.habit` |
| `/api/v1/checkin` | `type`: `mood` or `energy`, `value` 1 to 5, `day` (optional: yesterday while asked), `key` | `webactions.checkin` |
| `/api/v1/health` | `row` (`bed`, `wake`, `weight`, `sugar`, `bp_morning`, `bp_evening`), `v1` (blood pressure: upper) and `v2` (lower), or `time` (hh:mm, bed and wake), `ref` (to correct), `confirmed`, `key` | `webactions.health` |
| `/api/v1/answer` | `question_id`, `reply` | `logbook.answer` (no key) |
| `/api/v1/review` | `action: "ok"` + `ref`, or `action: "all"` + `refs: [...]` (the refs shown) | `webactions.review` |
| `/api/v1/food/entry` | `ref`, `action`: `save` (`amount`, `unit`, `time`, `food_name`) or `delete`, `confirmed` | `webfood.entry` |
| `/api/v1/food/note` | `ref`, `note` (empty = removed) | `webfood.note` |
| `/api/v1/undo` | `token` (from the last answer's `undo`) | `webundo.apply` |
| `/api/v1/held/retry` (77) | `id` (a number: `day.needs.not_read[].id`), `key` | `webheld.retry` (app.'s "Try again": reads it now, like `/log`) |
| `/api/v1/held/delete` (77) | `id` | `webheld.delete` (app.'s "Delete", with Undo: the message comes back) |
| `/api/v1/usual/meal` (86) | `meal_id`, `action`: `save` (`name`, `items: [{food_id, amount}]`: the whole list, in order, up to 40) or `delete`, `confirmed`, `key` | `webfood.usual_meal` |
| `/api/v1/usual/new` (86) | `name`, `drink` (true or false, default false), `items: [{food_id, amount}]` (1 to 8), `key` | `webfood.usual_create` |
| `/api/v1/usual/from_meal` (86) | `day` (yyyy-mm-dd), `meal` (1, 2, …; 0, the drinks, is refused), `name`, `key` | `webfood.usual_new` |
| `/api/v1/food/labeladd` (89) | `name` (2 to 120 characters), `basis` (`g` or `ml`, default `g`), `kcal`, `protein`, `fat`, `carbs` (numbers, per 100), optional `sat_fat`, `sugar_total`, `fibre`, `salt_g` (numbers or null), `barcode` (8 to 14 digits; otherwise left out), `source` (`label`, default, or `off`), optional `amount` (to log it now, in g or ml, above 0 and at most 5000) and `time` (hh:mm, default now), `key` | `webfood.label_add` |
| `/api/v1/health/day` (91) | `day` (yyyy-mm-dd), `values: {<row>: value}` (only the rows sent are looked at), `confirmed`, `confirm_delete`, `key`; `range`, `all` for the fresh read | `webactions.health_day` |
| `/api/v1/body` (91) | `day` (the session, yyyy-mm-dd), `values: {<measure>: cm}` (only the measures sent are looked at), `confirmed`, `confirm_delete`, `key`; `range` for the fresh read | `webactions.body_save` |
| `/api/v1/body/skip` (91) | | `webactions.body_skip` ("Not today": the due line hidden until the next health day; no Undo) |
| `/api/v1/habit/day` (93) | `name`, `day` (yyyy-mm-dd), `key`; `show` for the fresh read | `webactions.habit_day` (a square of the calendar) |
| `/api/v1/habits/manage` (93) | `action`: `track`, `retire`, `restore`, `edit`, `delete` or `new`, and its fields (below), `key`; `show` for the fresh read | `webhabits.ACTIONS[action]` |
| `/api/v1/gym/<action>` (95) | `action` in the path: `tick`, `remove`, `pick`, `new`, `rename`, `active`, `daynew`, `dayedit`, `dayactive`, `itemadd`, `itemset`, `itemmove`, `itemremove`; its fields (below), `key`; `view` for another fresh read | `gym.ACTIONS[action]` (app.'s `/web/gym/<action>`) |
| `/api/v1/lookup` (89) | `text` (a name, or a barcode of 8 to 14 digits), optional `question_id` (an open food question it answers; without `text` the question's word is looked up) | `webfood.look_up` → `logbook.food_lookup` (no key: it saves nothing) |

The usual-meal saves (86): the front end sends `confirmed: true` and the change is made at once, with Undo (without it a change or
delete is read back first, as on app.: `needs_confirmation` with `read_back` and `confirm`). Amounts above 0 and at most 5000 (g or ml); a
name of 2 to 60 characters that no other usual meal has, in any case ("There is already a usual meal called …"); foods active in
the catalogue. Each refusal is `rejected` with a plain `reason` and changes nothing. A `key` saves once: a re-send gets the first
answer with `replayed: true`; the same key with another body is refused ("This form was already used."). Undo puts the meal back as
it was (name, foods, amounts, the same item ids), after a delete also the past entries' link to it (`Row.usual_meal`); a new one is
removed again. app.'s Usual meals tab got the same Undo bar.

The label food (89): the checked values go into the catalogue through the logger's own new-food checks (impossible values are
refused, `rejected` with a `reason`), with the barcode and a source note ("label photo read by Claude, checked by the owner on …",
or "Open Food Facts, …" with `source: "off"`). Without `amount` the answer is `changed` ("Added … to your catalogue. Scan it again or
find it in the Again chips to log it.") and there is no Undo. With `amount` it is logged at once like an Again chip: `saved`, and
**Undo takes back the logged entry only; the catalogue food stays** (it can be hidden in app.'s Catalogue). An amount that is
refused still adds the food (`rejected` with the head "Added …" and the reason). A `key` saves once: a re-send gets the first answer
(`replayed: true`) and adds no second food; the same key with other values is refused ("This form was already used."). A wrong kind
of field is 400 `bad_request` (`kcal must be a number.`, `basis must be g or ml.`, `source must be label or off.`).

The look-up (89): by barcode Open Food Facts, by name USDA and Open Food Facts (an AI call picks the best fit). A food found is read
back: `needs_confirmation`, `read_back` (its values per 100) and its question in `questions` (`tool: "lookup_confirm"`, `text`
"Add this food?", answers `yes` and `no`); send the answer to `POST /answer` (`question_id` = the question's `id`): `yes` adds it
(`saved`; with a `question_id`, the question's waiting item is logged too), `no` is `cancelled`. A food already in the catalogue is
`saved` at once ("Your catalogue already has N…"). Nothing found, or no word: `rejected` with a `reason`.

The Health page's row and the body session (91), each like app.'s Save of that row or form:

- `values` of `/health/day`: `weight`, `sugar`, `mood`, `energy` a number; `bp_morning`, `bp_evening` `[upper, lower]`; `bed`, `wake`
  `"hh:mm"`. `/body`: `waist`, `hips`, `chest`, `upper_arm`, `thigh` in cm. A value that is there is changed (Save is the yes), an
  empty day's value is added for that day (no AI call), `null` or `""` deletes it; a row the same as now is left alone (all the
  same: `unchanged`, "Nothing changed."). Any value of the last 12 months: a later or older day is `rejected` ("Pick a day of the
  last 12 months."); `rejected` too for one number of a blood pressure ("BP morning: give both numbers."), a time not hh:mm, a body
  value of 0 or less ("Waist: give a number in cm."), a body form with nothing in it. A wrong kind of field is 400 `bad_request`
  (`weight must be a number or null.`, `bp_morning must be [upper, lower] or null.`, `bed must be a time hh:mm or null.`,
  `Unknown row: …`, `Unknown measure: …`, `range must be 7, 30 or 90.`, `day is missing.`).
- Read back first (`needs_confirmation`, nothing saved), in this order: **a delete** ("Delete on Sun 15.11.: Weight 82.4?", `confirm`
  "Yes, delete" / "No", on `/body` "Keep it"): send the same again with `confirm_delete: true`; then **an odd value** (a weight or
  sugar out of range, a body value out of the measure's range or 4 cm or more away from last time: "Check: Waist 96.5 cm is 4.5 cm
  away from last time (92.0). Right?", `confirm` "Yes, save it" / "Yes, save" and "Fix it"): send the same again with
  `confirmed: true` as well (keep `confirm_delete`). A **new** weight more than 5 kg away from the last one (within 60 days) is the
  logger's own question instead (`questions[0]`, `tool: "log_confirm"`, `confirm` null): `yes` through `POST /answer` saves it.
- `key`: the added values are logged once per key (a re-send while the first is still running is `replayed`); a re-send after it
  was saved finds the values there and answers `unchanged` (which ends the Undo bar, as on app.).
- **Undo** (`POST /undo`): changes and deletes only: the entries put back as they were (same ids); added values only: the logged
  message taken back (the chat's undo, while it is the newest); **a save that both changes and adds: the added values only** (the
  changes stay; app.'s rule, the same function). "Not today" has no Undo.
- The answer carries the fresh read: `view: "health"` (default of `/health/day`: `health` as `GET /health` with the body's `range`
  and `all`), `view: "body"` (default of `/body`: `body` of the session's day, or `view_day`); `/body/skip` answers with the `day`.

The Habits page's saves (93), each like app.'s form:

- `/habit/day`: a day with fewer ticks than the habit's `target` gets one more tick (a date, no time; `saved`, as a typed "tick
  <habit> on 13.11.2026" without the AI); a day that is done (n at least target) has all its ticks taken off (`changed`, "Removed 2
  ticks of Reading on 13.11.2026."); a habit to avoid is logged and taken off the same way. Refusals are `rejected` with a plain
  `reason`: "That habit cannot be changed for a past day here." (not tracked, retired, not there, or Wake-up and Bedtime),
  "Only the last 30 days can be changed here." (a day after today, or more than 35 days back: 35 back is still allowed), "Unknown day."
  (not a date). A missing `name` or `day` is 400 `bad_request`.
- `/habit/day` and `key`: the message carries the time of the click (as on app.), so a re-sent key never replays: sent again while the
  day still needs a tick it is refused ("This idempotency key was already used for a different message."), nothing is saved twice;
  sent again after the day is done it is the next click and takes the day's ticks off. The page sends a new `key` per tap and does not
  send a tap twice.
- `/habits/manage` fields by `action` (a plain yes is the click; Hiding and ordering on Today are not here):
  `track`: `name`, `on` (true or false; a retired habit is refused: "… is retired: bring it back first."; a newly tracked habit goes
  last on Today); `retire`, `restore`: `name`; `edit`: `name`, `label`, `target` (times a day, required: app.'s function sets 1 for a
  field left out), optional `order` (0 to 999; kept when not sent) and `aim` (`do` or `avoid`; kept when not sent); `delete`: `name`,
  `confirmed: true` (without it: "Press Yes, delete to delete a habit."; with history: "… has history, so it cannot be deleted. Retire
  it instead."); `new`: `label`, `group` (one of `groups`; "daily" when not sent), `target` (1 when not sent), `track` (true or false;
  false when not sent). Refusals as `rejected`: a label another habit or log type already has, in any case ("There is already a log
  type called …"; for a retired one "(retired: bring it back from the Retired list)"), no label ("A habit needs a name to show." /
  "Give the habit a name with letters or digits."), an unknown group ("Choose a group for the habit."), an unknown name ("Unknown
  habit."; Wake-up and Bedtime too).
- 400 `bad_request` (the page's own form stops these first; app.'s functions would cut or clamp them): a `label` of more than 40
  characters (after its spaces are tidied), a `target` that is not a whole number from 1 to 10, an `order` outside 0 to 999, an `aim`
  other than `do` or `avoid`, `on`, `track` not true or false, a missing `name`, an unknown `action`, an edit without `target`.
- `key` on `/habits/manage`: accepted, but app.'s functions take none: a `new` sent twice is refused the second time (the label is
  there), the others are the same twice.
- **Undo** (`POST /undo`): a ticked day (`saved`): the logged message taken back (the chat's undo, while it is the newest); an unticked
  day (`changed`): the ticks put back as they were (same ids). Today's `POST /habit` is the same (tick and untick). **The list's forms
  (`/habits/manage`) have no Undo** (as on app.): track, edit, retire, bring back, new and delete are changed back by hand (a deleted
  habit had no history); the answer's `undo` is null and the session's earlier Undo bar goes, as on app. A refusal leaves it.
- The answer carries the fresh read: `view: "habits"` (default of both routes: `habits` as `GET /habits` with the body's `show`).
  `POST /habit` (Today's button) answers with it too when sent `"view": "habits"`.

The Gym's saves (95), each like app.'s form of the same name:

- Fields (numbers as JSON numbers, ids as numbers; a wrong kind of field is 400 `bad_request`):
  `tick`: `exercise_id`, `sets`, `reps`, `kg`, `minutes`, `km` (numbers or null; send the row's `values`), `key`;
  `remove`: `set_id` (one row of today) or `exercise_id` (all of today's rows of it), not both;
  `pick`: `day_id` (a day of the split, or null = Free workout; required);
  `new`: `name` (up to 60), `kind` (`weights`, `bodyweight`, `cardio`), `words` (optional list of up to 10 words of up to 40 characters,
  no commas), `today` (true from the Workout tab: it also goes on today's day of the split);
  `rename`: `exercise_id`, `name`; `active`: `exercise_id`, `on` (false = Retire, true = Bring back);
  `daynew`: `name` (up to 40); `dayedit`: `day_id`, `name`; `dayactive`: `day_id`, `on` (false = Remove this day, true = Bring back);
  `itemadd`: `day_id`, `exercise_id`, `sets`, `reps` (both or neither); `itemset`: `item_id`, `sets`, `reps` (both null = no plan
  numbers); `itemmove`: `item_id`, `dir` (`up` or `down`); `itemremove`: `item_id`.
- Refusals are `rejected` with app.'s plain `reason` and change nothing: a number out of range or not whole (`gym.NUMBERS`: "Numbers
  only: sets 1 to 50, reps 1 to 500, kg 0 to 1000, minutes up to 600, km up to 200."), "Give the weight in kg." (weights), "Give sets
  and reps.", "Give the minutes." (cardio), "Unknown exercise.", "Unknown day." (also a removed day for `pick`), "That is not in
  today's workout." (a row of another day), "… is already in your list.", "A retired exercise is called …", "It is called … already.",
  "Pick weights, bodyweight or machine cardio.", "… is already a day of your split.", "… is already on …", "Give both sets and reps, or
  neither.", "Numbers only: sets 1 to 50, reps 1 to 500.", "Pick a day and one of your exercises." (a retired exercise or a removed
  day), "That is not on a day any more.". A name too long is 400 `bad_request`.
- A tick logs the exercise into today's workout; the first tick of the logging day starts the workout (with today's day of the split)
  and ticks the habit "gym" once. A second tick of the same exercise is another row. Removing the last row of the day also takes the
  workout and the day's gym tick away. `pick` moves today's workout, once started, to the day picked.
- `key`: only `tick` takes one (app.'s rule): a re-sent key answers the first answer (`replayed: true`) and logs nothing twice; the same
  key with other numbers is refused ("This form was already used."). The other actions take none: `new` and `daynew` sent twice are
  refused the second time (the name is there), `remove` sent twice finds nothing the second time, the others are the same twice.
- **Undo** (`POST /undo`), where app. has it (`gym_undo`): **a tick** (the row it made deleted; the workout too if this tick started
  it, and the gym tick if this tick made it); **a remove** (the rows put back with the same ids, and with the last row the workout and
  the gym tick); **`itemremove`** (the exercise back on its day, same id, place and plan numbers). Every other action has no Undo (as
  on app.): the answer's `undo` is null and the session's earlier Undo goes; a refusal leaves it. Send `"view": "gym"` (or
  `"gym_plan"`) with the undo for the tab's fresh read.
- The answer carries the tab's fresh read: `tick`, `remove`, `pick` and `new` with `today: true` → `gym` (the Workout tab); `new`
  without it, `rename`, `active` → `gym_exercises`; `daynew`, `dayedit`, `dayactive`, `itemadd`, `itemset`, `itemmove`, `itemremove`
  → `gym_plan`. The body's `view` chooses another (also `day`).
- Not here (as at app.): the starter split (`python -m app.gymseed`), a finish button (the last tick ends a workout), the watch's data
  (it comes from the phone).

Field names since 77: `action` (was `act` on `/review` and `/food/entry`), `time` (was `t` on `/health`), `items[].item_id` (was
`items[].id` on `/usual`). Since deploy 78 only the new names work: a field sent under its old name counts as missing.

Every save answers (HTTP 200, also when nothing was saved):

```
{
  v, outcome,            // see the list below
  tone,                  // "warning" or "ok": draw the answer as a warning (as app. does) or not
  head,                  // one short line to show
  receipt: [lines], notes: [lines], reason,
  questions: [Question],                       // the questions this save opened, in full (as in day.needs.questions)
  read_back,             // a change the logger reads back first …
  confirm: null | {label, no_label},           // … then send the same request again with "confirmed": true
  result,                // a look-up's answer; for a line that logs and asks ("150 g skyr and what did I eat today"), the answer to the ask
  refill: null | {label, text},                // words to put back in the log box ("Try again" on a message that is not an entry)
  replayed,
  undo: Undo,            // one per session, 15 minutes; POST /api/v1/undo {token}
  day: Day  |  food_day: FoodDay  |  usual: [Usual]  |  health: Health  |  body: Body  |  habits: Habits
       |  gym: Workout  |  gym_plan: Plan  |  gym_exercises: Exercises
                                                       // the fresh read; body "view": "day" | "food" | "usual" (86) | "health" |
                                                       // "body" (91) | "habits" (93, with "show") | "gym" | "gym_plan" |
                                                       // "gym_exercises" (95) and "view_day": "yyyy-mm-dd" choose it;
                                                       // /gym/<action> defaults to its tab (see the Gym's saves);
                                                       // /habit/day and /habits/manage default to "habits"; /usual/meal and
                                                       // /usual/new default to "usual", /usual/from_meal and /food/* to "food",
                                                       // /health/day to "health" (with "range", "all"), /body to "body" (its day),
                                                       // the rest to "day"
}
```

Outcomes (`api.OUTCOMES`):

| outcome | tone | meaning |
|---|---|---|
| `saved` | ok | saved (also a private or gratitude line: `head` "Saved privately.") |
| `partly_saved` | ok | saved what was clear; a question is open |
| `changed` | ok | an entry was changed or deleted, or an Undo was made |
| `removed` | ok | a message not read yet was deleted |
| `answered` | ok | a look-up: the answer is in `result` |
| `unchanged` | ok | nothing to change (the same value again, an untick with nothing ticked) |
| `kept` | ok | kept as text (a thought) |
| `cancelled` | ok | skipped (a "no" to a question) |
| `held` | warning | not read yet, the words kept; they show in `day.needs.not_read` |
| `needs_confirmation` | warning | nothing saved yet: answer the question, or send again with `confirmed` |
| `needs_choice` | warning | nothing saved yet: a question is open |
| `not_logged` | warning | the words read as a question for the assistant, not an entry |
| `rejected` | warning | nothing saved; `reason` says why |

Texts in `read_back`, `result` and questions never carry the lines meant for the chat app ("resend with confirmed=true",
"call add_food again", "Ask the user …"); they are taken out by the door (`reads.plain`).

- **Undo** works as the web app's Undo bar: one record per session, replaced by the next action (not by a re-sent or refused one),
  gone after 15 minutes. A typed message is undone only while it is still the newest one.
- **Private and gratitude words never appear in any answer.** A line starting `g:`, `gratitude:` or `private:` is saved without the
  AI and answered with `head` "Saved privately." and no receipt; so is a line the AI files as private by itself (since 77), with
  nothing more. A look-up or change that names private entries (the logger writes them
  as `P<id>` or "private entries") is answered without its texts and with `reason` saying to open it in the app; the same holds for an
  open question's text and read-back.
- Errors inside a save (the AI or the database not answering) are `outcome: "rejected"` with a reason that nothing was saved; a typed
  line's words stay kept (`held`) and appear in `day.needs.not_read`.

Not in the door (on purpose, for now): Home and Coach, the body settings (interval, hidden measures, height: read in
`GET /body`, changed at app.), the Food catalogue editor, the gratitude list itself (only its count), Ideas and Private.

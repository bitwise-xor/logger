# The JSON door `/api/v1` (for the new front end)

Since deploys 75 and 76 (16.11.2026); deploy 77 (16.11.2026) made the changes of the door's review (marked "since 77");
deploy 78 removed the old field names that 77 kept for one deploy; deploy 86 added the usual-meal editor; deploy 89 the scanner, the label photo and the look-up; deploy 91 the Health page and body measurements; deploy 93 the Habits page; deploy 95 the Gym; deploy 98 Home; deploy 101 Trends (Week, Food trends, Insights, the Week review); deploy 104 Library and Medical (the food catalogue, lab reports, tests over time, medication); deploy 107 Search, Recent, Usage and Coach (with Today's Coach card and the day coaching's button); deploy 110 Settings and the notifications of this address (with the export file and Today's `shown`). The front end that calls it: `front/` (`front/README.md`).
Code: `core/app/api.py` (the door, the saves), `core/app/reads.py` (the reads).
Tests: `tests/test_api_door.py`, `tests/test_api_reads.py`, `tests/test_api_saves.py`, `tests/test_api_shape.py` (77),
`tests/test_api_usual.py` (86), `tests/test_api_scan.py` (89), `tests/test_api_health.py` (91), `tests/test_api_habits.py` (93),
`tests/test_api_gym.py` (95), `tests/test_api_home.py` (98), `tests/test_api_trends.py` (101), `tests/test_api_library.py`,
`tests/test_api_medical.py` (104), `tests/test_api_more.py`, `tests/test_api_coach.py` (107), `tests/test_api_settings.py`,
`tests/test_api_push.py` (110).

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

- JSON, `"v": 1` in every body, `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`. One exception (110): `POST /export`
  answers the ZIP file itself (same headers; its errors are JSON).
- Signed-in calls carry `X-Session-Expires: <ISO time, UTC>`: the session's end. A session in use renews like a page view
  (once a day the end moves to 30 days from now); the front end can renew its own cookie from this header.
- Errors: `{"v": 1, "error": "<code>", "message": "<plain text>"}`. Codes: `not_found` 404, `signed_out` 401,
  `wrong_credentials` 401, `too_many_tries` 429, `bad_request` 400, `too_large` 413 (body over 64 KB), `no_entry` 404,
  `wrong_code` 403 (21.11.2026: the export with private entries without the right authenticator code), `server_error` 500. Only `POST /food/label` takes a larger body (up to three photos, see below).
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
gratitude count. The Gym card since 95 (`gym`), the Home card since 98 (`home`), the Coach card since 107 (`coach`), `shown` since 110.

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
  home: null | {this_week, goal, text, waiting: null | HomeRow, hidden}
                                                        // (98) Today's Home card (homepage.card_data): this week's sessions of the
                                                        // weekly goal and app.'s words ("this week 1 of 3"), the chore waiting
                                                        // longest (not one hidden for today; null: "Nothing else is waiting
                                                        // today."), how many jobs are hidden for today. null as at app.: a past
                                                        // day, no active chore in an active zone, or the card hidden in Settings >
                                                        // Today page. Its buttons: "15 minutes" = GET /home/pick?min=15, Open Home
  coach: null | Card                                    // (107) Today's Coach card for the day shown (coachpage.card_data, as
                                                        // app.'s todaypage._coach_card): earlier days too; null when Settings >
                                                        // Today page hides it ("card:coach"). Card: see GET /coach. Its button:
                                                        // POST /coach/start {kind: "day", start: day, end: day}; while "working"
                                                        // poll GET /coach/status?id=
  shown: {review, gratitude}                            // (110) Settings > Today page's switches "review:box" (the To review box)
                                                        // and "card:gratitude" (the Gratitude card), as app.'s todaypage reads
                                                        // them; needs.review and gratitude stay filled in either way: the front end
                                                        // hides them (app. shows a hidden review box as one line while something
                                                        // waits, and no Gratitude card on a past day)
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
FoodDay = {day, today, past, rows: [Row (food) + note], meals: [{meal, label, nutrients, note}], totals, targets, day_note}
```

Built on `foodpage._day_rows`. `meals[].note` (21.11.2026): the meal's one-line note (below, `POST /food/mealnote`), null when it has
none; the drinks (meal 0) never have one. `day_note`: a meal note whose meals are all gone (the day has no food left but drinks, or
none), shown as a note on the day; else null.

**Meal notes** (21.11.2026, migration 033, `core/app/mealnotes.py`, the one place that works this out). Meal numbers change (SQL
`assign_meals` renumbers a day's meals by time whenever its entries change), so a note is not kept against a meal number: it is
kept with a time, `at` (the time of the meal's first entry when it was saved), and belongs to the meal of the day's food entry nearest
to `at` (drinks left out; a tie goes to the earlier entry). So a meal renumbered by an earlier entry added later keeps its note; when
two meals merge, the newest note is shown (and the next save on that meal deletes the other); when a meal's entries are deleted, its
note moves to the meal nearest in time (where that meal's own newer note wins); with no food entry left it is the day's note.

### `GET /api/v1/food/nutrients?day=&days=1|7|30` → `{"food_nutrients": Nutrients}` (21.11.2026)

The Food space's Nutrients tab: every tracked value of what was eaten in the `days` ending at `day` (today without it; a later day is
today; `days` 1 without it, anything but 1, 7 or 30 is 400 `days must be 1, 7 or 30.`). An unknown value (NULL on the entry) is never
counted as zero without saying so: a total made with unknown entries carries their count.

```
Nutrients = {day, today, past, days, start, end,          // start .. end (= day) is the period, both included
  eaten_days,                                             // days in the period with entries
  per_day,                                                // days > 1: value is the average per day that has entries
  nutrients: [Line],                                      // always these ten, in this order (below)
  foods: [FoodRow],                                       // one row per food eaten, most kcal first
  meals: [MealRow]}                                       // one day only (else []): by meal, the drinks (0) last
Line = {key, label, unit, sub,                            // sub: an "of which" line (saturated under fat, sugar under carbs)
  aim,                                                    // with a target: "reach" (protein, fibre) or "under" (the rest); null: none
  sum,                                                    // the period's sum of the known values (the food rows' shares are of it)
  value,                                                  // = sum for one day; over 7 or 30 days sum / eaten_days
  unknown, unknown_foods,                                 // entries / foods (any of its entries) without a value for this line
  target}                                                 // food_targets' row in force on `day` (salt from its sodium_mg), or null
  // + on salt: sodium_mg (the same as value, in mg of sodium), target_sodium_mg
FoodRow = {food_id, ref: "N12", name, unit: "g" | "ml", drink, amount, entries,   // amount and entries added up over the period
  refs: ["f123"] | null,                                  // its entries (one day only; null over 7 or 30 days)
  values: {kcal, protein, fat, sat_fat, carbs, sugar_total, sugar_added, fibre, salt, caffeine_mg, sodium_mg},
                                                          // added up; null where one of its entries has no value
  per_100: {… the same keys},                             // the catalogue's values per 100 g or ml (unknown null)
  source}                                                 // "label · Brand · note" (the Catalogue's source line's parts)
MealRow = {meal, label: "Meal 1" | "Drinks", values: {…as FoodRow, the known values added up}, unknown: {key: entries}, foods: ["f123"]}
```

Keys and labels: `kcal` Calories (kcal), `protein` Protein, `fat` Fat, `sat_fat` of which saturated, `carbs` Carbs, `sugar_total` of
which sugar, `sugar_added` Added sugar, `fibre` Fibre (g), `salt` Salt (g: sodium mg × 2.5 / 1000), `caffeine_mg` Caffeine (mg).
Values to 1 decimal (salt 2, mg whole over 7 or 30 days).

### `GET /api/v1/food/notes?days=` → `{"food_notes": Notes}` (21.11.2026)

The Food space's Notes tab: every meal note and food note of the last `days` days, today included (1 to 366, 90 without it; anything
else 400 `days must be a whole number from 1 to 366.`). Newest first: by day, then by time (a note on the day first, a meal's note
before its foods' at the same time).

```
Notes = {days, start, today, notes: [Note]}
Note = {kind: "meal" | "food" | "day", day, meal, label,   // meal and label ("Meal 2", "Drinks") as the meal is numbered now; a day's
        at,                                                // note: meal and label null. at: the meal's first entry or the food's time
        note}                                              // (null when not known)
  // + on a food's note: ref: "f123" (?open= on that day's Food day), food, amount, unit, portion_text
```

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

### `GET /api/v1/foods/suggest` → `{"foods": [{food_id, name, unit, words, last_amount, eaten, last_at}]}` (116)

The logging box's suggestions at logger.: every active food (none hidden), most eaten first, then by name, the same data as app.'s
`/web/foods.json`. No parameters; the box filters the list itself while typing.

```
food = {food_id, name, unit: "g" | "ml", words: [string], last_amount: number | null, eaten: int, last_at: string | null}
```

`unit` is the food's basis; `words` its aliases (`[]` when none); `last_amount` the amount of the newest entry, in `unit`; `eaten`
how many entries there are. A food never eaten has `last_amount: null`, `eaten: 0`, `last_at: null`; `last_at` is the newest
entry's time (ISO 8601, Berlin time with offset).

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
  interval_days, hidden: [keys],      // Settings > Body (changed through POST /settings/body since 110)
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

### `GET /api/v1/gym/history?w=<workout id>` → `{"gym_history": {"workouts": [...]}, "undo": Undo}` (95)

The last 60 workouts, newest first (`gympage.history`); with `w` (107) that workout too, in its place by date, when it is older than
the last 60 (a search result opens its card at `#w<id>`); without `w`, or a `w` already listed or not there, the answer is the same.
`w` not digits: 400 `bad_request` ("w must be a workout's id."). Each: `{workout_id, anchor, day, split_day_id, split, started_at, ended_at, when,
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

### Home (98): the six pages of app.'s Home as data

app.'s Home section (`homepage.now_data`, `pick_data`, `zones_data`, `history_data`, `chore_data`, `edit_data`, `card_data`: app.'s
pages draw from the same data). A chore is done per zone: a **pair** is `[chore_id, zone_id]`; a whole-flat chore (Dust, Vacuum, Mop)
is one pair per zone it is done in. Ages and intervals are whole logging days. Where app. writes words, both come: the facts (`age`,
`interval`, …) and app.'s words (`age_text` "3 weeks ago" / "not logged yet" / "today", `age_short` "3 wk" / "not yet",
`interval_text` "weekly" / "every 2 weeks", `label` "Dust · Kitchen", app.'s whole lines as `text` or `meta`), so both apps say the same.

```
HomeRow = {chore_id, zone_id, name, zone, short, label, flat,   // flat: a whole-flat chore; short: the zone's tile label
           age, age_text, interval, interval_text,              // age: days since last done (null = never logged; 0 = today)
           minutes, done_today, done_at}                        // minutes in this zone; done_at: the last done row's time (ISO)
Timer   = {id, state, left, ends_at, minutes, title, pairs}     // state "running" | "paused" | "over"; left: seconds (count down
                                                                // from it); ends_at null while paused; the job's title and pairs
Done    = {ids, chore_id, chore, zones, flat, label,           // rows stamped together (All done) are one entry with all their
           at, day, dated, source, how, time, when}             // ids; dated: a job done earlier or a starting point (12:00 of
                                                                // day: time null, only the date shown); source "web" | "chat" |
                                                                // "pick" | "start"; how "ticked" | "chat" | "timer" | "starting
                                                                // point" | "earlier"; when: app.'s "16.11. 08:05" or "14.11."
```

The open timer (`home.timer_open`: the last one of the past 6 hours not closed) is the same object everywhere; `timer` is null when
there is none **or its job is gone** (its chores retired meanwhile: app. shows no timer then and the Pick page picks afresh).

#### `GET /api/v1/home?min=5|15|30|60` → `{"home": Now, "undo": Undo}`

```
Now = {
  today, empty,                       // empty: no active chore at all ("No zones or chores yet. Add them on Edit zones.")
  minutes, minutes_options: [{minutes, label}],   // the time chips: 5 "5 min", 15, 30, 60 "1 hour"; min not one of them = 15
  timer: null | Timer,                // the Timer card ("Open the timer" = the Pick page)
  week: {goal, this, weeks: [4]},     // "This week N of goal sessions", "Last 4 weeks: 2 · 3 · 1 · 0" (the latest first); a
                                      // session = a day with a job done or a timer run out
  rows: [HomeRow], count, shown: 6,   // "Longest since last done": one row per chore (a whole-flat chore: its zone waiting longest),
                                      // waiting longest first, without the jobs hidden for today; app. shows the first 6 and "Show
                                      // all N chores" (a link to Zones) when there are more; the tick circle = POST /home/tick
  hidden,                             // "N hidden for today" (jobs marked Not today)
  recent: [Done]                      // "Recently done": the last 5, starting points left out
}
```

#### `GET /api/v1/home/pick?min=&n=` → `{"home_pick": Pick, "undo": Undo}`

```
Pick = {
  today, empty,                       // null, "no_chores" ("No zones or chores yet.") or "nothing_waiting" ("Nothing is waiting for
                                      // you right now. Everything is done today, hidden for today, or retired.")
  minutes, title,                     // "Your 15 minutes", "Your hour"
  timer: null | Timer,                // with a timer open its job and minutes; min and n are not looked at (as app.)
  job: null | {pairs, title, zone, age, age_text, minutes, steps, howto, over, session},
                                      // one pair ("Wipe the stove", "Dust the kitchen"), a zone session at 60 minutes ("Kitchen:
                                      // 3 jobs", steps "Dust (15 min)") or "Vacuum the whole flat" (steps per zone); over: nothing
                                      // fits, the shortest job ("This job takes about N minutes: do what fits, stopping counts.")
  n, count,                           // the n-th of count jobs that fit ("Job 2 of 5" when count > 1; ?n= modulo count, as app.;
                                      // "Another job" = n + 1); with a timer n null and count 1
  also: [{n, title}],                 // "Also fits in N minutes": the next two (open with ?n=), [] with a timer
  earlier: [{when, label}],           // "Done it earlier?": when 1 "Yesterday", 2 "2 days ago" (or a date: POST /home/earlier)
  next_from_s: 180,                   // "Done, next job" only while running with at least this many seconds left
  earlier_days: 365
}
```

Without a timer: "Start timer" (POST /home/start with the job's pairs and `minutes`), "Done" (/home/pickdone), "Another job", "Not
today" (/home/skip). With one: Pause or Resume, "Done" (/home/pickdone), "Done, next job" (/home/picknext, running only), "Stop
timer" ("Finished" once over: /home/stop). At zero app. hides Pause and "Done, next job" and shows "Time is up · well done".

#### `GET /api/v1/home/zones` → `{"home_zones": Zones, "undo": Undo}`

```
Zones = {
  today, empty,
  start: {jobs: [{chore_id, name, pairs, zone, zones, where, interval, interval_text}], more, answers: [{ago, label}]},
                                      // "When did you last do these?": never-logged jobs (not answered "Don't know"), one per chore
                                      // (a whole-flat chore with all its never-logged zones: zone null, where "3 zones"), the first
                                      // 5 in the Now order, more: "N more jobs after these"; answers: week "This week", month "This
                                      // month", longer "Longer ago", unknown "Don’t know" (POST /home/startpoint)
  flat: [{chore_id, name, interval, interval_text, minutes, all_done_today,
          per_zone: {text, groups: [{interval, interval_text, zones: [{zone_id, short}]}], off: [{zone_id, short}]},
          tiles: [HomeRow + {age_short, tinted}]}],
                                      // "Whole flat": per_zone.text is app.'s line ("every 2 weeks; Bath, Kitchen weekly; not in
                                      // Hall"), groups the zones whose interval differs, off where it is not done; a tile per zone
                                      // (tap = POST /home/tick; tinted: done today or less than half its interval ago);
                                      // all_done_today: "All done ✓" (POST /home/alldone; again takes today's ticks back)
  zones: [{zone_id, name, short, count, own, chores: [HomeRow], open, todoist, oldest_age, oldest_text}]
                                      // a card per active zone: its chores and its share of the whole-flat ones (Dust first,
                                      // Vacuum and Mop last); count 0: "no recurring chores"; open: one of its own chores done within
                                      // 14 days (app. opens the card); oldest_text "oldest 3 weeks ago" / "not yet"; todoist: the
                                      // Storage zone with no chore of its own (app. links "sorting jobs in Todoist ›")
}
```

#### `GET /api/v1/home/history?n=` → `{"home_history": History, "undo": Undo}`

```
History = {
  today, limit, step: 60, max: 600, more, count,   // ?n= rows, 60 to 600 (60 when not given or not a number); more: "Show more"
                                                   // (?n=limit + step) when count == limit < max
  days: [{day, label, rows: [Done]}],              // grouped by logging day, newest first; label "Tuesday 03.11."; × on a row =
                                                   // POST /home/remove with its ids
  jobs: [{pairs: [[chore_id, zone_id]], label}],   // "+ Add one done earlier": every active pair by chore name (POST /home/earlier)
  earlier_days: 365
}
```

#### `GET /api/v1/home/chore?id=<chore id>` → `{"home_chore": Chore, "undo": Undo}`

Any chore, a retired one too. `id` not digits (or missing) is 400 `bad_request` ("id must be a chore's id."); a chore that is not
there 404 `no_entry` ("That chore is not in the list.", app.'s words).

```
Chore = {
  chore_id, name, zone_id, zone, flat, active,     // zone: the zone's name or "whole flat"
  interval, interval_text, minutes, meta,          // meta: app.'s line "weekly · 15 min · Kitchen" (" · retired")
  steps, howto, words,
  last: [{day, start}], last_text,                 // the last 10 done days, newest first; start: a starting point; last_text app.'s
                                                   // "14.11. · 02.11. (starting point)" or "not logged yet" (a whole-flat chore: [] / null)
  usually_days, usually,                           // the median gap of 3 or more done days (no starting points): 9, "usually every 9 days"
  zones: null | [{zone_id, zone, on, interval, interval_text, minutes, text, usually_days, usually, last, last_text}]
                                                   // a whole-flat chore: each active zone it is done in or was done in; on false =
                                                   // "not done here" (text); text "weekly · 10 min"
}
```

#### `GET /api/v1/home/edit` → `{"home_edit": Edit, "undo": Undo}`

```
Edit = {
  goal,                                            // the weekly goal (1 to 7; POST /home/goalset)
  flat: [EditChore],                               // "Whole flat": the whole-flat chores, retired ones too
  zones: [{zone_id, name, short, spots, words, active, count, chores: [EditChore]}],
                                                   // every zone, retired ones too (active false: "Bring back"), each with its
                                                   // chores (retired ones too); count: its active chores
  zone_options: [{zone_id, label, active}],        // the chore form's "Where": zone_id null = "Whole flat (each zone on its own)",
                                                   // then every zone ("… (retired)": offer it only for the chore already in it)
  limits: {zone_name_max: 40, short_max: 12, spots_max: 12, spot_max: 40, chore_name_max: 60, steps_max: 8, step_max: 80,
           howto_max: 300, words_max: 12, word_max: 40, days_min: 1, days_max: 730, minutes_min: 1, minutes_max: 240,
           minutes_default: 15, goal_min: 1, goal_max: 7}
}
EditChore = {chore_id, name, zone_id, flat, active, interval, interval_text, minutes, meta, steps, howto, words,
             per_zone: null | [{zone_id, zone, on, days, minutes}]}
                                                   // per_zone: a whole-flat chore that is not retired ("Per zone"): each active
                                                   // zone, on or off, its own days and minutes (null = blank = the chore's own)
```

### Trends (101): the Week page, the Food page's Trends tab, Insights

app.'s Week page with its Week review card, the Trends tab of its Food page and its Insights page as data (`weekpage.data`,
`trendspage.data`, `insightspage.data`, `coachpage.week_review`: app.'s pages draw from the same, byte for byte as before). Only complete
days count: today is left out, and a day under half its calorie target is "partly logged" (its bar shows; averages and counts leave it
out). Where app. writes words, both come: the numbers and app.'s words (`*_text`, `note`, `detail`, the stat line's parts). Every chart
card has the Health page's shape (`Chart` above: `{id, title, small, stat: [{text, bold}], chart, legend: [{key, text}]}`), and `chart` is
exactly what app. puts into `data-chart` for `drawChart`; the legend's keys here are `sq a` (the daily bars), `line b` (the 7-day
average) and `ref t` (the target line, only with a target).

#### `GET /api/v1/week?p=7|last|30|this` → `{"week": Week, "undo": Undo}`

`p`: the last 7 days (default), last week (Monday to Sunday), the last 30 days, this week so far (Monday to yesterday); another value is
400 `bad_request` ("p must be 7, last, 30 or this.").

```
Week = {
  p, periods: [{p, label, current}],          // the four tabs: "Last 7 days", "Last week", "Last 30 days", "This week so far"
  today, start, end, ndays,                   // the period: start .. end (yyyy-mm-dd), ndays its days
  empty, empty_text,                          // empty: no complete day yet (this week so far, on a Monday): then only the period,
                                              // empty_text ("No complete day in this period yet (this week so far starts after
                                              // Monday).") and the words; every list below is [], review null
  with_food, dates_text, days_text,           // the header line: dates_text "Mon 09.11. to Sun 15.11.2026", days_text "5 of 7 days
  left_out, today_text,                       // with food", left_out "1 partly logged day left out (11.11.: under half the
                                              // calorie target)" or null, today_text "today is left out, it is not over yet";
                                              // app. writes them joined by " · "
  food: [Tile],                               // the Food card: kcal, protein, fat, carbs
  meter_hint,                                 // "Average day as a share of the target; the thin line is 100%."
  health: [{key, label, value, detail}],      // "Health and habits", app.'s order, only rows with data (see below)
  health_none,                                // "Nothing logged in this period." (when health is [])
  foods: {by_kcal: [Food], by_count: [Food]}, // "Foods that count most": "Most calories" and "Eaten most often", eight each
  charts: [Chart],                            // kcal, protein, fat, carbs over the period (app.'s page draws them under the foods)
  days: [{day, label, kcal, protein, fat, carbs, kg, partly}],   // "The days", newest first; label app.'s "Mon 09.11.";
                                              // kg the day's last weight or null; partly: under half the calorie target (app.'s
                                              // table does not mark it, its charts and averages do)
  days_none,                                  // "No complete days with food." (when days is [])
  review: Review | null                       // the Week review card (null when empty)
}
Tile = {key, label, unit,                     // label "Calories", unit "kcal" or "g" (app.: "2,095 / 2,000 kcal", "112 g / 120 g")
        average, target, pct,                 // the average complete day, the latest target, the average in % of the target
        level, over,                          // the meter as app. draws it: level "good" | "warn" | "bad" | "" (protein: ""
                                              // under 80 %), over: the bar drawn as over (kcal, fat, carbs at warn or bad)
        average_text, target_text,            // app.'s numbers ("2,095", "–" without days; target_text null without a target)
        note}                                 // instead of the bar: "no target set" or "no complete days"; else null
Food = {name, kcal, n, text}                  // text: app.'s "1,240 kcal" (by_kcal) or "5×" (by_count)
```

- `health` rows, each only when there is data: `weight` ("80.9 kg", detail "(−0.2 kg since 05.11.)"), `bp_morning` and `bp_evening`
  ("120/79", "average of 2"), `sugar` ("100 mg/dL", "average of 7"), `sleep` ("6 h 30", "average night"), `feel` (label
  "Mood · energy": "mood 3.2 · energy 2.8", "average of 4 evenings, 1 to 5"), `body` (one per measuring session: "Measured 04.11.:
  waist −1.0 cm since last", "(1 value)"), `habits` ("57%", "of habit-days done (8 of 14)"), `avoid` (one per habit to avoid; label the
  habit's: "6 of 7 days without", "(a habit to avoid)"), `gym` (once there are exercises: "1 workout", detail the days "Sat 07.11. (Push)"
  or null). app. writes `value` and then `detail` small.

```
Review = {
  offered,                                    // true for last and this (the review is of a Monday-to-Sunday week); false for 7, 30
  kind: "week", start, end,                   // the period the button reviews (null when not offered)
  title, small,                               // "Week review", "this period · on demand" ("Monday to Sunday" when not offered)
  state,                                      // "none" | "working" | "done" | "failed"; null when not offered
  id,                                         // the coaching (working, done, failed): poll GET /coach/status?id= while "working"
  wait, wait_note,                            // working: "Reviewing… about 45 seconds", "You can leave this page: …"
  parts: [Part], caution, meta,               // done: the sections, "Comments only on what you logged; not medical advice.",
                                              // meta {model: "Claude Opus", usd, at, at_text: "16.11. 14:05", text: app.'s whole line
                                              // "Claude Opus · $0.21 · 16.11. 14:05"} (usd null when not known)
  failed,                                     // failed: "That did not work (cut off); nothing was charged if the AI did not answer. Try
                                              // again." ("cut off": a review still "working" after 10 minutes, app.'s rule)
  intro, cost,                                // none and failed: app.'s intro and "about 45 seconds · about 20 cents"
  button,                                     // "Review last week" | "Review this week so far" (none, failed), "Review again" (done),
                                              // null while working → POST /coach/start with kind, start, end
  links: [{label, href}],                     // "All coachings", "Your goals" (app.'s pages: /web/coach, /web/settings?tab=coach)
  blurb, latest, weeks                        // not offered: "The review looks at one week from Monday to Sunday.", the latest
                                              // finished review {start, end, text: "Latest review: 02.11. to 08.11."} or null, and
                                              // the two tabs to go to [{p: "last", label: "Last week"}, {p: "this", …}]
}
Part = {key, title, style, tone, items, meal, text}
                                              // in app.'s order, without the parts the owner switched off (Settings > Coach) and
                                              // without empty ones: targets "Against your targets", trends "Trends", habits "Habits,
                                              // gym and home", days "Best and hardest day" (items: best, hardest), focus "Focus for
                                              // next week" (style "numbered"), doctor (style "note", the words in text; app. shows no
                                              // title); style "list" otherwise; tone, meal: for the day coaching (since 107: went_well
                                              // "What went well" tone "ok", improve "To improve" tone "warn", next_meal "Next meal" style
                                              // "meal" with meal {title, why, kcal, protein, carbs, fat, macros: "380 kcal · 34 g
                                              // protein · 6 g carbs · 25 g fat"}, gaps "Missing in the log", doctor)
```

#### `GET /api/v1/food/trends?range=7|30|90` → `{"trends": Trends, "undo": Undo}`

The Food page's Trends tab: the last `range` complete days (30 when not given; another value is 400 `bad_request`, "range must be 7,
30 or 90.").

```
Trends = {range, ranges: [7, 30, 90], start, end,     // start .. end = yesterday
          title, small,                               // "Last 30 complete days", "17.10. to 15.11., today not counted"
          charts: [Chart]}                            // kcal, protein, fat, carbs
```

Each chart's `stat` is app.'s line in parts: `average ` **`2,095 kcal`** ` · target 2,000` ` · over the target on ` **`9`** ` of 23 days`
(protein: ` · target reached on ` **`n`** ` of m days`), the kcal card also the left-out words (` · 2 partly logged days left out (…)`);
without a target only the average; with no complete day "no complete days with food in this range". The chart: `bar` per day with
food (`cls` a; a partly logged day's hover says "(partly logged)"), `line` the 7-day average of the complete days (`cls` b), `lines`
the target `[value, "t", "2,000"]`, `min` 0, `unit` "" (kcal) or " g", `label` "Calories per day".

#### `GET /api/v1/insights?days=90|180|365` → `{"insights": Insights, "undo": Undo}`

`days` the range (90 when not given; web item 50, 22.11.2026); anything else is 400 `bad_request` ("days must be 90, 180 or 365.").
app.'s `/web/insights` is always 90 days. A night belongs to the day of its wake-up; its hours (bed to wake-up) count only between 2
and 14. Calories count complete days only, without the partly logged ones (the Week page's rule: under half the calorie target).
Caffeine is the entries' own `caffeine_mg` (the food's value per 100 times the amount), only entries with a known time.

```
Insights = {days: 90, ranges: [90, 180, 365], min_each: 4, title: "Insights", small: "From the last 90 days",
            cards: [Insight],                         // nine, the ones with a statement first, then the waiting ones, each half
                                                      // in this order: late (food close to bedtime and fasting sugar), carbs
                                                      // (carb share and fasting sugar), late_sleep (food close to bedtime and that
                                                      // night's hours), caffeine_sleep (50 mg or more in the 8 h before bed and that
                                                      // night's hours), sleep (short nights and weight), sleep_kcal (short nights and
                                                      // calories that day), sleep_bp (short nights and that morning's systolic blood
                                                      // pressure), sleep_mood, sleep_energy (short nights and that day's check-in, 1-5)
            note}                                     // "These are patterns in your own numbers, not proof …"
Insight = {key, title, unit, digits, sign, needs,     // unit "mg/dL", "g", "h", "kcal", "mmHg" or "" (mood, energy: no unit, no
                                                      // trailing space); digits after the point; sign: values with + / −
           waiting, wait_text,                        // waiting: a group has fewer than min_each days; wait_text app.'s
                                                      // "Not enough days yet: 3 for "…" and 5 for "…"; each needs 4. It counts …"
           chip,                                      // the corner: "+11 mg/dL" or "no difference" (null while waiting)
           say: [{text, bold}],                       // app.'s sentence, the two averages bold (null while waiting)
           caveat,                                    // null, or one sentence: "The difference is smaller than the usual day-to-day
                                                      // spread (about 9 mg/dL), so it may be chance." (the difference is under half
                                                      // the pooled standard deviation of the two groups) or "Few days so far (4 and
                                                      // 6): this can still change a lot." (a group under 8 days); both: the first.
                                                      // null while waiting and when the chip says "no difference"
           zero,                                      // where zero is on the bars' track (percent: 0, or more when a value is below 0)
           groups: [{key, label, n, mean, text, cls, left, width}]}
                                                      // yes (the group the sentence is about, cls a) and no (cls b): label, days,
                                                      // the average and app.'s words for it; the bar from left, width (percent of the
                                                      // track, as app. draws it); mean, text, left, width null while waiting
```

#### `GET /api/v1/coach/status?id=<coaching id>` → `{"coaching": {id, state}, "undo": Undo}`

As app.'s card asks every few seconds while a review reads (`coach.status`): `state` is `working`, `done`, `failed` (also one still
"working" after 10 minutes: cut off) or `gone` (no such coaching). `id` not digits: 400 `bad_request` ("id must be a coaching's id.").
Then read `GET /week` (a review) or `GET /day` / `GET /coach?day=` (a day coaching) again for the finished card.

### Library (104): the food catalogue

app.'s Food > Catalogue as data (`foodpage.catalogue_data`, `food_data`: app.'s page draws from the same, byte for byte as before), with
app.'s words beside the facts. Values per 100 g or ml (the food's `basis`); an unknown value is null.

#### `GET /api/v1/food/catalogue?q=&f=all|drinks|new|review&s=<order>` → `{"catalogue": Catalogue, "undo": Undo}`

`q` (cut at 60) searches name, words, N number and barcode, as app.; `f` all (default), drinks, new ("Added in the last 14 days"),
review ("Needs review"), anything else 400 (`f must be all, drinks, new or review.`); `s` one of `eaten` (default), `recent`, `last`,
`added`, `kcal`, `kcal_low`, `protein`, `name`, anything else 400. Only active foods are listed (a hidden one is not), at most 400.

```
Catalogue = {q, filter, sort,
             filters: [{key, label, on}],              // app.'s chips, in its order
             sorts: [{key, label, on}],                // app.'s eight orders ("Most eaten", "Most eaten in the last 30 days", …)
             count, limit: 400,
             more,                                     // "Showing the first 400; search to find others." when the list is full, else null
             empty,                                    // "No food matches." when there are no rows, else null
             hint, placeholder,                        // "Sorted by: most eaten. Click a food to see and change it.", the search box's
             rows: [CatalogueRow]}
CatalogueRow = {id, ref: "N12", name, review, drink, aliases: [words], basis: "g" | "ml",
                per_100: {kcal, protein, fat, carbs}, per_100_text: {…: "58.7" | "372"},   // as app.'s table prints them
                eaten,                                 // how many entries
                last, last_text,                       // the last day eaten (yyyy-mm-dd or null), app.'s "17.11." or "–"
                added, added_text}                     // the day it was added, app.'s "18.10.26"
```

#### `GET /api/v1/food/item?id=N12` → `{"food_item": Item, "undo": Undo}`

One food's box (`id` "N12", "n12" or "12"; anything else 400 `id must be a food's id (N12 or 12).`; not there 404 `no_entry` "That
food is not there any more."). A hidden food reads too (`active` false): app.'s list never opens it.

```
Item = {id, ref, name, basis,
        source: {text,                                 // app.'s line: "Source: label · Brand · note · added 18.10.2026 · eaten 8 times,
                                                       // last 17.11.2026 · values per 100 g"
                 line, source, brand, note},           // its parts: "label · Brand · note"; source label|database|estimate|calculated
        needs_review, review_reason,
        values: [{key, label, value}],                 // the ten: kcal, protein, fat, sat_fat, carbs, fibre, sugar_total, sugar_added,
                                                       // sodium_mg, caffeine_mg; labels "kcal", "Protein g", … "Caffeine mg"; unknown null
        aliases, drink, active,
        units: [{unit, grams, text}],                  // "1 slice = 35 g" (ml for a drink)
        barcode, eaten, first, last, last_text, added, added_text,
        recipe, values_editable,                       // "C3" for a recipe food (its values are calculated: values_editable false,
                                                       // a values change is refused), else null and true
        past: null | {n, text},                        // "Also recalculate the 8 past entries (10.11.2026 to 17.11.2026)"; null: never eaten
        words: {values_hint, basics_hint, none, review, reviewed},   // app.'s words under the forms, "none", "needs review", "Looks right"
        limits: {name_min: 2, name_max: 120, word_max: 60, words_max: 20, unit_max: 30, grams_max: 2000, barcode_min: 8, barcode_max: 14}}
```

### Medical (104): lab reports, tests over time, medication

app.'s Medical page as data (`labspage.reports_data`, `tests_data`, `test_chart`, `meds_data`: app.'s three tabs draw from the same,
byte for byte as before). Values are written as the logger prints them (`text`: "13.8 g/dL", "<0.5 mg/L", "slightly enlarged"; ranges
"13.5-17.5", "<116", "-" for none). Flags: `H` high, `L` low, `A` abnormal (`flag_word`), `N` or null none. Health data: these answers
are no-store like every answer of the door, nothing of them is written to a log line, and the changes' audit rows keep ids and kinds
only.

#### `GET /api/v1/labs?open=R12` → `{"labs": Labs, "undo": Undo}`

`open` "R12", "r12" or "12" (the report open; one that is not there: none open, as app.); anything else 400 (`open must be a report's
id (R12 or 12).`).

```
Labs = {flagged: null | {                              // the newest report of kind lab (null when there is none)
          report_id, ref, date, date_text, title,
          heading: "Flagged in your newest report", hint,  // "Click one to see it over time. H high, L low and A abnormal in amber."
          empty,                                       // "Nothing flagged." or null
          chips: [{test_id, test, value, range, flag, flag_word}]},   // by test name; value as printed ("162 mg/dL")
        reports: [{id, ref: "R12", date, date_text, title, kind: "lab" | "imaging", provider, values, flagged}],  // newest first
        empty,                                         // "No reports yet." or null
        hint,                                          // "New reports come in through the chat (photo or PDF). …"
        open: null | {id, ref, date, date_text, title, kind, provider, notes,
                      values: [LabValue], empty,       // "No values in this report." or null
                      form: {collected, title, provider, notes},   // what "Change date, title or notes" starts from
                      value_hint, report_hint},        // app.'s words under the two forms
        limits: {value_max: 60, unit_max: 30, ref_max: 60, title_max: 200, provider_max: 200, notes_max: 2000}}
LabValue = {id, ref: "V34", test_id, test, note, text, value, unit, range, ref_low, ref_high, flag, flag_word,
            site,                                      // imaging: "left kidney", else null
            printed: {value, unit, ref}}               // as printed on the report: what the correction form starts from
```

#### `GET /api/v1/labs/tests?q=&t=<test id>` → `{"labs_tests": Tests, "undo": Undo}`

As app.'s Tests over time: `q` (cut at 60) searches names and words; `t` a test's id (not digits: 400 `t must be a test's id.`; one that
is not there: no test, as app.). Without a test: the tests with numbers on three or more days (`title` "Tests with values on three or
more days:"), or with `q` its matches (`empty` "No test with that name. Try another word." when none), at most 30 each, most values
first; a `q` with one match opens it. app.'s list has names and counts only (no latest value).

```
Tests = {q, placeholder, title, empty,
         tests: [{id, name, unit, values}],            // the list (empty when a test is open)
         test: null | {id, name, unit, values},
         card: null | {id: "test", title, small: "4 values", stat: [],     // the Health page's card shape …
                       chart,                          // … chart = app.'s data-chart object: start, days, label "<test> over time",
                                                       // years true, band [low, high] from the newest value (or null), series: a line
                                                       // (cls a, only with one value a day) and dots by flag (cls a none, w H or L,
                                                       // r A), pts [day index, value, "05.10.2026: 55 ng/mL (site)"]
                       legend: [{key, text}],          // "sq band" reference range (from the newest value), "w" outside the range
                       note},                          // chart null: "Only one value so far; …" or "All values are from one day …"
         rows: [{id, date, date_text, site, value, range, flag, flag_word, report_id, report_ref}]}   // newest first
```

#### `GET /api/v1/labs/meds` → `{"labs_meds": Meds, "undo": Undo}`

```
Meds = {today, running,                                // the count of running courses (a stop date after today is still running)
        empty, hint, form_hint,                        // "No medication recorded." or null; app.'s "A new course is a sentence …"
        meds: [{id, ref: "D3", name, ingredient, dose, frequency, indication, start, stop, start_text, stop_text,
                running, can_end}],                    // app.'s order: running first, then by start, newest first; can_end: running
                                                       // without a stop date (app.'s End button)
        limits: {dose_max: 60, frequency_max: 60, indication_max: 120}}
```

### More (107): Search, Recent, Usage, Coach

app.'s Search, Recent, Usage and Coach pages as data (`searchpage.results`, `recentpage.load` and `messages`, `usagepage.data`,
`coachpage.list_data` and `card_data`: app.'s pages draw from the same, byte for byte as before). Ids and facts, with app.'s words beside
them; the front end builds its own links. Never a thought, never a private or gratitude entry's words.

#### `GET /api/v1/search?q=` → `{"search": Search, "undo": Undo}`

As app.'s Search: `q` with its spaces squeezed, cut at 80 characters; under two characters nothing is searched (`searched` false, every
`rows` [], `hint` app.'s "Type at least two letters. …"). Every kind matches a part of a word, without case, with ä, ö, ü, ß read as ae,
oe, ue, ss on both sides ("muesli" finds "Müsli"). At most 15 of each kind; `more` true when a kind has 15 (app.'s "15+"; there may be
exactly 15). **No thoughts** (app.'s page has a Thoughts card; they stay at app.), and private and gratitude entries are never searched.

```
Search = {q, searched, limit: 15, hint,       // hint: "Private and gratitude entries are searched on the Private page only."
  foods:    {title: "Foods in the catalogue", more, rows: [{id: "N214", food_id, name}]},     // active foods, name or other words, A to Z
  ate:      {title: "What you ate", more, rows: [{id, ref: "f<id>", day, day_text: "Mon 16.11.2026", food, amount, unit,
                                                  amount_text: "150 g", note}]},              // food name, its other words or the
                                                                                              // entry's note; newest first
  workouts: {title: "Gym workouts", more, rows: [{workout_id, anchor: "w<id>", day, day_text, split, text}]},
                                              // the split day's name, an exercise's name or other words; split the day's name or
                                              // "Free workout"; text: the matching exercises with their rows ("Rowing 3 × 8 at 24 kg";
                                              // all exercise names when only the day matched; "nothing logged")
  chores:   {title: "Chores done", more, rows: [{chore_id, label: "Stove · Kitchen", day, day_text, start}]},
                                              // chore, zone (name or short) or their words; newest first; start: a starting point
  tests:    {title: "Lab tests", more, rows: [{test_id, name}]}                               // lab test names, A to Z
}
```

Links the front end can build: a food `/library?q=…&food=N214`, a meal `/food?day=…&open=f<id>`, a workout `/gym/history?w=<id>#w<id>`
(see `GET /gym/history?w=`), a chore `/home/chore?id=…`, a test `/medical/tests?t=<test id>`.

#### `GET /api/v1/recent` → `{"recent": Recent, "undo": Undo}`

As app.'s Recent page: the last 50 messages from the web app and from Claude (not imports), newest first, by logging day, each with what
it saved. A private or gratitude entry is listed by its label only: no words, no id, no Use again, no Open day (app.'s page shows its
words; the door never does). A message whose words carry a private label or name private entries (`P12`, "private entries") comes without
its words (`text` and `again` null; fail closed).

```
Recent = {limit: 50, small: "The last 50 messages from the web app and Claude", empty: "No messages yet.",
          none: "Nothing saved from this message.",         // app.'s line under a message that saved nothing
          days: [{day, head, messages: [Message]}],          // head: "Today", "Yesterday", "Mon 16.11."
          not_read}                                          // how many messages wait to be read (they are on Today's card:
                                                             // day.needs.not_read, Try again and Delete)
Message = {id,                                               // the message (raw_inbox); null for a private entry
           private, at, time: "13:05",
           channel, channel_label,                           // "web" "Web app", "claude-chat" or "mcp" "Claude"; null "Private"
           text, again,                                      // the words; again: the words for Use again (app.'s again_text: without
                                                             // "at 13:05", "on 01.11.2026", "(clicked …)"); null for a private entry
           open_day,                                         // the day Open day opens (the first thing it saved), or null
           saved: [{kind, text}]}                            // app.'s lines: Food "Skyr 150 g · meal 1", Health, Body, Habit, Sleep,
                                                             // a thought by its type ("Idea", "Task", … with its summary), Labs, Gym,
                                                             // Home, Task (to-do changes); a private entry [{kind: "Private", text:
                                                             // "private" | "gratitude"}]; [] = nothing saved
```

#### `GET /api/v1/usage?r=7|30|all` → `{"usage": Usage, "undo": Undo}`

As app.'s Usage page: what the AI calls cost over the last 7 days (default), 30 days or everything; another `r` is 400 `bad_request`
("r must be 7, 30 or all."). Dollars as numbers (5 places) and as app. writes them (`*_text`: "$0.10", "$0.012").

```
Usage = {r, ranges: [{r, label, current}],             // "7 days", "30 days", "Everything"
  start, end, days, first,                             // the range (end = today); first: the first day with a cost
  since,                                               // "Recorded since 26.10.2026 (the v2 trial); v1 kept no costs."
  tiles: {calls, usd, usd_text,                        // AI calls, Cost
          per_message, per_message_text, messages,     // Per message (typed messages only; null and "–" without one)
          tokens_in, tokens_out, tokens_text,          // "23k / 1k"
          tokens_known, tokens_note},                  // false and "some older calls have none" when a call has its cost only
  chart, empty,                                        // Cost per day: app.'s data-chart object (stacked bars per model family:
                                                       // cls a Haiku, b Sonnet, c Opus and other; pts [i, usd, hover, below]),
                                                       // null when there is no call (then app.'s "No AI calls in this range.")
  legend: [{key, text}],                               // "sq a" "Haiku (every message)", "sq b" "Sonnet (…)", "sq c" "Opus (coaching)"
  kinds: [Kind], all: Kind,                            // By kind, most expensive first, and the All row
  kinds_note,                                          // "* Some of these calls are older than 04.11.2026 …" or null
  pushes, pushes_text,                                 // "Phone notifications sent: 2 (free)."
  top: [{at, at_text: "Tue 17.11. 09:30", kind,        // the 10 most expensive calls but coachings
         text,                                         // the message's first 60 characters ("…" when longer); null for a private
                                                       // entry, a look-up, a lab report or a label photo (no words)
         private,                                      // a private entry's call: app.'s "private" mark, never words
         models, models_text,                          // ["Haiku", "Sonnet"], "Haiku + Sonnet"
         usd, usd_text, escalated}],                   // escalated: "read again by the larger model"
  note}                                                // "Private entries never show their words. …"
Kind = {kind, calls, tokens_in, tokens_out, tokens_known, tokens_in_text, tokens_out_text, usd, usd_text}
                                                       // kind: "message", "food look-up", "lab report", "label photo", "answer to a
                                                       // question", "coaching"; tokens_*_text "6.0k" ("6.0k*": some calls without)
```

#### `GET /api/v1/coach?f=all|days|weeks&day=yyyy-mm-dd` → `{"coach": Coach, "undo": Undo}`

As app.'s Coach page: every finished coaching, newest first (at most 100), of the kinds of `f` (all when not given; another value is
400 `bad_request`, "f must be all, days or weeks."), and the Coach card of `day` (today when not given; not a date: 400 "day must be
yyyy-mm-dd."; a day after today: 400 "day must not be after today.") for the page's "Coach a day".

```
Coach = {f, filters: [{f, label, current}],           // "All", "Days", "Weeks"
  list: [{id, kind, start, end,                        // kind "day" | "week"
          heading,                                     // "Sat 07.11." | "Week 02.11. to 08.11."
          first,                                       // the first line: the first of improve, went_well (day), focus, trends (week)
          parts: [Part], caution, meta}],              // as in the Review card (meta {model, usd, at, at_text, text}); without the
                                                       // parts switched off in Settings > Coach, also in older coachings
  empty,                                               // "No coachings yet. Press "Coach me" on Today or "Review this week" …"
  month: {count, usd, text},                           // this month's finished coachings (Berlin), whatever f is: "This month: 2
                                                       // coachings · $0.27 (also on the Usage page)."
  note,                                                // "Every coaching is kept; "Coach me again" adds a new one."
  day, card: Card}                                     // the day asked (or today) and its Coach card
Card = {kind: "day", start, end, title: "Coach", small: "this day · on demand", state, id, wait, wait_note, parts, caution, meta,
        failed, intro, cost, button, links}           // the Review card's keys without offered, blurb, latest, weeks (see Review):
                                                       // state "none" (intro "A short look at this day: …", cost "about 30 seconds
                                                       // · about 6 cents", button "Coach me"), "working" (wait "Coaching… about 30
                                                       // seconds", wait_note; button null: poll GET /coach/status?id=), "done"
                                                       // (parts, caution, meta, button "Coach me again"), "failed" (failed "That did
                                                       // not work (…); …", intro, cost, button "Coach me")
```

## Settings and notifications (110)

app.'s Settings tabs as data (`reads.settings_*`, built on `settingspage.targets_data`, `today_data`, `body_data`, `devices_data`,
`notify_data`, `coachpage.settings_data` and `export.settings_data`, which app.'s tabs draw from: app.'s pages are byte for byte as
before), their forms through app.'s own functions (`websettings.ACTIONS`, `coach.goals_set`) with their checks and words, the
notifications of this address (`/push/*`) and the export file. Not here: the gratitude goal (Settings > Today page's Gratitude card; it
stays at app. with the gratitude list).

### Reads: `GET /api/v1/settings/<tab>` → `{"settings_<tab>": …, "undo": Undo}`

`<tab>` is `targets`, `today`, `body`, `coach`, `devices`, `notify` or `export` (the answer's key: `settings_targets`, …).

```
settings_targets = {
  valid_from,                                  // the logging day: the form's default "Valid from"
  current: null | {valid_from, valid_from_text, note},   // the row in force (the newest from today or before; all later: the newest)
  fields: [{key, label, unit, value}],         // nine, in app.'s order: kcal "Calories" kcal, protein, fat, sat_fat, carbs, fibre,
                                               // sugar_added, sodium_mg "Sodium" mg, water_ml "Water" ml; value null = no target
  history: [{valid_from, valid_from_text, values: {kcal, …, water_ml}, note}],   // every row, newest first
  limits: {min: 0, max: 100000, note_max: 200}, hint}
settings_today = {groups: [{kind, heading, items: [{id, label, shown}]}], hint}
                                               // kind habit ("Habits": id = the habit's name), health ("Health card rows": bed, wake,
                                               // weight, sugar, bp_morning, bp_evening), usual ("Usual meal buttons": id = the meal's
                                               // id as text), review ("Box": box "To review"), card ("Cards": gratitude, home, coach);
                                               // items in the chosen order (new ones after); shown false = hidden on Today
settings_body = {valid_from, height: null | {cm, valid_from},   // the height in force today
  heights: [{cm, valid_from, valid_from_text}],                 // newest first
  height_range: {min: 120, max: 230}, interval: {days, min: 7, max: 90, default: 28},
  measures: [{key, label, shown}],             // waist, hips, chest, upper_arm, thigh
  hints: {height, measures}}
settings_coach = {goals, style, max: 2000,
  kinds: [{kind: "day" | "week", title, parts: [{key, label, on}]}],   // "Day coaching (Today)": went_well, improve, next_meal, gaps,
                                               // doctor; "Week review (Week page)": targets, trends, habits, days, focus, doctor
  facts: [4 lines],                            // "How the coach works" (the model and the daily limit from coach.py)
  model, daily_limit}
settings_devices = {devices: [{id, name, address: "logger" | "app", signed_in, last_used, expires, current}], others}
                                               // every session not expired (web_sessions), last used first: here (logger.) and at
                                               // app.; name from the browser ("iPhone, Safari", "Unknown device"); current: this
                                               // session; others: how many are not
settings_notify = {on, on_label: "Send nudges",
  nudges: [{key, label, after, on, hours: {key, value, min, max, step: 0.5, default}, note}],
                                               // weight, habits, idle, checkin, bp_evening, gratitude: "<label> [hours] <after>", e.g.
                                               // "No weight yet," … "hours after waking"; note (gratitude only): "A tap on this one
                                               // opens the gratitude list in the full app."
  awake_hours: 16,                             // quiet hours: nothing later than this after waking
  subscriptions: [{id, name, address: "logger" | "app", on_since, last_delivered, this}],   // oldest first; this: turned on in
                                               // this session (POST /push/subscribe); last_delivered null: nothing delivered yet
  public_key,                                  // the VAPID key a browser subscribes with (applicationServerKey); null: not set up
  twice}                                       // a device name with notifications on both here and at app.: show "This phone is on at
                                               // app. too: nudges arrive twice until you turn that one off."
settings_export = {title, intro, private_label, button, hint,
  last: null | {at, private, text}}            // the last download: "Last download: 11.11.2026 09:12, with private entries."
```

### Saves

As app.'s Settings: **no `key`** (one sent is ignored) and **no Undo** (a change ends the session's Undo bar, as app.'s forms do). Each
answers in the save shape (see Saves below) with the fresh tab: `settings_<tab>` as its GET (the body's `view` chooses another read,
e.g. `"day"`). app.'s refusals are `rejected` with app.'s `reason`; a wrong kind of field is 400 `bad_request`. A field left out stays
as it is now (the door fills it in, as app.'s form comes filled in), except on `/settings/targets`.

| Route | Body | Calls (app.'s words) |
|---|---|---|
| `/settings/targets` | `valid_from` (yyyy-mm-dd), `kcal`, `protein`, `fat`, `sat_fat`, `carbs`, `fibre`, `sugar_added`, `sodium_mg`, `water_ml` (numbers; left out or null: no target, as app.'s form: the row is all nine), `note` (up to 200) | `websettings.targets`: "Targets from 17.11.2026 saved: Calories 2000, Protein 150, Water 3000 ml."; "Give the date the targets start on.", "Calories: give a number from 0 to 100000, or leave it empty.", "Give at least one target." A row of the same day is replaced; earlier days keep theirs. |
| `/settings/today` | `groups: {habit|health|usual|review|card: [{id, shown}]}`, each list in the wanted order (one tap sends its whole group) | `websettings.today`, as app.'s form (show_/pos_ fields): stored in `ui_settings` "today" as `{hidden, order}`. A group not sent stays as it is; an item of a group missing from its list keeps its state and goes after the sent ones; an unknown id is ignored (as on app., ids no longer on the page drop out of what is stored). "Saved. The Today page shows what you chose." / "… shows everything." |
| `/settings/today_reset` | | `websettings.today_reset`: "The Today page shows everything again, in the default order." |
| `/settings/height` | `valid_from`, `height` (cm) | `websettings.height`: "Height 177 cm saved, from 01.02.2026."; "Give the date the height counts from.", "Height: give a number from 120 to 230 cm." |
| `/settings/body` | `interval` (whole days), `show` (the measure keys shown) | `websettings.body_settings`: "Body measurements: due every 28 days, 3 hidden."; "Due every: give a whole number of days from 7 to 90.", "Keep at least one measure." |
| `/settings/coach` | `goals`, `style` (text up to 2000, as `coach._clean` reads it), `parts: {day: [keys on], week: [keys on]}` (a kind left out: as now) | `coach.goals_set`: "Saved: the coach reads your settings every time."; "Keep at least one part of the day coaching." / "… week review." |
| `/settings/device` | `id` (a device of `settings_devices`) | `websettings.device` (also an app. session): "Signed that device out."; this session: "This is the device you are using; use Sign out on More." (app. says "… at the top."); gone: `unchanged` "That device is already signed out."; "Unknown device." |
| `/settings/others` | | `websettings.others`: every other session, here and at app.: "Signed out 2 other devices." / "No other device was signed in." |
| `/settings/nudges` | `on`, `weight`, `habits`, `idle`, `checkin`, `bp_evening`, `gratitude` (true or false); `weight_after`, `habits_after`, `idle_hours`, `checkin_after`, `bp_evening_after`, `gratitude_after` (numbers: clamped to their range in half hours, as app.) | `websettings.nudge_settings` (nudges.save stores the whole value; the door fills in what is left out): "Saved. Nudges are on." / "… off." |
| `/push/subscribe` | `endpoint`, `keys: {p256dh, auth}` (the browser's PushSubscription), `user_agent` | app.'s checks of `/web/push/subscribe` (`webpush.allowed`: https on Apple's, Google's, Mozilla's or Microsoft's push service; `webpush.valid_keys`), else `rejected` "Not a known push service."; kept with `origin` "logger" and this session (upsert on the endpoint; the audit row "notifications on"): "Notifications are on for this device." |
| `/push/off` | `id` (a number: `settings_notify.subscriptions[].id`, here or at app.) | `websettings.push_off`: "Notifications are off for that device."; "That device is not there any more." |
| `/push/test` | | `websettings.nudge_test`, to every device (each with its own address's link): "Test notification sent to 2 devices."; none: "No device took the test notification. Turn notifications on again on the phone, then try once more." |

### The notifications at two addresses (migration 032)

`push_subscriptions.origin` is `app` (`/web/push/subscribe`, every row before 110) or `logger` (`POST /push/subscribe`). One VAPID key
serves both; each browser's subscription has its own endpoint. `nudges.deliver` sends every message (the nudges, "Not read yet" of
held.py, the test) to every device with the link of its address (`nudges.link_for`): app.'s unchanged (`/web/…`, as before); a logger.
device's `/web/` → `/`, `/web/settings?tab=notify` → `/settings/notifications`, and any other app. page (the gratitude nudge's
`/web/gratitude`: its words stay at app.) → the full app's absolute address `https://<APP_HOST>/web/…`. The payload is otherwise the same:
`{title, body, url, tag}` (the front end's service worker shows `title` and `body`, and opens `url` on a tap). A device with notifications
on at both addresses gets each nudge twice (`settings_notify.twice`). app.'s Settings > Notifications lists every device alike.

### The export: `POST /api/v1/export` → the ZIP

Body `{private: true | false, code}` (private left out: false; not a boolean: 400). Since 21.11.2026 (Core 37) `private: true` needs
`code`, the authenticator code, checked as at a sign-in (`web.sign_in`; `api._private_code`): each code works once (it moves
`owner_credentials.last_totp_step`, the row locked while it is checked), a wrong or missing code is 403 `wrong_code` ("Wrong
authenticator code (or one used already). Nothing was exported." / "The export with private entries needs the authenticator code.
Nothing was exported.") and a failed try of this session's device (`login_failures`, the sign-in's pool of a known device), and after
`auth.MAX_FAILURES` failed tries within `auth.FAILURE_WINDOW_MIN` minutes (sign-ins and codes together) it is 429 `too_many_tries`, even
with the right code; the right code clears the device's failed tries. Nothing is exported on a refusal. Without `private` nothing
changed: no code is asked for. The answer is **the file itself**, not JSON: `application/zip`,
`Content-Disposition: attachment; filename="logger-export-dd.mm.yyyy.zip"`, `Cache-Control: no-store`, `X-Session-Expires`; made by
`export.download` exactly as app.'s Download (the same files; `private.csv` only with `private: true`; the audit row with counts only).
Its errors are JSON as everywhere (the door's checks first; 500 `server_error` "The export could not be made (the database did not
answer). Try again in a moment."). Only this route may answer anything but JSON (`route(..., download=True)`; a file from any other route
is a 500).

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
| `/api/v1/food/mealnote` (21.11.2026) | `day` (yyyy-mm-dd), `meal` (1, 2, …; 0 = the day's note when no meal is left), `note` (up to 300 characters after whitespace is collapsed; empty or left out = removed); answers with the fresh `food_day` of `day` | `mealnotes.save`: "Meal note saved.", "Meal note removed." ("Note saved.", "Note removed." for the day's note); `unchanged` "Nothing changed." or "There was no note to remove."; rejected "That meal is not there any more.", "This day has meals: a note goes on one of them.", "That day has not started yet."; 400 for a missing or bad `day` or `meal`, a `note` that is not text or over 300. The note replaces every note that shows on that meal now (one per meal); no Undo, no key (saving twice is the same). |
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
| `/api/v1/home/<action>` (98) | `action` in the path: one of the 20 of `home.ACTIONS` (below); its fields, `key` on six; `view` (+ `view_min`, `view_n`, `view_limit`, `view_id`) for another fresh read | `home.ACTIONS[action]` (app.'s `/web/home/<action>`) |
| `/api/v1/coach/start` (101) | `kind: "week"` or (107) `"day"`, `start`, `end` (yyyy-mm-dd: the Week review's period, or the day twice); **no `key`**; `view`, `view_p`, `view_day`, `view_f` for another fresh read | `coach.start` (app.'s `/web/coach/start`; see below) |
| `/api/v1/lookup` (89) | `text` (a name, or a barcode of 8 to 14 digits), optional `question_id` (an open food question it answers; without `text` the question's word is looked up) | `webfood.look_up` → `logbook.food_lookup` (no key: it saves nothing) |
| `/api/v1/food/catalogue/<action>` (104) | `action` in the path: `values`, `words`, `barcode`, `basics`, `unit`, `reviewed`; `id` (the food's number) and its fields (below), `confirmed` (values); **no `key`** (one sent is ignored); `view` (+ `view_q`, `view_f`, `view_s`, `view_food`) | `webfood.ACTIONS[action]` (app.'s `/web/food/<action>`; `unit` is `webfood.unit_add`) |
| `/api/v1/labs/value`, `/labs/report`, `/labs/med` (104) | `id` (the value's, report's or course's number) and its fields (below), `confirmed`; **no `key`** (one sent is ignored); `view` (+ `view_open`, `view_q`, `view_t`) | `weblabs.ACTIONS[action]` (app.'s `/web/labs/<action>`) |
| `/api/v1/settings/<form>`, `/push/subscribe`, `/push/off`, `/push/test` (110) | see "Settings and notifications (110)" above; **no `key`**; `view` | `websettings.ACTIONS[form]`, `coach.goals_set`; the subscription as `/web/push/subscribe` |

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

Home's saves (98), each like app.'s form of the same name (`home.ACTIONS`):

- Fields (ids and numbers as JSON numbers, `pairs` as `[[chore_id, zone_id], …]` (1 to 12), lists of texts as lists; a wrong kind of
  field is 400 `bad_request`, nothing saved):
  `tick`: `chore_id`, `zone_id`, `key` (a done pair today: its tick taken off); `alldone`: `chore_id` (a whole-flat chore), `key`;
  `remove`: `ids` (a `Done` entry's ids, 1 to 20);
  `zonenew`: `name` (up to 40), `short` (tile label, up to 12; empty: the name's first word), `spots` (up to 12 of up to 40, one line
  each), `words` (up to 12 of up to 40, no commas); `zoneedit`: `zone_id` and the same; `zoneactive`: `zone_id`, `on` (false = Retire);
  `chorenew`: `name` (up to 60), `zone_id` (a zone, or null = the whole flat; required), `days` (whole), `minutes` (whole; left out
  or null = 15), `steps` (up to 8 of up to 80, one line each), `howto` (text up to 300, or null), `words`; `choreedit`: `chore_id` and the
  same; `choreactive`: `chore_id`, `on`;
  `start`: `pairs`, `minutes` (the Pick page's); `pause`, `resume`, `stop`: `timer_id`; `pickdone`: `pairs` (`timer_id` may come
  along, not needed), `key`; `picknext`: `pairs`, `timer_id`, `key`; `skip`: `pairs`;
  `goalset`: `goal`; `chorezones`: `chore_id`, `zones: [{zone_id, on, days, minutes}]` (the whole Per zone table: **a zone left out
  is off**, as an unticked box; `days`, `minutes` null or left out = blank = the chore's own);
  `startpoint`: `pairs`, `ago` (`week` = 3 days ago, `month` = 14 days ago, `longer` = twice the interval ago, `unknown` = "Don't
  know": left as not logged yet, off the card), `key`; `earlier`: `pairs`, `when` (1 to 7 = days ago, or `yyyy-mm-dd`: a day before
  today in the last year; done at 12:00 that day), `key`.
- Refusals are `rejected` with app.'s plain `reason` and change nothing, e.g. "That chore is not in the list.", "That is not a
  whole-flat chore.", "That is not in the history any more.", "Type the zone's name.", "… is already in your list.", "Another zone has
  that name.", "That zone is not in the list.", "Type the chore's name.", "Give the interval in whole days and the minutes as a whole
  number.", "The interval is 1 to 730 days and the time 1 to 240 minutes.", "Pick a zone from the list, or the whole flat.", "That job
  is not in the list any more." (also `start` outside 1 to 240 minutes), "That timer is not running." / "… not paused." / "… already
  closed.", "The weekly goal is 1 to 7 sessions.", "Give the days (1 to 730) and minutes (1 to 240) as whole numbers, or leave them
  blank.", "… needs at least one zone. Retire it instead.", "Pick a job from the list.", "Pick a day before today, in the last year.".
  A name, label or text too long is 400 `bad_request`; ranges are app.'s (the refusal above).
- Not refusals (as app.): `zonenew` of a retired zone's name brings it back with its history ("… is back in your list."); `pickdone`
  of a job ticked today already: "Already ticked today." (no Undo); `skip` of a job hidden already: "Hidden already."; `startpoint` of
  a pair logged meanwhile: "Logged already."; `picknext` with nothing else that fits or under 3 minutes left: "… Nothing else fits in
  the time left; the timer is closed."
- `key`: only `tick`, `alldone`, `pickdone`, `picknext`, `earlier` and `startpoint` take one (app.'s rule, `home._once`): a re-sent key
  answers the first answer (`replayed: true`) and saves nothing twice; the same key with another body is refused ("This form was already
  used."). The others take none (a `key` sent is not used): `chorenew` sent twice adds a second chore of that name, `zonenew` is
  refused the second time (the name is there), `remove` finds nothing the second time, `start` starts the timer again; the rest are the
  same twice. The page sends each of them once.
- The timer is kept on the server: `start` closes any open timer and starts one (ends_at = now + minutes); `pause` keeps the seconds
  left, `resume` runs them; `stop` closes it ("Finished" once over: a timer that ran out counts as a session); `pickdone` ticks the job's
  pairs not done today (source "pick") and closes the timer; `picknext` ticks them and moves the running timer to the next job that fits
  in the time left (its title in `head`: "Saved: … Next: …").
- **Undo** (`POST /undo`), where app. has it (`home.undo`): `tick` (the tick deleted; a tick taken off: put back), `alldone` (the same),
  `remove` (the rows back with the same ids), `pickdone`, `picknext` when it ticked something, `earlier`, `startpoint` (the rows
  deleted; "Don't know": back on the card), `skip` (the job back in the list). The other twelve have no Undo (as on app.): the answer's
  `undo` is null and the session's earlier Undo goes; a refusal or a replay leaves it. Send `"view": "home"` (or another Home view, with
  its parameters) with the undo for the page's fresh read.
- The answer carries the page's fresh read: `tick`, `pickdone` → `home`; `start`, `pause`, `resume`, `stop`, `skip`, `picknext`,
  `earlier` → `home_pick`; `alldone`, `startpoint` → `home_zones`; `remove` → `home_history`; `zonenew`, `zoneedit`, `zoneactive`,
  `chorenew`, `choreedit`, `choreactive`, `chorezones`, `goalset` → `home_edit`. The body's `view` chooses another (also `day`), with
  the page's parameters as `view_min` (`home`, `home_pick`), `view_n` (`home_pick`), `view_limit` (`home_history`'s `n`) and `view_id`
  (`home_chore`; without it, or a chore not there, `home_chore` is null: the save is made all the same).
- Not here (as at app.): the starter list (`python -m app.homeseed`); chores typed in a line go through `POST /log` (and `/answer`) as
  before (`homechat`).

The Catalogue's saves (104), at `/api/v1/food/catalogue/<action>` (not `/food/<action>`: `/food/entry` and `/food/note` change food
entries; these change a food), each through the same function as app.'s form of that name (`webfood.values`, `words`, `barcode`, `basics`,
`unit_add`, `reviewed`):

- Fields (`id` the food's number, e.g. 12 for N12; a wrong kind of field is 400 `bad_request`, nothing saved):
  `values`: the ten values (`kcal`, `protein`, `fat`, `sat_fat`, `carbs`, `fibre`, `sugar_total`, `sugar_added`, `sodium_mg`,
  `caffeine_mg`) as numbers; **one left out or null is not sent** (unchanged; an unknown value cannot be set here, as on app.); `past`
  (true: the past entries are rewritten from the new values, app.'s tick "Also recalculate the n past entries"; false or left out:
  only new entries use them), `confirmed`;
  `words`: `act` (`add` or `remove`), `word` (up to 60; lower-cased and tidied by app.'s function);
  `barcode`: `barcode` (text: 8 to 14 digits, spaces allowed);
  `basics`: `name` (up to 120), `drink`, `hide` (true or false); **one left out stays as it is** (app.'s form comes filled in; a box not
  ticked there is sent as false here);
  `unit`: `unit` (up to 30), `grams` (a number; ml for a drink); the same unit again changes its grams;
  `reviewed`: `id` only ("Looks right").
- `values` is shown first: `needs_confirmation` with app.'s `read_back` (v1's preview) and `confirm`; the same request again with
  `confirmed: true` saves it (`changed`, "Changed N12 Skyr."). The others are saved at once (`changed`), as on app.
- Refusals are `rejected` with app.'s `reason` and change nothing: "Unknown food.", "kcal: give a number of 0 or more.", "Type a word
  first.", "A barcode is 8 to 14 digits.", "Give the food a name.", "Name the unit, e.g. slice, piece, scoop or cup.", "Give its weight
  as a number above 0 and at most 2000 g.", and v1's own: a word that is another food's name or word ("'…' is the name of N7 …: an alias
  must not shadow another food", "'…' is already an alias of N7 …: remove it there first, or use a more specific word"), more than 20
  words, a recipe food's values ("N12 is calculated from recipe C3: change the recipe (C3) instead"). The same values, name, barcode
  again: `unchanged`, "Nothing changed.".
- **No `key`** (app. has none; one sent is ignored: a word added twice is "already a name or alias" the second time) and **no Undo** (as
  on app.: the answer's `undo` is null and the session's earlier Undo goes; a refusal leaves it).
- The answer carries the fresh Catalogue (`view: "catalogue"`, the default): `catalogue` as `GET /food/catalogue` with `view_q`,
  `view_f`, `view_s` (an unknown filter or order: app.'s default), and `food_item`, the box of `view_food` (12 or "N12") when that food
  is in the list, else null (also after it was hidden, as app. shows no box then); without `view_food` null.
- A new food is `POST /lookup` (the read-back, its `yes` through `POST /answer`); send `"view": "catalogue"` (with `view_q`, …) to both
  for the fresh Catalogue with the new food in it.

Medical's saves (104), at `/api/v1/labs/value`, `/labs/report`, `/labs/med`, each through the same function as app.'s form (`weblabs.value`,
`report`, `med`):

- Fields (`id` the number of the value V…, report R… or course D…; texts as text, dates as yyyy-mm-dd; **a field left out stays as it
  is** (app.'s form comes filled in), **null is empty**; a wrong kind of field or one longer than the form allows is 400 `bad_request`):
  `value`: `value` (as printed, up to 60), `unit` (up to 30), `ref` (the range as printed, up to 60, e.g. "30-100" or "<116");
  `report`: `collected` (the date), `title` (up to 200), `provider` (up to 200), `notes` (up to 2000);
  `med`: `act` (`save` or `end`); with `save`: `dose`, `frequency` (up to 60 each), `indication` (up to 120), `start`, `stop` (null =
  running).
- Every change is shown first: `needs_confirmation` with app.'s `read_back` and `confirm` ("Yes, change"; End: "Yes, end it today"); the
  same request again with `confirmed: true` makes it (`changed`: "Changed Haemoglobin.", "Changed the report.", "Vitamin D ended today.",
  "Changed Vitamin D."). The logger converts the unit and sets the flag again.
- Refusals are `rejected` with app.'s `reason`: "That value is not there any more.", "The value cannot be empty.", "That report is not
  there any more.", "The title cannot be empty.", "The lab cannot be empty.", "Give the report's date.", "That course is not there any
  more.", "Give the start as a date.", and v1's own (e.g. "stop 01.01.2023 lies before start 01.04.2023"). Nothing different from now:
  `unchanged`, "Nothing changed."; End on a course with a stop date: `unchanged`, "That course has a stop date already.".
- **No `key`** (one sent is ignored) and **no Undo**, as on app.
- The answer carries the fresh read: `value` and `report` → `labs` with the changed report open (or `view_open`); `med` → `labs_meds`.
  The body's `view` chooses another: `labs` (+ `view_open`), `labs_tests` (+ `view_q`, `view_t`), `labs_meds` (also `day`).
- A new course is a sentence through `POST /log` ("started vitamin D 1000 IU daily"): read back (`needs_confirmation`, its question in
  `questions`), saved by `yes` through `POST /answer`; send `"view": "labs_meds"` to both for the fresh Medication tab.

The Week review's button (101) and the Coach card's "Coach me" (107), `POST /api/v1/coach/start`, through `coach.start` exactly as
app.'s `/web/coach/start`:

- `kind` is `"week"` or (since 107) `"day"`; anything else is 400 `bad_request` (`kind must be "day" or "week".`; until 107 a day was
  refused). `start` and `end` as yyyy-mm-dd (else 400, `start must be a date yyyy-mm-dd.`): the card's `start` and `end` (a day: the
  same day twice; another end is coach.start's own refusal below).
- **No `key`, and a page must never send this request again by itself** (not after a sign-in, not on a retry): `coach.start` takes no
  key, and every coaching that starts is read by the AI and costs money (about 6 cents a day, about 20 cents a week). Only the owner's
  press starts one.
- app.'s checks, each `rejected` with app.'s `reason` and `coaching: null`: "That is not a day or week to coach." (not a calendar day,
  end before start, end after today, more than 31 days, a day whose end is not its start), "That is 10 coachings today, the daily limit. Tomorrow there are new ones."
  (day coachings and reviews together, per logging day).
- Started: `changed`, `head` "The coach is reading your week: about 45 seconds." (a day: "The coach is reading your day: about 30
  seconds."), `coaching: {id, state}` of that kind and period (`working`; the coach reads in the background, 20 to 60 s: poll
  `GET /coach/status?id=`). One for the same period still reading: `changed`, `head` "The coach is
  already on it." and that one's `coaching` (nothing new starts).
- The answer has the save's shape plus `coaching`, and a fresh read: a week the Week page (`week`) of `view_p` (without `view_p` the
  period of `start`/`end` when it is last week or this week so far, else 7); a day (107) the day (`day`) of `view_day`, without it the
  day coached. `view` chooses another read, e.g. `"coach"` (the Coach page with `view_f`, and the card of `view_day`, else the day
  coached; an unknown `view_f` is all, a later day today). No Undo; as app., it ends the session's
  Undo bar.

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
       |  home: Now  |  home_pick: Pick  |  home_zones: Zones  |  home_history: History  |  home_chore: Chore  |  home_edit: Edit
       |  week: Week  |  catalogue: Catalogue + food_item: Item | null  |  labs: Labs  |  labs_tests: Tests  |  labs_meds: Meds
       |  coach: Coach  |  settings_targets | settings_today | settings_body | settings_coach | settings_devices
       |  settings_notify | settings_export
                                                       // the fresh read; body "view": "day" | "food" | "usual" (86) | "health" |
                                                       // "body" (91) | "habits" (93, with "show") | "gym" | "gym_plan" |
                                                       // "gym_exercises" (95) | "home" | "home_pick" | "home_zones" |
                                                       // "home_history" | "home_chore" | "home_edit" (98, with view_min,
                                                       // view_n, view_limit, view_id) | "week" (101, with view_p) |
                                                       // "catalogue" (104, with view_q, view_f, view_s, view_food) |
                                                       // "labs" (104, with view_open) | "labs_tests" (with view_q, view_t) |
                                                       // "labs_meds" | "coach" (107, with view_f; view_day the
                                                       // card's day) | "settings_<tab>" (110) and "view_day": "yyyy-mm-dd" choose it
                                                       // (on every save: /log, /answer and /lookup too);
                                                       // /gym/<action> defaults to its tab (see the Gym's saves);
                                                       // /home/<action> to its page (see Home's saves);
                                                       // /coach/start to "week" or "day" (see the Week review's button);
                                                       // /settings/<form> and /push/* to their tab (110);
                                                       // /food/catalogue/<action> to "catalogue", /labs/value and
                                                       // /labs/report to "labs", /labs/med to "labs_meds";
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

Not in the door (on purpose, for now): the gratitude goal (Settings > Today page's Gratitude card: it stays at app. with the list);
the old Habits tab of Settings (habits are managed through `/habits/manage` since 93); thoughts in Search (app.'s Search keeps its Thoughts card); a list of hidden foods (the Catalogue lists active foods only, as app.; a hidden
food's box reads by its id and `basics` with `hide: false` brings it back), a lab report upload (reports come in through the chat), the
gratitude list itself (only its count), Ideas and Private. The Food catalogue editor is in since 104; the day coaching (Today's
Coach card), the Coach page, Search, Recent and Usage since 107; Settings, the notifications and the export since 110.

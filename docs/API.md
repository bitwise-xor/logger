# The JSON door `/api/v1` (for the new front end)

Since deploys 75 and 76 (16.11.2026). Code: `core/app/api.py` (the door, the saves), `core/app/reads.py` (the reads).
Tests: `tests/test_api_door.py`, `tests/test_api_reads.py`, `tests/test_api_saves.py`.

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

## Every answer

- JSON, `"v": 1` in every body, `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`.
- Signed-in calls carry `X-Session-Expires: <ISO time, UTC>`: the session's end. A session in use renews like a page view
  (once a day the end moves to 30 days from now); the front end can renew its own cookie from this header.
- Errors: `{"v": 1, "error": "<code>", "message": "<plain text>"}`. Codes: `not_found` 404, `signed_out` 401,
  `wrong_credentials` 401, `too_many_tries` 429, `bad_request` 400, `too_large` 413 (body over 64 KB), `no_entry` 404,
  `server_error` 500.
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

### `GET /api/v1/day?day=yyyy-mm-dd` → `{"day": Day}`

Today without `day`; an earlier day as asked; a later day is today. Built on `todaypage.load`, `webquestions.load`, `held.rows` and the
gratitude count. No Home, Gym or Coach cards, no body-measure line.

```
Day = {
  day, today, past,
  header:  {wake_at, slept_minutes, awake_minutes, naps: [{bed_at, wake_at, minutes}], next_sleep, watch_wake_at},
  needs: {
    questions: [Question],                              // today only; every open question, newest first
    not_read:  [{id, received_at, text, tries, needs_you, reading}],   // messages kept but not read yet (today only)
    review:    [{ref, kind, label, day, reason, at, thought_type, area, type, time, v1, v2, unit}],
    checkin:   null | {day, mood, energy, scale: {mood: [5 words], energy: [5 words]}}
  },
  energy:  {totals: {kcal, protein, fat, carbs}, targets: {…same, null if none}, meals: [{meal, label, nutrients}]},
  water:   {ml, target_ml, glass_ml},
  chips:   {again: [{food_id, name, amount, unit}],
            usual: [{meal_id, name, nutrients, items: [{item_id, food, amount, unit, nutrients}]}]},
  rows:    [Row],                                       // food and health together, in time order, unknown times last
  health:  [{row, label, sub, type, period, unit, ref, v1, v2, at, last_at}],   // the Health card, shown rows in the chosen order
  habits:  [{name, label, done, target, complete, avoid, last_tick}],
  gratitude: {count, goal}                              // a count only, never words
}
Row (food)   = {ref: "f<id>", kind: "food", meal, at, time_known, food, food_id, amount, unit, portion_text,
                nutrients: {kcal, protein, fat, carbs}, usual_meal: null | {id, name}}
Row (health) = {ref: "m<id>" | "e<id>", kind: "measurement" | "event", type, label, at, time_known, v1, v2, unit, period, needs_review}
Question     = {id, tool, kind, asked_at, open_until, message, text, read_back, answers: [{reply, label}],
                free: null | {placeholder, type: "text" | "number", unit}, lookup: null | {name, source, per_100}, refill}
```

- `meal`: 1, 2, … by the 2-hour rule; 0 = the day's drinks. `ref` values are stable: the saves take them.
- `health[].ref` is the entry a correction changes; `null` = nothing logged yet. Twelve hours after the wake-up, Woke up and Bed are
  for the next sleep: `ref` null, the last time in `last_at` (`header.next_sleep` true).
- `habits[].last_tick` is the tick an untick removes.
- `Question.answers` are buttons: send the `reply` to `/answer`. `free`: a field whose words go to `/answer`. `refill`: words to put
  back in the log box ("Correct it", "Log again"). `read_back`: show before the answers.
- A thought to review comes with `thought_type` and `area`, never its words (`label` null).

### `GET /api/v1/food/day?day=` → `{"food_day": FoodDay}`

```
FoodDay = {day, today, past, rows: [Row (food) + note], meals: [{meal, label, nutrients}], totals, targets}
```

Built on `foodpage._day_rows`.

### `GET /api/v1/food/entry?ref=f<id>` → `{"entry": {...}}`

`{ref, day, food_id, food, amount, unit, at, time_known, note, units: [{unit, in_basis}]}`. `units`: the food's own unit first
(`in_basis` 1), then its other units with how much of the base unit one is ("slice", 35). Unknown: 404 `no_entry`.

## Saves (`POST`)

Each calls the same function as the live form and passes `key` (a new random string per action, the same on a re-send) where that
function takes one, so a re-sent request saves once (`replayed: true`).

| Route | Body | Calls |
|---|---|---|
| `/api/v1/log` | `text`, `key` | `logbook.log` (synchronous: it can wait for the AI up to about 40 s; then `held`, the words kept) |
| `/api/v1/again` | `food_id`, `amount`, `time` (hh:mm, optional = now), `key` | `webfood.again` |
| `/api/v1/usual` | `meal_id`, `key`; optional `items: [{id, amount}]` (only these, with these amounts) and `time` | `webactions.usual` |
| `/api/v1/water` | `key`, `ml` (optional, 50 to 2000; default 250) | `webfood.water` |
| `/api/v1/habit` | `name`, `action`: `tick` or `untick`, `ref` (the tick, optional: today's last), `key` | `webactions.habit` |
| `/api/v1/checkin` | `type`: `mood` or `energy`, `value` 1 to 5, `day` (optional: yesterday while asked), `key` | `webactions.checkin` |
| `/api/v1/health` | `row` (`bed`, `wake`, `weight`, `sugar`, `bp_morning`, `bp_evening`), `v1`, `v2` or `t` (hh:mm), `ref` (to correct), `confirmed`, `key` | `webactions.health` |
| `/api/v1/answer` | `question_id`, `reply` | `logbook.answer` (no key) |
| `/api/v1/review` | `act: "ok"` + `ref`, or `act: "all"` + `refs: [...]` (the refs shown) | `webactions.review` |
| `/api/v1/food/entry` | `ref`, `act`: `save` (`amount`, `unit`, `time`, `food_name`) or `delete`, `confirmed` | `webfood.entry` |
| `/api/v1/food/note` | `ref`, `note` (empty = removed) | `webfood.note` |
| `/api/v1/undo` | `token` (from the last answer's `undo`) | `webundo.apply` |

Every save answers (HTTP 200, also when nothing was saved):

```
{
  v, outcome,            // saved, partly_saved, changed, unchanged, needs_confirmation, needs_choice, held, rejected, cancelled, answered, …
  head,                  // one short line to show
  receipt: [lines], notes: [lines], reason,
  questions: [{id, question}],                 // the full question, with its buttons, is in day.needs.questions
  read_back,             // a change the logger reads back first …
  confirm: null | {label, no_label},           // … then send the same request again with "confirmed": true
  result,                // a look-up's answer
  replayed,
  undo: null | {token, head, expires_at},      // one per session, 15 minutes; POST /api/v1/undo {token}
  day: Day  |  food_day: FoodDay               // the fresh day; body "view": "food" | "day" and "view_day": "yyyy-mm-dd" choose it
}
```

- **Undo** works as the web app's Undo bar: one record per session, replaced by the next action (not by a re-sent or refused one),
  gone after 15 minutes. A typed message is undone only while it is still the newest one.
- **Private and gratitude words never appear in any answer.** A line starting `g:`, `gratitude:` or `private:` is saved without the
  AI and answered with `head` "Saved privately." and no receipt. A look-up or change that names private entries (the logger writes them
  as `P<id>` or "private entries") is answered without its texts and with `reason` saying to open it in the app; the same holds for an
  open question's text and read-back.
- Errors inside a save (the AI or the database not answering) are `outcome: "rejected"` with a reason that nothing was saved; a typed
  line's words stay kept (`held`) and appear in `day.needs.not_read`.

Not in the door (on purpose, for now): Home, Gym and Coach, body measurements, the Food catalogue and usual-meal editors, "Try again" or
"Delete" on a message not read yet, the gratitude list itself (only its count), Ideas and Private.

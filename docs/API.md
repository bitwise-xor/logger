# The JSON door `/api/v1` (for the new front end)

Since deploys 75 and 76 (16.11.2026); deploy 77 (16.11.2026) made the changes of the door's review (marked "since 77");
deploy 78 removed the old field names that 77 kept for one deploy; deploy 86 added the usual-meal editor; deploy 89 the scanner, the label photo and the look-up. The front end that calls it: `front/` (`front/README.md`).
Code: `core/app/api.py` (the door, the saves), `core/app/reads.py` (the reads).
Tests: `tests/test_api_door.py`, `tests/test_api_reads.py`, `tests/test_api_saves.py`, `tests/test_api_shape.py` (77),
`tests/test_api_usual.py` (86), `tests/test_api_scan.py` (89).

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
gratitude count. No Home, Gym or Coach cards, no body-measure line.

```
Day = {
  day, today, past,
  header:  {wake_at, slept_minutes, awake_minutes, naps: [{bed_at, wake_at, minutes}], next_sleep, watch_wake_at},
  needs: {
    questions: [Question],                              // today only; every open question, newest first
    not_read:  [{id, received_at, text, tries, needs_you, reading}],   // messages kept but not read yet (today only)
    review:    [{ref, kind, label, day, reason, at, logged_at, thought_type, area, type, v1, v2, unit}],
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
  day: Day  |  food_day: FoodDay  |  usual: [Usual]   // the fresh read; body "view": "day" | "food" | "usual" (86) and
                                                       // "view_day": "yyyy-mm-dd" choose it; /usual/meal and /usual/new default to
                                                       // "usual", /usual/from_meal and /food/* to "food", the rest to "day"
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

Not in the door (on purpose, for now): Home, Gym and Coach, body measurements, the Food catalogue editor, the gratitude list
itself (only its count), Ideas and Private.

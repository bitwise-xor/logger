# logger

A private, single-user logging app: one core with thin clients (chat apps over remote MCP, the home dashboard, a new front end,
the older web app). Food and drinks, habits, health values, labs, thoughts and private entries go in as free text and are kept
in one Postgres database; a Google Sheet is fed from it.

Status (23.11.2026): this has been the real logger since 26.10.2026. The first app (v1, repo `logger-app`) is decommissioned.
Until 23.11.2026 this repo, its folder and its containers were called `logger-v2`; older reports, dumps and backups still say so.

- **Core** (`core/app`, Python): the rules, the AI reading of a message, the database, and three doors: the MCP door for chat apps
  and the hub, the JSON door `/api/v1` for the new front end (`docs/API.md`), and the old web app's pages. Reads a typed message with
  an AI model and keeps the words first, so a failed read never loses a message.
- **New front end** (`front/`, SvelteKit, "logger."): the main app now. Today, Food, Trends, Library, the Spaces (Gym, Health,
  Habits, Home, Medical), Coach, Search, Recent, Usage and Settings, with notifications on the phone. It only talks to the core's
  JSON door (`front/README.md`).
- **The old web app** ("app.", `/web/` in the core, on its way out): it still serves Ideas (and Todoist), Private and Gratitude
  until the journal app exists; the rest moved to logger. Its address is home network and tailnet only.
- **MCP door** (11 tools: `log`, `answer`, `today_summary`, `tick_habit`, `untick_habit`, `add_water`, `set_checkin`, `add_food`,
  `food_lookup`, `food_words`, `lab_report`), behind the owner's sign-in; the home hub calls seven of them with its own token,
  only from inside the server. The chat's instructions are in `docs/chat-prompt.md`. The watch's data (Health Auto Export) comes
  in at `/watch/health` (`core/app/watch.py`).
- `docs/DESIGN.md`: the original design draft (history). `docs/API.md`: the JSON door. `docs/IMPROVEMENTS.md` (web) and
  `docs/CORE-IMPROVEMENTS.md` (core): the priorities and what is done; `docs/reports/`: reports of early build runs.
- Rules: no passwords, keys, `.env` files, dumps or personal health data in this repo. Test cases built from real messages stay
  private. Data and secrets stay out of git (`.gitignore`).
- Tests: `tests/test-db.sh up`, then `python -m pytest -q tests` (about 1,700 tests, about 11 minutes; the front end's own tests:
  `pnpm test` in `front/`). Each checkout has its own test database: the main checkout uses `logger-testdb` on
  127.0.0.1:55433, a git worktree its own container and port (`tests/test-db.sh where` shows them). Run `tests/test-db.sh down`
  in a worktree before removing it; `tests/test-db.sh prune` removes those of deleted worktrees. GitHub runs the same tests on
  every push that changes what they cover (`.github/workflows/`), and Dependabot opens one grouped update pull request a month.
- Deploy: this folder is cloned to `/opt/stacks/logger` on the homelab VM. `tools/deploy.sh <N> <what>` (core) and
  `tools/deploy-front.sh <N>` (front) only in the main checkout, on a clean `main` that is pushed to GitHub (`ALLOW_UNPUSHED=1`
  skips that), one at a time, with a deploy number not used before (core and front share the numbers; a used one is refused and the
  highest is shown). The core's deploy stops when the dump before it fails or is tiny; a container that is not healthy ends with the
  rollback commands and exit 1. The newest 20 dumps in `private-dumps/` stay.

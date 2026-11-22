#!/usr/bin/env bash
# Deploy logger-v2-core. The steps are in this script (HANDOVER.md, which an older comment pointed to, is not in the repo). Usage: tools/deploy.sh <N> <what, for the dump name>
#   N     the deploy number, shared with tools/deploy-front.sh: a number whose rollback image exists already is refused (the
#         highest number in use is printed). The rollback image is logger-v2-core:trial-fixes<N>.
#   what  a few words for the dump's name: private-dumps/v2-live-before-<N>-<what>-<date>.dump
#   ALLOW_UNPUSHED=1 in the environment: deploy a main that is not on GitHub (origin/main) yet, or when GitHub cannot be reached.
# Before anything is built: the guard below, main pushed, a new number, and a dump of the live database that worked and is not
# tiny; otherwise the deploy stops. Prints one line per check; "CHECK FAILED" marks a problem. A container that is not healthy
# after the wait: the rollback commands are printed and, after the remaining read-only checks, the script exits 1 (no clean-up).
# After a healthy deploy the newest 20 v2-live-before-*.dump in private-dumps/ stay, older ones are removed.
# Rollback: docker tag logger-v2-core:trial-fixes<N> logger-v2-core:pilot; docker compose up -d core

# Deploy guard (core item 30, 08.11.2026): the image is built from the checkout, so only a clean main in the main checkout
# ships, and never two deploys at once. Each refusal says why and exits 1 before anything is touched.
MAIN=/opt/stacks/logger-v2
refuse() { echo "DEPLOY REFUSED: $*"; exit 1; }
[ $# -eq 2 ] && [ -n "$2" ] || refuse "usage: tools/deploy.sh <N, the deploy number> <what, for the dump name>"
[[ "$1" =~ ^[0-9]+$ ]] || refuse "N must be a number (got '$1')"
self=$(cd "$(dirname "${BASH_SOURCE[0]}")" && git rev-parse --show-toplevel 2>/dev/null)
here=$(git rev-parse --show-toplevel 2>/dev/null)
[ "$self" = "$MAIN" ] && [ "$here" = "$MAIN" ] \
  || refuse "run it as tools/deploy.sh in $MAIN itself (this script is in ${self:-no git checkout}, the current folder is in ${here:-no git checkout}); a worktree never deploys"
cd "$MAIN" || exit 1
[ "$(git rev-parse --absolute-git-dir)" = "$(git rev-parse --path-format=absolute --git-common-dir)" ] \
  || refuse "$MAIN is a linked worktree, not the main checkout"
exec 9>/tmp/logger-v2-deploy.lock
flock -n 9 || refuse "another deploy is running (lock /tmp/logger-v2-deploy.lock); wait for it to finish"
b=$(git symbolic-ref --quiet --short HEAD) || b="(detached HEAD)"
[ "$b" = main ] || refuse "the main checkout is on '$b', not on main"
dirty=$( { git status --porcelain --untracked-files=no; git status --porcelain -- core; } | sort -u)
[ -z "$dirty" ] || { echo "$dirty" | head -n 20; refuse "uncommitted changes (listed above); commit or remove them first"; }
echo "guard ok: main at $(git rev-parse --short HEAD), clean, no other deploy running"

N="$1"; WHAT="$2"
[[ "$WHAT" != */* ]] || refuse "what must not contain '/' (it is part of the dump's file name)"

# core 38 (21.11.2026): only what is on GitHub ships, so the deployed commit can always be found again
if [ "${ALLOW_UNPUSHED:-}" = 1 ]; then
  echo "push check skipped: ALLOW_UNPUSHED=1 (main at $(git rev-parse --short HEAD) may not be on GitHub)"
elif ! timeout 60 env GIT_TERMINAL_PROMPT=0 git fetch -q origin main </dev/null >/dev/null 2>&1; then
  refuse "git fetch origin main failed (no network, or GitHub unreachable), so it is unknown whether main is pushed; ALLOW_UNPUSHED=1 deploys anyway"
elif ! git merge-base --is-ancestor HEAD origin/main; then
  refuse "main at $(git rev-parse --short HEAD) is not pushed (origin/main is at $(git rev-parse --short origin/main)); git push first, or ALLOW_UNPUSHED=1"
else
  echo "pushed: main at $(git rev-parse --short HEAD) is on origin/main"
fi

# a deploy number is used once (21.11.2026 it was used twice): core and front deploys share the numbers
highest=$(docker images --format '{{.Repository}}:{{.Tag}}' | grep -E '^(logger-v2-core:trial-fixes|logger-v2-front:front-fixes)[0-9]+$' | grep -oE '[0-9]+$' | sort -n | tail -n 1)
for used in "logger-v2-core:trial-fixes${N}" "logger-v2-front:front-fixes${N}"; do
  ! docker image inspect "$used" >/dev/null 2>&1 || refuse "deploy number $N is in use already ($used exists); the highest number in use is ${highest:-none}"
done
echo "deploy number $N is new (the highest in use: ${highest:-none})"

D="private-dumps/v2-live-before-${N}-${WHAT}-$(date +%Y%m%d).dump"
DUMP_MIN_BYTES=100000  # the live database's dump is about 250 KB and only grows; an empty or failed one is a few KB at most
umask 077
docker exec logger-v2-db pg_dump -U pgadmin -Fc appdata > "$D" </dev/null || { rm -f -- "$D"; refuse "the dump of the live database failed; nothing was built"; }
size=$(stat -c %s "$D")
[ "$size" -ge "$DUMP_MIN_BYTES" ] || refuse "the dump $D has only $size bytes (fewer than $DUMP_MIN_BYTES): look at it; nothing was built"
echo "dump: $D $size bytes"
docker tag logger-v2-core:pilot "logger-v2-core:trial-fixes${N}" || refuse "the rollback image logger-v2-core:trial-fixes${N} could not be made; nothing was built"
echo "rollback image: logger-v2-core:trial-fixes${N}"
rollback() {
  echo "ROLLBACK of deploy $N (the image before it; the dump before it is $D):"
  echo "  cd $MAIN && docker tag logger-v2-core:trial-fixes${N} logger-v2-core:pilot && docker compose up -d core"
}
chmod -R a+rX core
docker compose build --no-cache core </dev/null > /tmp/deploy-build.log 2>&1 && echo "build ok" || { echo "CHECK FAILED: build"; tail -n 20 /tmp/deploy-build.log; exit 1; }
docker compose up -d core </dev/null 2>&1 | tail -n 3
for i in $(seq 1 40); do
  s=$(docker inspect -f '{{.State.Health.Status}}' logger-v2-core 2>/dev/null); [ "$s" = healthy ] && break; sleep 3
done
unhealthy=0
echo "container health: $s"; [ "$s" = healthy ] || { unhealthy=1; echo "CHECK FAILED: not healthy (the read-only checks follow, then exit 1)"; rollback; }
echo -n "public /health: "; curl -s -m 15 https://logger-mcp.19hospitalroad.fyi/health </dev/null; echo
echo "== files inside the container match the checkout"
bad=0
for f in $(cd core && find app migrations -type f ! -path '*/__pycache__/*' | sort); do
  a=$(sha256sum "core/$f" | cut -d' ' -f1); b=$(docker exec logger-v2-core sha256sum "/srv/$f" 2>/dev/null | cut -d' ' -f1)
  [ "$a" = "$b" ] || { echo "CHECK FAILED: differs or missing in container: $f"; bad=1; }
done
[ $bad = 0 ] && echo "all files identical ($(cd core && find app migrations -type f ! -path '*/__pycache__/*' | wc -l) files)"
echo "== migrations applied"; docker exec logger-v2-db psql -U pgadmin -d appdata -At -c "select name from schema_migrations order by name desc limit 2" </dev/null
echo "== tools"
docker exec -i -w /srv logger-v2-core python - <<'EOF'  # the script on stdin (no </dev/null: the here-document is stdin)
import asyncio
from app.mcp_app import mcp
try:
    print(sorted(t.name for t in asyncio.run(mcp.list_tools())))
except Exception as e:  # the listing call differs between library versions
    print("tool listing skipped:", type(e).__name__, e)
EOF
# core 35 (21.11.2026): the hub's token is taken only from inside the server (auth.from_inside). Statuses only, never the token.
docker exec -i logger-v2-core python - <<'EOF'  # the script on stdin (no </dev/null: the here-document is stdin)
import os, urllib.error, urllib.request
token, path = os.environ.get("HUB_TOKEN", "").strip(), os.environ.get("MCP_PATH", "/mcp")
def status(extra):
    req = urllib.request.Request("http://127.0.0.1:8000" + path, method="POST", data=b'{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}',
                                 headers={"Host": "logger-v2-core:8000", "Authorization": "Bearer " + token, "Content-Type": "application/json",
                                          "Accept": "application/json, text/event-stream", **extra})
    try:
        return urllib.request.urlopen(req, timeout=10).status
    except urllib.error.HTTPError as e:
        return e.code
    except Exception as e:  # noqa: BLE001 - the kind only
        return type(e).__name__
if len(token) < 32:
    print("hub token from inside: skipped (HUB_TOKEN not set)"); print("hub token with Cf-Ray: skipped (HUB_TOKEN not set)")
else:
    a, b = status({}), status({"Cf-Ray": "0000000000000000-FRA"})
    print("hub token from inside (must not be 401) ->", a, "" if isinstance(a, int) and a != 401 else "CHECK FAILED")
    print("hub token with Cf-Ray, as through the tunnel (must be 401) ->", b, "" if b == 401 else "CHECK FAILED")
EOF
echo "== pages render against the live data (read only)"
docker exec -i -w /srv logger-v2-core python - <<'EOF'  # the script on stdin (no </dev/null: the here-document is stdin)
import traceback
from app import foodpage, habitspage, healthpage, ideaspage, insightspage, labspage, privatepage, searchpage, settingspage, todaypage, trendspage, usagepage, web, weekpage, webheld, gympage, homepage, reads, coachpage
sess = {"csrf": "x", "token_hash": "none", "sid": "00000000-0000-0000-0000-000000000000"}
from app.db import connect
def first(sql):
    with connect() as c:
        r = c.execute(sql).fetchone()
    return r["id"] if r else 0
first_food = lambda: first("SELECT id FROM foods WHERE active ORDER BY id LIMIT 1")
first_report = lambda: first("SELECT id FROM lab_reports ORDER BY collected_date DESC, id DESC LIMIT 1")
first_test = lambda: first("SELECT test_id AS id FROM lab_results GROUP BY test_id ORDER BY count(*) DESC, test_id LIMIT 1")
checks = {
  "today": lambda: todaypage.render("x"), "health": lambda: healthpage.render("x", 30), "food log": lambda: foodpage.render_log("x", {}),
  "catalogue": lambda: foodpage.render_catalogue("x", {"s": "kcal"}), "usual": lambda: foodpage.render_usual("x", {}),
  "private": lambda: privatepage.render("x", {}), "gratitude": lambda: privatepage.render("x", {"view": "grat"}),
  "usage": lambda: usagepage.render("7"), "labs": lambda: labspage.render_reports("x", {}),
  "thoughts": lambda: ideaspage.render_thoughts("x", {}), "settings": lambda: settingspage.render(sess, {}),
  "habits": lambda: habitspage.render("x"), "week": lambda: weekpage.render("x", {}), "trends": lambda: trendspage.render("x", {}),
  "search": lambda: searchpage.render("x", {"q": "salmon"}), "settings today": lambda: settingspage.render(sess, {"tab": "today"}),
  "shell": lambda: web.shell(sess, "<p>x</p>", active="today").body.decode(),
  "not read yet": lambda: webheld.section("x") or "(none waiting)",
  "gym": lambda: gympage.render_workout("x"), "gym exercises": lambda: gympage.render_exercises("x"), "gym card": gympage.today_card,
  "home": lambda: homepage.render_now("x"), "home pick": lambda: homepage.render_pick("x", {"min": "30"}), "home zones": lambda: homepage.render_zones("x"),
  "home history": lambda: homepage.render_history("x"), "home chore": lambda: homepage.render_chore("x", {"id": "1"}), "home edit": lambda: homepage.render_edit("x"),
  "home card": homepage.today_card, "door home reads": lambda: str([reads.home({}), reads.home_pick({}), reads.home_zones(), reads.home_history({}), reads.home_edit(), reads.home_card()]),
  "week last": lambda: weekpage.render("x", {"p": "last"}), "week this": lambda: weekpage.render("x", {"p": "this"}), "trends 90": lambda: trendspage.render("x", {"r": "90"}),
  "insights": lambda: insightspage.render("x"), "coach page": lambda: coachpage.render("x", {}),
  "door trends reads": lambda: str([reads.week(p) for p in ("7", "last", "30", "this")] + [reads.food_trends(r) for r in (7, 30, 90)] + [reads.insights()]),
  "catalogue review": lambda: foodpage.render_catalogue("x", {"f": "review", "s": "name"}),
  "catalogue open": lambda: foodpage.render_catalogue("x", {"food": "N%d" % first_food()}),
  "labs open": lambda: labspage.render_reports("x", {"open": "R%d" % first_report(), "report": "1"}), "labs tests": lambda: labspage.render_tests("x", {}),
  "labs test": lambda: labspage.render_tests("x", {"t": str(first_test())}), "labs meds": lambda: labspage.render_meds("x", {}),
  "door library reads": lambda: str([reads.catalogue("", f, s) for f in ("all", "drinks", "new", "review") for s in ("eaten", "name")]
                                    + [reads.food_item(first_food())]),
  "door medical reads": lambda: str([reads.labs(""), reads.labs("R%d" % first_report()), reads.labs_tests("", ""), reads.labs_tests("", str(first_test())),
                                     reads.labs_meds()]),
  "settings tabs": lambda: "".join(settingspage.render(sess, {"tab": t}) for t, _l in settingspage.TABS),
  "door settings reads": lambda: str([reads.settings_targets(), reads.settings_today(), reads.settings_body(), reads.settings_coach(),
                                      reads.settings_devices(sess), reads.settings_notify(sess), reads.settings_export()]),
}
for name, f in checks.items():
    try:
        out = f(); print("ok  ", name, len(out), "chars")
    except Exception:
        print("CHECK FAILED:", name); traceback.print_exc()
EOF
echo "== from outside (signed out)"
H="Host: app.19hospitalroad.fyi"
for p in /web/ /web/food /web/settings /web/nothing; do
  echo -n "$p -> "; curl -sk -m 10 -o /dev/null -w "%{http_code} %{redirect_url}\n" --resolve app.19hospitalroad.fyi:443:127.0.0.1 "https://app.19hospitalroad.fyi$p" </dev/null
done
echo -n "POST /web/log without a session -> "; curl -sk -m 10 -o /dev/null -w "%{http_code}\n" -X POST -H "Origin: https://app.19hospitalroad.fyi" --resolve app.19hospitalroad.fyi:443:127.0.0.1 -d "text=x" https://app.19hospitalroad.fyi/web/log </dev/null
echo -n "static manifest -> "; curl -sk -m 10 -o /dev/null -w "%{http_code} %{content_type}\n" --resolve app.19hospitalroad.fyi:443:127.0.0.1 https://app.19hospitalroad.fyi/web/static/manifest.webmanifest </dev/null
echo -n "logger-mcp. host /web/login (must be 404) -> "; curl -s -m 10 -o /dev/null -w "%{http_code}\n" https://logger-mcp.19hospitalroad.fyi/web/login </dev/null
echo "== errors in the log since start"; docker logs --since 2m logger-v2-core 2>&1 | grep -iE "error|traceback|exception" | head -n 10 || true; echo "(end of errors)"
if [ "$unhealthy" = 1 ]; then
  echo "DEPLOY FAILED: logger-v2-core is not healthy ($s); nothing was cleaned up"
  rollback
  exit 1
fi
# 02.11.2026 (disk at 86%): keep the last three rollback images (restyle-5035cd8 is never touched) and 1 GB of build cache.
# 17.11.2026: the newest three by number, not "N-3": the numbers have gaps since the front end has its own deploys, so old ones stayed.
echo "== clean-up"
if [[ "$N" =~ ^[0-9]+$ ]]; then
  docker images --format '{{.Tag}}' logger-v2-core | grep -E '^trial-fixes[0-9]+$' | sed 's/^trial-fixes//' | sort -rn | tail -n +4 | while read -r n; do
    docker rmi "logger-v2-core:trial-fixes$n" >/dev/null && echo "removed logger-v2-core:trial-fixes$n (the newest three rollback images stay)"
  done
fi
docker builder prune -f --reserved-space 1gb </dev/null | tail -n 1 | sed 's/^/build cache freed: /'
# core 38: the newest 20 dumps made before a deploy stay (by time); no other file in private-dumps/ is ever touched
find private-dumps -maxdepth 1 -type f -name 'v2-live-before-*.dump' -printf '%T@ %p\0' | sort -z -rn | tail -z -n +21 | cut -z -d' ' -f2- \
  | while IFS= read -r -d '' old; do rm -f -- "$old" && echo "removed $old (the newest 20 dumps before a deploy stay)"; done
docker images --format '{{.Repository}}:{{.Tag}} {{.Size}}' | grep -E 'logger-v2-core' ; df -h / | tail -n 1

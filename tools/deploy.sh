#!/usr/bin/env bash
# Deploy logger-v2-core by the recipe in HANDOVER.md section 4. Usage: deploy.sh <N for trial-fixesN> <what, for the dump name>
# Prints one line per check; "CHECK FAILED" marks a problem. Rollback: docker tag logger-v2-core:trial-fixes<N> logger-v2-core:pilot; docker compose up -d core

# Deploy guard (core item 30, 08.11.2026): the image is built from the checkout, so only a clean main in the main checkout
# ships, and never two deploys at once. Each refusal says why and exits 1 before anything is touched.
MAIN=/opt/stacks/logger-v2
refuse() { echo "DEPLOY REFUSED: $*"; exit 1; }
[ $# -eq 2 ] && [ -n "$2" ] || refuse "usage: tools/deploy.sh <N for trial-fixesN> <what, for the dump name>"
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

N="$1"; WHAT="$2"; D="private-dumps/v2-live-before-${WHAT}-$(date +%Y%m%d).dump"
umask 077
docker exec logger-v2-db pg_dump -U pgadmin -Fc appdata > "$D" </dev/null && echo "dump: $D $(stat -c %s "$D") bytes"
docker tag logger-v2-core:pilot "logger-v2-core:trial-fixes${N}" && echo "rollback image: logger-v2-core:trial-fixes${N}"
chmod -R a+rX core
docker compose build --no-cache core </dev/null > /tmp/deploy-build.log 2>&1 && echo "build ok" || { echo "CHECK FAILED: build"; tail -n 20 /tmp/deploy-build.log; exit 1; }
docker compose up -d core </dev/null 2>&1 | tail -n 3
for i in $(seq 1 40); do
  s=$(docker inspect -f '{{.State.Health.Status}}' logger-v2-core 2>/dev/null); [ "$s" = healthy ] && break; sleep 3
done
echo "container health: $s"; [ "$s" = healthy ] || echo "CHECK FAILED: not healthy"
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
docker exec -i -w /srv logger-v2-core python - </dev/null <<'EOF'
import asyncio
from app.mcp_app import mcp
try:
    print(sorted(t.name for t in asyncio.run(mcp.list_tools())))
except Exception as e:  # the listing call differs between library versions
    print("tool listing skipped:", type(e).__name__, e)
EOF
echo "== pages render against the live data (read only)"
docker exec -i -w /srv logger-v2-core python - </dev/null <<'EOF'
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
# 02.11.2026 (disk at 86%): keep the last three rollback images (restyle-5035cd8 is never touched) and 1 GB of build cache.
# 17.11.2026: the newest three by number, not "N-3": the numbers have gaps since the front end has its own deploys, so old ones stayed.
echo "== clean-up"
if [[ "$N" =~ ^[0-9]+$ ]]; then
  docker images --format '{{.Tag}}' logger-v2-core | grep -E '^trial-fixes[0-9]+$' | sed 's/^trial-fixes//' | sort -rn | tail -n +4 | while read -r n; do
    docker rmi "logger-v2-core:trial-fixes$n" >/dev/null && echo "removed logger-v2-core:trial-fixes$n (the newest three rollback images stay)"
  done
fi
docker builder prune -f --reserved-space 1gb </dev/null | tail -n 1 | sed 's/^/build cache freed: /'
docker images --format '{{.Repository}}:{{.Tag}} {{.Size}}' | grep -E 'logger-v2-core' ; df -h / | tail -n 1

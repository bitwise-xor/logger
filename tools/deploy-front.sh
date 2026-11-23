#!/usr/bin/env bash
# Deploy the new front end (logger-front, front/). tools/deploy.sh builds and checks the core only; this one the front.
# Usage: tools/deploy-front.sh <N>
#   N  the deploy number, shared with tools/deploy.sh: a number whose rollback image exists already (logger-front:front-fixes<N>
#      or logger-core:trial-fixes<N>) is refused, and the highest number in use is printed.
#   ALLOW_UNPUSHED=1 in the environment: deploy a main that is not on GitHub (origin/main) yet, or when GitHub cannot be reached.
# Prints one line per check; "CHECK FAILED" marks a problem. A container that is not healthy after the wait: the rollback
# commands are printed and, after the remaining read-only checks, the script exits 1 (no clean-up).
# Rollback of deploy N: docker tag logger-front:front-fixes<N> logger-front:pilot; docker compose up -d front
# (the first front deploy has no earlier image: stop it with docker compose stop front).

# The same guard as tools/deploy.sh: only a clean main in the main checkout ships, never two deploys at once (the same lock).
MAIN=/opt/stacks/logger
refuse() { echo "DEPLOY REFUSED: $*"; exit 1; }
[ $# -eq 1 ] && [[ "$1" =~ ^[0-9]+$ ]] || refuse "usage: tools/deploy-front.sh <N, the deploy number>"
self=$(cd "$(dirname "${BASH_SOURCE[0]}")" && git rev-parse --show-toplevel 2>/dev/null)
here=$(git rev-parse --show-toplevel 2>/dev/null)
[ "$self" = "$MAIN" ] && [ "$here" = "$MAIN" ] \
  || refuse "run it as tools/deploy-front.sh in $MAIN itself; a worktree never deploys"
cd "$MAIN" || exit 1
[ "$(git rev-parse --absolute-git-dir)" = "$(git rev-parse --path-format=absolute --git-common-dir)" ] \
  || refuse "$MAIN is a linked worktree, not the main checkout"
exec 9>/tmp/logger-deploy.lock
flock -n 9 || refuse "another deploy is running (lock /tmp/logger-deploy.lock); wait for it to finish"
b=$(git symbolic-ref --quiet --short HEAD) || b="(detached HEAD)"
[ "$b" = main ] || refuse "the main checkout is on '$b', not on main"
dirty=$( { git status --porcelain --untracked-files=no; git status --porcelain -- front compose.yaml; } | sort -u)
[ -z "$dirty" ] || { echo "$dirty" | head -n 20; refuse "uncommitted changes (listed above); commit or remove them first"; }
commit=$(git rev-parse --short HEAD)
echo "guard ok: main at $commit, clean, no other deploy running"

N="$1"

# core 38 (21.11.2026): only what is on GitHub ships, so the deployed commit can always be found again
if [ "${ALLOW_UNPUSHED:-}" = 1 ]; then
  echo "push check skipped: ALLOW_UNPUSHED=1 (main at $commit may not be on GitHub)"
elif ! timeout 60 env GIT_TERMINAL_PROMPT=0 git fetch -q origin main </dev/null >/dev/null 2>&1; then
  refuse "git fetch origin main failed (no network, or GitHub unreachable), so it is unknown whether main is pushed; ALLOW_UNPUSHED=1 deploys anyway"
elif ! git merge-base --is-ancestor HEAD origin/main; then
  refuse "main at $commit is not pushed (origin/main is at $(git rev-parse --short origin/main)); git push first, or ALLOW_UNPUSHED=1"
else
  echo "pushed: main at $commit is on origin/main"
fi

# a deploy number is used once (21.11.2026 it was used twice): core and front deploys share the numbers
highest=$(docker images --format '{{.Repository}}:{{.Tag}}' | grep -E '^(logger-core:trial-fixes|logger-front:front-fixes)[0-9]+$' | grep -oE '[0-9]+$' | sort -n | tail -n 1)
for used in "logger-front:front-fixes${N}" "logger-core:trial-fixes${N}"; do
  ! docker image inspect "$used" >/dev/null 2>&1 || refuse "deploy number $N is in use already ($used exists); the highest number in use is ${highest:-none}"
done
echo "deploy number $N is new (the highest in use: ${highest:-none})"

if docker image inspect logger-front:pilot >/dev/null 2>&1; then
  docker tag logger-front:pilot "logger-front:front-fixes${N}" || refuse "the rollback image logger-front:front-fixes${N} could not be made; nothing was built"
  echo "rollback image: logger-front:front-fixes${N}"
  rollback() {
    echo "ROLLBACK of deploy $N (the front image before it):"
    echo "  cd $MAIN && docker tag logger-front:front-fixes${N} logger-front:pilot && docker compose up -d front"
  }
else
  echo "no earlier front image (first deploy): rollback = docker compose stop front"
  rollback() {
    echo "ROLLBACK of deploy $N (the first front deploy: there is no image before it, so the front is stopped):"
    echo "  cd $MAIN && docker compose stop front"
  }
fi
chmod -R a+rX front
docker build --no-cache --label "logger.commit=$commit" -t logger-front:pilot front </dev/null > /tmp/deploy-front-build.log 2>&1 \
  && echo "build ok" || { echo "CHECK FAILED: build"; tail -n 20 /tmp/deploy-front-build.log; exit 1; }
docker compose up -d front </dev/null 2>&1 | tail -n 3
for i in $(seq 1 30); do
  s=$(docker inspect -f '{{.State.Health.Status}}' logger-front 2>/dev/null); [ "$s" = healthy ] && break; sleep 3
done
unhealthy=0
echo "container health: $s"; [ "$s" = healthy ] || { unhealthy=1; echo "CHECK FAILED: not healthy (the read-only checks follow, then exit 1)"; rollback; }

echo "== the container's limits"
docker inspect -f 'image commit {{index .Config.Labels "logger.commit"}}, read-only {{.HostConfig.ReadonlyRootfs}}, memory {{.HostConfig.Memory}}, memory+swap {{.HostConfig.MemorySwap}}, user {{.Config.User}}' logger-front
[ "$(docker inspect -f '{{.HostConfig.ReadonlyRootfs}} {{.HostConfig.Memory}} {{.HostConfig.MemorySwap}}' logger-front)" = "true 268435456 268435456" ] \
  || echo "CHECK FAILED: not read-only with 256 MB and the same swap limit"
echo "networks: $(docker inspect -f '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}' logger-front)"
[ "$(docker inspect -f '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}' logger-front)" = "proxy " ] || echo "CHECK FAILED: not on the proxy network only"
[ -z "$(docker port logger-front)" ] && echo "no published port" || echo "CHECK FAILED: a port is published"
docker stats --no-stream --format 'memory now: {{.MemUsage}}' logger-front

echo "== the door, from the front's container (status only; the token is never printed)"
docker exec logger-front node -e "
const t = process.env.FRONT_TOKEN || '';
if (t.length < 32) { console.log('FRONT_TOKEN not set (32+ characters): the door is off, the sign-in page says so'); process.exit(0); }
fetch(process.env.DOOR_URL + '/api/v1/session', { headers: { 'X-Front-Token': t, Accept: 'application/json' } })
  .then(async (r) => { const j = await r.json(); console.log('GET /api/v1/session without a session ->', r.status, j.error,
    r.status === 401 ? '(the token matches the core: ok)' : 'CHECK FAILED: expected 401 signed_out (404 = the core has another token, or none)'); })
  .catch((e) => console.log('CHECK FAILED: the core does not answer:', e.message));
" </dev/null

echo "== through Caddy (logger. resolved to this machine)"
L=(--resolve logger.19hospitalroad.fyi:443:127.0.0.1)
echo -n "/login -> "; curl -sk -m 10 -o /dev/null -w "%{http_code}\n" "${L[@]}" https://logger.19hospitalroad.fyi/login </dev/null
echo -n "/login sees the door on and the core answering (must be 0 messages) -> "; curl -sk -m 10 "${L[@]}" https://logger.19hospitalroad.fyi/login </dev/null | grep -c 'data-problem=' || true
echo -n "/ signed out -> "; curl -sk -m 10 -o /dev/null -w "%{http_code} %{redirect_url}\n" -H "Accept: text/html" "${L[@]}" https://logger.19hospitalroad.fyi/ </dev/null
echo -n "sign-in from another origin (must be 403) -> "; curl -sk -m 10 -o /dev/null -w "%{http_code}\n" -X POST -H "Origin: https://example.com" -d "password=x&code=1" "${L[@]}" https://logger.19hospitalroad.fyi/login </dev/null
echo -n "headers: "; curl -sk -m 10 -D - -o /dev/null "${L[@]}" https://logger.19hospitalroad.fyi/login </dev/null | grep -ciE "^(content-security-policy|x-frame-options|x-content-type-options|referrer-policy):" | sed 's/$/ of 4 security headers/'
# signed out, the front sends every page it does not serve to its sign-in first (since deploy 123), signed in it is a 404:
# either way the core's door never answers through logger.
d=$(curl -sk -m 10 -o /dev/null -w "%{http_code} %{redirect_url}" "${L[@]}" https://logger.19hospitalroad.fyi/api/v1/session </dev/null)
echo "the door is not reachable through logger. (signed out: the sign-in, or 404) -> $d"
[[ "$d" =~ ^(404\ |303\ https://logger\.19hospitalroad\.fyi/login(\?|$)) ]] || echo "CHECK FAILED: not the front's sign-in or 404"
# the home-screen app and the nudges' service worker (deploy 112): served signed out, never the sign-in page
m=$(curl -sk -m 10 -o /dev/null -w "%{http_code} %{content_type}" "${L[@]}" https://logger.19hospitalroad.fyi/manifest.webmanifest </dev/null)
echo "/manifest.webmanifest signed out -> $m"; [[ "$m" =~ ^200\ application/manifest\+json ]] || echo "CHECK FAILED: not 200 with a manifest type"
w=$(curl -sk -m 10 -o /dev/null -w "%{http_code} %{content_type}" "${L[@]}" https://logger.19hospitalroad.fyi/sw.js </dev/null)
echo "/sw.js signed out -> $w"; [[ "$w" =~ ^200\ (text|application)/javascript ]] || echo "CHECK FAILED: not 200 with a JavaScript type"
echo -n "app. still answers -> "; curl -sk -m 10 -o /dev/null -w "%{http_code} %{redirect_url}\n" --resolve app.19hospitalroad.fyi:443:127.0.0.1 https://app.19hospitalroad.fyi/web/ </dev/null

echo "== errors in the log since start"; docker logs --since 2m logger-front 2>&1 | grep -iE "error|exception" | head -n 10 || true; echo "(end of errors)"
if [ "$unhealthy" = 1 ]; then
  echo "DEPLOY FAILED: logger-front is not healthy ($s); nothing was cleaned up"
  rollback
  exit 1
fi
echo "== clean-up"
# the newest three by number, not "N-3" (17.11.2026: the numbers have gaps since the core has its own deploys, so old ones stayed)
docker images --format '{{.Tag}}' logger-front | grep -E '^front-fixes[0-9]+$' | sed 's/^front-fixes//' | sort -rn | tail -n +4 | while read -r n; do
  docker rmi "logger-front:front-fixes$n" >/dev/null && echo "removed logger-front:front-fixes$n (the newest three rollback images stay)"
done
docker builder prune -f --reserved-space 1gb </dev/null | tail -n 1 | sed 's/^/build cache freed: /'
docker images --format '{{.Repository}}:{{.Tag}} {{.Size}}' | grep -E 'logger-front'; df -h / | tail -n 1

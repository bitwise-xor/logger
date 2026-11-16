#!/usr/bin/env bash
# Deploy the new front end (logger-v2-front, front/). tools/deploy.sh builds and checks the core only; this one the front.
# Usage: tools/deploy-front.sh <N for front-fixesN>      (N = the deploy number, as for the core)
# Prints one line per check; "CHECK FAILED" marks a problem.
# Rollback of deploy N: docker tag logger-v2-front:front-fixes<N> logger-v2-front:pilot; docker compose up -d front
# (the first front deploy has no earlier image: stop it with docker compose stop front).

# The same guard as tools/deploy.sh: only a clean main in the main checkout ships, never two deploys at once (the same lock).
MAIN=/opt/stacks/logger-v2
refuse() { echo "DEPLOY REFUSED: $*"; exit 1; }
[ $# -eq 1 ] && [[ "$1" =~ ^[0-9]+$ ]] || refuse "usage: tools/deploy-front.sh <N for front-fixesN>"
self=$(cd "$(dirname "${BASH_SOURCE[0]}")" && git rev-parse --show-toplevel 2>/dev/null)
here=$(git rev-parse --show-toplevel 2>/dev/null)
[ "$self" = "$MAIN" ] && [ "$here" = "$MAIN" ] \
  || refuse "run it as tools/deploy-front.sh in $MAIN itself; a worktree never deploys"
cd "$MAIN" || exit 1
[ "$(git rev-parse --absolute-git-dir)" = "$(git rev-parse --path-format=absolute --git-common-dir)" ] \
  || refuse "$MAIN is a linked worktree, not the main checkout"
exec 9>/tmp/logger-v2-deploy.lock
flock -n 9 || refuse "another deploy is running (lock /tmp/logger-v2-deploy.lock); wait for it to finish"
b=$(git symbolic-ref --quiet --short HEAD) || b="(detached HEAD)"
[ "$b" = main ] || refuse "the main checkout is on '$b', not on main"
dirty=$( { git status --porcelain --untracked-files=no; git status --porcelain -- front compose.yaml; } | sort -u)
[ -z "$dirty" ] || { echo "$dirty" | head -n 20; refuse "uncommitted changes (listed above); commit or remove them first"; }
commit=$(git rev-parse --short HEAD)
echo "guard ok: main at $commit, clean, no other deploy running"

N="$1"
if docker image inspect logger-v2-front:pilot >/dev/null 2>&1; then
  docker tag logger-v2-front:pilot "logger-v2-front:front-fixes${N}" && echo "rollback image: logger-v2-front:front-fixes${N}"
else
  echo "no earlier front image (first deploy): rollback = docker compose stop front"
fi
chmod -R a+rX front
docker build --no-cache --label "logger.commit=$commit" -t logger-v2-front:pilot front </dev/null > /tmp/deploy-front-build.log 2>&1 \
  && echo "build ok" || { echo "CHECK FAILED: build"; tail -n 20 /tmp/deploy-front-build.log; exit 1; }
docker compose up -d front </dev/null 2>&1 | tail -n 3
for i in $(seq 1 30); do
  s=$(docker inspect -f '{{.State.Health.Status}}' logger-v2-front 2>/dev/null); [ "$s" = healthy ] && break; sleep 3
done
echo "container health: $s"; [ "$s" = healthy ] || echo "CHECK FAILED: not healthy"

echo "== the container's limits"
docker inspect -f 'image commit {{index .Config.Labels "logger.commit"}}, read-only {{.HostConfig.ReadonlyRootfs}}, memory {{.HostConfig.Memory}}, memory+swap {{.HostConfig.MemorySwap}}, user {{.Config.User}}' logger-v2-front
[ "$(docker inspect -f '{{.HostConfig.ReadonlyRootfs}} {{.HostConfig.Memory}} {{.HostConfig.MemorySwap}}' logger-v2-front)" = "true 268435456 268435456" ] \
  || echo "CHECK FAILED: not read-only with 256 MB and the same swap limit"
echo "networks: $(docker inspect -f '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}' logger-v2-front)"
[ "$(docker inspect -f '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}' logger-v2-front)" = "proxy " ] || echo "CHECK FAILED: not on the proxy network only"
[ -z "$(docker port logger-v2-front)" ] && echo "no published port" || echo "CHECK FAILED: a port is published"
docker stats --no-stream --format 'memory now: {{.MemUsage}}' logger-v2-front

echo "== the door, from the front's container (status only; the token is never printed)"
docker exec logger-v2-front node -e "
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
echo -n "/ signed out -> "; curl -sk -m 10 -o /dev/null -w "%{http_code} %{redirect_url}\n" -H "Accept: text/html" "${L[@]}" https://logger.19hospitalroad.fyi/ </dev/null
echo -n "sign-in from another origin (must be 403) -> "; curl -sk -m 10 -o /dev/null -w "%{http_code}\n" -X POST -H "Origin: https://example.com" -d "password=x&code=1" "${L[@]}" https://logger.19hospitalroad.fyi/login </dev/null
echo -n "headers: "; curl -sk -m 10 -D - -o /dev/null "${L[@]}" https://logger.19hospitalroad.fyi/login </dev/null | grep -ciE "^(content-security-policy|x-frame-options|x-content-type-options|referrer-policy):" | sed 's/$/ of 4 security headers/'
echo -n "the door is not reachable through logger. (must be 404 from the front) -> "; curl -sk -m 10 -o /dev/null -w "%{http_code}\n" "${L[@]}" https://logger.19hospitalroad.fyi/api/v1/session </dev/null
echo -n "app. still answers -> "; curl -sk -m 10 -o /dev/null -w "%{http_code} %{redirect_url}\n" --resolve app.19hospitalroad.fyi:443:127.0.0.1 https://app.19hospitalroad.fyi/web/ </dev/null

echo "== errors in the log since start"; docker logs --since 2m logger-v2-front 2>&1 | grep -iE "error|exception" | head -n 10 || true; echo "(end of errors)"
echo "== clean-up"
old="logger-v2-front:front-fixes$((N - 3))"
docker image inspect "$old" >/dev/null 2>&1 && docker rmi "$old" >/dev/null && echo "removed $old (the last three rollback images stay)"
docker builder prune -f --reserved-space 1gb </dev/null | tail -n 1 | sed 's/^/build cache freed: /'
docker images --format '{{.Repository}}:{{.Tag}} {{.Size}}' | grep -E 'logger-v2-front'; df -h / | tail -n 1

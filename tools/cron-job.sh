#!/usr/bin/env bash
# One run of a core cron job, with its result kept for monitoring (core item 40, 22.11.2026). Usage from cron:
#   */5 * * * * /opt/stacks/logger/tools/cron-job.sh held
#   */5 * * * * /opt/stacks/logger/tools/cron-job.sh nudges
# Runs `python -m app.<job>` in the core's container and writes ~/.local/state/logger/<job>.status as the Sheet sync writes
# its status: result=OK or result=FAILED (exit N), and time=<ISO time>. The output (the job's JSON line, or an error's last
# lines) goes to <job>.log beside it, replaced on each run, so a failure can be read afterwards. The server's Uptime Kuma push
# script reads the .status files; a job that stops running shows as an old time there. No values from the job are written
# besides what it prints itself (counts, kinds).
set -u
job="${1:-}"
case "$job" in held|nudges) ;; *) echo "usage: $0 held|nudges" >&2; exit 2 ;; esac
dir="${LOGGER_CRON_STATE:-$HOME/.local/state/logger}"
mkdir -p "$dir"
out=$(timeout 280 docker exec logger-core python -m "app.$job" 2>&1)
rc=$?
printf '%s\n' "$out" | tail -n 20 > "$dir/$job.log"
if [ "$rc" -eq 0 ]; then result=OK; else result="FAILED (exit $rc)"; fi
printf 'result=%s\ntime=%s\n' "$result" "$(date -Iseconds)" > "$dir/$job.status.tmp" && mv "$dir/$job.status.tmp" "$dir/$job.status"
exit "$rc"

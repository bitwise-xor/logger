#!/usr/bin/env bash
# Rebuilds the sheet layout (sheets_layout.py) while holding the sync's lock, so the cron sync cannot run in between.
set -a; . /opt/stacks/logger/sheets/sync.env; set +a
exec 9>/opt/stacks/logger/sheets/lock
flock 9
/opt/stacks/logger/sheets/.venv/bin/python /opt/stacks/logger/tools/sheets/sheets_layout.py "$@"
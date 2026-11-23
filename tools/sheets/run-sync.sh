#!/usr/bin/env bash
# One run of the sheet sync (same settings as the cron job). Usage: run-sync.sh [--check|--force|--dry-run]
set -a; . /opt/stacks/logger/sheets/sync.env; set +a
exec /opt/stacks/logger/sheets/.venv/bin/python /opt/stacks/logger/tools/sheets/sheets_sync.py "$@"
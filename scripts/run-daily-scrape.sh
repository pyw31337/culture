#!/usr/bin/env bash
# CultureFlow daily scrape (legacy cron entry point).
#
# Deprecated wrapper kept for old cron lines. The maintained entry point is
# scripts/local-scheduler.sh (launchd: time-window guard, lock, light/full
# profiles), which calls scripts/run-local-data-update.sh.
set -euo pipefail

# Make node available for cron/launchd shells that do not load a profile.
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "$SCRIPT_DIR/local-scheduler.sh" "$@"

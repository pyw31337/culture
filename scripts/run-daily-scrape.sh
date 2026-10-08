#!/usr/bin/env bash
# CultureFlow daily scrape (cron entry point).
#
# Deprecated wrapper: the old version hard-coded a personal iCloud path and
# called scripts/scrape-ott.ts, which no longer exists. The maintained local
# pipeline is scripts/run-local-data-update.sh (loads .env.local, runs the
# local scraper plan, validates, commits and pushes).
set -euo pipefail

# Make node available for cron/launchd shells that do not load a profile.
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "$SCRIPT_DIR/run-local-data-update.sh" "$@"

#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="${CULTUREFLOW_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
LOG_DIR="$PROJECT_DIR/logs/data-update"
RUN_STAMP="$(TZ=Asia/Seoul date '+%Y%m%d-%H%M%S')"
LOG_FILE="$LOG_DIR/local-data-update-$RUN_STAMP.log"
SKIP_AFTER_HOUR="${LOCAL_UPDATE_SKIP_AFTER_HOUR:-14}"
SCRAPER_TIMEOUT_SECONDS="${LOCAL_SCRAPER_TIMEOUT_SECONDS:-2700}"

mkdir -p "$LOG_DIR"
exec > >(tee -a "$LOG_FILE") 2>&1

cd "$PROJECT_DIR"

echo "[local-update] started at $(TZ=Asia/Seoul date '+%Y-%m-%d %H:%M:%S %Z')"
echo "[local-update] project: $PROJECT_DIR"
echo "[local-update] log: $LOG_FILE"

current_hour="$(TZ=Asia/Seoul date '+%H')"
if [ "${FORCE_LOCAL_UPDATE:-0}" != "1" ] && [ "$current_hour" -ge "$SKIP_AFTER_HOUR" ]; then
  echo "[local-update] skipped: it is already ${current_hour}:00 KST. GitHub fallback owns the afternoon window."
  exit 0
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "[local-update] skipped: working tree has local changes. Commit/stash them before the scheduled update."
  git status --short
  exit 2
fi

echo "[local-update] syncing main branch"
git fetch origin main
git pull --ff-only origin main

if [ ! -d node_modules ] || [ package-lock.json -nt node_modules/.package-lock.json ]; then
  echo "[local-update] installing dependencies"
  export PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
  npm ci --prefer-offline --no-audit --fund=false
else
  echo "[local-update] node_modules is present; skipping npm ci"
fi

if [ "${SKIP_PLAYWRIGHT_INSTALL:-0}" != "1" ]; then
  echo "[local-update] ensuring Playwright Chromium is installed"
  npx playwright install chromium
fi

failures=()
critical_failures=()
: > "$LOG_DIR/last-scrape-failures.txt"

terminate_process_tree() {
  local pid="$1"
  local child

  for child in $(pgrep -P "$pid" 2>/dev/null || true); do
    terminate_process_tree "$child"
  done

  kill "$pid" 2>/dev/null || true
}

force_kill_process_tree() {
  local pid="$1"
  local child

  for child in $(pgrep -P "$pid" 2>/dev/null || true); do
    force_kill_process_tree "$child"
  done

  kill -KILL "$pid" 2>/dev/null || true
}

run_scraper() {
  local name="$1"
  local priority="$2"
  shift 2

  echo "[local-update] >>> ${name} (${priority})"
  set +e
  "$@" &
  local scraper_pid=$!
  local status=0
  local elapsed=0

  while kill -0 "$scraper_pid" 2>/dev/null; do
    if [ "$elapsed" -ge "$SCRAPER_TIMEOUT_SECONDS" ]; then
      echo "[local-update] !!! ${name} timed out after ${SCRAPER_TIMEOUT_SECONDS}s"
      terminate_process_tree "$scraper_pid"
      sleep 5
      if kill -0 "$scraper_pid" 2>/dev/null; then
        force_kill_process_tree "$scraper_pid"
      fi
      wait "$scraper_pid" 2>/dev/null
      status=124
      break
    fi

    sleep 5
    elapsed=$((elapsed + 5))
  done

  if [ "$status" -eq 0 ]; then
    wait "$scraper_pid"
    status=$?
  fi
  set -e
  echo "[local-update] <<< ${name} exit=${status}"

  if [ $status -ne 0 ]; then
    failures+=("$name")
    if [ "$priority" = "critical" ]; then
      critical_failures+=("$name")
    fi
  fi
}

run_scraper "interpark" critical npx tsx scripts/scrape-interpark.ts
run_scraper "kovo" optional npx tsx scripts/scrape-kovo.ts
run_scraper "kbl" optional npx tsx scripts/scrape-kbl.ts
run_scraper "handball" optional npx tsx scripts/scrape-handball.ts
run_scraper "festival" optional npx tsx scripts/scrape-festival.ts
run_scraper "kbo" critical npx tsx scripts/scrape-kbo.ts
run_scraper "kleague" optional npx tsx scripts/scrape-kleague.ts
run_scraper "yes24-exclusive" optional npx tsx scripts/scrape-yes24-exclusive.ts
run_scraper "kopis" critical npx tsx scripts/scrape-kopis.ts
run_scraper "timeticket" optional npx tsx scripts/scrape-timeticket.ts
run_scraper "movies" critical npx tsx scripts/scrape-movies.ts
run_scraper "cinemas" critical npx tsx scripts/scrape-cinemas.ts
run_scraper "myrealtrip" optional node scripts/scrape-myrealtrip.js
run_scraper "umclass" optional npx tsx scripts/scrape-umclass.ts
run_scraper "sssd" optional npx tsx scripts/scrape-sssd.ts
run_scraper "mochaclass" critical npx tsx scripts/scrape-mochaclass.ts
run_scraper "museum" optional npx tsx scripts/scrape-museum.ts
run_scraper "mommom" optional npx tsx scripts/scrape-mommom.ts
run_scraper "mommom-activities" optional npx tsx scripts/scrape-mommom-activities.ts
run_scraper "mommom-exhibitions" optional npx tsx scripts/scrape-mommom-exhibitions.ts
run_scraper "mommom-products" optional npx tsx scripts/scrape-mommom-products.ts
run_scraper "seoul-culture" optional npx tsx scripts/scrape-seoul-culture.ts
run_scraper "build-venues" critical npx tsx scripts/build-venues.ts

if [ "${RUN_LINK_VERIFY:-0}" = "1" ]; then
  run_scraper "verify-links" optional npx tsx scripts/verify-links.ts
else
  echo "[local-update] verify-links skipped by default. Set RUN_LINK_VERIFY=1 to enable it."
fi

if [ ${#failures[@]} -gt 0 ]; then
  printf '%s\n' "${failures[@]}" > "$LOG_DIR/last-scrape-failures.txt"
  echo "[local-update] scraper failures recorded: ${failures[*]}"
fi

if [ ${#critical_failures[@]} -gt 0 ]; then
  echo "[local-update] warning: critical scraper failures occurred, but final validators will decide whether data is safe."
  echo "[local-update] critical failures: ${critical_failures[*]}"
fi

echo "[local-update] validating and generating public artifacts"
npx tsx scripts/validate-data-integrity.ts
npx tsx scripts/prune-expired-data.ts
npx tsx scripts/prune-data.ts
npm run generate-data
npm run validate:content
npm run validate:locations
npm run validate:display

git add src/data public/data public/version.txt public/images/posters

if git diff --quiet && git diff --staged --quiet; then
  echo "[local-update] no data changes to commit"
  echo "[local-update] completed at $(TZ=Asia/Seoul date '+%Y-%m-%d %H:%M:%S %Z')"
  exit 0
fi

git commit -m "chore: local daily data update"
git pull --rebase origin main
git push origin main

echo "[local-update] pushed data update; GitHub Pages deploy will run from the push workflow"
echo "[local-update] completed at $(TZ=Asia/Seoul date '+%Y-%m-%d %H:%M:%S %Z')"

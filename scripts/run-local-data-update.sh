#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="${CULTUREFLOW_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
LOG_DIR="$PROJECT_DIR/logs/data-update"
RUN_STAMP="$(TZ=Asia/Seoul date '+%Y%m%d-%H%M%S')"
LOG_FILE="$LOG_DIR/local-data-update-$RUN_STAMP.log"
STATUS_FILE="$LOG_DIR/last-run-status.json"
SKIP_AFTER_HOUR="${LOCAL_UPDATE_SKIP_AFTER_HOUR:-3}"
SCRAPER_TIMEOUT_SECONDS="${LOCAL_SCRAPER_TIMEOUT_SECONDS:-2700}"
SCRAPER_RETRY_COUNT="${LOCAL_SCRAPER_RETRY_COUNT:-1}"
LOCAL_UPDATE_NOTIFY="${LOCAL_UPDATE_NOTIFY:-1}"

mkdir -p "$LOG_DIR"
exec > >(tee -a "$LOG_FILE") 2>&1

cd "$PROJECT_DIR"

RUN_STARTED_AT="$(TZ=Asia/Seoul date '+%Y-%m-%d %H:%M:%S %Z')"
RUN_STATUS="running"
RUN_MESSAGE="Local data update is running."
RUN_NOTIFIED="0"
failures=()
critical_failures=()
recovered_failures=()

notify_local_update() {
  local title="$1"
  local message="$2"

  if [ "$LOCAL_UPDATE_NOTIFY" != "1" ]; then
    return 1
  fi

  /usr/bin/osascript - "$title" "$message" <<'APPLESCRIPT' >/dev/null 2>&1
on run argv
  display notification (item 2 of argv) with title (item 1 of argv)
end run
APPLESCRIPT
}

write_status_file() {
  local exit_code="$1"
  local ended_at
  local head_sha
  local failure_list
  local critical_failure_list

  ended_at="$(TZ=Asia/Seoul date '+%Y-%m-%d %H:%M:%S %Z')"
  head_sha="$(git rev-parse --short HEAD 2>/dev/null || true)"
  failure_list="${failures[*]:-}"
  critical_failure_list="${critical_failures[*]:-}"

  node - "$STATUS_FILE" "$RUN_STARTED_AT" "$ended_at" "$RUN_STATUS" "$exit_code" "$RUN_MESSAGE" "$PROJECT_DIR" "$LOG_FILE" "$head_sha" "$failure_list" "$critical_failure_list" <<'NODE' >/dev/null 2>&1 || true
const fs = require('fs');
const [
  statusPath,
  startedAt,
  endedAt,
  status,
  exitCode,
  message,
  projectDir,
  logFile,
  headSha,
  failures,
  criticalFailures,
] = process.argv.slice(2);

fs.writeFileSync(statusPath, JSON.stringify({
  startedAt,
  endedAt,
  status,
  exitCode: Number(exitCode),
  message,
  projectDir,
  logFile,
  headSha,
  failures: failures ? failures.split(/\s+/).filter(Boolean) : [],
  criticalFailures: criticalFailures ? criticalFailures.split(/\s+/).filter(Boolean) : [],
}, null, 2) + '\n');
NODE
}

abort_run() {
  local signal_name="${1:-interrupted}"
  RUN_STATUS="failed"
  RUN_MESSAGE="Local data update was ${signal_name}. Check $LOG_FILE"
  echo "[local-update] interrupted: $RUN_MESSAGE"
  exit 130
}

finish_run() {
  local exit_code="$?"

  if [ -n "${SCRAPER_CHECKPOINT_ROOT:-}" ]; then
    rm -rf "$SCRAPER_CHECKPOINT_ROOT"
  fi

  if [ "$exit_code" -ne 0 ] && [ "$RUN_STATUS" = "running" ]; then
    RUN_STATUS="failed"
    RUN_MESSAGE="Local data update failed. Check $LOG_FILE"
  fi

  if [ "$RUN_STATUS" = "running" ]; then
    RUN_STATUS="success"
    RUN_MESSAGE="Local data update completed."
  fi

  write_status_file "$exit_code"

  case "$RUN_STATUS" in
    success)
      if [ ${#failures[@]} -gt 0 ]; then
        if notify_local_update "CultureFlow update completed with warnings" "Scraper warnings: ${failures[*]}. Log: $LOG_FILE"; then
          RUN_NOTIFIED="1"
        fi
      fi
      ;;
    skipped)
      if notify_local_update "CultureFlow update skipped" "$RUN_MESSAGE"; then
        RUN_NOTIFIED="1"
      fi
      ;;
    failed)
      if notify_local_update "CultureFlow update failed" "$RUN_MESSAGE"; then
        RUN_NOTIFIED="1"
      fi
      ;;
  esac

  if [ "$RUN_NOTIFIED" = "1" ]; then
    echo "[local-update] notification sent: $RUN_STATUS"
  fi
}

trap 'abort_run interrupted' INT TERM
trap finish_run EXIT

echo "[local-update] started at $(TZ=Asia/Seoul date '+%Y-%m-%d %H:%M:%S %Z')"
echo "[local-update] project: $PROJECT_DIR"
echo "[local-update] log: $LOG_FILE"

if [ -f "$PROJECT_DIR/.env.local" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$PROJECT_DIR/.env.local"
  set +a
  echo "[local-update] loaded local environment variables"
fi

current_hour="$(TZ=Asia/Seoul date '+%H')"
if [ "${FORCE_LOCAL_UPDATE:-0}" != "1" ] && [ "$current_hour" -ge "$SKIP_AFTER_HOUR" ]; then
  RUN_STATUS="skipped"
  RUN_MESSAGE="It is already ${current_hour}:00 KST. GitHub fallback owns the 03:00+ KST window."
  echo "[local-update] skipped: $RUN_MESSAGE"
  exit 0
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  RUN_STATUS="skipped"
  RUN_MESSAGE="Working tree has local changes. Commit/stash them before the scheduled update."
  echo "[local-update] skipped: $RUN_MESSAGE"
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

if [ -z "${PUPPETEER_EXECUTABLE_PATH:-}" ]; then
  PUPPETEER_EXECUTABLE_PATH="$(node -e "console.log(require('playwright').chromium.executablePath())")"
  export PUPPETEER_EXECUTABLE_PATH
fi
echo "[local-update] Puppeteer executable: $PUPPETEER_EXECUTABLE_PATH"

: > "$LOG_DIR/last-scrape-failures.txt"
SCRAPER_CHECKPOINT_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/cultureflow-scrapers.XXXXXX")"

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
  local checkpoint_dir="$SCRAPER_CHECKPOINT_ROOT/$name"
  local attempt status scraper_pid elapsed
  rm -rf "$checkpoint_dir"
  mkdir -p "$checkpoint_dir"
  cp -a src/data "$checkpoint_dir/data"

  status=1
  for attempt in $(seq 1 $((SCRAPER_RETRY_COUNT + 1))); do
    set +e
    "$@" &
    scraper_pid=$!
    status=0
    elapsed=0

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

    if [ "$status" -eq 0 ]; then
      break
    fi

    echo "[local-update] ${name} attempt ${attempt} failed; restoring its data checkpoint"
    rm -rf src/data
    cp -a "$checkpoint_dir/data" src/data
    if [ "$attempt" -le "$SCRAPER_RETRY_COUNT" ]; then
      sleep $((attempt * 3))
    fi
  done

  echo "[local-update] <<< ${name} exit=${status}"

  if [ $status -ne 0 ]; then
    failures+=("$name")
    if [ "$priority" = "critical" ]; then
      critical_failures+=("$name")
    fi
  elif [ "$attempt" -gt 1 ]; then
    recovered_failures+=("$name")
  fi

  rm -rf "$checkpoint_dir"
}

run_scraper "interpark" critical npx tsx scripts/scrape-interpark.ts
run_scraper "kopis" critical npx tsx scripts/scrape-kopis.ts
run_scraper "kovo" optional npx tsx scripts/scrape-kovo.ts
run_scraper "kbl" optional npx tsx scripts/scrape-kbl.ts
run_scraper "handball" optional npx tsx scripts/scrape-handball.ts
run_scraper "festival" optional npx tsx scripts/scrape-festival.ts
run_scraper "kbo" critical npx tsx scripts/scrape-kbo.ts
run_scraper "kleague" optional npx tsx scripts/scrape-kleague.ts
run_scraper "yes24-exclusive" optional npx tsx scripts/scrape-yes24-exclusive.ts
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
run_scraper "culture-portal" optional npx tsx scripts/scrape-culture-portal.ts
run_scraper "tourism" optional npx tsx scripts/scrape-visitkorea-expanded.ts
run_scraper "build-venues" critical npx tsx scripts/build-venues.ts
run_scraper "venue-places" optional npx tsx scripts/enrich-venue-places.ts

if [ "${RUN_LINK_VERIFY:-0}" = "1" ]; then
  run_scraper "verify-links" optional npx tsx scripts/verify-links.ts
else
  echo "[local-update] verify-links skipped by default. Set RUN_LINK_VERIFY=1 to enable it."
fi

if [ ${#failures[@]} -gt 0 ]; then
  printf '%s\n' "${failures[@]}" > "$LOG_DIR/last-scrape-failures.txt"
  echo "[local-update] scraper failures recorded: ${failures[*]}"
fi

if [ ${#recovered_failures[@]} -gt 0 ]; then
  echo "[local-update] scrapers recovered after retry: ${recovered_failures[*]}"
fi

if [ ${#critical_failures[@]} -gt 0 ]; then
  RUN_STATUS="failed"
  RUN_MESSAGE="Critical scraper failures occurred: ${critical_failures[*]}. Data changes were not committed."
  echo "[local-update] failed: $RUN_MESSAGE"
  echo "[local-update] critical failures: ${critical_failures[*]}"
  echo "[local-update] restoring clean pre-run data state so the next scheduled run can proceed"
  git restore --source=HEAD -- src/data public/data public/version.txt public/images/posters 2>/dev/null || true
  git clean -fd -- public/images/posters 2>/dev/null || true
  exit 1
fi

echo "[local-update] validating and generating public artifacts"
npx tsx scripts/validate-data-integrity.ts
npx tsx scripts/prune-expired-data.ts
npx tsx scripts/prune-data.ts
npm run generate-data
POSTER_CACHE_INCLUDE_ALL_REMOTE=1 POSTER_CACHE_MAX_NEW_DOWNLOADS=8000 npm run cache:posters
npm run generate:thumbs
npm run validate:content
npm run validate:locations
npm run validate:display

git add src/data public/data public/version.txt public/images/posters public/images/thumbs

if git diff --quiet && git diff --staged --quiet; then
  echo "[local-update] no data changes to commit"
  RUN_STATUS="success"
  RUN_MESSAGE="Local data update completed with no data changes."
  echo "[local-update] completed at $(TZ=Asia/Seoul date '+%Y-%m-%d %H:%M:%S %Z')"
  exit 0
fi

git commit -m "chore: local daily data update"

if ! git diff --quiet || [ -n "$(git ls-files --others --exclude-standard)" ]; then
  echo "[local-update] stashing residual generated files before syncing"
  git status --short
  git stash push -u -m "local-update residual generated files ${RUN_STAMP}"
fi

git pull --rebase origin main
git push origin main

RUN_STATUS="success"
RUN_MESSAGE="Local data update pushed data changes to origin/main."
echo "[local-update] pushed data update; GitHub Pages deploy will run from the push workflow"
echo "[local-update] completed at $(TZ=Asia/Seoul date '+%Y-%m-%d %H:%M:%S %Z')"

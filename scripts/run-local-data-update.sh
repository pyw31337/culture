#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="${CULTUREFLOW_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
LOG_DIR="$PROJECT_DIR/logs/data-update"
RUN_STAMP="$(TZ=Asia/Seoul date '+%Y%m%d-%H%M%S')"
LOG_FILE="$LOG_DIR/local-data-update-$RUN_STAMP.log"
STATUS_FILE="$LOG_DIR/last-run-status.json"
# The time-window policy now lives in scripts/local-scheduler.sh (launchd entry
# point). Set LOCAL_UPDATE_SKIP_AFTER_HOUR only to restore the legacy guard.
SKIP_AFTER_HOUR="${LOCAL_UPDATE_SKIP_AFTER_HOUR:-}"
SCRAPER_TIMEOUT_SECONDS="${LOCAL_SCRAPER_TIMEOUT_SECONDS:-2700}"
SCRAPER_RETRY_COUNT="${LOCAL_SCRAPER_RETRY_COUNT:-1}"
LOCAL_UPDATE_NOTIFY="${LOCAL_UPDATE_NOTIFY:-1}"
# Which scripts/scraper-plan.json plan to run: local (full) or local-light.
LOCAL_SCRAPER_PLAN="${LOCAL_SCRAPER_PLAN:-local}"
LOCAL_UPDATE_PROFILE="${LOCAL_UPDATE_PROFILE:-$LOCAL_SCRAPER_PLAN}"
# Epoch seconds after which no new scraper starts (set by the scheduler so a
# run never spills into the weekday 08:00-18:00 block or the CI 03:00 slot).
SCRAPE_DEADLINE_EPOCH="${LOCAL_UPDATE_SCRAPE_DEADLINE_EPOCH:-0}"
# Critical scraper failures used to block the whole publish. Each failed
# scraper already has its data restored from a checkpoint, so by default the
# other sources are still published (same policy as the GitHub fallback).
ABORT_ON_CRITICAL_FAILURE="${LOCAL_ABORT_ON_CRITICAL_FAILURE:-0}"
DATA_PATHS="src/data public/data public/version.txt public/images/posters public/images/thumbs"
# Same threshold the GitHub fallback uses. The local default (300) is what
# failed the 2026-05-23 run and, with the dirty tree it left behind, stopped
# every local update until 2026-10-08.
export UMCLASS_MISSING_GEO_CRITICAL_THRESHOLD="${UMCLASS_MISSING_GEO_CRITICAL_THRESHOLD:-1000}"
GITHUB_REPO="${CULTUREFLOW_GITHUB_REPO:-pyw31337/culture}"

mkdir -p "$LOG_DIR"
exec > >(tee -a "$LOG_FILE") 2>&1

cd "$PROJECT_DIR"

RUN_STARTED_AT="$(TZ=Asia/Seoul date '+%Y-%m-%d %H:%M:%S %Z')"
RUN_STATUS="running"
RUN_MESSAGE="Local data update is running."
RUN_NOTIFIED="0"
RUN_COMMITTED="0"
RUN_BASE_SHA=""
failures=()
critical_failures=()
recovered_failures=()
deferred_scrapers=()

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

  # Never leave a half-finished data tree behind. A dirty tree made every
  # scheduled run skip itself from 2026-05-24 to 2026-10-08.
  if [ "$RUN_STATUS" = "failed" ] && [ "$RUN_COMMITTED" != "1" ]; then
    restore_data_paths || true
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

restore_data_paths() {
  echo "[local-update] restoring data paths to HEAD so the next scheduled run starts clean"
  # shellcheck disable=SC2086
  git reset -q HEAD -- $DATA_PATHS 2>/dev/null || true
  # shellcheck disable=SC2086
  git checkout -- $DATA_PATHS 2>/dev/null || true
  git clean -fdq -- public/images/posters public/images/thumbs public/data 2>/dev/null || true
}

is_data_path() {
  case "$1" in
    src/data/*|public/data/*|public/version.txt|public/images/posters/*|public/images/thumbs/*) return 0 ;;
    *) return 1 ;;
  esac
}

# Dirty files outside the generated data paths mean someone is editing this
# checkout by hand: do not touch them. Generated data left over from an
# interrupted run is stashed (kept as a backup) and the run continues.
prepare_worktree() {
  local path non_data=""
  local dirty
  dirty="$(git status --porcelain --untracked-files=all | cut -c4-)"
  [ -z "$dirty" ] && return 0
  while IFS= read -r path; do
    [ -z "$path" ] && continue
    path="${path#\"}"; path="${path%\"}"
    case "$path" in *" -> "*) path="${path##* -> }" ;; esac
    if ! is_data_path "$path"; then
      non_data="${non_data}${path}"$'\n'
    fi
  done <<EOF_DIRTY
$dirty
EOF_DIRTY
  if [ -n "$non_data" ]; then
    echo "[local-update] non-data local changes found:"
    printf '%s' "$non_data"
    return 1
  fi
  echo "[local-update] stashing leftover generated data from an earlier run (kept as git stash backup)"
  # shellcheck disable=SC2086
  git stash push -u -q -m "auto-backup: leftover local data ${RUN_STAMP}" -- $DATA_PATHS
  prune_auto_stashes
}

# Keep only the newest few automatic stashes so they do not pile up.
prune_auto_stashes() {
  local keep="${LOCAL_UPDATE_KEEP_STASHES:-3}"
  local refs count i
  refs="$(git stash list --format='%gd %s' | grep -E 'auto-backup: leftover local data|local-update residual generated files' | awk '{print $1}')"
  count="$(printf '%s\n' "$refs" | grep -c . || true)"
  if [ "$count" -le "$keep" ]; then return 0; fi
  # Drop from the oldest (highest index) so earlier indexes stay valid.
  for i in $(printf '%s\n' "$refs" | tail -n $((count - keep)) | sed -E 's/stash@\{([0-9]+)\}/\1/' | sort -rn); do
    git stash drop -q "stash@{$i}" || true
  done
}

ci_update_running() {
  command -v gh >/dev/null 2>&1 || return 1
  local n
  n="$(gh run list --repo "$GITHUB_REPO" --workflow daily-update.yml --limit 5 --json status \
    --jq '[.[] | select(.status == "in_progress" or .status == "queued" or .status == "waiting")] | length' 2>/dev/null || echo 0)"
  [ "${n:-0}" -gt 0 ]
}

# The GitHub fallback (03:00 KST) also commits data. Wait for it rather than
# racing it; after LOCAL_CI_WAIT_MAX_SECONDS, continue and let rebase decide.
wait_for_ci_idle() {
  local waited=0 max="${LOCAL_CI_WAIT_MAX_SECONDS:-2400}"
  while ci_update_running; do
    if [ "$waited" -ge "$max" ]; then
      echo "[local-update] GitHub Daily Data Update still running after ${waited}s; continuing anyway"
      return 0
    fi
    echo "[local-update] GitHub Daily Data Update is running; waiting 60s before touching origin/main"
    sleep 60
    waited=$((waited + 60))
  done
}

# Every step uses "|| return 1" because this function is also called from
# inside publish_changes, where "set -e" is not in effect.
regenerate_and_validate() {
  echo "[local-update] validating and generating public artifacts"
  if [ -n "${LOCAL_UPDATE_VALIDATE_CMD:-}" ]; then
    # Test hook: replace the (slow) generate/validate chain with a custom command.
    bash -c "$LOCAL_UPDATE_VALIDATE_CMD" || return 1
    return 0
  fi
  node scripts/guard-retained-data.mjs || return 1
  npx tsx scripts/validate-data-integrity.ts || return 1
  npx tsx scripts/prune-expired-data.ts || return 1
  npx tsx scripts/prune-data.ts || return 1
  npm run generate-data || return 1
  POSTER_CACHE_INCLUDE_ALL_REMOTE=1 POSTER_CACHE_MAX_NEW_DOWNLOADS="${POSTER_CACHE_MAX_NEW_DOWNLOADS:-8000}" npm run cache:posters || return 1
  npm run validate:posters || return 1
  npm run generate:thumbs || return 1
  npm run validate:content || return 1
  npm run validate:details || return 1
  npm run validate:search || return 1
  npm run validate:location-search || return 1
  npm run validate:locations || return 1
  npm run validate:display || return 1
}

changed_json_valid() {
  local f
  for f in $(git diff --name-only "$1" HEAD -- '*.json'); do
    [ -f "$f" ] || continue
    node -e 'JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"))' "$f" 2>/dev/null || {
      echo "[local-update] $f is not valid JSON after rebase"
      return 1
    }
  done
}

# Publish the local data commit. Order of preference:
#  1. plain push;
#  2. rebase onto the new origin/main (code-only or non-overlapping changes);
#  3. on conflict: take origin/main and re-apply the src/data files this run
#     produced (local data wins for the sources it scraped), then regenerate.
publish_changes() {
  local attempt tmp files f
  for attempt in 1 2 3 4; do
    wait_for_ci_idle
    if git push origin HEAD:main; then
      return 0
    fi
    echo "[local-update] push rejected (attempt ${attempt}); syncing with origin/main"
    git fetch origin main || return 1
    local before_rebase
    before_rebase="$(git rev-parse HEAD)"
    if git rebase origin/main && changed_json_valid origin/main; then
      continue
    fi
    git rebase --abort 2>/dev/null || true
    git reset -q --hard "$before_rebase" || return 1

    echo "[local-update] conflict with origin/main; re-applying this run's src/data files on top of it"
    tmp="$(mktemp -d "${TMPDIR:-/tmp}/cultureflow-publish.XXXXXX")"
    files="$(git diff --name-only "$RUN_BASE_SHA" HEAD -- src/data)"
    for f in $files; do
      mkdir -p "$tmp/$(dirname "$f")"
      git show "HEAD:$f" > "$tmp/$f" 2>/dev/null || rm -f "$tmp/$f"
    done
    echo "[local-update] previous local commit kept in reflog: $before_rebase"
    git reset -q --hard origin/main || return 1
    for f in $files; do
      if [ -f "$tmp/$f" ]; then cp "$tmp/$f" "$f"; fi
    done
    rm -rf "$tmp"
    RUN_BASE_SHA="$(git rev-parse HEAD)"
    regenerate_and_validate || return 1
    # shellcheck disable=SC2086
    git add $DATA_PATHS || return 1
    if git diff --staged --quiet; then
      echo "[local-update] nothing left to publish after re-applying on origin/main"
      return 0
    fi
    git commit -q -m "chore: local ${LOCAL_UPDATE_PROFILE} data update (re-applied on origin/main)" || return 1
  done
  return 1
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

echo "[local-update] profile: ${LOCAL_UPDATE_PROFILE} (plan: ${LOCAL_SCRAPER_PLAN})"
if [ "$SCRAPE_DEADLINE_EPOCH" -gt 0 ]; then
  echo "[local-update] no new scraper starts after $(TZ=Asia/Seoul date -r "$SCRAPE_DEADLINE_EPOCH" '+%H:%M %Z' 2>/dev/null || TZ=Asia/Seoul date -d "@$SCRAPE_DEADLINE_EPOCH" '+%H:%M %Z' 2>/dev/null || echo "$SCRAPE_DEADLINE_EPOCH")"
fi

current_hour="$(TZ=Asia/Seoul date '+%H')"
if [ -n "$SKIP_AFTER_HOUR" ] && [ "${FORCE_LOCAL_UPDATE:-0}" != "1" ] && [ "$((10#$current_hour))" -ge "$SKIP_AFTER_HOUR" ]; then
  RUN_STATUS="skipped"
  RUN_MESSAGE="It is already ${current_hour}:00 KST. GitHub fallback owns the 03:00+ KST window."
  echo "[local-update] skipped: $RUN_MESSAGE"
  exit 0
fi

if ! prepare_worktree; then
  RUN_STATUS="skipped"
  RUN_MESSAGE="Working tree has non-data local changes. Commit/stash them before the scheduled update."
  echo "[local-update] skipped: $RUN_MESSAGE"
  exit 2
fi

current_branch="$(git rev-parse --abbrev-ref HEAD)"
if [ "$current_branch" != "main" ]; then
  echo "[local-update] switching from ${current_branch} to main"
  git checkout -q main
fi

echo "[local-update] syncing main branch"
wait_for_ci_idle
git fetch origin main
if [ -n "$(git rev-list origin/main..HEAD 2>/dev/null)" ]; then
  echo "[local-update] local main has unpushed commits from an earlier run: $(git rev-parse --short HEAD) (kept in reflog)"
  if ! git rebase -q origin/main; then
    git rebase --abort 2>/dev/null || true
    echo "[local-update] dropping the stale unpushed data commit(s); this run re-collects the data"
    git reset -q --hard origin/main
  fi
else
  git pull -q --ff-only origin main
fi
RUN_BASE_SHA="$(git rev-parse HEAD)"

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

  local checkpoint_dir="$SCRAPER_CHECKPOINT_ROOT/$name"
  local attempt status scraper_pid elapsed timeout_seconds remaining
  timeout_seconds="$SCRAPER_TIMEOUT_SECONDS"
  if [ "$SCRAPE_DEADLINE_EPOCH" -gt 0 ]; then
    remaining=$((SCRAPE_DEADLINE_EPOCH - $(date +%s)))
    if [ "$remaining" -lt "${LOCAL_SCRAPER_MIN_SECONDS:-180}" ]; then
      echo "[local-update] --- ${name} deferred to the next run (time window budget used up; existing data kept)"
      deferred_scrapers+=("$name")
      return 0
    fi
    if [ "$remaining" -lt "$timeout_seconds" ]; then
      timeout_seconds="$remaining"
    fi
  fi
  echo "[local-update] >>> ${name} (${priority}, timeout ${timeout_seconds}s)"
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
      if [ "$elapsed" -ge "$timeout_seconds" ]; then
        echo "[local-update] !!! ${name} timed out after ${timeout_seconds}s"
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

while IFS=$'\t' read -r name priority command; do
  run_scraper "$name" "$priority" bash -lc "$command"
done < <(node scripts/print-scraper-plan.mjs "$LOCAL_SCRAPER_PLAN")

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

if [ ${#deferred_scrapers[@]} -gt 0 ]; then
  echo "[local-update] deferred to the next run: ${deferred_scrapers[*]}"
fi

if [ ${#critical_failures[@]} -gt 0 ] && [ "$ABORT_ON_CRITICAL_FAILURE" != "1" ]; then
  echo "[local-update] critical scraper(s) failed but kept their previous data: ${critical_failures[*]}. Publishing the other sources."
fi

if [ ${#critical_failures[@]} -gt 0 ] && [ "$ABORT_ON_CRITICAL_FAILURE" = "1" ]; then
  RUN_STATUS="failed"
  RUN_MESSAGE="Critical scraper failures occurred: ${critical_failures[*]}. Data changes were not committed."
  echo "[local-update] failed: $RUN_MESSAGE"
  echo "[local-update] critical failures: ${critical_failures[*]}"
  echo "[local-update] restoring clean pre-run data state so the next scheduled run can proceed"
  restore_data_paths
  exit 1
fi

if [ "${LOCAL_UPDATE_SKIP_PUBLISH:-0}" = "1" ]; then
  RUN_STATUS="success"
  RUN_MESSAGE="Scrapers finished; publish skipped (LOCAL_UPDATE_SKIP_PUBLISH=1)."
  echo "[local-update] $RUN_MESSAGE"
  exit 0
fi

regenerate_and_validate

# shellcheck disable=SC2086
git add $DATA_PATHS

if git diff --quiet && git diff --staged --quiet; then
  echo "[local-update] no data changes to commit"
  RUN_STATUS="success"
  RUN_MESSAGE="Local data update completed with no data changes."
  echo "[local-update] completed at $(TZ=Asia/Seoul date '+%Y-%m-%d %H:%M:%S %Z')"
  exit 0
fi

git commit -q -m "chore: local ${LOCAL_UPDATE_PROFILE} data update"
RUN_COMMITTED="1"

if ! git diff --quiet || [ -n "$(git ls-files --others --exclude-standard)" ]; then
  echo "[local-update] stashing residual generated files before syncing"
  git status --short
  git stash push -u -q -m "local-update residual generated files ${RUN_STAMP}"
  prune_auto_stashes
fi

if ! publish_changes; then
  RUN_STATUS="failed"
  RUN_MESSAGE="Could not push the local data commit after several attempts. Check $LOG_FILE"
  echo "[local-update] failed: $RUN_MESSAGE"
  exit 1
fi

RUN_STATUS="success"
RUN_MESSAGE="Local data update pushed data changes to origin/main."
echo "[local-update] pushed data update; GitHub Pages deploy will run from the push workflow"
echo "[local-update] completed at $(TZ=Asia/Seoul date '+%Y-%m-%d %H:%M:%S %Z')"

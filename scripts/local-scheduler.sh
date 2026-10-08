#!/bin/bash
# CultureFlow local scheduler — launchd entry point on the Mac mini.
#
# Runs the sources GitHub-hosted runners cannot reach (Interpark ticket API,
# 국가유산청, YES24, IP-restricted Kakao REST) inside the allowed windows:
#   - weekdays (Mon-Fri): 18:00 → next day 08:00 KST
#   - weekends (Sat/Sun): any time
# and stays out of the GitHub fallback slot (03:00 KST cron, guard 02:40-04:45).
#
# Profiles (scripts/scraper-plan.json):
#   light → plan "local-light": blocked/local-only sources with larger caps.
#           Enrichment is incremental (lastApiEnriched / sessionsCheckedAt /
#           venue-place cache), so each run continues where the last one stopped.
#   full  → plan "local": every source, deep caps. Once a day (weekday 21:xx,
#           weekend 13:xx) or whenever the last full success is older than 36h.
#
# Usage:
#   scripts/local-scheduler.sh                 # what launchd runs
#   scripts/local-scheduler.sh --force         # ignore the time window
#   scripts/local-scheduler.sh --dry-run       # checks only: window, lock, env, network
#   scripts/local-scheduler.sh --profile full  # light | full | auto (default)
#   touch logs/data-update/scheduler/dry-run-once  # next launchd start is a dry run
#
# Bash 3.2 compatible (macOS /bin/bash).
set -uo pipefail

PROJECT_DIR="${CULTUREFLOW_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
export CULTUREFLOW_PROJECT_DIR="$PROJECT_DIR"
export TZ="Asia/Seoul"
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${PATH:-}"
if ! command -v node >/dev/null 2>&1 && [ -s "${NVM_DIR:-$HOME/.nvm}/nvm.sh" ]; then
  # shellcheck disable=SC1091
  . "${NVM_DIR:-$HOME/.nvm}/nvm.sh"
fi

LOG_DIR="$PROJECT_DIR/logs/data-update"
STATE_DIR="$LOG_DIR/scheduler"
LOCK_DIR="$STATE_DIR/run.lock"
mkdir -p "$STATE_DIR"
SCHED_LOG="$LOG_DIR/scheduler-$(date '+%Y%m').log"
GITHUB_REPO="${CULTUREFLOW_GITHUB_REPO:-pyw31337/culture}"
ISSUE_LABEL="local-pipeline-failure"

# Window / budget knobs (minutes since midnight KST).
WEEKDAY_BLOCK_START="${SCHED_WEEKDAY_BLOCK_START:-480}"   # 08:00
WEEKDAY_BLOCK_END="${SCHED_WEEKDAY_BLOCK_END:-1080}"      # 18:00
CI_GUARD_START="${SCHED_CI_GUARD_START:-160}"             # 02:40
CI_GUARD_END="${SCHED_CI_GUARD_END:-285}"                 # 04:45
POST_RESERVE_MIN="${SCHED_POST_RESERVE_MINUTES:-25}"      # validate+commit+push
LIGHT_BUDGET_MIN="${SCHED_LIGHT_BUDGET_MINUTES:-90}"
FULL_BUDGET_MIN="${SCHED_FULL_BUDGET_MINUTES:-210}"
FULL_MIN_WINDOW_MIN="${SCHED_FULL_MIN_WINDOW_MINUTES:-150}"
FULL_CATCHUP_HOURS="${SCHED_FULL_CATCHUP_HOURS:-36}"
MIN_SCRAPE_MIN="${SCHED_MIN_SCRAPE_MINUTES:-15}"
CRITICAL_STREAK_ALERT="${SCHED_CRITICAL_STREAK_ALERT:-3}"

FORCE=0
DRY_RUN=0
PROFILE="auto"
while [ $# -gt 0 ]; do
  case "$1" in
    --force) FORCE=1 ;;
    --dry-run) DRY_RUN=1 ;;
    --profile) shift; PROFILE="${1:-auto}" ;;
    --profile=*) PROFILE="${1#--profile=}" ;;
    -h|--help) sed -n '2,27p' "$0"; exit 0 ;;
    *) echo "unknown option: $1" >&2; exit 64 ;;
  esac
  shift
done
case "$PROFILE" in auto|light|full) ;; *) echo "invalid --profile: $PROFILE" >&2; exit 64 ;; esac

if [ -f "$STATE_DIR/dry-run-once" ]; then
  rm -f "$STATE_DIR/dry-run-once"
  DRY_RUN=1
fi

exec > >(tee -a "$SCHED_LOG") 2>&1

log() { echo "[scheduler $(date '+%Y-%m-%d %H:%M:%S %Z')] $*"; }

rotate_logs() {
  local f size keep_bytes=1048576 max_bytes=$((5 * 1048576))
  find "$LOG_DIR" -maxdepth 1 -name 'local-data-update-*.log' -mtime +"${SCHED_LOG_RETENTION_DAYS:-21}" -delete 2>/dev/null || true
  find "$LOG_DIR" -maxdepth 1 -name 'scheduler-*.log' -mtime +120 -delete 2>/dev/null || true
  for f in "$PROJECT_DIR"/logs/launchd-*.log "$LOG_DIR"/local-data-update-status-check.log; do
    [ -f "$f" ] || continue
    size="$(wc -c < "$f" | tr -d ' ')"
    if [ "${size:-0}" -gt "$max_bytes" ]; then
      tail -c "$keep_bytes" "$f" > "$f.tmp" && cat "$f.tmp" > "$f" && rm -f "$f.tmp"
    fi
  done
}

now_epoch="$(date +%s)"
dow="${SCHED_TEST_DOW:-$(date +%u)}"     # 1=Mon … 7=Sun (SCHED_TEST_* only for tests)
hhmm="${SCHED_TEST_HHMM:-$((10#$(date +%H) * 60 + 10#$(date +%M)))}"
is_weekday=0; [ "$dow" -le 5 ] && is_weekday=1

window_state="open"
window_reason=""
if [ "$is_weekday" -eq 1 ] && [ "$hhmm" -ge "$WEEKDAY_BLOCK_START" ] && [ "$hhmm" -lt "$WEEKDAY_BLOCK_END" ]; then
  window_state="closed"; window_reason="weekday 08:00-18:00 KST is reserved"
elif [ "$hhmm" -ge "$CI_GUARD_START" ] && [ "$hhmm" -lt "$CI_GUARD_END" ]; then
  window_state="closed"; window_reason="GitHub fallback slot (03:00 KST) guard 02:40-04:45"
fi

# Minutes until the next boundary (CI guard start, or 08:00 on a weekday morning).
if [ "$hhmm" -lt "$CI_GUARD_START" ]; then to_ci=$((CI_GUARD_START - hhmm)); else to_ci=$((1440 - hhmm + CI_GUARD_START)); fi
to_block=100000
if [ "$hhmm" -lt "$WEEKDAY_BLOCK_START" ] && [ "$is_weekday" -eq 1 ]; then
  to_block=$((WEEKDAY_BLOCK_START - hhmm))
elif [ "$hhmm" -ge "$WEEKDAY_BLOCK_START" ]; then
  next_dow=$((dow % 7 + 1))
  [ "$next_dow" -le 5 ] && to_block=$((1440 - hhmm + WEEKDAY_BLOCK_START))
fi
window_left=$to_ci; [ "$to_block" -lt "$window_left" ] && window_left=$to_block

last_full_epoch="$(cat "$STATE_DIR/last-full-success" 2>/dev/null || echo 0)"
full_age_h=$(( (now_epoch - ${last_full_epoch:-0}) / 3600 ))

if [ "$PROFILE" = "auto" ]; then
  hour=$((hhmm / 60))
  if { [ "$is_weekday" -eq 1 ] && [ "$hour" -eq 21 ]; } || { [ "$is_weekday" -eq 0 ] && [ "$hour" -eq 13 ]; } || [ "$full_age_h" -ge "$FULL_CATCHUP_HOURS" ]; then
    PROFILE="full"
  else
    PROFILE="light"
  fi
  if [ "$PROFILE" = "full" ] && [ "$FORCE" -eq 0 ] && [ "$window_left" -lt "$FULL_MIN_WINDOW_MIN" ]; then
    log "full run wanted but only ${window_left} min of window left; running light instead"
    PROFILE="light"
  fi
fi

if [ "$PROFILE" = "full" ]; then budget=$FULL_BUDGET_MIN; else budget=$LIGHT_BUDGET_MIN; fi
if [ "$FORCE" -eq 0 ]; then
  room=$((window_left - POST_RESERVE_MIN))
  [ "$room" -lt "$budget" ] && budget=$room
fi

log "start: profile=${PROFILE} window=${window_state}${window_reason:+ (${window_reason})} window_left=${window_left}min scrape_budget=${budget}min force=${FORCE} dry_run=${DRY_RUN} last_full=${full_age_h}h ago"

if [ "$window_state" = "closed" ] && [ "$FORCE" -eq 0 ] && [ "$DRY_RUN" -eq 0 ]; then
  log "skip: ${window_reason}. Use --force to override."
  exit 0
fi
if [ "$budget" -lt "$MIN_SCRAPE_MIN" ] && [ "$FORCE" -eq 0 ] && [ "$DRY_RUN" -eq 0 ]; then
  log "skip: only ${budget} min of scraping time left before the next boundary"
  exit 0
fi

# ---- lock (mkdir is atomic; flock is not available on macOS) ----
acquire_lock() {
  if mkdir "$LOCK_DIR" 2>/dev/null; then
    echo "$$" > "$LOCK_DIR/pid"; date '+%Y-%m-%d %H:%M:%S %Z' > "$LOCK_DIR/started"
    return 0
  fi
  local pid; pid="$(cat "$LOCK_DIR/pid" 2>/dev/null || true)"
  if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
    log "skip: another run (pid $pid, started $(cat "$LOCK_DIR/started" 2>/dev/null)) is still active"
    return 1
  fi
  log "removing stale lock (pid ${pid:-unknown} is gone)"
  rm -rf "$LOCK_DIR"
  mkdir "$LOCK_DIR" 2>/dev/null || return 1
  echo "$$" > "$LOCK_DIR/pid"; date '+%Y-%m-%d %H:%M:%S %Z' > "$LOCK_DIR/started"
}

if [ "$DRY_RUN" -eq 0 ]; then
  acquire_lock || exit 0
  trap 'rm -rf "$LOCK_DIR"' EXIT
fi
rotate_logs

if [ -f "$PROJECT_DIR/.env.local" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$PROJECT_DIR/.env.local"
  set +a
fi

probe() {
  # prints HTTP status only (never the response body or credentials)
  local code
  code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time "${PROBE_TIMEOUT:-15}" -A "$PROBE_UA" "$@" 2>/dev/null)" || true
  echo "${code:-000}"
}

# Interpark answers 403 to curl's default User-Agent, so probe like the scrapers do.
PROBE_UA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
run_probes() {
  [ "${SCHED_SKIP_PROBES:-0}" = "1" ] && { log "network: probes skipped"; return 0; }
  local interpark heritage yes24 kakao="skipped(no key)"
  interpark="$(probe -H 'Referer: https://tickets.interpark.com/' 'https://api-ticketfront.interpark.com/v1/goods/26009511/summary')"
  heritage="$(PROBE_TIMEOUT=45 probe 'https://www.khs.go.kr/cha/openapi/selectEventListOpenapi.do?searchYear=2026&searchMonth=1')"
  yes24="$(probe 'https://ticket.yes24.com/')"
  if [ -n "${KAKAO_REST_API_KEY:-}" ]; then
    kakao="$(probe -H "Authorization: KakaoAK ${KAKAO_REST_API_KEY}" 'https://dapi.kakao.com/v2/local/search/keyword.json?query=%EC%98%88%EC%88%A0%EC%9D%98%EC%A0%84%EB%8B%B9&size=1')"
  fi
  log "network: interpark-api=${interpark} khs.go.kr=${heritage} yes24=${yes24} kakao-local=${kakao}"
}

report_issue() {
  local title="$1" body_file="$2"
  command -v gh >/dev/null 2>&1 || { log "gh not found; cannot open an issue"; return 0; }
  gh auth status >/dev/null 2>&1 || { log "gh is not logged in; cannot open an issue"; return 0; }
  gh label create "$ISSUE_LABEL" --repo "$GITHUB_REPO" --color D93F0B --description 'Mac mini local data pipeline failure' >/dev/null 2>&1 || true
  local existing
  existing="$(gh issue list --repo "$GITHUB_REPO" --label "$ISSUE_LABEL" --state open --json number --jq '.[0].number' 2>/dev/null || true)"
  if [ -n "$existing" ]; then
    gh issue comment "$existing" --repo "$GITHUB_REPO" --body-file "$body_file" >/dev/null 2>&1 && log "updated issue #$existing"
  else
    gh issue create --repo "$GITHUB_REPO" --title "$title" --label "$ISSUE_LABEL" --body-file "$body_file" >/dev/null 2>&1 && log "opened a GitHub issue ($ISSUE_LABEL)"
  fi
}

close_issues() {
  command -v gh >/dev/null 2>&1 || return 0
  local n
  for n in $(gh issue list --repo "$GITHUB_REPO" --label "$ISSUE_LABEL" --state open --json number --jq '.[].number' 2>/dev/null || true); do
    gh issue close "$n" --repo "$GITHUB_REPO" --comment "Recovered: local ${PROFILE} run succeeded at $(date '+%Y-%m-%d %H:%M %Z')." >/dev/null 2>&1 && log "closed issue #$n"
  done
}

profile_env() {
  # Only set what the caller has not set already.
  if [ "$PROFILE" = "full" ]; then
    : "${LOCAL_SCRAPER_PLAN:=local}"
    : "${INTERPARK_API_ENRICH_LIMIT:=1500}"
    : "${INTERPARK_SESSION_LIMIT:=1200}"
    : "${INTERPARK_RUN_BUDGET_SECONDS:=3600}"
    : "${VENUE_PLACE_LOOKUP_LIMIT:=400}"
    : "${LOCAL_SCRAPER_TIMEOUT_SECONDS:=2700}"
  else
    : "${LOCAL_SCRAPER_PLAN:=local-light}"
    : "${INTERPARK_ENRICH_LIMIT:=40}"
    : "${INTERPARK_API_ENRICH_LIMIT:=700}"
    : "${INTERPARK_SESSION_LIMIT:=500}"
    : "${INTERPARK_RUN_BUDGET_SECONDS:=1800}"
    : "${VENUE_PLACE_LOOKUP_LIMIT:=200}"
    : "${YES24_DETAIL_LIMIT:=150}"
    : "${LOCAL_SCRAPER_TIMEOUT_SECONDS:=2100}"
    : "${SKIP_PLAYWRIGHT_INSTALL:=1}"
  fi
  : "${INTERPARK_SESSION_WINDOW_DAYS:=90}"
  export LOCAL_SCRAPER_PLAN INTERPARK_API_ENRICH_LIMIT INTERPARK_SESSION_LIMIT INTERPARK_RUN_BUDGET_SECONDS \
    VENUE_PLACE_LOOKUP_LIMIT LOCAL_SCRAPER_TIMEOUT_SECONDS INTERPARK_SESSION_WINDOW_DAYS
  [ -n "${INTERPARK_ENRICH_LIMIT:-}" ] && export INTERPARK_ENRICH_LIMIT
  [ -n "${YES24_DETAIL_LIMIT:-}" ] && export YES24_DETAIL_LIMIT
  [ -n "${SKIP_PLAYWRIGHT_INSTALL:-}" ] && export SKIP_PLAYWRIGHT_INSTALL
  export LOCAL_UPDATE_PROFILE="$PROFILE"
  export LOCAL_UPDATE_SCRAPE_DEADLINE_EPOCH=$((now_epoch + budget * 60))
  export FORCE_LOCAL_UPDATE=1
}

if [ "$DRY_RUN" -eq 1 ]; then
  log "dry-run: node=$(node -v 2>/dev/null || echo missing) npm=$(npm -v 2>/dev/null || echo missing) git=$(git --version 2>/dev/null | awk '{print $3}') gh=$(command -v gh >/dev/null && echo yes || echo no)"
  if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then log "dry-run: gh logged in"; else log "dry-run: gh NOT logged in (issue reporting disabled)"; fi
  missing=""
  for k in KOPIS_API_KEY KOBIS_API_KEY TMDB_API_KEY KCISA_API_KEY KAKAO_REST_API_KEY; do
    eval "v=\${$k:-}"; [ -z "$v" ] && missing="$missing $k"
  done
  if [ -n "$missing" ]; then log "dry-run: env keys MISSING:$missing"; else log "dry-run: env keys all present (names checked, values not printed)"; fi
  cd "$PROJECT_DIR" && log "dry-run: git $(git rev-parse --abbrev-ref HEAD)@$(git rev-parse --short HEAD), dirty files: $(git status --porcelain | wc -l | tr -d ' ')"
  [ -d "$LOCK_DIR" ] && log "dry-run: lock present (pid $(cat "$LOCK_DIR/pid" 2>/dev/null))"
  profile_env
  log "dry-run: plan ${LOCAL_SCRAPER_PLAN}: $(node "$PROJECT_DIR/scripts/print-scraper-plan.mjs" "$LOCAL_SCRAPER_PLAN" 2>/dev/null | cut -f1 | tr '\n' ' ')"
  run_probes
  log "dry-run finished (nothing scraped, committed or pushed)"
  exit 0
fi

run_probes
profile_env

started="$(date '+%Y-%m-%d %H:%M:%S %Z')"
# The runner keeps its own detailed log (logs/data-update/local-data-update-*.log);
# only the summary lines go to the scheduler log.
bash "$PROJECT_DIR/scripts/run-local-data-update.sh" >/dev/null 2>&1
rc=$?
log "run-local-data-update.sh exit=${rc} (profile=${PROFILE})"

status_json="$LOG_DIR/last-run-status.json"
critical="$(node -e 'try{const s=require(process.argv[1]);process.stdout.write((s.criticalFailures||[]).join(" "))}catch{}' "$status_json" 2>/dev/null || true)"
run_log="$(node -e 'try{process.stdout.write(require(process.argv[1]).logFile||"")}catch{}' "$status_json" 2>/dev/null || true)"
run_status="$(node -e 'try{process.stdout.write(require(process.argv[1]).status||"")}catch{}' "$status_json" 2>/dev/null || true)"
log "result: status=${run_status:-unknown}${critical:+ critical_failures=${critical}} log=${run_log}"

streak="$(cat "$STATE_DIR/critical-streak" 2>/dev/null || echo 0)"
if [ "$rc" -eq 0 ] && [ -n "$critical" ]; then streak=$((streak + 1)); elif [ "$rc" -eq 0 ]; then streak=0; fi
echo "$streak" > "$STATE_DIR/critical-streak"

if [ "$rc" -eq 0 ]; then
  [ "$PROFILE" = "full" ] && date +%s > "$STATE_DIR/last-full-success"
  date +%s > "$STATE_DIR/last-success"
fi

body="$STATE_DIR/issue-body.md"
if [ "$rc" -ne 0 ] && [ "$run_status" != "skipped" ]; then
  {
    echo "### Mac mini local ${PROFILE} run failed — ${started}"
    echo ""
    echo "- Exit code: ${rc}"
    echo "- Host: $(hostname -s)"
    echo "- Log: \`${run_log:-$SCHED_LOG}\`"
    echo "- Live data stays on the last successful data commit."
    echo ""
    echo "Last log lines:"
    echo '```'
    [ -n "$run_log" ] && [ -f "$run_log" ] && tail -n 25 "$run_log" | cut -c1-300
    echo '```'
  } > "$body"
  report_issue "Mac mini local data update is failing" "$body"
elif [ "$rc" -ne 0 ]; then
  {
    echo "### Mac mini local run skipped — ${started}"
    echo ""
    echo "The checkout at \`$PROJECT_DIR\` has non-data local changes, so the scheduled update could not run."
  } > "$body"
  report_issue "Mac mini local data update is failing" "$body"
elif [ "$streak" -ge "$CRITICAL_STREAK_ALERT" ]; then
  {
    echo "### Critical scrapers keep failing on the Mac mini — ${started}"
    echo ""
    echo "- ${streak} consecutive runs with critical scraper failures: ${critical}"
    echo "- Other sources are still published; these keep their previous data."
    echo "- Log: \`${run_log}\`"
  } > "$body"
  report_issue "Mac mini local data update is failing" "$body"
else
  close_issues
fi

exit "$rc"

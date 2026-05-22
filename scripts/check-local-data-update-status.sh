#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="${CULTUREFLOW_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
LOG_DIR="$PROJECT_DIR/logs/data-update"
STATUS_FILE="$LOG_DIR/last-run-status.json"
BUILD_INFO_FILE="$PROJECT_DIR/public/data/build-info.json"
CHECK_LOG="$LOG_DIR/local-data-update-status-check.log"
MAX_STATUS_AGE_HOURS="${LOCAL_UPDATE_STATUS_MAX_AGE_HOURS:-30}"
MAX_BUILD_AGE_HOURS="${LOCAL_UPDATE_BUILD_MAX_AGE_HOURS:-30}"
LOCAL_UPDATE_STATUS_NOTIFY="${LOCAL_UPDATE_STATUS_NOTIFY:-1}"

mkdir -p "$LOG_DIR"
exec > >(tee -a "$CHECK_LOG") 2>&1

cd "$PROJECT_DIR"

notify_status() {
  local title="$1"
  local message="$2"

  if [ "$LOCAL_UPDATE_STATUS_NOTIFY" != "1" ]; then
    return 1
  fi

  /usr/bin/osascript - "$title" "$message" <<'APPLESCRIPT' >/dev/null 2>&1
on run argv
  display notification (item 2 of argv) with title (item 1 of argv)
end run
APPLESCRIPT
}

echo "[status-check] started at $(TZ=Asia/Seoul date '+%Y-%m-%d %H:%M:%S %Z')"

check_result="$(
  node - "$STATUS_FILE" "$BUILD_INFO_FILE" "$MAX_STATUS_AGE_HOURS" "$MAX_BUILD_AGE_HOURS" <<'NODE'
const fs = require('fs');

const [statusPath, buildInfoPath, maxStatusAgeHoursRaw, maxBuildAgeHoursRaw] = process.argv.slice(2);
const maxStatusAgeHours = Number(maxStatusAgeHoursRaw) || 30;
const maxBuildAgeHours = Number(maxBuildAgeHoursRaw) || 30;
const now = new Date();
const kstDate = (date) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(date);
const todayKst = kstDate(now);
const reasons = [];
let status = null;
let buildInfo = null;

function readJson(file, label) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    reasons.push(`${label} is missing or unreadable: ${file}`);
    return null;
  }
}

status = readJson(statusPath, 'last run status');
buildInfo = readJson(buildInfoPath, 'build info');

if (status) {
  if (status.status !== 'success') reasons.push(`last run status is ${status.status || 'unknown'}`);
  if (Number(status.exitCode) !== 0) reasons.push(`last run exitCode is ${status.exitCode}`);
  if (Array.isArray(status.criticalFailures) && status.criticalFailures.length > 0) {
    reasons.push(`critical scraper failures: ${status.criticalFailures.join(', ')}`);
  }

  const endedAt = status.endedAt ? new Date(String(status.endedAt).replace(' KST', '+09:00')) : null;
  if (!endedAt || Number.isNaN(endedAt.getTime())) {
    reasons.push('last run endedAt is missing or invalid');
  } else {
    const ageHours = (now.getTime() - endedAt.getTime()) / 36e5;
    if (kstDate(endedAt) !== todayKst) reasons.push(`last run was not today KST: ${status.endedAt}`);
    if (ageHours < 0 || ageHours > maxStatusAgeHours) {
      reasons.push(`last run age is ${ageHours.toFixed(1)}h, over ${maxStatusAgeHours}h`);
    }
  }
}

if (buildInfo) {
  const generatedAt = buildInfo.generatedAt ? new Date(buildInfo.generatedAt) : null;
  if (!generatedAt || Number.isNaN(generatedAt.getTime())) {
    reasons.push('build-info generatedAt is missing or invalid');
  } else {
    const ageHours = (now.getTime() - generatedAt.getTime()) / 36e5;
    if (kstDate(generatedAt) !== todayKst) reasons.push(`public data was not generated today KST: ${buildInfo.generatedAt}`);
    if (ageHours < 0 || ageHours > maxBuildAgeHours) {
      reasons.push(`public data age is ${ageHours.toFixed(1)}h, over ${maxBuildAgeHours}h`);
    }
  }
}

const ok = reasons.length === 0;
const message = ok
  ? `Local update healthy. head=${status?.headSha || 'unknown'}, generatedAt=${buildInfo?.generatedAt || 'unknown'}`
  : `Local update needs attention: ${reasons.join('; ')}`;

console.log(JSON.stringify({
  ok,
  message,
  reasons,
  status: status ? {
    startedAt: status.startedAt,
    endedAt: status.endedAt,
    status: status.status,
    exitCode: status.exitCode,
    headSha: status.headSha,
    failures: status.failures || [],
    criticalFailures: status.criticalFailures || [],
    logFile: status.logFile,
  } : null,
  buildInfo: buildInfo ? {
    generatedAt: buildInfo.generatedAt,
    itemCount: buildInfo.itemCount,
  } : null,
}, null, 2));
NODE
)"

echo "$check_result"

if node -e "const r = JSON.parse(process.argv[1]); process.exit(r.ok ? 0 : 1)" "$check_result"; then
  echo "[status-check] healthy"
  exit 0
fi

message="$(node -e "const r = JSON.parse(process.argv[1]); console.log(r.message)" "$check_result")"
echo "[status-check] unhealthy: $message"
notify_status "CultureFlow update needs attention" "$message" || true
exit 1

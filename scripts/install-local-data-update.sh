#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="${CULTUREFLOW_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"

mkdir -p "$HOME/Library/LaunchAgents" "$PROJECT_DIR/logs"

install_launch_agent() {
  local label="$1"
  local schedule="$2"
  local plist_src="$PROJECT_DIR/ops/launchd/${label}.plist"
  local plist_dest="$HOME/Library/LaunchAgents/${label}.plist"

  if [ ! -f "$plist_src" ]; then
    echo "Missing plist template: $plist_src" >&2
    exit 1
  fi

  sed "s#__PROJECT_DIR__#$PROJECT_DIR#g" "$plist_src" > "$plist_dest"
  chmod 644 "$plist_dest"

  if launchctl print "gui/$(id -u)/$label" >/dev/null 2>&1; then
    launchctl bootout "gui/$(id -u)" "$plist_dest" >/dev/null 2>&1 || true
  fi

  launchctl bootstrap "gui/$(id -u)" "$plist_dest"
  launchctl enable "gui/$(id -u)/$label"

  echo "Installed $label"
  echo "Schedule: $schedule"
  echo "Plist: $plist_dest"
}

install_launch_agent "com.cultureflow.daily-update" "every day at 00:00 KST while this Mac is available."
install_launch_agent "com.cultureflow.update-watch" "every day at 07:30 KST to verify the midnight update."

echo "Logs: $PROJECT_DIR/logs/launchd-daily-update.out.log"
echo "Watch logs: $PROJECT_DIR/logs/launchd-update-watch.out.log"
echo "Last run status: $PROJECT_DIR/logs/data-update/last-run-status.json"
echo "Run now manually with: FORCE_LOCAL_UPDATE=1 $PROJECT_DIR/scripts/run-local-data-update.sh"
echo "Check status manually with: $PROJECT_DIR/scripts/check-local-data-update-status.sh"

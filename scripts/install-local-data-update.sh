#!/usr/bin/env bash
# Installs the Mac mini LaunchAgents for the local data pipeline.
#
#   com.cultureflow.local-scheduler  scripts/local-scheduler.sh on the window schedule
#                                    (weekdays 18:37/21:47/01:17/05:17, weekends ~every 4h)
#   com.cultureflow.update-watch     07:30 health check (macOS notification)
#
# The legacy com.cultureflow.daily-update (00:00, run-local-data-update.sh) is
# unloaded, disabled and its plist moved to ~/Library/LaunchAgents/disabled-cultureflow/
# (backup, not deleted). Re-run this script after pulling plist changes.
set -euo pipefail

PROJECT_DIR="${CULTUREFLOW_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
AGENTS_DIR="$HOME/Library/LaunchAgents"
BACKUP_DIR="$AGENTS_DIR/disabled-cultureflow"
DOMAIN="gui/$(id -u)"
STAMP="$(date '+%Y%m%d-%H%M%S')"

mkdir -p "$AGENTS_DIR" "$PROJECT_DIR/logs/data-update/scheduler" "$BACKUP_DIR"

install_launch_agent() {
  local label="$1"
  local plist_src="$PROJECT_DIR/ops/launchd/${label}.plist"
  local plist_dest="$AGENTS_DIR/${label}.plist"

  if [ ! -f "$plist_src" ]; then
    echo "Missing plist template: $plist_src" >&2
    exit 1
  fi

  if [ -f "$plist_dest" ]; then
    cp -p "$plist_dest" "$BACKUP_DIR/${label}.plist.bak-$STAMP"
  fi
  sed "s#__PROJECT_DIR__#$PROJECT_DIR#g" "$plist_src" > "$plist_dest"
  chmod 644 "$plist_dest"
  plutil -lint "$plist_dest" >/dev/null

  if launchctl print "$DOMAIN/$label" >/dev/null 2>&1; then
    launchctl bootout "$DOMAIN/$label" >/dev/null 2>&1 || true
  fi
  launchctl enable "$DOMAIN/$label"
  launchctl bootstrap "$DOMAIN" "$plist_dest"
  echo "Installed $label → $plist_dest"
}

disable_legacy_agent() {
  local label="com.cultureflow.daily-update"
  local plist="$AGENTS_DIR/${label}.plist"
  if launchctl print "$DOMAIN/$label" >/dev/null 2>&1; then
    launchctl bootout "$DOMAIN/$label" >/dev/null 2>&1 || true
  fi
  launchctl disable "$DOMAIN/$label" >/dev/null 2>&1 || true
  if [ -f "$plist" ]; then
    mv "$plist" "$BACKUP_DIR/${label}.plist.disabled-$STAMP"
    echo "Disabled legacy $label (plist backed up to $BACKUP_DIR)"
  fi
}

chmod +x "$PROJECT_DIR/scripts/local-scheduler.sh" "$PROJECT_DIR/scripts/run-local-data-update.sh" "$PROJECT_DIR/scripts/check-local-data-update-status.sh"
disable_legacy_agent
install_launch_agent "com.cultureflow.local-scheduler"
install_launch_agent "com.cultureflow.update-watch"

cat <<EOF

Schedule (KST): weekdays 18:37 light, 21:47 full, 01:17 light, 05:17 light
                weekends 01:17, 05:17, 09:13, 13:07(full), 17:19, 21:47 light
Window guard:   weekdays 08:00-18:00 and 02:40-04:45 (GitHub fallback) are skipped.
Scheduler log:  $PROJECT_DIR/logs/data-update/scheduler-YYYYMM.log
Run log:        $PROJECT_DIR/logs/data-update/local-data-update-*.log
Dry run now:    touch $PROJECT_DIR/logs/data-update/scheduler/dry-run-once && launchctl kickstart $DOMAIN/com.cultureflow.local-scheduler
Manual run:     $PROJECT_DIR/scripts/local-scheduler.sh --force [--profile light|full]
EOF

#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="${CULTUREFLOW_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
LABEL="com.cultureflow.daily-update"
PLIST_SRC="$PROJECT_DIR/ops/launchd/${LABEL}.plist"
PLIST_DEST="$HOME/Library/LaunchAgents/${LABEL}.plist"

mkdir -p "$HOME/Library/LaunchAgents" "$PROJECT_DIR/logs"

if [ ! -f "$PLIST_SRC" ]; then
  echo "Missing plist template: $PLIST_SRC" >&2
  exit 1
fi

sed "s#__PROJECT_DIR__#$PROJECT_DIR#g" "$PLIST_SRC" > "$PLIST_DEST"
chmod 644 "$PLIST_DEST"

if launchctl print "gui/$(id -u)/$LABEL" >/dev/null 2>&1; then
  launchctl bootout "gui/$(id -u)" "$PLIST_DEST" >/dev/null 2>&1 || true
fi

launchctl bootstrap "gui/$(id -u)" "$PLIST_DEST"
launchctl enable "gui/$(id -u)/$LABEL"

echo "Installed $LABEL"
echo "Schedule: every day at 00:00 KST while this Mac is available."
echo "Plist: $PLIST_DEST"
echo "Logs: $PROJECT_DIR/logs/launchd-daily-update.out.log"
echo "Run now manually with: FORCE_LOCAL_UPDATE=1 $PROJECT_DIR/scripts/run-local-data-update.sh"

#!/usr/bin/env bash
# macOS-compatible cleanup (no mapfile)
set -euo pipefail
cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
echo "==> Culture Flow repo cleanup"
echo "Working directory: $(pwd)"
echo

remove_pathspec() {
  local pattern="$1"
  local matches
  matches=$(git ls-files -- "$pattern" 2>/dev/null || true)
  [ -z "$matches" ] && return 0
  printf '%s\n' "$matches" | while IFS= read -r f; do
    [ -z "$f" ] && continue
    echo "  rm --cached: $f"
    git rm --cached -f -- "$f" 2>/dev/null || true
    [ -f "$f" ] && rm -f -- "$f"
  done
}

for pattern in \
  'debug_*' 'debug-*' 'error_row_*.png' 'naver_debug*.png' \
  'interpark*_screenshot.png' '*_debug.html' '*_debug.json' \
  'debug_*.log' 'server.log' 'server_log.txt' 'Untitled-*.psd' '*.psd' \
  'culture_bak_*.zip' 'deploy.zip' 'coex-page.html' 'kbl_debug.html' \
  'kovo_debug.html' 'timeticket_item_dump.html' 'venue_page_v2.html' \
  'tmp-*.json' 'tmp_price.json' 'missing_venues.txt' 'missing_venues_report.json' \
  'unmatched_sports_venues.json' 'venue_audit.csv' 'venue_cache.json' \
  'venue_coordinate_mismatches.csv' 'venue_export*.csv' 'venue_report*' \
  'venues_export.csv' 'venues_for_review.csv' 'export_venues_csv*.js' \
  'get-missing-sample.js' 'test-*.js' 'kovo.js' '0' '=' \
  '1200x600.jpg' '256x256.jpg' 'ReadMe.rtf' 'oracle_key' \
  'QUALITY_REPORT.json' 'geospatial_audit_report.md' 'mochaclass_debug.json' \
  'debug_daum_api.json' 'debug_html_empty_list.txt' 'debug_hockey.log' \
  'debug_interpark.log' 'debug_output.txt'
do
  remove_pathspec "$pattern"
done

extra=$(git ls-files | grep -E '(^|/)(debug[-_]|error_row_|naver_debug|interpark.*screenshot)' || true)
if [ -n "$extra" ]; then
  printf '%s\n' "$extra" | while IFS= read -r f; do
    [ -z "$f" ] && continue
    echo "  rm --cached (extra): $f"
    git rm --cached -f -- "$f" 2>/dev/null || true
    [ -f "$f" ] && rm -f -- "$f"
  done
fi

echo
echo "Cleanup pass finished. Review with: git status"
echo "NOTE: If oracle_key was a real secret, rotate it immediately."

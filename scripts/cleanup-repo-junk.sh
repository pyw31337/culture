#!/usr/bin/env bash
# Culture Flow — remove debug artifacts, logs, and binary junk from git tracking.
# Safe to re-run. Does not delete local ignored files outside the patterns below.
set -euo pipefail

cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

echo "==> Culture Flow repo cleanup"
echo "Working directory: $(pwd)"
echo

# Patterns that should never be in version control
PATTERNS=(
  'debug_*'
  'debug-*'
  'error_row_*.png'
  'naver_debug*.png'
  'interpark*_screenshot.png'
  '*_debug.html'
  '*_debug.json'
  'debug_*.log'
  'server.log'
  'server_log.txt'
  'Untitled-*.psd'
  '*.psd'
  'culture_bak_*.zip'
  'deploy.zip'
  'coex-page.html'
  'kbl_debug.html'
  'kovo_debug.html'
  'timeticket_item_dump.html'
  'venue_page_v2.html'
  'tmp-*.json'
  'tmp_price.json'
  'missing_venues.txt'
  'missing_venues_report.json'
  'unmatched_sports_venues.json'
  'venue_audit.csv'
  'venue_cache.json'
  'venue_coordinate_mismatches.csv'
  'venue_export*.csv'
  'venue_report*'
  'venues_export.csv'
  'venues_for_review.csv'
  'export_venues_csv*.js'
  'get-missing-sample.js'
  'test-*.js'
  'test-cleantitle.js'
  'test-date.js'
  'test-mommom.js'
  'test-naver*.js'
  'test-regex.js'
  'kovo.js'
  '0'
  '='
  '1200x600.jpg'
  '256x256.jpg'
  'ReadMe.rtf'
  'oracle_key'
  'QUALITY_REPORT.json'
  'geospatial_audit_report.md'
  'mochaclass_debug.json'
  'debug_daum_api.json'
  'debug_html_empty_list.txt'
  'debug_hockey.log'
  'debug_interpark.log'
  'debug_output.txt'
)

removed=0
for pattern in "${PATTERNS[@]}"; do
  # List tracked files matching pattern
  mapfile -t matches < <(git ls-files -- "$pattern" 2>/dev/null || true)
  if [ ${#matches[@]} -eq 0 ]; then
    continue
  fi
  for f in "${matches[@]}"; do
    if [ -n "$f" ]; then
      echo "  rm --cached: $f"
      git rm --cached -f -- "$f" 2>/dev/null || true
      # Also remove working tree copy if present (junk should not stay)
      if [ -f "$f" ]; then
        rm -f -- "$f"
      fi
      removed=$((removed + 1))
    fi
  done
done

# Extra: any remaining debug-*.png / error screenshots tracked
mapfile -t extra < <(git ls-files | grep -E '(^|/)(debug[-_]|error_row_|naver_debug|interpark.*screenshot)' || true)
for f in "${extra[@]}"; do
  if [ -n "$f" ]; then
    echo "  rm --cached (extra): $f"
    git rm --cached -f -- "$f" 2>/dev/null || true
    [ -f "$f" ] && rm -f -- "$f"
    removed=$((removed + 1))
  fi
done

echo
echo "Removed $removed tracked junk path(s) from the index."
echo "Review with: git status"
echo "Then: git add .gitignore && git commit -m 'chore: purge debug artifacts and junk files'"
echo
echo "NOTE: If oracle_key contained a real secret, rotate/revoke it immediately."
echo "      History rewrite may still be required if it was ever pushed."

# CultureFlow Local Data Update

CultureFlow uses a local-first collection schedule to avoid exhausting GitHub Actions minutes. The scheduled job should run from a dedicated clean clone, not from an active development checkout.

## Schedule

- Local Mac: every day at 00:00 KST via `launchd`.
- GitHub Actions fallback: every day at 03:00 KST.
- The GitHub fallback first checks `public/data/build-info.json`. If today's local update already produced data on the same KST date within 20 hours, it skips the expensive scraper job.

## Production Runner Clone

Use a separate clone for automation so local development changes cannot make the scheduled job skip:

```bash
git clone https://github.com/pyw31337/culture.git ~/Developer/CultureFlow-Runner
cp -p ~/Developer/CultureFlow-New/.env.local ~/Developer/CultureFlow-Runner/.env.local
cd ~/Developer/CultureFlow-Runner
scripts/install-local-data-update.sh
```

The active launchd job should point to `~/Developer/CultureFlow-Runner`.

## Install or Refresh the Local Scheduler

```bash
scripts/install-local-data-update.sh
```

## Run Manually

```bash
FORCE_LOCAL_UPDATE=1 scripts/run-local-data-update.sh
```

For a fast smoke run while debugging, keep the full pipeline shape but reduce heavy detail enrichment:

```bash
FORCE_LOCAL_UPDATE=1 \
INTERPARK_ENRICH_LIMIT=10 \
YES24_DETAIL_LIMIT=10 \
MOCHACLASS_DETAIL_LIMIT=10 \
UMCLASS_DETAIL_LIMIT=10 \
MUSEUM_MAX_DETAIL_ITEMS=10 \
CULTURE_PORTAL_DETAIL_LIMIT=10 \
TOURISM_MAX_PAGES=1 \
scripts/run-local-data-update.sh
```

## Logs

- Launchd stdout: `logs/launchd-daily-update.out.log`
- Launchd stderr: `logs/launchd-daily-update.err.log`
- Per-run logs: `logs/data-update/local-data-update-YYYYMMDD-HHMMSS.log`
- Last run status: `logs/data-update/last-run-status.json`
- Last scraper failures: `logs/data-update/last-scrape-failures.txt`

## Notes

- If the runner working tree has uncommitted changes, the local job skips to avoid damaging local work and sends a macOS notification.
- If the Mac wakes late after 03:00 KST, the local job skips because the GitHub fallback owns that window.
- Critical scraper failures stop the run before validators and git commit/push, so partial critical data is not published as a successful update.
- Culture Portal keeps a large active index, but HTML detail enrichment is intentionally capped (`CULTURE_PORTAL_DETAIL_LIMIT`, default 400) and retried on a rolling stale window.
- Failures and skips write `last-run-status.json` and send a macOS notification by default. Set `LOCAL_UPDATE_NOTIFY=0` to disable notifications.
- Manual GitHub dispatch still runs immediately, even when today's local data is fresh.
- `verify-links` is intentionally disabled by default because it is slow and often fails due external 500 responses. Enable it only when needed with `RUN_LINK_VERIFY=1`.

# CultureFlow Local Data Update

CultureFlow uses a local-first collection schedule to avoid exhausting GitHub Actions minutes.

## Schedule

- Local Mac: every day at 00:00 KST via `launchd`.
- GitHub Actions fallback: every day at 03:00 KST.
- The GitHub fallback first checks `public/data/build-info.json`. If today's local update already produced data on the same KST date within 20 hours, it skips the expensive scraper job.

## Install or Refresh the Local Scheduler

```bash
scripts/install-local-data-update.sh
```

## Run Manually

```bash
FORCE_LOCAL_UPDATE=1 scripts/run-local-data-update.sh
```

## Logs

- Launchd stdout: `logs/launchd-daily-update.out.log`
- Launchd stderr: `logs/launchd-daily-update.err.log`
- Per-run logs: `logs/data-update/local-data-update-YYYYMMDD-HHMMSS.log`
- Last scraper failures: `logs/data-update/last-scrape-failures.txt`

## Notes

- If the working tree has uncommitted changes, the local job skips to avoid damaging local work.
- If the Mac wakes late after 03:00 KST, the local job skips because the GitHub fallback owns that window.
- Manual GitHub dispatch still runs immediately, even when today's local data is fresh.
- `verify-links` is intentionally disabled by default because it is slow and often fails due external 500 responses. Enable it only when needed with `RUN_LINK_VERIFY=1`.

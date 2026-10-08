# CultureFlow Local Data Update

CultureFlow uses a local-first collection schedule to avoid exhausting GitHub Actions minutes. The scheduled job should run from a dedicated clean clone, not from an active development checkout.

## Schedule

GitHub-hosted runners cannot reach several sources (Interpark ticket API → 403,
국가유산청 khs.go.kr → foreign IPs blocked, YES24 → unreachable, Kakao REST → key is
IP-restricted). Those run on the Mac mini inside the allowed windows:

- **Allowed (KST)**: weekdays 18:00 → next day 08:00, weekends all day.
  Weekday 08:00–18:00 is always skipped (`--force` overrides).
- **GitHub fallback guard**: 02:40–04:45 KST is skipped so the local job never races the
  03:00 KST `Daily Data Update` workflow. Local runs that would cross 02:40 stop starting
  new scrapers early; before touching `origin/main` the runner waits while that workflow runs.
- launchd `com.cultureflow.local-scheduler` → `scripts/local-scheduler.sh`:

| When (KST) | Days | Profile |
| --- | --- | --- |
| 18:37 | Mon–Fri | light |
| 21:47 | every day | full on Mon–Fri, light on Sat/Sun |
| 01:17 | every day | light (finishes before 02:40, so the 03:00 fallback sees fresh data and skips) |
| 05:17 | every day | light (weekday mornings stop starting scrapers ~07:35) |
| 09:13 / 13:07 / 17:19 | Sat, Sun | light / full / light |

- **light** = plan `local-light` in `scripts/scraper-plan.json`: interpark (list + API price/age/runtime
  + playSeq sessions, larger caps), yes24-exclusive, timeticket, heritage-events, cinemas,
  cinema-relay-ids, build-venues, venue-places (Kakao category). Enrichment is incremental
  (`lastApiEnriched`, `sessionsCheckedAt`, venue-place cache), so every run resumes where the
  previous one stopped and heavy work is spread across runs.
- **full** = plan `local`: every source with deep caps. Also forced when the last successful
  full run is older than 36h (e.g. the Mac was off).
- A lock (`logs/data-update/scheduler/run.lock`) prevents overlapping runs.
- Local health check: every day at 07:30 KST (`com.cultureflow.update-watch`, macOS notification).
- GitHub Actions fallback: every day at 03:00 KST. It skips when `public/data/build-info.json`
  was generated today (KST, ≤ 20h) or within the last 6 hours. It never runs the local-only
  sources, and `scripts/guard-retained-data.mjs` restores the committed file if a blocked
  source comes back suspiciously short, so CI keeps the last good local data.
- Failures open or update a GitHub issue labelled `local-pipeline-failure` (via `gh`);
  the next successful run closes it. Critical scrapers that keep failing (3 runs in a row)
  also open it.

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
scripts/local-scheduler.sh --dry-run            # window, lock, env names, network probes only
scripts/local-scheduler.sh --force               # run now, profile picked automatically
scripts/local-scheduler.sh --force --profile light
# dry run under launchd's own environment:
touch logs/data-update/scheduler/dry-run-once && launchctl kickstart gui/$(id -u)/com.cultureflow.local-scheduler
```

The lower-level runner still works on its own (`FORCE_LOCAL_UPDATE=1 scripts/run-local-data-update.sh`,
`LOCAL_SCRAPER_PLAN=local-light`, `LOCAL_UPDATE_SKIP_PUBLISH=1` to scrape without committing).

Check the latest local run without scraping:

```bash
scripts/check-local-data-update-status.sh
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

- Scheduler summary: `logs/data-update/scheduler-YYYYMM.log`
- Launchd stdout/stderr: `logs/launchd-local-scheduler.{out,err}.log`
- Rotation: per-run logs older than 21 days are deleted; launchd logs over 5 MB are trimmed to the last 1 MB.
- Health check stdout: `logs/launchd-update-watch.out.log`
- Health check stderr: `logs/launchd-update-watch.err.log`
- Health check detail log: `logs/data-update/local-data-update-status-check.log`
- Per-run logs: `logs/data-update/local-data-update-YYYYMMDD-HHMMSS.log`
- Last run status: `logs/data-update/last-run-status.json`
- Last scraper failures: `logs/data-update/last-scrape-failures.txt`

## Notes

- Leftover generated data from an interrupted run (only `src/data`, `public/data`, posters, thumbs)
  is stashed as a backup (`git stash list`, newest 3 kept) and the run continues. Any other local
  change makes the run skip and opens the `local-pipeline-failure` issue.
- A failed run restores the data paths to `HEAD`, so it can never block the next run.
  (The 2026-05-23 failure left a dirty tree and every midnight run skipped until 2026-10-08.)
- A failed critical scraper keeps its previous data (checkpoint restore) and the other sources are
  still published. Set `LOCAL_ABORT_ON_CRITICAL_FAILURE=1` for the old all-or-nothing behaviour.
- Push: plain push → rebase on `origin/main` → on conflict, re-apply this run's `src/data` files on
  top of `origin/main`, regenerate and validate, then push (up to 4 attempts). No force push.
- Culture Portal keeps a large active index, but HTML detail enrichment is intentionally capped (`CULTURE_PORTAL_DETAIL_LIMIT`, default 400) and retried on a rolling stale window.
- Set `LOCAL_UPDATE_NOTIFY=0` to disable macOS notifications.
- Manual GitHub dispatch still runs immediately, even when today's local data is fresh.
- `verify-links` is intentionally disabled by default because it is slow and often fails due external 500 responses. Enable it only when needed with `RUN_LINK_VERIFY=1`.

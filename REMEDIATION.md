# 🚨 Zero Data Alert Remediation Guide

If the `Daily Data Update` workflow fails with a **Data Integrity Error** (0 items found for Movies, Museum, or Mommom Food), follow these steps to investigate and fix the issue.

## 1. Identify the Failure
Check the GitHub Actions log for the `Run Scrapers` or `Validation Check` step. Look for messages like:
- `❌ [Scraper Error] movies.error: KOBIS returned 0 items`
- `❌ [Movies] ZERO data collected`

## 2. Troubleshoot Locally
Use the troubleshooting script to run the problematic scraper in debug mode (visible browser, verbose logging).

```bash
# Example: Troubleshoot Movies
npx tsx scripts/troubleshoot-scraper.ts movie

# Example: Troubleshoot Museum
npx tsx scripts/troubleshoot-scraper.ts museum

# Example: Troubleshoot Mommom Food
npx tsx scripts/troubleshoot-scraper.ts mommom-food
```

This script will:
- Launch a **visible** Chrome browser (so you can see if the site layout changed or if a popup is blocking content).
- Log detailed progress.
- Pause on failure so you can inspect the page with DevTools.

## 3. Common Causes & Fixes
| Symptom | Probable Cause | Fix |
|---|---|---|
| **Movies (0 items)** | KOBIS site layout changed (selector `#tbody_0 > tr` invalid) | Open KOBIS URL in browser, inspect table rows, updateselector in `scripts/scrape-movies.ts`. |
| **Museum (0 items)** | Mommom site structure changed | Run troubleshooter, inspect `.contents > a` selector. |
| **Blocking / Captcha** | Site is blocking automation | Try updating headers or slowing down the scraper. |

## 4. Verify Fix
After updating the scraper code:
1. Run the scraper locally: `npx tsx scripts/scrape-movies.ts`
2. Run validation: `npx tsx scripts/validate-data-integrity.ts`
3. If successful, commit and push changes.

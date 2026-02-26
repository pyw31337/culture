# Resuming Work and Stabilizing Data Recovery

Analyze the causes of the previous crash and resume the coordinate recovery and SEO validation tasks.

## Proposed Changes

### Recovery Script Optimization
#### [MODIFY] [recover-missing-coordinates.ts](file:///Users/pyw31337/Developer/CultureFlow-New/scripts/recover-missing-coordinates.ts)
- Add periodic state saving (every 50 items) to `venues.json` to prevent data loss on crash.
- Implement better error logging and retry logic for API failures.
- Add memory usage monitoring or `global.gc()` if needed (though unlikely necessary for this scale).

### Data Integrity & SEO
- Finalize the recovery of the remaining ~700 missing coordinates.
- Run `validate-data-integrity.ts` to ensure everything is correct.
- Verify JSON-LD structure using a simulation or manual check of the generated HTML.

## Verification Plan

### Automated Tests
- Run `npx tsx scripts/recover-missing-coordinates.ts` and monitor for stability.
- Run `npm run generate-data` to ensure the final payload is updated.
- Run `npx tsx scripts/validate-data-integrity.ts` for final quality check.

### Manual Verification
- Check `src/data/venues.json` size and content to ensure it's growing as expected.
- Verify a few 'Class' category items in the UI to ensure they appear on the map.

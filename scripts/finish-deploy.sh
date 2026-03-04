#!/bin/bash

# Wait for Mochaclass scraper to finish
echo "Waiting for scrape-mochaclass.ts to finish..."
while pgrep -f "scripts/scrape-mochaclass.ts" > /dev/null; do
  sleep 10
done
echo "Scraper finished! Proceeding with data generation."

# 1. Geocode new venues
npx tsx scripts/fix-venue-coordinates.ts

# 2. Bundle all data for production
npm run generate-data

# 3. Build Next.js
npm run build

# 4. Commit and Deploy
git add src/data/mochaclass.json public/data/ src/components/performance/PerformanceListItem.tsx
git commit -m "fix: retrieve exact Mochaclass venues, recalculate discount logic, and unify price UI"
git push origin main

echo "Deployment finished."

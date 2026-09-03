// One-off backfill for the address/lat/lng/district bug fixed in scrape-kopis.ts (the venue
// enrichment step was fetching this data into venues.json but never copying it onto the
// performance item itself). Applies the same venues.json lookup to the already-collected
// src/data/kopis-performances.json so the fix is visible immediately instead of waiting for the
// next full KOPIS scrape cycle to naturally repopulate it.
import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = path.resolve(import.meta.dirname, '../src/data');
const KOPIS_FILE = path.join(DATA_DIR, 'kopis-performances.json');
const VENUE_FILE = path.join(DATA_DIR, 'venues.json');

const venues = JSON.parse(fs.readFileSync(VENUE_FILE, 'utf-8'));
const kopis = JSON.parse(fs.readFileSync(KOPIS_FILE, 'utf-8'));

let filled = 0;
for (const item of kopis) {
  if (item.address && item.lat && item.lng) continue;
  const v = venues[item.venue];
  if (!v || !v.address) continue;
  item.address = v.address;
  item.lat = v.lat;
  item.lng = v.lng;
  if (v.district) item.district = v.district;
  filled++;
}

fs.writeFileSync(KOPIS_FILE, JSON.stringify(kopis, null, 2));
console.log(`[backfill-kopis-venue-geo] filled address/lat/lng for ${filled} of ${kopis.length} items`);

/**
 * Upgrades cached festival posters in public/images/posters/festivals/ in place.
 *
 * scrape-festival.ts only re-reads a festival's detail page when it re-enriches that item, and
 * the old image step never replaced a file that already existed -- so posters saved as small
 * landscape thumbnails (300x200 photos instead of the portrait poster on the same page) stayed
 * that way. This walks src/data/festivals.json, fetches each detail page over plain HTTP (the
 * image URLs are in the server-rendered HTML), picks the best candidate with the same rules as
 * the scraper (scripts/lib/festival-poster.ts), and overwrites the cached webp only when the new
 * one ranks higher. Items whose cache is already a portrait poster >= MIN_GOOD_LONG_SIDE are
 * skipped without a request.
 *
 *   npx tsx scripts/upgrade-festival-posters.ts            # upgrade
 *   npx tsx scripts/upgrade-festival-posters.ts --dry-run  # report only
 */
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import sharp from 'sharp';
import {
  collectFestivalImageCandidates,
  encodePosterWebp,
  fetchBestPoster,
  rankPoster,
  readImageSize,
} from './lib/festival-poster';

const DATA_FILE = path.join(process.cwd(), 'src', 'data', 'festivals.json');
const PUBLIC_DIR = path.join(process.cwd(), 'public');
const DETAIL_BASE_URL = 'https://korean.visitkorea.or.kr/kfes/detail/fstvlDetail.do';
const MIN_GOOD_LONG_SIDE = 600;
const DRY_RUN = process.argv.includes('--dry-run');

type Festival = { id?: string; title?: string; image?: string };

async function fetchDetailHtml(id: string): Promise<string> {
  const response = await axios.get<string>(`${DETAIL_BASE_URL}?fstvlCntntsId=${encodeURIComponent(id)}`, {
    timeout: 20000,
    responseType: 'text',
    validateStatus: () => true,
    headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36' },
  });
  return response.status >= 200 && response.status < 300 ? String(response.data || '') : '';
}

async function main() {
  const festivals: Festival[] = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  let upgraded = 0;
  let kept = 0;
  let failed = 0;
  for (const festival of festivals) {
    const image = String(festival.image || '');
    if (!festival.id || !image.startsWith('/images/posters/festivals/')) continue;
    const file = path.join(PUBLIC_DIR, image);
    const current = await readImageSize(file);
    if (current && current.height >= current.width * 1.2 && Math.max(current.width, current.height) >= MIN_GOOD_LONG_SIDE) {
      kept += 1;
      continue;
    }
    const html = await fetchDetailHtml(festival.id);
    const best = html ? await fetchBestPoster(collectFestivalImageCandidates(html, festival.id)) : null;
    if (!best) {
      failed += 1;
      console.warn(`[festival-poster] no candidate: ${festival.title} (${festival.id})`);
      continue;
    }
    const output = await encodePosterWebp(best.buffer);
    const next = await sharp(output).metadata();
    const before = current ? `${current.width}x${current.height}` : 'missing';
    if (current && rankPoster(current.width, current.height) >= rankPoster(next.width || 0, next.height || 0)) {
      kept += 1;
      continue;
    }
    console.log(`[festival-poster] ${festival.title}: ${before} -> ${next.width}x${next.height}${DRY_RUN ? ' (dry run)' : ''}`);
    if (!DRY_RUN) fs.writeFileSync(file, output);
    upgraded += 1;
  }
  console.log(`[festival-poster] upgraded ${upgraded}, kept ${kept}, no candidate ${failed}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

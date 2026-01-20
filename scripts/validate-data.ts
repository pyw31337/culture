
import fs from 'fs';
import path from 'path';

// VALIDATION RULES
// 1. Check for 'OTT' in subGenre/Genre (should be actual genre)
// 2. Check for Age Rating that looks like Runtime
// 3. Check for 404 Images (optional, HEAD check) - Skipped for now to avoid ban, just check structure.
// 4. Report stats.

const DATA_DIR = path.resolve(process.cwd(), 'src/data');

const load = (f: string) => {
    try {
        return JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf-8'));
    } catch { return []; }
};

const save = (f: string, data: any[]) => {
    fs.writeFileSync(path.join(DATA_DIR, f), JSON.stringify(data, null, 2));
};

async function validate() {
    console.log('Starting Data Validation...');

    // 1. OTT Data
    const ott = load('ott.json');
    console.log(`Loaded ${ott.length} OTT items.`);
    let modified = 0;

    const newOtt = ott.map((item: any) => {
        let changed = false;

        // Rule 1: 'OTT' in subGenre
        if (item.subGenre === 'OTT') {
            // console.log(`[Fix] Removing 'OTT' subGenre from ${item.title}`);
            delete item.subGenre;
            changed = true;
        }

        // Rule 2: Age Rating looks like Runtime or '42분'
        if (item.ageRating && (item.ageRating.includes('분') || item.ageRating.includes('min') || item.ageRating.match(/^\d+$/))) {
            console.log(`[Fix] Invalid Age Rating '${item.ageRating}' for ${item.title}. Clearing.`);
            // Optionally move to runningTime if runningTime is empty
            if (!item.runningTime && item.ageRating.includes('분')) {
                item.runningTime = item.ageRating;
            }
            delete item.ageRating;
            changed = true;
        }

        // Rule 3: Age Rating Cleanups
        if (item.ageRating === '전체' || item.ageRating === 'ALL') {
            item.ageRating = '전체 관람가';
            changed = true;
        }

        // Rule 4: Poster validation (Smart Image Scraping placeholder)
        // If poster is missing, we can't do much here without re-scraping.
        // But if poster is low res (s166), we could try to upgrade it?
        if (item.image && item.image.includes('/s166/')) {
            // console.log(`[Improve] Upgrading low-res image for ${item.title}`);
            item.image = item.image.replace('/s166/', '/s718/');
            changed = true;
        }

        if (changed) modified++;
        return item;
    });

    if (modified > 0) {
        save('ott.json', newOtt);
        console.log(`Updated ${modified} items in ott.json`);
    } else {
        console.log('No changes needed for ott.json');
    }

    // 2. Validate Movies
    const movies = load('movies.json');
    console.log(`Checked ${movies.length} movies.`);
    let movieMod = 0;

    // Naver Fallback helpers could go here if we want to auto-enrich validation failures immediately.
    // For now, let's just flag them or try rudimentary cleanups.
    // If user wants "auto-correct", we might need to hook up a searcher.
    // Given the request "Collect correctly", let's just report or try to clean.

    const newMovies = movies.map((m: any) => {
        let changed = false;

        // Rule 1: Check if poster is missing or 404 (we can't check 404 easily without fetch, but we can check empty)
        if (!m.image || m.image.trim() === '') {
            console.warn(`[Warning] Movie ${m.title} has no poster.`);
        }

        // Rule 2: Check for details
        if (!m.director && !m.movieInfo) {
            console.warn(`[Warning] Movie ${m.title} missing details.`);
        }

        return m;
    });

    // For now, we are just reporting on movies as the scraper update should fix it on next run.
    console.log('Movie validation complete.');
}

validate();

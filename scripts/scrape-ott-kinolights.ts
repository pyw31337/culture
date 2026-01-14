/**
 * OTT Scraper - Kinolights Source
 * 
 * This script scrapes OTT release data from Kinolights.
 * It extracts: Date, Platform, Title, Poster Image, Link
 * 
 * Phase 1: Skeleton Scrape (no per-page enrichment for speed)
 */

import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';
import path from 'path';

puppeteer.use(StealthPlugin());

const KINOLIGHTS_NEW_URL = 'https://m.kinolights.com/new';
const KINOLIGHTS_UPCOMING_URL = 'https://m.kinolights.com/new?tab=upcoming';
const TARGET_FILE = path.join(__dirname, '../src/data/ott.json');

interface OTTItemRaw {
    title: string;
    link: string;
    date: string;
    platform: string;
    poster: string;
    grade: string;
}

interface OTTPerformance {
    id: string;
    title: string;
    date: string;
    venue: string; // Can store source info
    platforms: string[];
    image: string;
    link: string;
    genre: string;
    region: string;
    grade: string;
    originalTitle?: string;
    productionCountry?: string;
    productionYear?: string;
    movieInfo?: string; // Mapped from Genre
    cast?: string[];
    director?: string;
}

// --- Helper Functions ---

function normalizeDate(dateStr: string): string {
    const now = new Date();
    const currentYear = now.getFullYear();

    if (dateStr === '오늘') {
        return now.toISOString().split('T')[0];
    }
    if (dateStr === '어제') {
        const d = new Date(now);
        d.setDate(d.getDate() - 1);
        return d.toISOString().split('T')[0];
    }
    if (dateStr === '내일') {
        const d = new Date(now);
        d.setDate(d.getDate() + 1);
        return d.toISOString().split('T')[0];
    }

    // Handle "MM.DD" -> determine correct year (handle year boundary)
    const match = dateStr.match(/(\d{2})\.(\d{2})/);
    if (match) {
        const month = parseInt(match[1], 10);
        const day = parseInt(match[2], 10);

        // If month is far in the future (e.g. Dec when now is Jan), it might be last year
        // For upcoming: if month is less than current month, it's next year
        // Simplification: just use current year for now
        return `${currentYear}-${match[1]}-${match[2]}`;
    }

    return dateStr;
}

function mapPlatform(className: string): string | null {
    const parts = className.split(' ');
    for (const p of parts) {
        if (p.startsWith('kino-icon--')) {
            const key = p.replace('kino-icon--', '').toLowerCase();
            if (key.includes('netflix')) return 'netflix';
            if (key.includes('tving')) return 'tving';
            if (key.includes('wavve') || key.includes('wave')) return 'wavve';
            if (key.includes('disney')) return 'disney';
            if (key.includes('coupang')) return 'coupang';
            if (key.includes('watcha')) return 'watcha';
            if (key.includes('apple')) return 'apple';
            if (key.includes('laftel')) return 'laftel';
            if (key.includes('amazon') || key.includes('prime')) return 'amazon';
            if (key.includes('mobiletv')) return 'uplus';
            if (key.includes('u+') || key.includes('uplus') || key.includes('lgu')) return 'uplus';

            console.warn(`Unknown platform key: ${key}`);
            return key;
        }
    }
    return null;
}

function sanitizeId(title: string, date: string, platform: string): string {
    const slug = title
        .replace(/[^a-zA-Z0-9가-힣\s]/g, '')
        .replace(/\s+/g, '_')
        .substring(0, 50);
    return `ott_${slug}_${date}_${platform}`;
}

async function scrapeList(page: any, url: string): Promise<OTTItemRaw[]> {
    console.log(`Navigating to ${url}...`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    // Infinite Scroll
    let previousHeight = 0;
    let scrollAttempts = 0;
    const MAX_SCROLLS = 15;

    while (scrollAttempts < MAX_SCROLLS) {
        previousHeight = await page.evaluate('document.body.scrollHeight');
        await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
        await new Promise(r => setTimeout(r, 1500));

        const newHeight = await page.evaluate('document.body.scrollHeight');
        if (newHeight === previousHeight) {
            console.log(`Scroll ended at attempt ${scrollAttempts}`);
            break;
        }
        scrollAttempts++;
    }
    console.log(`Completed ${scrollAttempts} scroll attempts`);

    // Parse DOM - Extract poster directly
    const rawItems: OTTItemRaw[] = await page.evaluate(() => {
        const items: any[] = [];
        const sections = document.querySelectorAll('#listArea > section.new-streaming-wrap');

        sections.forEach(section => {
            const dateEl = section.querySelector('h5 > span.title');
            const dateText = dateEl?.textContent?.trim() || '';

            const contents = section.querySelectorAll('.contents-wrap');
            contents.forEach(content => {
                const iconInfo = content.querySelector('.streaming-info i.kino-icon');
                const iconClass = iconInfo ? iconInfo.className : '';

                const movies = content.querySelectorAll('.movie-list-area .MovieItem');
                movies.forEach(movie => {
                    const titleEl = movie.querySelector('.title');
                    const title = titleEl?.textContent?.trim() || '';

                    const linkEl = movie.querySelector('a.poster-container');
                    const link = linkEl?.getAttribute('href') || '';

                    // Extract poster image directly from list
                    const posterEl = movie.querySelector('a.poster-container img');
                    const poster = posterEl ? (posterEl.getAttribute('src') || posterEl.getAttribute('data-src') || '') : '';

                    // Extract Grade
                    const gradeEl = movie.querySelector('i.grade-icon');
                    let grade = '전체';
                    if (gradeEl) {
                        const gradeClass = gradeEl.className;
                        if (gradeClass.includes('gr-19')) grade = '19세';
                        else if (gradeClass.includes('gr-15')) grade = '15세';
                        else if (gradeClass.includes('gr-12')) grade = '12세';
                        else if (gradeClass.includes('gr-all')) grade = '전체';
                        else if (gradeClass.includes('rate-19')) grade = '19세'; // Fallback
                        else if (gradeClass.includes('rate-15')) grade = '15세';
                        else if (gradeClass.includes('rate-12')) grade = '12세';
                        else if (gradeClass.includes('rate-all')) grade = '전체';
                    }

                    if (title && iconClass) {
                        items.push({
                            dateRaw: dateText,
                            platformClass: iconClass,
                            title: title,
                            link: link,
                            poster: poster,
                            grade: grade
                        });
                    }
                });
            });
        });
        return items;
    });

    console.log(`Parsed ${rawItems.length} raw items from ${url}`);

    // Post-process
    return rawItems.map((item: any) => ({
        title: item.title,
        link: item.link.startsWith('http') ? item.link : `https://m.kinolights.com${item.link}`,
        date: normalizeDate(item.dateRaw),
        platform: mapPlatform(item.platformClass) || 'other',
        poster: item.poster,
        grade: item.grade
    }));
}

function transformToPerformances(items: OTTItemRaw[]): OTTPerformance[] {
    // Group by Title+Date to merge platforms
    const grouped: Record<string, OTTItemRaw[]> = {};
    items.forEach(item => {
        const key = `${item.title}::${item.date}`;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(item);
    });

    const results: OTTPerformance[] = [];

    for (const [key, group] of Object.entries(grouped)) {
        const [title, date] = key.split('::');
        const platforms = Array.from(new Set(group.map(g => g.platform)));

        // Pick best poster (non-empty)
        const poster = group.find(g => g.poster && g.poster.length > 0)?.poster || '';

        const id = sanitizeId(title, date, platforms[0]);

        results.push({
            id,
            title,
            date,
            venue: 'OTT', // Dummy venue for compatibility
            platforms,
            image: poster || '/culture/images/placeholder.jpg',
            link: group[0].link,
            genre: 'ott',
            region: 'all',
            grade: group[0].grade
        });
    }

    return results;
}

// --- Main Execution ---

(async () => {
    console.log('Starting OTT Scraper (Kinolights - Skeleton Mode)...');
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 375, height: 812 }); // Mobile viewport

        // 1. Scrape New
        const newItems = await scrapeList(page, KINOLIGHTS_NEW_URL);
        console.log(`Found ${newItems.length} new items.`);

        // 2. Scrape Upcoming
        const upcomingItems = await scrapeList(page, KINOLIGHTS_UPCOMING_URL);
        console.log(`Found ${upcomingItems.length} upcoming items.`);

        const allItems = [...newItems, ...upcomingItems];
        console.log(`Total raw items: ${allItems.length}`);

        // 3. Enrich with Details (Visit each link)
        const enrichedPerformances: OTTPerformance[] = [];
        const CONCURRENCY = 3; // Lower concurrency to be polite and avoid blocks

        for (let i = 0; i < allItems.length; i += CONCURRENCY) {
            const chunk = allItems.slice(i, i + CONCURRENCY);
            console.log(`Processing chunk ${Math.floor(i / CONCURRENCY) + 1}/${Math.ceil(allItems.length / CONCURRENCY)}...`);

            const promises = chunk.map(async (item) => {
                const newPage = await browser.newPage();
                await newPage.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1');
                await newPage.setViewport({ width: 390, height: 844 });

                try {
                    const link = item.link.startsWith('http') ? item.link : `https://m.kinolights.com${item.link}`;
                    // console.log(`Scraping detail: ${item.title} (${link})`);

                    await newPage.goto(link, { waitUntil: 'domcontentloaded', timeout: 30000 });

                    // Wait for metadata section
                    try {
                        await newPage.waitForSelector('#contents > div.info.tab-item', { timeout: 5000 });
                    } catch (e) {
                        // ignore
                    }

                    const details = await newPage.evaluate(() => {
                        const getText = (selector: string) => {
                            const el = document.querySelector(selector);
                            return el ? el.textContent?.trim() || '' : '';
                        };

                        // User provided selectors:
                        // Original Title: #contents > div.info.tab-item > section:nth-child(1) > ul > li:nth-child(1)
                        // Genre: li:nth-child(2)
                        // Grade: li:nth-child(7)
                        // Country: li:nth-child(8)
                        // Year: li:nth-child(9)

                        const baseSelector = '#contents > div.info.tab-item > section:nth-child(1) > ul';
                        const originalTitle = getText(`${baseSelector} > li:nth-child(1) .desc`) || getText(`${baseSelector} > li:nth-child(1)`);
                        const genre = getText(`${baseSelector} > li:nth-child(2) .desc`) || getText(`${baseSelector} > li:nth-child(2)`);
                        const grade = getText(`${baseSelector} > li:nth-child(7) .desc`) || getText(`${baseSelector} > li:nth-child(7)`);
                        const country = getText(`${baseSelector} > li:nth-child(8) .desc`) || getText(`${baseSelector} > li:nth-child(8)`);
                        const year = getText(`${baseSelector} > li:nth-child(9) .desc`) || getText(`${baseSelector} > li:nth-child(9)`);

                        return { originalTitle, genre, grade, country, year };
                    });

                    // Map platform from list item
                    let platform = mapPlatform(item.platformClass) || 'other';

                    // Create ID based on Title, Date, Platform
                    const uniqueId = `ott_${item.date.replace(/-/g, '')}_${item.title.replace(/\s+/g, '')}`;

                    return {
                        id: uniqueId,
                        title: item.title,
                        date: normalizeDate(item.dateRaw),
                        venue: 'OTT',
                        platforms: [platform],
                        image: item.poster || '/culture/images/placeholder.jpg',
                        link: link,
                        genre: 'ott', // This will be displayed as "Movie/Show" but mapped to OTT category
                        region: 'all',
                        grade: details.grade || item.grade,
                        movieInfo: details.genre, // Store genre in movieInfo for display parity
                        originalTitle: details.originalTitle,
                        productionCountry: details.country,
                        productionYear: details.year,
                        cast: [], // Could extract cast if needed, but user didn't explicitly ask for it here, kept simple
                        director: ''
                    } as OTTPerformance;

                } catch (e) {
                    console.error(`Failed to enrich ${item.title}:`, e);
                    // Fallback to basic info
                    const simplifiedId = `ott_${normalizeDate(item.dateRaw).replace(/-/g, '')}_${item.title.replace(/\s+/g, '')}`;
                    return {
                        id: simplifiedId,
                        title: item.title,
                        date: normalizeDate(item.dateRaw),
                        venue: 'OTT',
                        platforms: [mapPlatform(item.platformClass) || 'other'],
                        image: item.poster || '/culture/images/placeholder.jpg',
                        link: item.link.startsWith('http') ? item.link : `https://m.kinolights.com${item.link}`,
                        genre: 'ott',
                        region: 'all',
                        grade: item.grade
                    } as OTTPerformance;
                } finally {
                    await newPage.close();
                }
            });

            const results = await Promise.all(promises);
            enrichedPerformances.push(...results);
        }

        console.log(`Enriched ${enrichedPerformances.length} items.`);

        // 4. Save with Accumulation Logic
        let finalPerformances = enrichedPerformances;
        if (fs.existsSync(TARGET_FILE)) {
            try {
                const existingData = JSON.parse(fs.readFileSync(TARGET_FILE, 'utf-8')) as OTTPerformance[];
                console.log(`Loaded ${existingData.length} existing items.`);

                const itemMap = new Map<string, OTTPerformance>();
                existingData.forEach(item => itemMap.set(item.id, item));

                // Merge new items (Overwrite existing if ID matches to update details)
                performances.forEach(item => {
                    if (itemMap.has(item.id)) {
                        // Optional: Carefully merge fields if needed, but for now update is safe
                        // assuming scraper is source of truth for current state.
                        // However, we want to KEEP old items that are NOT in new scrape.
                        const existing = itemMap.get(item.id)!;
                        itemMap.set(item.id, { ...existing, ...item });
                    } else {
                        itemMap.set(item.id, item);
                    }
                });

                finalPerformances = Array.from(itemMap.values());
                console.log(`Merged into ${finalPerformances.length} total items.`);
            } catch (e) {
                console.error("Error reading existing file for merge, overwriting...", e);
            }
        }

        fs.writeFileSync(TARGET_FILE, JSON.stringify(finalPerformances, null, 2));
        console.log(`Saved ${finalPerformances.length} OTT performances to ${TARGET_FILE}`);

    } catch (err) {
        console.error('Error scraping OTT data:', err);
        process.exit(1);
    } finally {
        await browser.close();
    }
})();

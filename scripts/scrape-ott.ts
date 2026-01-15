
import { firefox } from 'playwright';
import fs from 'fs';
import path from 'path';

// --- Configuration ---
const KINO_LIST_URLS = [
    'https://m.kinolights.com/new',
    'https://m.kinolights.com/new?tab=upcoming'
];

interface OTTPerformance {
    id: string;
    title: string;
    date: string; // YYYY-MM-DD
    image: string;
    link: string;
    genre: string;
    platforms: string[];
    grade: string;
    director: string;
    cast: string[];
    originalTitle: string;
    productionCountry: string;
    productionYear: string;
    runningTime: string;
    detailDate: string;
    movieInfo: string;
    region: 'ott';
    venue: 'OTT';
}

// --- Helper Functions ---

function mapPlatform(nameOrClass: string): string | null {
    if (!nameOrClass) return null;
    const lower = nameOrClass.toLowerCase();
    if (lower.includes('netflix') || lower.includes('넷플릭스')) return 'netflix';
    if (lower.includes('disney') || lower.includes('디즈니')) return 'disney';
    if (lower.includes('wavve') || lower.includes('웨이브')) return 'wavve';
    if (lower.includes('tving') || lower.includes('티빙')) return 'tving';
    if (lower.includes('coupang') || lower.includes('쿠팡')) return 'coupang';
    if (lower.includes('apple') || lower.includes('애플')) return 'apple';
    if (lower.includes('watcha') || lower.includes('왓챠')) return 'watcha';
    if (lower.includes('laftel') || lower.includes('라프텔')) return 'laftel';
    if (lower.includes('amazon') || lower.includes('prime')) return 'amazon';
    if (lower.includes('u+') || lower.includes('uplus') || lower.includes('lgu')) return 'uplus';
    return null;
}

function drawProgressBar(current: number, total: number, width = 30) {
    const percentage = Math.round((current / total) * 100);
    const filled = Math.round((width * current) / total);
    const empty = width - filled;
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    process.stdout.write(`\r[${bar}] ${percentage}% (${current}/${total})`);
}

// --- Sub-Scrapers ---

async function scrapeKinoList(page: any): Promise<any[]> {
    const allItems: any[] = [];

    for (const url of KINO_LIST_URLS) {
        console.log(`[Kinolights] Navigating to list: ${url}`);
        try {
            const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
            if (response?.status() === 403) {
                console.error(`[Kinolights] Blocked (403) on ${url}.`);
                // Don't throw, just return what we have (or empty) so we can fallback to existing JSON
                continue;
            }
        } catch (e) {
            console.error(`[Kinolights] Error loading ${url}:`, e);
            continue;
        }

        // Scroll
        await page.evaluate(async () => {
            await new Promise<void>((resolve) => {
                let totalHeight = 0;
                const distance = 200;
                const timer = setInterval(() => {
                    const scrollHeight = document.body.scrollHeight;
                    window.scrollBy(0, distance);
                    totalHeight += distance;
                    if (totalHeight >= scrollHeight || totalHeight > 10000) {
                        clearInterval(timer);
                        resolve();
                    }
                }, 100);
            });
        });
        await page.waitForTimeout(2000);

        const items = await page.evaluate(() => {
            const results: any[] = [];
            const year = new Date().getFullYear();
            const contentWraps = document.querySelectorAll('.contents-wrap');
            let currentPlatformRaw = '';

            contentWraps.forEach(wrap => {
                const platformIcon = wrap.querySelector('.streaming-info .kino-icon');
                if (platformIcon) currentPlatformRaw = platformIcon.className;

                const headerTitle = wrap.querySelector('.streaming-info h3');
                const headerText = headerTitle ? headerTitle.textContent?.trim() || '' : '';
                let formattedDate = new Date().toISOString().split('T')[0];
                const dateMatch = headerText.match(/(\d{1,2})[./월]\s*(\d{1,2})/);
                if (dateMatch) {
                    const month = dateMatch[1].padStart(2, '0');
                    const day = dateMatch[2].padStart(2, '0');
                    formattedDate = `${year}-${month}-${day}`;
                }

                const cards = wrap.querySelectorAll('.MovieItem');
                cards.forEach(card => {
                    const titleEl = card.querySelector('.title, .name');
                    const posterEl = card.querySelector('.poster img, .responsive-image__image-container img');
                    const linkEl = card.querySelector('a.poster-container') || card.querySelector('a');

                    if (titleEl && posterEl) {
                        const title = titleEl.textContent?.trim() || '';
                        const image = posterEl.getAttribute('src') || posterEl.getAttribute('data-src') || '';
                        const link = linkEl ? linkEl.getAttribute('href') : '';

                        const platforms: string[] = [];
                        const pLower = currentPlatformRaw.toLowerCase();
                        if (pLower.includes('netflix')) platforms.push('netflix');
                        else if (pLower.includes('disney')) platforms.push('disney');
                        else if (pLower.includes('wavve')) platforms.push('wavve');
                        else if (pLower.includes('tving')) platforms.push('tving');
                        else if (pLower.includes('coupang')) platforms.push('coupang');
                        else if (pLower.includes('apple')) platforms.push('apple');
                        else if (pLower.includes('watcha')) platforms.push('watcha');

                        results.push({
                            title,
                            date: formattedDate,
                            image,
                            link: link && link.startsWith('http') ? link : `https://m.kinolights.com${link || ''}`,
                            genre: 'ott',
                            platforms: platforms,
                            id: ''
                        });
                    }
                });
            });
            return results;
        });

        console.log(`[Kinolights] Found ${items.length} items on ${url}`);
        allItems.push(...items);
    }
    return allItems;
}

async function enrichWithNaver(page: any, item: any) {
    const queries = [
        `영화 ${item.title} 정보`,
        `${item.title} 정보`,
        `${item.title} 드라마 정보`,
        // `방송 ${item.title} 정보` // Removed broadcast specific prefix as it often targets different component
    ];

    for (const query of queries) {
        try {
            await page.goto(`https://search.naver.com/search.naver?query=${encodeURIComponent(query)}`, { waitUntil: 'domcontentloaded', timeout: 8000 });

            // Check for info box
            const hasInfo = await page.evaluate(() => {
                return !!(document.querySelector('.cm_content_area') || document.querySelector('.cs_common_module'));
            });

            if (!hasInfo) continue;

            const data = await page.evaluate(() => {
                const res: any = {};
                function clean(t: string) { return (t || '').trim(); }

                const infoGroups = document.querySelectorAll('.info_group');
                infoGroups.forEach(group => {
                    const dt = group.querySelector('dt');
                    const dd = group.querySelector('dd');
                    if (dt && dd) {
                        const label = dt.textContent || '';
                        const value = dd.textContent || '';

                        if (label.includes('감독')) res.director = clean(value);
                        if (label.includes('출연') || label.includes('출연진')) {
                            res.cast = value.split(',').map(s => s.trim()).slice(0, 5);
                        }
                        if (label.includes('제작진')) {
                            if (!res.director) {
                                const parts = value.split(',').map(s => s.trim());
                                // Look for (연출), (감독)
                                const directorPart = parts.find(p => p.includes('연출') || p.includes('감독'));
                                if (directorPart) {
                                    res.director = clean(directorPart.split('(')[0]);
                                } else if (parts.length > 0) {
                                    // Fallback: take first person
                                    res.director = clean(parts[0]);
                                }
                            }
                        }

                        if (label.includes('장르')) res.genre = clean(value);
                        if (label.includes('등급')) res.grade = clean(value);
                        if (label.includes('국가')) res.productionCountry = clean(value);
                        if (label.includes('러닝타임')) res.runningTime = clean(value);
                        if (label.includes('개봉') || label.includes('방영') || label.includes('편성')) res.detailDate = clean(value);
                        if (label.includes('원제')) res.originalTitle = clean(value);
                    }
                });
                return res;
            });

            if (data.director || data.cast || data.genre) {
                return data;
            }

        } catch (e) {
            // ignore
        }
    }
    return {};
}

// --- Main Execution ---

async function runHybridScraper() {
    console.log('Starting Hybrid OTT Scraper (Resilient Mode)...');

    // Attempt Headless: false for stealth, 
    // but in CI/Cloud this might fail if no display. 
    // Agent environment usually supports headless: false via virtual display or xvfb implicit in Playwright? 
    // If it fails with "no display", we must switch to headless: true.
    // Let's try headless: true first for stability in cloud, relying on UA and Firefox to bypass.
    // User requested "Local" execution for bypass, but now "Git context" which implies cloud.
    // Changing to headless: true to avoid launch errors, but Firefox engine.

    const browser = await firefox.launch({ headless: true });

    // 1. Scrape List from Kinolights (Best Effort)
    let basicItems: any[] = [];
    try {
        const contextKino = await browser.newContext({
            viewport: { width: 390, height: 844 },
            userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
            locale: 'ko-KR'
        });
        const pageKino = await contextKino.newPage();
        basicItems = await scrapeKinoList(pageKino);
        await contextKino.close();
    } catch (e) {
        console.error('Failed to scrape Kinolights list:', e);
    }

    // 2. Load Existing Data
    const jsonPath = path.resolve(process.cwd(), 'src/data/ott.json');
    let existingData: any[] = [];
    if (fs.existsSync(jsonPath)) {
        try { existingData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8')); } catch (e) { }
    }

    // 3. Merge Strategies
    // If basicItems is empty (blocked), we ONLY use existingData.
    // If basicItems has data, we merge.

    if (basicItems.length === 0) {
        console.log('Kinolights list blocked or empty. Proceeding with existing data enrichment only.');
        // We will assume existingData is our working set
    } else {
        // Merge Logic
        const uniqueMap = new Map();
        // Prefer new items for "Availability", but keep old items for "Metadata"
        basicItems.forEach(i => uniqueMap.set(i.link, i));

        // Ensure we don't lose old items that might just be temporarily off the "New" list
        // Actually, ott.json seems to accumulate history.
        existingData.forEach(ex => {
            const key = ex.link || ex.id;
            if (uniqueMap.has(key)) {
                // Merge: Keep existing metadata if valid
                const newItem = uniqueMap.get(key);
                if (ex.director && !newItem.director) {
                    uniqueMap.set(key, { ...newItem, ...ex });
                }
            } else {
                // Old item not in new list. Keep it.
                uniqueMap.set(key, ex);
            }
        });
        existingData = Array.from(uniqueMap.values());
    }

    // 4. Identify Enrichment Targets
    // Target: Items with title but MISSING director/cast
    const needyItems = existingData.filter(item => {
        const missingDirector = !item.director || item.director === '';
        const missingCast = !item.cast || item.cast.length === 0;
        return item.title && (missingDirector || missingCast);
    });

    console.log(`\nTotal items: ${existingData.length}`);
    console.log(`Items requiring enrichment: ${needyItems.length}`);

    if (needyItems.length === 0) {
        console.log('No items need enrichment.');
        await browser.close();
        return;
    }

    // 5. Enrich Loop
    const contextNaver = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1280, height: 800 }
    });
    const pageNaver = await contextNaver.newPage();

    console.log('\nStarting Enrichment (Naver Search)...');

    // Sort needy items by date desc to prioritize recent ones? Or just process all.
    // Let's process closest to today first?
    // needyItems.sort((a, b) => b.date.localeCompare(a.date));

    // Limit batch size? No, user said "collect as much as possible".
    // But we should save periodically.

    const CHUNK_SIZE = 10;

    for (let i = 0; i < needyItems.length; i++) {
        const item = needyItems[i];

        // Progress Bar
        drawProgressBar(i + 1, needyItems.length);

        try {
            await pageNaver.waitForTimeout(500 + Math.random() * 1000); // Faster checks
            const metadata = await enrichWithNaver(pageNaver, item);

            if (metadata.director || metadata.genre) {
                // Update the REFERENCE object in existingData array
                Object.assign(item, metadata);

                if (!Array.isArray(item.cast) && typeof item.cast === 'string') {
                    // @ts-ignore
                    item.cast = [item.cast];
                }
                item.movieInfo = [item.genre, item.runningTime].filter(Boolean).join(' / ');
            }

        } catch (e) {
            // console.error(`Failed: ${item.title}`);
        }

        // Save periodically
        if (i % CHUNK_SIZE === 0 || i === needyItems.length - 1) {
            finalizeAndSave(existingData, jsonPath);
        }
    }
    process.stdout.write('\n'); // End progress bar line

    await browser.close();
    console.log('Scraping Completed.');
}

function finalizeAndSave(items: any[], path: string) {
    // Generate IDs and map fields
    const final = items.map(item => {
        if (!item.id) {
            const dateStr = item.date ? item.date.replace(/-/g, '') : '00000000';
            const titleStr = item.title ? item.title.replace(/[\s\W]/g, '') : 'unknown';
            item.id = `ott_${dateStr}_${titleStr}`;
        }

        if (item.platforms && item.platforms.length > 0) {
            item.platforms = item.platforms.map((p: string) => mapPlatform(p)).filter(Boolean);
            item.platforms = [...new Set(item.platforms)];
        }

        item.region = 'ott';
        item.venue = 'OTT';
        item.cast = item.cast || [];
        item.director = item.director || '';

        return item;
    });

    fs.writeFileSync(path, JSON.stringify(final, null, 2));
    // console.log(`  Saved ${final.length} items`);
}

runHybridScraper();

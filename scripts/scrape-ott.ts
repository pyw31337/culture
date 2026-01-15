
import { firefox } from 'playwright';
import fs from 'fs';
import path from 'path';

// JustWatch New/New Timeline
const TARGET_URL = 'https://www.justwatch.com/kr/new';

// Supported Platforms Allowlist
const SUPPORTED_PLATFORMS = ['Netflix', 'Disney Plus', 'wavve', 'TVING', 'Watcha', 'Coupang Play', 'Amazon Prime Video', 'Apple TV Plus', 'Apple TV', 'Naver Store', 'Google Play Movies'];

async function scrapeJustWatch() {
    console.log('Starting JustWatch Scraper (v5.0 - Aggregation & Localization)...');

    const browser = await firefox.launch({ headless: true });
    const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    const page = await context.newPage();

    try {
        await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });

        // Scroll
        for (let i = 0; i < 5; i++) {
            await page.mouse.wheel(0, 1500);
            await page.waitForTimeout(1000);
        }

        const rawItems = await page.evaluate(() => {
            const results: any[] = [];
            const timeframes = document.querySelectorAll('.timeline__timeframe');

            timeframes.forEach(frame => {
                let dateStr = '';
                frame.classList.forEach(c => {
                    if (c.startsWith('timeline__timeframe--') && c.match(/\d{4}-\d{2}-\d{2}/)) {
                        const match = c.match(/(\d{4}-\d{2}-\d{2})/);
                        if (match) dateStr = match[1];
                    }
                });

                const providerBlocks = frame.querySelectorAll('.timeline__provider-block');

                providerBlocks.forEach(block => {
                    // Extract Provider
                    let blockProvider = '';
                    block.classList.forEach(c => {
                        if (c.includes('--nfx')) blockProvider = 'Netflix';
                        if (c.includes('--dnp')) blockProvider = 'Disney Plus';
                        if (c.includes('--wav')) blockProvider = 'wavve';
                        if (c.includes('--tvk')) blockProvider = 'TVING';
                        if (c.includes('--nfa')) blockProvider = 'Netflix';
                        if (c.includes('--atp')) blockProvider = 'Apple TV Plus';
                        if (c.includes('--wac')) blockProvider = 'Watcha';
                        if (c.includes('--cpn')) blockProvider = 'Coupang Play';
                        if (c.includes('--amp')) blockProvider = 'Amazon Prime Video';
                    });

                    if (!blockProvider) {
                        const icon = block.querySelector('.timeline__provider-block__icon') || block.querySelector(':scope > img');
                        if (icon) {
                            blockProvider = icon.getAttribute('alt') || icon.getAttribute('title') || '';
                        }
                    }

                    const cards = block.querySelectorAll('.horizontal-title-list__item');
                    cards.forEach(card => {
                        const anchor = card.querySelector('a');
                        const img = card.querySelector('img');

                        if (anchor) {
                            const link = anchor.getAttribute('href') || '';
                            // Robust Image Extraction
                            let image = '';
                            if (img) {
                                image = img.getAttribute('src') || img.getAttribute('data-src') || '';
                            } else {
                                const source = card.querySelector('source');
                                image = source?.getAttribute('srcset')?.split(',')[0]?.split(' ')[0] || '';
                            }

                            const title = img?.getAttribute('alt') || anchor.textContent?.trim() || '';

                            const platforms: string[] = [];
                            if (blockProvider) platforms.push(blockProvider);

                            // Check item-specific icons (sometimes mixed in block)
                            const itemIcons = card.querySelectorAll('.monetization-icon img');
                            itemIcons.forEach(icon => {
                                const alt = icon.getAttribute('alt') || icon.getAttribute('title');
                                if (alt && !platforms.includes(alt)) platforms.push(alt);
                            });

                            if (title) {
                                results.push({
                                    title,
                                    date: dateStr,
                                    image,
                                    link: `https://www.justwatch.com${link}`,
                                    platforms: platforms,
                                    genre: 'ott',
                                    originalTitle: title,
                                    id: ''
                                });
                            }
                        }
                    });
                });
            });
            return results;
        });

        // --- Aggregation Step ---
        const aggregatedMap = new Map<string, any>();
        const normalizeTitle = (t: string) => t.replace(/\s+/g, '').toLowerCase();

        rawItems.forEach(item => {
            const key = normalizeTitle(item.title);
            if (aggregatedMap.has(key)) {
                const existing = aggregatedMap.get(key);
                // Merge platforms
                item.platforms.forEach((p: string) => {
                    if (!existing.platforms.includes(p)) existing.platforms.push(p);
                });
                // Keep earliest date? JustWatch usually sorts new... let's keep the one we have or update if newer?
                // JustWatch 'New' is accurate per day.
            } else {
                aggregatedMap.set(key, item);
            }
        });

        const aggregatedItems = Array.from(aggregatedMap.values());
        console.log(`Aggregated ${aggregatedItems.length} unique items from ${rawItems.length} raw entries.`);

        const platformMap: Record<string, string> = {
            'Netflix': 'netflix',
            'Disney Plus': 'disney',
            'wavve': 'wavve',
            'Watcha': 'watcha',
            'Amazon Prime Video': 'amazon',
            'Prime Video': 'amazon',
            'Coupang Play': 'coupang',
            'TVING': 'tving',
            'Apple TV Plus': 'apple',
            'Apple TV': 'apple',
            'Naver Store': 'naver',
            'Google Play Movies': 'google'
        };

        const finalItems = [];

        // Enrichment
        let count = 0;
        const LIMIT = 50;

        for (const item of aggregatedItems) {
            // 1. Filter Platforms
            const mappedPlatforms = item.platforms.map((p: string) => {
                // Check allowlist (Original String check)
                const isSupported = SUPPORTED_PLATFORMS.some(sp => p.toLowerCase().includes(sp.toLowerCase()));
                if (!isSupported) return null;

                // Map to internal key
                for (const key in platformMap) {
                    if (p.toLowerCase().includes(key.toLowerCase())) return platformMap[key];
                }
                return null;
            }).filter(Boolean);

            const uniquePlatforms = [...new Set(mappedPlatforms)];
            if (uniquePlatforms.length === 0) continue; // Skip unsupported

            item.platforms = uniquePlatforms;
            item.region = 'ott';
            item.venue = 'OTT';

            // 2. Limit detail visits
            if (count < LIMIT) {
                count++;
                process.stdout.write(`Enriching ${count}/${Math.min(aggregatedItems.length, LIMIT)}: ${item.title}... `);

                try {
                    const p = await context.newPage();
                    await p.goto(item.link, { waitUntil: 'domcontentloaded' });

                    // Metadata Extraction: Prefer DOM for Korean text
                    const domData = await p.evaluate(() => {
                        const res: any = {};

                        // Detail Infos Block
                        const headings = document.querySelectorAll('.detail-infos__heading');
                        headings.forEach(h => {
                            const key = h.textContent?.trim();
                            const valNode = h.nextElementSibling;
                            const val = valNode?.textContent?.trim();

                            if (key?.includes('재생 시간') || key?.includes('Runtime')) res.runningTime = val;
                            if (key?.includes('원제') || key?.includes('Original title')) res.originalTitle = val;
                            if (key?.includes('제작 국가') || key?.includes('Production country')) res.productionCountry = val;
                        });

                        // Credits (Director/Cast) - often in a separate section
                        // JustWatch class names vary, but usually title-credits__actor
                        const directors: string[] = [];
                        const casts: string[] = [];

                        // Look for sections
                        // Trying to find generic credit headers
                        const sections = document.querySelectorAll('.title-credits__header');
                        sections.forEach(sec => {
                            const title = sec.textContent?.trim();
                            if (title === '감독') {
                                // siblings until next header?
                                // usually followed by .title-credits__actor
                                let next = sec.nextElementSibling;
                                while (next && next.classList.contains('title-credits__actor')) {
                                    directors.push(next.querySelector('.title-credits__actor-name')?.textContent?.trim() || '');
                                    next = next.nextElementSibling;
                                }
                            }
                            if (title === '출연') {
                                let next = sec.nextElementSibling;
                                while (next && next.classList.contains('title-credits__actor')) {
                                    casts.push(next.querySelector('.title-credits__actor-name')?.textContent?.trim() || '');
                                    next = next.nextElementSibling;
                                }
                            }
                        });

                        // Fallback: JSON-LD might be needed if DOM structure changes
                        return { ...res, directors, casts };
                    });

                    // JSON-LD backup
                    const jsonLdData = await p.evaluate(() => {
                        const scripts = document.querySelectorAll('script[type="application/ld+json"]');
                        for (const script of scripts) {
                            try {
                                const json = JSON.parse(script.textContent || '{}');
                                if (['Movie', 'TVSeries', 'TVSeason'].includes(json['@type'])) return json;
                            } catch (e) { }
                        }
                        return null;
                    });

                    if (jsonLdData) {
                        // Genre
                        if (jsonLdData.genre) item.subGenre = Array.isArray(jsonLdData.genre) ? jsonLdData.genre.join(', ') : jsonLdData.genre;

                        // Year
                        if (jsonLdData.dateCreated || jsonLdData.datePublished) item.productionYear = (jsonLdData.dateCreated || jsonLdData.datePublished).substring(0, 4);

                        // Description
                        if (jsonLdData.description) item.movieInfo = jsonLdData.description;

                        // Rating
                        if (jsonLdData.contentRating) item.ageRating = jsonLdData.contentRating; // Expecting "15", "18", "All" etc.
                        if (item.ageRating === 'OTT') item.ageRating = ''; // Fix garbage data user reported

                        // Merge DOM data (Prioritize DOM for Director/Cast to get Korean)
                        if (domData.directors && domData.directors.length > 0) item.director = domData.directors.join(', ');
                        else if (jsonLdData.director) {
                            // Fallback to JSON-LD
                            if (Array.isArray(jsonLdData.director)) item.director = jsonLdData.director.map((d: any) => d.name).join(', ');
                            else item.director = jsonLdData.director.name;
                        }

                        if (domData.casts && domData.casts.length > 0) item.cast = domData.casts; // Already array
                        else if (jsonLdData.actor) {
                            if (Array.isArray(jsonLdData.actor)) {
                                item.cast = jsonLdData.actor.map((a: any) => {
                                    if (a['@type'] === 'Person') return a.name;
                                    if (a['@type'] === 'PerformanceRole' && a.actor) return a.actor.name;
                                    return null;
                                }).filter(Boolean);
                            }
                        }

                        // Others
                        if (domData.runningTime) item.runningTime = domData.runningTime;
                        if (domData.productionCountry) item.productionCountry = domData.productionCountry;
                        if (domData.originalTitle) item.originalTitle = domData.originalTitle;
                    }
                    process.stdout.write('Done\n');
                    await p.close();

                } catch (e) {
                    process.stdout.write('Skip (Error)\n');
                }
            }

            // Final ID
            const dateStr = item.date ? item.date.replace(/-/g, '') : '00000000';
            const titleStr = item.title ? item.title.replace(/\s+/g, '').replace(/[^\w\uAC00-\uD7A3]/g, '') : 'unknown';
            const finalTitleStr = titleStr || Math.random().toString(36).substring(7);
            item.id = `ott_${dateStr}_${finalTitleStr}`;

            finalItems.push(item);
        }

        const jsonPath = path.resolve(process.cwd(), 'src/data/ott.json');
        fs.writeFileSync(jsonPath, JSON.stringify(finalItems, null, 2));
        console.log(`\nSaved ${finalItems.length} items to ${jsonPath}`);
    } catch (e) {
        console.error(e);
    } finally {
        await browser.close();
    }
}

scrapeJustWatch();

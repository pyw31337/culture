
import { firefox } from 'playwright';
import fs from 'fs';
import path from 'path';

// JustWatch New/New Timeline
const TARGET_URL = 'https://www.justwatch.com/kr/new';

async function scrapeJustWatch() {
    console.log('Starting JustWatch Scraper (v4.1 - JSON-LD & Block Parsing)...');

    const browser = await firefox.launch({ headless: true });

    // Mobile viewport to ensure "App-like" behavior if needed, but Desktop is fine for JustWatch
    const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    const page = await context.newPage();

    try {
        await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });

        // Scroll to load content
        for (let i = 0; i < 5; i++) {
            await page.mouse.wheel(0, 1500);
            await page.waitForTimeout(1000);
        }

        const items = await page.evaluate(() => {
            const results: any[] = [];
            const timeframes = document.querySelectorAll('.timeline__timeframe');

            timeframes.forEach(frame => {
                // 1. Extract Date
                let dateStr = '';
                frame.classList.forEach(c => {
                    if (c.startsWith('timeline__timeframe--') && c.match(/\d{4}-\d{2}-\d{2}/)) {
                        const match = c.match(/(\d{4}-\d{2}-\d{2})/);
                        if (match) dateStr = match[1];
                    }
                });

                // 2. Iterate Provider Blocks
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

                    // 3. Find Items
                    const cards = block.querySelectorAll('.horizontal-title-list__item');
                    cards.forEach(card => {
                        const anchor = card.querySelector('a');
                        const img = card.querySelector('img');

                        if (anchor) {
                            const link = anchor.getAttribute('href') || '';
                            const title = img?.getAttribute('alt') || '';
                            const image = img?.getAttribute('src') || img?.getAttribute('data-src') || '';

                            const platforms: string[] = [];
                            if (blockProvider) platforms.push(blockProvider);

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
                                    originalTitle: title, // temp
                                    id: ''
                                });
                            }
                        }
                    });
                });
            });
            return results;
        });

        console.log(`Found ${items.length} items from JustWatch.`);

        // --- Detailed Enrichment (Visit 40 items) ---
        const detailedItems = [];
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

        for (let i = 0; i < items.length; i++) {
            const item = items[i];

            // Map platforms
            const mapped = item.platforms.map((p: string) => {
                for (const key in platformMap) {
                    if (p.toLowerCase().includes(key.toLowerCase())) return platformMap[key];
                }
                return null;
            }).filter(Boolean);
            item.platforms = [...new Set(mapped)];
            item.region = 'ott';
            item.venue = 'OTT';

            // Visit Detail Page for Metadata (Limit to 40)
            if (i < 40) {
                process.stdout.write(`Enriching ${i + 1}/${items.length}: ${item.title}... `);
                try {
                    const p = await context.newPage();
                    await p.goto(item.link, { waitUntil: 'domcontentloaded' });

                    // JSON-LD Extraction Strategy
                    const jsonLdData = await p.evaluate(() => {
                        const scripts = document.querySelectorAll('script[type="application/ld+json"]');
                        for (const script of scripts) {
                            try {
                                const json = JSON.parse(script.textContent || '{}');
                                // Look for Movie, TVSeries, TVEpisode, or TVSeason
                                // JustWatch usually wraps them or provides the main entity
                                if (json['@type'] === 'Movie' || json['@type'] === 'TVSeries' || json['@type'] === 'TVSeason') {
                                    return json;
                                }
                            } catch (e) { }
                        }
                        return null;
                    });

                    if (jsonLdData) {
                        const extract = (data: any) => {
                            const res: any = {};

                            // Director
                            if (data.director) {
                                if (Array.isArray(data.director)) {
                                    res.director = data.director.map((d: any) => d.name).join(', ');
                                } else {
                                    res.director = data.director.name;
                                }
                            }

                            // Actor/Cast (Fixed for PerformanceRole)
                            if (data.actor) {
                                if (Array.isArray(data.actor)) {
                                    res.cast = data.actor.map((a: any) => {
                                        if (a['@type'] === 'Person') return a.name;
                                        if (a['@type'] === 'PerformanceRole' && a.actor) return a.actor.name;
                                        return null;
                                    }).filter((n: any) => n);
                                }
                            }

                            // Genre
                            if (data.genre) {
                                res.subGenre = Array.isArray(data.genre) ? data.genre.join(', ') : data.genre;
                            }

                            // Country
                            if (data.countryOfOrigin) {
                                res.productionCountry = typeof data.countryOfOrigin === 'string' ? data.countryOfOrigin : data.countryOfOrigin.name;
                            }

                            // Date/Year
                            if (data.dateCreated || data.datePublished) {
                                res.productionYear = (data.dateCreated || data.datePublished).substring(0, 4);
                            }

                            // Description
                            if (data.description) res.movieInfo = data.description;

                            return res;
                        };

                        const extracted = extract(jsonLdData);
                        Object.assign(item, extracted);

                        // Clean up Duration from ISO if needed or try DOM
                        // Let's do a hybrid check for runtime from DOM (reliable fallback)
                        const domRuntime = await p.evaluate(() => {
                            // Look for the "Runtime" text in the details list
                            const nodes = document.querySelectorAll('.detail-infos__heading');
                            for (const node of nodes) {
                                if (node.textContent?.includes('재생 시간') || node.textContent?.includes('Runtime') || node.textContent?.includes('러닝타임')) {
                                    return node.nextElementSibling?.textContent?.trim();
                                }
                            }
                            return null;
                        });
                        if (domRuntime) item.runningTime = domRuntime;
                    }

                    process.stdout.write('Done (JSON-LD)\n');
                    await p.close();
                } catch (e) {
                    process.stdout.write('Skip (Error)\n');
                }
            }

            // ID Gen
            const dateStr = item.date ? item.date.replace(/-/g, '') : '00000000';
            const titleStr = item.title ? item.title.replace(/\s+/g, '').replace(/[^\w\uAC00-\uD7A3]/g, '') : 'unknown';
            const finalTitleStr = titleStr || Math.random().toString(36).substring(7);

            item.id = `ott_${dateStr}_${finalTitleStr}`;

            detailedItems.push(item);
        }

        const jsonPath = path.resolve(process.cwd(), 'src/data/ott.json');
        fs.writeFileSync(jsonPath, JSON.stringify(detailedItems, null, 2));
        console.log(`\nSaved ${detailedItems.length} items to ${jsonPath}`);

    } catch (e) {
        console.error(e);
    } finally {
        await browser.close();
    }
}

scrapeJustWatch();

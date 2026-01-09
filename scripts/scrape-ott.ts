import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';
import path from 'path';

puppeteer.use(StealthPlugin());

interface OTTPerformance {
    id: string;
    title: string;
    date: string; // YYYY-MM-DD format
    image: string;
    link: string;
    genre: 'ott';
    platform?: string; // e.g., 'netflix', 'disney', 'coupang'
    platforms?: string[]; // Array of platform IDs
    region: 'ott';
}

const TARGET_URLS = [
    'https://m.kinolights.com/new',
    'https://m.kinolights.com/new?tab=upcoming'
];

// Helper to map Korean platform names or classes to IDs
function mapPlatform(nameOrClass: string): string | null {
    const lower = nameOrClass.toLowerCase();
    if (lower.includes('netflix') || lower.includes('넷플릭스')) return 'netflix';
    if (lower.includes('disney') || lower.includes('디즈니')) return 'disney';
    if (lower.includes('wavve') || lower.includes('웨이브')) return 'wavve';
    if (lower.includes('tving') || lower.includes('티빙')) return 'tving';
    if (lower.includes('coupang') || lower.includes('쿠팡')) return 'coupang';
    if (lower.includes('apple') || lower.includes('애플')) return 'apple';
    if (lower.includes('watcha') || lower.includes('왓챠')) return 'watcha';
    return null;
}

async function autoScroll(page: any) {
    await page.evaluate(async () => {
        await new Promise<void>((resolve) => {
            let totalHeight = 0;
            const distance = 100;
            const timer = setInterval(() => {
                const scrollHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;

                // Stop scrolling if we've reached the bottom or a limit
                // Just scroll for a bit to trigger lazy loads
                if (totalHeight >= scrollHeight || totalHeight > 15000) {
                    clearInterval(timer);
                    resolve();
                }
            }, 100);
        });
    });
}

async function scrapeOTT() {
    console.log('Starting OTT Scraper (Kinolights)...');

    // Launch browser
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 390, height: 844 }); // iPhone 12 Viewport

        let allBasicItems: any[] = [];

        for (const url of TARGET_URLS) {
            console.log(`Navigating to ${url}...`);
            await page.goto(url, { waitUntil: 'networkidle2' });

            // Scroll to load more content
            console.log('Scrolling to load more content...');
            await autoScroll(page);
            await new Promise(r => setTimeout(r, 2000)); // Wait for lazy load

            // Wait for content
            await page.waitForSelector('body', { timeout: 10000 });

            // 1. Scrape Basic List (with correct Platforms)
            const items = await page.evaluate(() => {
                const results: any[] = [];
                const year = new Date().getFullYear();

                const contentWraps = document.querySelectorAll('.contents-wrap');
                let currentPlatformRaw = '';

                contentWraps.forEach(wrap => {
                    // Check if this wrap has a platform icon (Header Wrap)
                    const platformIcon = wrap.querySelector('.streaming-info .kino-icon');
                    if (platformIcon) {
                        currentPlatformRaw = platformIcon.className; // Update context
                    }

                    // Extract Date/Header (just in case it's a header wrap)
                    const headerTitle = wrap.querySelector('.streaming-info h3');
                    const headerText = headerTitle ? headerTitle.textContent?.trim() || '' : '';

                    // Default date logic
                    let formattedDate = new Date().toISOString().split('T')[0];
                    const dateMatch = headerText.match(/(\d{1,2})[./월]\s*(\d{1,2})/);
                    if (dateMatch) {
                        const month = dateMatch[1].padStart(2, '0');
                        const day = dateMatch[2].padStart(2, '0');
                        formattedDate = `${year}-${month}-${day}`;
                    }

                    // Extract Items (if any)
                    const cards = wrap.querySelectorAll('.MovieItem');
                    cards.forEach(card => {
                        const titleEl = card.querySelector('.title, .name');
                        const posterEl = card.querySelector('.poster img, .responsive-image__image-container img');
                        const linkEl = card.querySelector('a.poster-container') || card.querySelector('a');

                        if (titleEl && posterEl) {
                            const title = titleEl.textContent?.trim() || '';
                            const image = posterEl.getAttribute('src') || posterEl.getAttribute('data-src') || '';
                            const link = linkEl ? linkEl.getAttribute('href') : '';

                            // Platform logic: Use current context
                            const platforms: string[] = [];
                            if (currentPlatformRaw.includes('netflix')) platforms.push('netflix');
                            else if (currentPlatformRaw.includes('disney')) platforms.push('disney');
                            else if (currentPlatformRaw.includes('wavve')) platforms.push('wavve');
                            else if (currentPlatformRaw.includes('tving')) platforms.push('tving');
                            else if (currentPlatformRaw.includes('coupang')) platforms.push('coupang');
                            else if (currentPlatformRaw.includes('apple')) platforms.push('apple');
                            else if (currentPlatformRaw.includes('watcha')) platforms.push('watcha');

                            // Push item
                            results.push({
                                title,
                                date: formattedDate,
                                image,
                                link: link && link.startsWith('http') ? link : `https://m.kinolights.com${link || ''}`,
                                genre: 'ott',
                                platforms: platforms,
                                region: 'ott',
                                venue: 'OTT',
                                id: '' // Will be generated
                            });
                        }
                    });
                });
                return results;
            });

            console.log(`Found ${items.length} items from ${url}`);
            allBasicItems = [...allBasicItems, ...items];
        }

        console.log(`Total items found before deduplication: ${allBasicItems.length}`);

        // Deduplication
        const uniqueItemsMap = new Map();
        allBasicItems.forEach(item => {
            const key = `${item.title}_${item.date}`;
            if (!uniqueItemsMap.has(key)) {
                uniqueItemsMap.set(key, item);
            } else {
                // Merge platforms if same item exists
                const existing = uniqueItemsMap.get(key);
                const mergedPlatforms = Array.from(new Set([...existing.platforms, ...item.platforms]));
                uniqueItemsMap.set(key, { ...existing, platforms: mergedPlatforms });
            }
        });
        const basicItems = Array.from(uniqueItemsMap.values());
        console.log(`Unique items to process: ${basicItems.length}`);

        // 2. Enrich with Details (Director, Cast, Runtime, Grade, Genre)
        const enrichedItems: any[] = [];
        const CONCURRENCY = 5;

        // Chunk array for parallel processing
        for (let i = 0; i < basicItems.length; i += CONCURRENCY) {
            const chunk = basicItems.slice(i, i + CONCURRENCY);
            console.log(`Processing chunk ${Math.floor(i / CONCURRENCY) + 1}/${Math.ceil(basicItems.length / CONCURRENCY)}...`);

            const promises = chunk.map(async (item) => {
                const newPage = await browser.newPage();
                // Set User-Agent for each page
                await newPage.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1');
                await newPage.setViewport({ width: 390, height: 844 });

                try {
                    // console.log(`Enriching: ${item.title}`);
                    await newPage.goto(item.link, { waitUntil: 'domcontentloaded', timeout: 20000 });

                    try {
                        await newPage.waitForSelector('.metadata__item', { timeout: 3000 });
                    } catch (e) {
                        // Ignore
                    }

                    const details = await newPage.evaluate(() => {
                        const cleanText = (text: string) => text.replace(/\s+/g, ' ').trim();

                        // Helper to find value by label in metadata list
                        const getMetadataValue = (labelKeywords: string[]) => {
                            const items = Array.from(document.querySelectorAll('.metadata__item'));
                            for (const item of items) {
                                const titleEl = item.querySelector('.item__title');
                                if (titleEl) {
                                    const titleText = cleanText(titleEl.textContent || '');
                                    if (labelKeywords.some(k => titleText.includes(k))) {
                                        const fullText = cleanText(item.textContent || '');
                                        return fullText.replace(titleText, '').trim();
                                    }
                                }
                            }
                            return '';
                        };

                        const getDirector = () => {
                            const staffs = Array.from(document.querySelectorAll('.staff'));
                            for (const staff of staffs) {
                                const titleEl = staff.querySelector('.staff__title');
                                if (titleEl && cleanText(titleEl.textContent || '').includes('감독')) {
                                    const nameEl = staff.querySelector('.names__name');
                                    return nameEl ? cleanText(nameEl.textContent || '') : '';
                                }
                            }
                            return '';
                        };

                        const getCast = () => {
                            const actors = Array.from(document.querySelectorAll('[id^="actorList-"] .name'));
                            return actors.slice(0, 5).map(el => cleanText(el.textContent || '')).filter(Boolean);
                        };

                        const genre = getMetadataValue(['장르']);
                        const runtime = getMetadataValue(['러닝타임']);
                        const date = getMetadataValue(['방영일', '개봉일']);
                        const grade = getMetadataValue(['연령등급']);

                        return {
                            movieInfo: [genre, runtime].filter(Boolean).join(' / '),
                            grade: grade,
                            director: getDirector(),
                            cast: getCast(),
                            detailDate: date
                        };
                    });

                    let finalDate = item.date;
                    if (details.detailDate) {
                        const match = details.detailDate.match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
                        if (match) {
                            finalDate = `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
                        }
                    }

                    return {
                        ...item,
                        ...details,
                        date: finalDate,
                    };

                } catch (e) {
                    console.error(`Failed to enrich ${item.title}:`, e);
                    return item; // Return basic item on failure
                } finally {
                    await newPage.close();
                }
            });

            const results = await Promise.all(promises);
            enrichedItems.push(...results);
        }


        // Post-process items
        const processedItems: OTTPerformance[] = enrichedItems.map((p: any) => {
            const mappedPlatforms = p.platforms.map((raw: string) => mapPlatform(raw)).filter((Boolean) as any as (x: any) => x is string);
            const uniquePlatforms = Array.from(new Set(mappedPlatforms)) as string[];

            return {
                ...p,
                id: `ott_${p.date.replace(/-/g, '')}_${p.title.replace(/\s/g, '')}`,
                platforms: uniquePlatforms
            };
        });

        console.log(`Scraped ${processedItems.length} items with details.`);

        // Save
        const outputPath = path.resolve(process.cwd(), 'src/data/ott.json');
        fs.writeFileSync(outputPath, JSON.stringify(processedItems, null, 2));
        console.log(`Saved to ${outputPath}`);

    } catch (error) {
        console.error('Error in OTT Scraper:', error);
    } finally {
        await browser.close();
    }
}

scrapeOTT();

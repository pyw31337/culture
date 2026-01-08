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

        // Process in chunks to avoid overwhelming but let's do sequential for safety first, or small concurrency
        for (let i = 0; i < basicItems.length; i++) {
            const item = basicItems[i];
            console.log(`[${i + 1}/${basicItems.length}] Enriching: ${item.title}`);

            try {
                await page.goto(item.link, { waitUntil: 'domcontentloaded', timeout: 15000 });

                const details = await page.evaluate(() => {
                    const getText = (label: string) => {
                        const allDivs = Array.from(document.querySelectorAll('div, span, dt, h4'));
                        const labelEl = allDivs.find(el => el.textContent?.trim() === label);
                        if (!labelEl) return '';
                        // Try next sibling
                        if (labelEl.nextElementSibling) return labelEl.nextElementSibling.textContent?.trim() || '';
                        // Try parent's next sibling
                        if (labelEl.parentElement?.nextElementSibling) return labelEl.parentElement.nextElementSibling.textContent?.trim() || '';
                        return '';
                    };

                    const getCast = () => {
                        // Find "출연진/제작진" header
                        const allHeaders = Array.from(document.querySelectorAll('h3, h4, div'));
                        const header = allHeaders.find(el => el.textContent?.trim() === '출연진/제작진');

                        if (!header) return [];

                        const personLinks = Array.from(document.querySelectorAll('a[href*="/person/"]'));
                        // Filter out duplicates and likely irrelevant ones (like director if he is linked differently)
                        // This captures Director + Actors mostly.
                        const names = personLinks.map(l => l.querySelector('.name')?.textContent || l.textContent?.trim() || '').filter(Boolean);

                        return [...new Set(names)].slice(0, 5); // Unique, Top 5
                    };

                    const director = getText('감독');
                    const cleanDirector = director || ((() => {
                        // Fallback: Find "감독" text and grab next name
                        // ...
                        return '';
                    })());

                    const cast = getCast();
                    // Remove director from cast if present
                    const finalCast = cast.filter(c => c !== director);

                    return {
                        movieInfo: `${getText('장르')} / ${getText('러닝타임')}`, // Combine for display
                        grade: getText('연령등급'),
                        director: director,
                        cast: finalCast
                    };
                });

                // Merge details
                enrichedItems.push({
                    ...item,
                    ...details,
                    // Map Grade to Icon or text?
                    // PerformanceList expects 'gradeIcon' often, or just text.
                    // Let's keep 'grade' text for now.
                });

                // Small delay to be nice
                // await new Promise(r => setTimeout(r, 200));

            } catch (e) {
                console.error(`Failed to enrich ${item.title}:`, e);
                enrichedItems.push(item); // Keep basic data on failure
            }
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

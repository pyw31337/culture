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
    genre: string;
    platform?: string; // e.g., 'netflix', 'disney', 'coupang'
    platforms?: string[]; // Array of platform IDs
    region: 'ott';
    movieInfo?: string;
    grade?: string;
    director?: string;
    cast?: string[];
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

        // Load existing data for enrichment
        const jsonPath = path.resolve(process.cwd(), 'src/data/ott.json');
        let existingItemsDetails: any[] = [];
        if (fs.existsSync(jsonPath)) {
            try {
                const fileContent = fs.readFileSync(jsonPath, 'utf-8');
                existingItemsDetails = JSON.parse(fileContent);
                console.log(`Loaded ${existingItemsDetails.length} existing items.`);
            } catch (e) {
                console.error('Error loading existing data:', e);
            }
        }

        // Identify incomplete items that need re-enrichment
        const incompleteItems = existingItemsDetails.filter(item =>
            (!item.runningTime || !item.originalTitle || !item.grade || item.grade === 'OTT') &&
            item.link // Must have a link to scrape
        );
        console.log(`Found ${incompleteItems.length} existing items needing enrichment.`);

        // Add incomplete items to the processing list
        // We use the uniqueItemsMap to merge them.
        const uniqueItemsMap = new Map();

        // 1. Add scraped new items
        allBasicItems.forEach(item => {
            const key = item.link; // Use link as unique key for scraping efficiency
            uniqueItemsMap.set(key, item);
        });

        // 2. Add incomplete existing items (if not already found in new scrape)
        incompleteItems.forEach(item => {
            const key = item.link;
            if (!uniqueItemsMap.has(key)) {
                uniqueItemsMap.set(key, item);
            }
        });

        const basicItems = Array.from(uniqueItemsMap.values());
        console.log(`Unique items to process (New + Incomplete): ${basicItems.length}`);

        // 2. Enrich with Details (Director, Cast, Runtime, Grade, Genre)
        const CONCURRENCY = 5; // Reduced from 10 for stability

        // Initialize a map to hold the latest state of all items
        // We start with the basic items. As we enrich them, we update this map.
        const currentProgressMap = new Map();
        basicItems.forEach(item => currentProgressMap.set(item.link, item));

        // Chunk array for parallel processing
        for (let i = 0; i < basicItems.length; i += CONCURRENCY) {
            const chunk = basicItems.slice(i, i + CONCURRENCY);
            console.log(`Processing chunk ${Math.floor(i / CONCURRENCY) + 1}/${Math.ceil(basicItems.length / CONCURRENCY)}...`);

            const promises = chunk.map(async (item) => {
                const retryCount = 2; // Reduced retry count
                for (let attempt = 1; attempt <= retryCount; attempt++) {
                    const newPage = await browser.newPage();
                    // Block images/fonts/css for speed
                    await newPage.setRequestInterception(true);
                    newPage.on('request', (req) => {
                        const resourceType = req.resourceType();
                        if (['image', 'media', 'font', 'stylesheet'].includes(resourceType)) {
                            req.abort();
                        } else {
                            req.continue();
                        }
                    });

                    // Set User-Agent for each page
                    await newPage.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1');
                    await newPage.setViewport({ width: 390, height: 844 });

                    try {
                        // console.log(`Enriching: ${item.title} (Attempt ${attempt})`);
                        await newPage.goto(item.link, { waitUntil: 'domcontentloaded', timeout: 15000 }); // Reduced timeout

                        try {
                            await newPage.waitForSelector('.metadata__item', { timeout: 3000 });
                        } catch (e) {
                            // Ignore
                        }

                        // Use string evaluation to avoid tsx injection of helper functions
                        const extractionCode = `(() => {
                            function cleanText(t) { return (t || '').replace(/\\s+/g, ' ').trim(); }
                            
                            function getMetadataValue(labelKeywords) {
                                 const items = Array.from(document.querySelectorAll('.metadata__item'));
                                 for (const item of items) {
                                     const titleEl = item.querySelector('.item__title');
                                     if (titleEl) {
                                         const titleText = cleanText(titleEl.textContent);
                                         if (labelKeywords.some(k => titleText.includes(k))) {
                                             const fullText = cleanText(item.textContent);
                                             return fullText.replace(titleText, '').trim();
                                         }
                                     }
                                 }
                                 return '';
                            }
                            
                            let director = '';
                            const staffs = Array.from(document.querySelectorAll('.staff'));
                            for (const staff of staffs) {
                                const titleEl = staff.querySelector('.staff__title');
                                if (titleEl && cleanText(titleEl.textContent).includes('감독')) {
                                    const nameEl = staff.querySelector('.names__name');
                                    if (nameEl) director = cleanText(nameEl.textContent);
                                    break;
                                }
                            }

                            const cast = Array.from(document.querySelectorAll('[id^="actorList-"] .name'))
                                .slice(0, 5)
                                .map(el => cleanText(el.textContent))
                                .filter(Boolean);

                            // New fields
                            const genre = getMetadataValue(['장르']);
                            const runtime = getMetadataValue(['러닝타임']);
                            const dateRaw = getMetadataValue(['방영일', '개봉일', '첫 방영일', '방영 시작일']);
                            const grade = getMetadataValue(['연령등급']);
                            const originalTitle = getMetadataValue(['원제']); 
                            const productionCountry = getMetadataValue(['제작국가']);
                            const productionYear = getMetadataValue(['제작연도']);

                            const headerDateEl = document.querySelector('.movie-header-area .title-area .year');
                            const headerDate = headerDateEl ? cleanText(headerDateEl.textContent) : '';

                            const headerGradeEl = document.querySelector('.movie-header-area .title-area .age');
                            const headerGrade = headerGradeEl ? cleanText(headerGradeEl.textContent) : '';
                            
                            return {
                                movieInfo: [genre, runtime].filter(Boolean).join(' / '),
                                genre: genre,
                                runtime: runtime, // explicitly return runtime
                                grade: grade || headerGrade,
                                director: director,
                                cast: cast,
                                detailDate: headerDate || dateRaw,
                                originalTitle,
                                productionCountry,
                                productionYear,
                                runningTime: runtime // consistent naming
                            };
                        })()`;

                        const details = await newPage.evaluate(extractionCode) as any;

                        // Improved Date Parsing
                        let finalDate = item.date;
                        if (details.detailDate) {
                            // Matches "YYYY년 MM월 DD일" or "YYYY. MM. DD" or similar
                            const match = details.detailDate.match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
                            if (match) {
                                const y = match[1];
                                const m = match[2].padStart(2, '0');
                                const d = match[3].padStart(2, '0');
                                finalDate = `${y}-${m}-${d}`;
                            }
                        }

                        await newPage.close();
                        return {
                            ...item,
                            ...details,
                            date: finalDate,
                        };

                    } catch (e) {
                        console.error(`Error enriching ${item.title} (Attempt ${attempt}):`, e);
                        await newPage.close();
                        if (attempt === retryCount) {
                            console.error(`Failed to enrich ${item.title} after ${retryCount} attempts.`);
                            return item; // Return basic item on failure
                        }
                        // Wait before retry
                        await new Promise(r => setTimeout(r, 2000));
                    }
                }
                return item;
            });

            const results = await Promise.all(promises);

            // Update the map with enriched items
            results.forEach(res => currentProgressMap.set(res.link, res));

            // Incremental Save Logic
            const currentEnrichedItems = Array.from(currentProgressMap.values());

            // Post-process items
            const processedItems = currentEnrichedItems.map((p: any) => {
                const mappedPlatforms = (p.platforms || []).map((raw: string) => mapPlatform(raw)).filter((x: any) => x !== null) as string[];
                const uniquePlatforms = Array.from(new Set(mappedPlatforms));

                return {
                    ...p,
                    id: p.id || `ott_${p.date.replace(/-/g, '')}_${p.title.replace(/\s/g, '')}`,
                    platforms: uniquePlatforms
                };
            });

            // Merge with existing items
            const itemMap = new Map();
            existingItemsDetails.forEach((item: any) => itemMap.set(item.id, item));

            processedItems.forEach((newItem: any) => {
                if (itemMap.has(newItem.id)) {
                    const existing = itemMap.get(newItem.id);
                    const merged = { ...newItem, ...existing };

                    if ((!existing.genre || existing.genre.toLowerCase() === 'ott') && newItem.genre && newItem.genre.toLowerCase() !== 'ott') {
                        merged.genre = newItem.genre;
                        if (newItem.movieInfo && newItem.movieInfo.length > (existing.movieInfo?.length || 0)) {
                            merged.movieInfo = newItem.movieInfo;
                        }
                    }
                    if ((!existing.grade || existing.grade === 'OTT') && newItem.grade) {
                        merged.grade = newItem.grade;
                    }
                    if (!existing.runningTime && newItem.runningTime) merged.runningTime = newItem.runningTime;
                    if (!existing.originalTitle && newItem.originalTitle) merged.originalTitle = newItem.originalTitle;
                    if (!existing.productionCountry && newItem.productionCountry) merged.productionCountry = newItem.productionCountry;


                    itemMap.set(newItem.id, merged);
                } else {
                    itemMap.set(newItem.id, newItem);
                }
            });

            const finalItems = Array.from(itemMap.values());
            fs.writeFileSync(jsonPath, JSON.stringify(finalItems, null, 2));
            console.log(`[Incremental] Saved ${finalItems.length} items.`);
        }

    } catch (error) {
        console.error('Error in OTT Scraper:', error);
    } finally {
        await browser.close();
    }
}

scrapeOTT();

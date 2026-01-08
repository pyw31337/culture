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

const KINOLIGHTS_URL = 'https://m.kinolights.com/new?tab=upcoming';

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

        console.log(`Navigating to ${KINOLIGHTS_URL}...`);
        await page.goto(KINOLIGHTS_URL, { waitUntil: 'networkidle2' });

        // Wait for content
        await page.waitForSelector('body', { timeout: 10000 });

        // DEBUG: Save HTML to file
        const html = await page.content();
        fs.writeFileSync('debug-ott.html', html);
        console.log('Saved HTML to debug-ott.html');

        const performances = await page.evaluate(() => {
            const items: any[] = [];
            const year = new Date().getFullYear();

            // Structure: .contents-wrap contains .streaming-info (header) and .movie-list-area (list)
            const contentWraps = document.querySelectorAll('.contents-wrap');

            contentWraps.forEach(wrap => {
                // 1. Extract Platform from header
                const platformIcon = wrap.querySelector('.streaming-info .kino-icon');
                let platformRaw = '';
                if (platformIcon) {
                    platformRaw = platformIcon.className; // e.g. "kino-icon kino-icon--watcha-play"
                }

                // 2. Extract Date/Header
                const headerTitle = wrap.querySelector('.streaming-info h3');
                const headerText = headerTitle ? headerTitle.textContent?.trim() || '' : '';

                // Default date logic
                let formattedDate = new Date().toISOString().split('T')[0]; // Default to today

                // Try to parse date from header if it exists
                // Example: "1월 8일 (수)"
                const dateMatch = headerText.match(/(\d{1,2})[./월]\s*(\d{1,2})/);
                if (dateMatch) {
                    const month = dateMatch[1].padStart(2, '0');
                    const day = dateMatch[2].padStart(2, '0');
                    formattedDate = `${year}-${month}-${day}`;
                }

                // 3. Extract Items
                const cards = wrap.querySelectorAll('.MovieItem');
                cards.forEach(card => {
                    const titleEl = card.querySelector('.title, .name');
                    const posterEl = card.querySelector('.poster img, .responsive-image__image-container img');
                    const linkEl = card.querySelector('a.poster-container') || card.querySelector('a');

                    if (titleEl && posterEl) {
                        const title = titleEl.textContent?.trim() || '';
                        const image = posterEl.getAttribute('src') || posterEl.getAttribute('data-src') || '';
                        const link = linkEl ? linkEl.getAttribute('href') : '';

                        // Platform logic: Use the section's platform
                        const platforms: string[] = [];

                        // Map class name to platform ID
                        if (platformRaw.includes('netflix')) platforms.push('netflix');
                        else if (platformRaw.includes('disney')) platforms.push('disney');
                        else if (platformRaw.includes('wavve')) platforms.push('wavve');
                        else if (platformRaw.includes('tving')) platforms.push('tving');
                        else if (platformRaw.includes('coupang')) platforms.push('coupang');
                        else if (platformRaw.includes('apple')) platforms.push('apple');
                        else if (platformRaw.includes('watcha')) platforms.push('watcha');

                        // Push item
                        items.push({
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

            return items;
        });

        // Post-process items (IDs, Mapping Platforms)
        const processedItems: OTTPerformance[] = performances.map((p: any) => {
            const mappedPlatforms = p.platforms.map((raw: string) => mapPlatform(raw)).filter((Boolean) as any as (x: any) => x is string);
            // Dedupe
            const uniquePlatforms = Array.from(new Set(mappedPlatforms)) as string[];

            return {
                ...p,
                id: `ott_${p.date.replace(/-/g, '')}_${p.title.replace(/\s/g, '')}`,
                platforms: uniquePlatforms
            };
        });

        console.log(`Scraped ${processedItems.length} items from Kinolights.`);

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

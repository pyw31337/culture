
import { firefox } from 'playwright';
import fs from 'fs';
import path from 'path';

// JustWatch New/New Timeline
const TARGET_URL = 'https://www.justwatch.com/kr/new';

async function scrapeJustWatch() {
    console.log('Starting JustWatch Scraper...');

    // JustWatch runs heavy client-side React.
    // We need to load page, scroll down to get enough items.

    // Using Firefox headless for now
    const browser = await firefox.launch({ headless: true });

    const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    const page = await context.newPage();

    try {
        await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });

        // Scroll to load content
        // JustWatch loads blocks dynamically
        for (let i = 0; i < 5; i++) {
            await page.mouse.wheel(0, 1500);
            await page.waitForTimeout(1000);
        }

        const items = await page.evaluate(() => {
            const results: any[] = [];
            const timeframes = document.querySelectorAll('.timeline__timeframe');

            timeframes.forEach(frame => {
                // Try to deduce date from class (e.g., timeline__timeframe--2026-01-14)
                let dateStr = '';
                frame.classList.forEach(c => {
                    if (c.startsWith('timeline__timeframe--') && c.match(/\d{4}-\d{2}-\d{2}/)) {
                        // Extract YYYY-MM-DD
                        const match = c.match(/(\d{4}-\d{2}-\d{2})/);
                        if (match) dateStr = match[1];
                    }
                });

                // Find items
                const cards = frame.querySelectorAll('.horizontal-title-list__item');
                cards.forEach(card => {
                    const anchor = card.querySelector('a');
                    const img = card.querySelector('img');

                    if (anchor) {
                        const link = anchor.getAttribute('href') || '';
                        // Title usually in alt of img or just implicit
                        const title = img?.getAttribute('alt') || '';
                        const image = img?.getAttribute('src') || img?.getAttribute('data-src') || '';

                        // JustWatch groups by provider in the timeline often, OR icons are on the card
                        // If the timeframe has '--nfx' suffix, it might be specific. But let's look for icons on card.
                        const providerIcons = card.querySelectorAll('.monetization-icon img');
                        const platforms: string[] = [];

                        // If no icons on card, check if the timeframe has a provider logo header?
                        // .timeline__provider-block img
                        const blockIcon = frame.querySelector('.timeline__provider-block img');
                        if (blockIcon) {
                            const alt = blockIcon.getAttribute('alt') || blockIcon.getAttribute('title');
                            if (alt) platforms.push(alt);
                        }

                        // Also check individual icons
                        providerIcons.forEach(icon => {
                            const alt = icon.getAttribute('alt') || icon.getAttribute('title');
                            if (alt) platforms.push(alt);
                        });

                        if (title) {
                            results.push({
                                title,
                                date: dateStr,
                                image,
                                link: `https://www.justwatch.com${link}`,
                                platforms: platforms,
                                id: ''
                            });
                        }
                    }
                });
            });
            return results;
        });

        console.log(`Found ${items.length} items from JustWatch.`);

        // --- Detailed Enrichment (Visit 30 items) ---
        const detailedItems = [];

        // Map platforms
        const platformMap: Record<string, string> = {
            'Netflix': 'netflix',
            'Disney Plus': 'disney',
            'wavve': 'wavve',
            'Watcha': 'watcha',
            'Amazon Prime Video': 'amazon',
            'Coupang Play': 'coupang',
            'TVING': 'tving',
            'Apple TV Plus': 'apple',
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

            // Default region
            item.region = 'ott';
            item.venue = 'OTT';

            // Visit Detail Page for Metadata (Limit to first 30 for speed in validation)
            if (i < 30) {
                process.stdout.write(`Enriching ${i + 1}/${items.length}: ${item.title}... `);
                try {
                    const p = await context.newPage();
                    await p.goto(item.link, { waitUntil: 'domcontentloaded' });

                    const details = await p.evaluate(() => {
                        const res: any = {};
                        // JustWatch Detail Selectors (Verified visually in mind, need to be robust)
                        // .detail-infos__heading and .detail-infos__value

                        // Poster: .picture-comp__img-box img
                        const posterEl = document.querySelector('.picture-comp__img-box img');
                        if (posterEl) {
                            const src = posterEl.getAttribute('src') || posterEl.getAttribute('data-src');
                            if (src) res.image = src; // Higher res
                        }

                        const rows = document.querySelectorAll('.detail-infos__detail');
                        rows.forEach(row => {
                            const label = row.querySelector('.detail-infos__heading')?.textContent?.trim();
                            const val = row.querySelector('.detail-infos__value')?.textContent?.trim();

                            if (label && val) {
                                if (label.includes('감독')) res.director = val;
                                if (label.includes('출연')) res.cast = val.split(',').map(s => s.trim());
                                if (label.includes('장르')) res.genre = val;
                                if (label.includes('재생 시간')) res.runningTime = val;
                                if (label.includes('원제')) res.originalTitle = val;
                            }
                        });

                        // Synopsis? .text-wrap-pre-line
                        const overview = document.querySelector('.text-wrap-pre-line span')?.textContent;
                        if (overview) res.movieInfo = overview.trim(); // Use as info for now

                        return res;
                    });

                    Object.assign(item, details);
                    console.log('Done');
                    await p.close();
                } catch (e) {
                    console.log('Skip (Error)');
                }
            }

            // ID Gen
            const dateStr = item.date ? item.date.replace(/-/g, '') : '00000000';
            const titleStr = item.title ? item.title.replace(/[\s\W]/g, '') : 'unknown';
            item.id = `ott_${dateStr}_${titleStr}`;

            detailedItems.push(item);
        }

        // Write
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

import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';
import path from 'path';
import { processImage } from './utils/image-processor';
import cliProgress from 'cli-progress';

puppeteer.use(StealthPlugin());

const CATEGORIES = [
    { name: '콘서트', id: '15456', genre: 'concert' },
    { name: '뮤지컬', id: '15457', genre: 'musical' },
    { name: '연극', id: '15458', genre: 'play' },
    { name: '클래식', id: '15459', genre: 'classic' },
    { name: '전시/행사', id: '15460', genre: 'exhibition' },
    { name: '가족/어린이', id: '999', genre: 'kids' }
];

const DATA_DIR = path.join(process.cwd(), 'src', 'data');
const OUTPUT_FILE = path.join(DATA_DIR, 'yes24-exclusive.json');

function slugify(text: string): string {
    return text
        .replace(/[^a-zA-Z0-9가-힣]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
}

async function scrapeYes24() {
    console.log('Starting Yes24 Multi-Category Exclusive Scraper...');

    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

    // Load existing data to avoid redundant enrichment
    let allEnrichedItems: any[] = [];
    if (fs.existsSync(OUTPUT_FILE)) {
        try {
            allEnrichedItems = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf-8'));
            console.log(`Loaded ${allEnrichedItems.length} existing items.`);
        } catch (e) {
            console.error('Failed to load existing data:', e);
        }
    }

    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
    });

    try {
        const page = await browser.newPage();
        // Set a realistic User-Agent
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
        await page.setViewport({ width: 1280, height: 800 });

        for (const cat of CATEGORIES) {
            const url = `https://ticket.yes24.com/New/Genre/GenreList.aspx?genretype=1&genre=${cat.id}`;
            console.log(`\n--- Processing Category: ${cat.name} ---`);
            console.log(`Navigating to: ${url}`);
            
            try {
                await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
                await page.waitForSelector('.ms-list-imgs', { timeout: 30000 });

                // Scroll to load all items (lazy loading)
                await page.evaluate(async () => {
                    await new Promise<void>((resolve) => {
                        let totalHeight = 0;
                        let distance = 400;
                        let timer = setInterval(() => {
                            let scrollHeight = document.body.scrollHeight;
                            window.scrollBy(0, distance);
                            totalHeight += distance;
                            if (totalHeight >= scrollHeight || totalHeight > 15000) {
                                clearInterval(timer);
                                resolve();
                            }
                        }, 150);
                    });
                });
                await new Promise(r => setTimeout(r, 2000));

                // Extract basic info
                const items = await page.evaluate((genre) => {
                    const results: any[] = [];
                    const cards = document.querySelectorAll('.ms-list-imgs a');
                    
                    cards.forEach((card) => {
                        const exclusiveBadge = card.querySelector('p.list-b-circle');
                        const badgeText = exclusiveBadge?.textContent?.trim() || '';
                        
                        if (badgeText === '단독') {
                            const title = card.querySelector('.list-b-tit1')?.textContent?.trim() || '';
                            const img = card.querySelector('img');
                            const poster = img?.getAttribute('data-src') || img?.getAttribute('src') || '';
                            
                            const infoTexts = card.querySelectorAll('.list-b-tit2');
                            const dateRaw = infoTexts[0]?.textContent?.trim() || '';
                            const venue = infoTexts[1]?.textContent?.trim() || '';
                            
                            const onclick = card.getAttribute('onclick') || '';
                            const idMatch = onclick.match(/\((\d+)\)/);
                            const perfId = idMatch ? idMatch[1] : '';

                            if (title && perfId) {
                                results.push({
                                    id: `yes24_${perfId}`,
                                    title,
                                    poster: poster && !poster.startsWith('http') ? `https:${poster}` : poster,
                                    date: dateRaw,
                                    venue,
                                    link: `https://ticket.yes24.com/Perf/${perfId}`,
                                    genre: genre,
                                    region: '서울'
                                });
                            }
                        }
                    });
                    return results;
                }, cat.genre);

                console.log(`Found ${items.length} exclusive items in ${cat.name}.`);

                const progressBar = new cliProgress.SingleBar({
                    format: `${cat.name} 상세 수집 | {bar} | {percentage}% | {value}/{total} | {item}`,
                    hideCursor: true
                }, cliProgress.Presets.shades_classic);

                progressBar.start(items.length, 0, { item: '대기 중' });

                for (const item of items) {
                    progressBar.update({ item: item.title.substring(0, 15) });
                    
                    // Check if already enriched to save time and requests
                    const existing = allEnrichedItems.find(i => i.id === item.id);
                    if (existing) {
                        progressBar.increment();
                        continue;
                    }

                    try {
                        const detailPage = await browser.newPage();
                        await detailPage.goto(item.link, { waitUntil: 'domcontentloaded', timeout: 30000 });
                        
                        const detail = await detailPage.evaluate(() => {
                            const priceList = document.querySelectorAll('.rn-product-price1 li');
                            const prices = Array.from(priceList).map(li => li.textContent?.trim() || '').filter(Boolean);
                            const description = document.querySelector('.rn-product-area2')?.textContent?.trim() || '';
                            return { price: prices.join(', '), description };
                        });
                        
                        const safeTitle = slugify(item.title);
                        const localPoster = await processImage(item.poster, `yes24_${safeTitle}`, `posters/${cat.genre}`);
                        
                        allEnrichedItems.push({
                            ...item,
                            ...detail,
                            image: localPoster,
                            backupPoster: item.poster,
                            category: '독점공연'
                        });

                        await detailPage.close();
                        // Random delay between requests: 1-2.5s
                        await new Promise(r => setTimeout(r, 1000 + Math.random() * 1500));
                    } catch (e: any) {
                        console.error(`\nFailed to enrich ${item.title}:`, e.message);
                        allEnrichedItems.push(item);
                    }
                    progressBar.increment();
                }
                progressBar.stop();

                // Save after each category
                fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allEnrichedItems, null, 2));
                console.log(`Saved progress to ${OUTPUT_FILE}`);

                // Random delay between categories: 3-6s
                await new Promise(r => setTimeout(r, 3000 + Math.random() * 3000));

            } catch (e: any) {
                console.error(`Error processing category ${cat.name}:`, e.message);
            }
        }

        console.log(`\nScraping complete. Total items: ${allEnrichedItems.length}`);

    } catch (e) {
        console.error('Global Scraping Error:', e);
    } finally {
        await browser.close();
    }
}

scrapeYes24();

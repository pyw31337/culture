import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';
import path from 'path';
import { atomicWriteJson } from './utils/scraper-utils';

puppeteer.use(StealthPlugin());

const OUTPUT_FILE = path.resolve(process.cwd(), 'src/data/sssd-class.json');

// Korean User Agent for better locale detection
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// All main categories from SSSD
const CATEGORIES = [
    { name: '전체', midx: 'all' }
];

function slugify(text: string): string {
    return text
        .replace(/[^a-zA-Z0-9가-힣]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
}

async function setupKoreanLocale(page: any) {
    await page.setExtraHTTPHeaders({
        'Accept-Language': 'ko-KR,ko;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    });

    await page.setCookie(
        { name: 'SSSD_MW_LANG', value: 'ko-KR', domain: '.sssd.co.kr', path: '/' },
        { name: 'lang', value: 'ko', domain: '.sssd.co.kr', path: '/' },
        { name: 'locale', value: 'ko_KR', domain: '.sssd.co.kr', path: '/' }
    );

    await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'language', { get: () => 'ko-KR' });
        Object.defineProperty(navigator, 'languages', { get: () => ['ko-KR', 'ko'] });
    });
}

async function scrollToLoadAll(page: any, listSelector: string) {
    let previousHeight = 0;
    let noChangeCount = 0;
    const maxNoChange = 3;

    while (noChangeCount < maxNoChange) {
        const currentHeight = await page.evaluate(() => document.body.scrollHeight);

        if (currentHeight === previousHeight) {
            noChangeCount++;
        } else {
            noChangeCount = 0;
        }

        previousHeight = currentHeight;
        await page.evaluate(() => window.scrollBy(0, 1000));
        await new Promise(r => setTimeout(r, 800));
    }
}

async function extractListItems(page: any, listSelector: string) {
    return await page.evaluate((selector: string) => {
        const elements = Array.from(document.querySelectorAll(selector));
        return elements.map(el => {
            const linkEl = el.querySelector('a');
            if (!linkEl) return null;

            const link = linkEl.href;
            const titleEl = linkEl.querySelector('div:nth-child(3)');
            const title = titleEl ? (titleEl as HTMLElement).innerText.trim() : '';

            const imgDiv = linkEl.querySelector('div > div');
            let image = '';

            if (imgDiv) {
                const style = (imgDiv as HTMLElement).getAttribute('style');
                if (style) {
                    const match = style.match(/url\(["']?(.+?)["']?\)/);
                    if (match && !match[1].includes('img_loding_bg')) {
                        image = match[1];
                    }
                }

                if (!image || image.includes('img_loding_bg')) {
                    const computed = window.getComputedStyle(imgDiv);
                    const bgImage = computed.backgroundImage;
                    if (bgImage && bgImage !== 'none') {
                        const match = bgImage.match(/url\(["']?(.+?)["']?\)/);
                        if (match && !match[1].includes('img_loding_bg')) {
                            image = match[1];
                        }
                    }
                }

                if (!image || image.includes('img_loding_bg')) {
                    const dataBg = (imgDiv as HTMLElement).getAttribute('data-bg') ||
                        (imgDiv as HTMLElement).getAttribute('data-src') ||
                        (imgDiv as HTMLElement).getAttribute('data-lazy');
                    if (dataBg && !dataBg.includes('img_loding_bg')) {
                        image = dataBg;
                    }
                }
            }

            if (!image || image.includes('img_loding_bg')) {
                const imgTag = linkEl.querySelector('img');
                if (imgTag) {
                    const src = imgTag.getAttribute('data-src') ||
                        imgTag.getAttribute('data-lazy') ||
                        imgTag.getAttribute('src');
                    if (src && !src.includes('img_loding_bg')) {
                        image = src;
                    }
                }
            }

            return { title, link, image };
        }).filter(item => item && item.title && item.link);
    }, listSelector);
}

async function scrapeDetailPage(detailPage: any, item: any) {
    try {
        await detailPage.goto(item.link, { waitUntil: 'domcontentloaded', timeout: 90000 });
        // wait for a bit to be sure dynamic content is there
        await new Promise(r => setTimeout(r, 1000));

        const detailInfo = await detailPage.evaluate(() => {
            // User Provided Selectors:
            // Address: #placeCopy (data-clipboard-text) OR #class_info ... .info-address-text-area > span
            // Duration: .class-detail-summery-area > div:nth-child(3) > div
            // People: .class-detail-summery-area > div:nth-child(4) > div
            // Discount: #price-bar ... .discount_rate
            // Origin: #price-bar ... .base_price
            // Sale: #price-bar ... .detail_txt.col-xs-6 > div (this might return text including span, need clean)

            // 1. Location
            let location = '';
            const clipEl = document.querySelector('#placeCopy');
            if (clipEl) location = clipEl.getAttribute('data-clipboard-text') || '';

            if (!location) {
                location = document.querySelector('#class_info > div.address-info-box.info-area.p-t-30.p-l-15.p-r-15.m-b-30 > div > div.info-address-text-area > span')?.textContent?.trim() || '';
            }
            if (!location) {
                const detailPlace = document.querySelector('.detail-place');
                if (detailPlace) location = (detailPlace as HTMLElement).innerText.trim();
            }

            // 2. Info
            const time = document.querySelector('body > div.content.opened > div.container.no-lr-padding > div.class-detail-summery-area > div:nth-child(3) > div')?.textContent?.trim() || '';
            const capacity = document.querySelector('body > div.content.opened > div.container.no-lr-padding > div.class-detail-summery-area > div:nth-child(4) > div')?.textContent?.trim() || '';

            // 3. Price
            const discountRate = document.querySelector('#price-bar > div.row > div.detail_txt.col-xs-6 > span.discount_rate')?.textContent?.trim() || '';
            const originalPrice = document.querySelector('#price-bar > div.row > div.detail_txt.col-xs-6 > span.base_price')?.textContent?.trim() || '';


            // Sale price is inside the div but outside the spans technically? Structure: <div> <span class="discount"></span> <span class="base"></span> 30,000원 </div>
            // We need to be careful to extract just the price text.
            const priceContainer = document.querySelector('#price-bar > div.row > div.detail_txt.col-xs-6');
            let finalPrice = '';
            if (priceContainer) {
                // Clone to avoid modifying DOM? Or just iterate nodes.
                // Simplest: regex on innerText, knowing that discount/base are there.
                // OR: remove children text from total text?
                // Let's get full text and parse. e.g. "30% 50,000원 35,000원"
                // Usually the LAST number is the sale price.
                const fullText = (priceContainer as HTMLElement).innerText;
                const numbers = fullText.match(/[\d,]+원/g);
                if (numbers && numbers.length > 0) {
                    finalPrice = numbers[numbers.length - 1]; // Last one usually
                } else {
                    // Try just text content?
                    finalPrice = fullText;
                }
            }

            let detailImage = '';
            const mainImg = document.querySelector('.class-detail-img img, .swiper-slide img');
            if (mainImg) {
                detailImage = (mainImg as HTMLImageElement).src ||
                    (mainImg as HTMLElement).getAttribute('data-src') || '';
            }

            // Parking? Old selector: .detail-car. We can keep it or skip if not requested.
            // keeping for richness if it exists alongside new selectors
            const parking = document.querySelector('.detail-car')?.textContent?.trim() || '';
            const metaDescription = document.querySelector('meta[name="description"], meta[property="og:description"]')?.getAttribute('content')?.trim() || '';
            const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute('href') || window.location.href;
            const keywords = document.querySelector('meta[name="keywords"]')?.getAttribute('content')?.split(',')
                .map((keyword) => keyword.trim())
                .filter(Boolean)
                .slice(0, 12) || [];
            if (!location || location.startsWith('http')) {
                const metaAddress = metaDescription.match(/장소\s*:\s*([^,]+)/)?.[1]?.trim();
                if (metaAddress) location = metaAddress;
            }

            return {
                location: location || '상세페이지 참조',
                time,
                capacity,
                discountRate,
                originalPrice,
                finalPrice,
                detailImage,
                parking,
                metaDescription,
                canonical,
                keywords
            };
        });

        return detailInfo;
    } catch (err) {
        throw err;
    }
}

function loadExistingData(): Map<string, any> {
    if (!fs.existsSync(OUTPUT_FILE)) return new Map();
    try {
        const data = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf-8'));
        const map = new Map<string, any>();
        data.forEach((item: any) => {
            if (item.link) map.set(item.link, item);
        });
        return map;
    } catch (e) {
        console.warn("Failed to load existing data for incremental scraping.");
        return new Map();
    }
}

async function scrape() {
    console.log('Starting SSSD Multi-Category Scraper...');
    console.log(`Will scrape ${CATEGORIES.length} categories to maximize class collection.\n`);

    const browser = await puppeteer.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled',
            '--window-size=1920,1080',
            '--lang=ko-KR',
            '--accept-lang=ko-KR'
        ]
    });

    const allItems: Map<string, any> = new Map(); // Use Map to dedupe by link

    const existingDataMap = loadExistingData();
    console.log(`Loaded ${existingDataMap.size} existing items for incremental scraping.`);

    const listSelector = '.class-search-result li';

    try {
        // Collect items from all categories
        for (const category of CATEGORIES) {
            const url = `https://www.sssd.co.kr/m/search/class/category?midx=${category.midx}`;
            console.log(`\n[${category.name}] Fetching from ${url}...`);

            const page = await browser.newPage();
            await page.setUserAgent(USER_AGENT);
            await page.setViewport({ width: 1920, height: 1080 });
            await setupKoreanLocale(page);

            await page.setRequestInterception(true);
            page.on('request', (req) => {
                if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) {
                    req.abort();
                } else {
                    req.continue();
                }
            });

            let retries = 2;
            let success = false;

            while (retries > 0 && !success) {
                try {
                    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });

                    try {
                        await page.waitForSelector(listSelector, { timeout: 15000 });
                    } catch (e) {
                        console.log(`  No items found, skipping...`);
                        success = true; // Treated as success (empty category)
                        continue;
                    }

                    await scrollToLoadAll(page, listSelector);
                    await new Promise(r => setTimeout(r, 3000));

                    const items = await extractListItems(page, listSelector);

                    let newItems = 0;
                    for (const item of items) {
                        if (item && !allItems.has(item.link)) {
                            allItems.set(item.link, item);
                            newItems++;
                        }
                    }

                    console.log(`  Found ${items.length} items, ${newItems} new. Total unique: ${allItems.size}`);
                    success = true;

                } catch (err) {
                    retries--;
                    if (retries === 0) {
                        console.error(`  Error fetching category after retries: ${err}`);
                    } else {
                        console.log(`  Error fetching category (timeout?), retrying... (${retries} retries left)`);
                        await new Promise(r => setTimeout(r, 5000)); // Wait 5s before retry
                    }
                }
            }

            await page.close();
        }

        console.log(`\n${'='.repeat(50)}`);
        console.log(`Total unique items collected: ${allItems.size}`);
        console.log(`${'='.repeat(50)}\n`);

        // Convert Map to array for detail scraping
        const itemsArray = Array.from(allItems.values());
        const results: any[] = [];

        // Detail scraping
        console.log('Starting detail scraping...');

        // Create a single page for detail scraping to avoid overhead
        const detailPage = await browser.newPage();
        await detailPage.setUserAgent(USER_AGENT);
        await detailPage.setViewport({ width: 1920, height: 1080 });
        await setupKoreanLocale(detailPage);

        for (let i = 0; i < itemsArray.length; i++) {
            const item = itemsArray[i];
            const progress = `[${i + 1}/${itemsArray.length}]`;
            process.stdout.write(`${progress} Scraping ${item.title.substring(0, 30)}... \r`);

            if (!item.link.startsWith('http')) continue;

            // INCREMENTAL SCRAPING OPTIMIZATION:
            if (existingDataMap.has(item.link)) {
                const existing = existingDataMap.get(item.link);
                const hasRichDetail = existing.address && !String(existing.address).startsWith('http') && existing.description && existing.priceDetail;
                if (hasRichDetail) {
                    results.push(existing);
                    process.stdout.write(` [Skipped - Exists] \r`);
                    continue;
                }
            }

            try {
                const detailInfo = await scrapeDetailPage(detailPage, item);

                const tags = [
                    detailInfo.parking,
                    detailInfo.time,
                    detailInfo.capacity
                ].filter(s => s && s.trim() !== '' && !['Copy Address', '주소복사'].includes(s) && !s.includes('http'));

                let finalImage = item.image;
                if (!finalImage || finalImage.includes('img_loding_bg')) {
                    finalImage = detailInfo.detailImage || '';
                }

                results.push({
                    id: `class_${slugify(item.title)}`,
                    title: item.title,
                    date: '상시',
                    venue: detailInfo.location && detailInfo.location !== '상세페이지 참조' ? detailInfo.location : '솜씨당 클래스',
                    address: detailInfo.location && detailInfo.location !== '상세페이지 참조' ? detailInfo.location : '',
                    price: detailInfo.finalPrice || '가격 정보 없음',
                    originalPrice: detailInfo.originalPrice,
                    discount: detailInfo.discountRate,
                    image: finalImage,
                    link: item.link,
                    genre: 'class',
                    source: 'sssd',
                    tags: tags,
                    status: 'OPEN',
                    description: detailInfo.metaDescription,
                    priceDetail: [
                        detailInfo.originalPrice ? `정상가: ${detailInfo.originalPrice}` : '',
                        detailInfo.discountRate ? `할인율: ${detailInfo.discountRate}` : '',
                        detailInfo.finalPrice ? `판매가: ${detailInfo.finalPrice}` : '',
                    ].filter(Boolean).join('\n'),
                    feesAndPrograms: [
                        detailInfo.time ? `수업시간: ${detailInfo.time}` : '',
                        detailInfo.capacity ? `인원: ${detailInfo.capacity}` : '',
                        detailInfo.parking ? `주차: ${detailInfo.parking}` : '',
                    ].filter(Boolean).join('\n'),
                    runningTime: detailInfo.time,
                    targetAudience: detailInfo.capacity,
                    parking: detailInfo.parking,
                    website: detailInfo.canonical,
                    sourceUpdatedAt: new Date().toISOString(),
                    keywords: detailInfo.keywords
                });

            } catch (err) {
                console.error(`\nError scraping ${item.link}:`, err);
            }
        }

        await detailPage.close();

        console.log(`\n\nScraping complete! Saved ${results.length} items to ${OUTPUT_FILE}`);

        const dir = path.dirname(OUTPUT_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        atomicWriteJson(OUTPUT_FILE, results);

    } catch (e) {
        console.error('Fatal Error:', e);
        process.exit(1);
    } finally {
        await browser.close();
    }
}

scrape();

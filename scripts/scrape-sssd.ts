import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';
import path from 'path';

puppeteer.use(StealthPlugin());

const OUTPUT_FILE = path.join(__dirname, '../src/data/sssd-class.json');

// Korean User Agent for better locale detection
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// All main categories from SSSD
const CATEGORIES = [
    { name: '전체', midx: 'all' },
    { name: '요리', midx: '1' },
    { name: '수공예', midx: '2' },
    { name: '미술', midx: '3' },
    { name: '플라워', midx: '4' },
    { name: '뷰티', midx: '12' },
    { name: '모임', midx: '13' },
    { name: '액티비티', midx: '8' },
    { name: '정규', midx: '11' },
    { name: '음악', midx: '7' },
    { name: '라이프스타일', midx: '5' },
    { name: '키즈', midx: '10' }
];

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

async function scrapeDetailPage(browser: any, item: any, setupLocale: (page: any) => Promise<void>) {
    const detailPage = await browser.newPage();
    await detailPage.setUserAgent(USER_AGENT);
    await detailPage.setViewport({ width: 1920, height: 1080 });
    await setupLocale(detailPage);

    try {
        await detailPage.goto(item.link, { waitUntil: 'networkidle2', timeout: 60000 });
        await new Promise(r => setTimeout(r, 2000));

        const detailInfo = await detailPage.evaluate(() => {
            let location = '';
            const locationEl = document.querySelector('#placeCopy');

            if (locationEl) {
                const clipboardText = locationEl.getAttribute('data-clipboard-text');
                if (clipboardText &&
                    clipboardText.trim().length > 0 &&
                    !clipboardText.startsWith('http') &&
                    clipboardText !== 'Copy Address' &&
                    clipboardText !== '주소복사') {
                    location = clipboardText.trim();
                }
            }

            if (!location) {
                const detailPlace = document.querySelector('.detail-place');
                if (detailPlace) {
                    const text = (detailPlace as HTMLElement).innerText.trim();
                    if (text && text.length > 2) {
                        location = text;
                    }
                }
            }

            if (!location) {
                const bodyText = document.body.innerText;
                const addressMatch = bodyText.match(/(서울|경기|인천|부산|대구|광주|대전|울산|세종|강원|충북|충남|전북|전남|경북|경남|제주)[^\n]{5,50}/);
                if (addressMatch) {
                    location = addressMatch[0].trim();
                }
            }

            if (!location) location = '상세페이지 참조';

            let discountRate = '';
            let originalPrice = '';
            let finalPrice = '';

            const discountEl = document.querySelector('.discount_rate');
            const baseEl = document.querySelector('.base_price');
            const priceEl = document.querySelector('.price01');

            if (discountEl) discountRate = (discountEl as HTMLElement).innerText.trim();
            if (baseEl) originalPrice = (baseEl as HTMLElement).innerText.trim();
            if (priceEl) {
                const listPrice = document.querySelector('.list-price');
                if (listPrice) finalPrice = (listPrice as HTMLElement).innerText.trim();
                else finalPrice = (priceEl as HTMLElement).innerText.trim() + '원';
            }

            let parking = '';
            let time = '';
            let capacity = '';

            const parkingEl = document.querySelector('.detail-car');
            const timeEl = document.querySelector('.detail-time');
            const peopleEl = document.querySelector('.detail-people');

            if (parkingEl) parking = (parkingEl as HTMLElement).innerText.trim();
            if (timeEl) time = (timeEl as HTMLElement).innerText.trim();
            if (peopleEl) capacity = (peopleEl as HTMLElement).innerText.trim();

            let detailImage = '';
            const mainImg = document.querySelector('.class-detail-img img, .swiper-slide img');
            if (mainImg) {
                detailImage = (mainImg as HTMLImageElement).src ||
                    (mainImg as HTMLElement).getAttribute('data-src') || '';
            }

            return { location, parking, time, capacity, discountRate, originalPrice, finalPrice, detailImage };
        });

        await detailPage.close();
        return detailInfo;
    } catch (err) {
        await detailPage.close();
        throw err;
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

            try {
                await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

                try {
                    await page.waitForSelector(listSelector, { timeout: 10000 });
                } catch (e) {
                    console.log(`  No items found, skipping...`);
                    await page.close();
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

            } catch (err) {
                console.error(`  Error fetching category: ${err}`);
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
        for (let i = 0; i < itemsArray.length; i++) {
            const item = itemsArray[i];
            const progress = `[${i + 1}/${itemsArray.length}]`;
            process.stdout.write(`${progress} Scraping ${item.title.substring(0, 30)}... \r`);

            if (!item.link.startsWith('http')) continue;

            try {
                const detailInfo = await scrapeDetailPage(browser, item, setupKoreanLocale);

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
                    id: `sssd-${i}`,
                    title: item.title,
                    date: '상시',
                    venue: detailInfo.location,
                    price: detailInfo.finalPrice || '가격 정보 없음',
                    originalPrice: detailInfo.originalPrice,
                    discount: detailInfo.discountRate,
                    image: finalImage,
                    link: item.link,
                    genre: 'class',
                    source: 'sssd',
                    tags: tags,
                    status: 'OPEN'
                });

            } catch (err) {
                console.error(`\nError scraping ${item.link}:`, err);
            }
        }

        console.log(`\n\nScraping complete! Saved ${results.length} items to ${OUTPUT_FILE}`);

        const dir = path.dirname(OUTPUT_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));

    } catch (e) {
        console.error('Fatal Error:', e);
        process.exit(1);
    } finally {
        await browser.close();
    }
}

scrape();

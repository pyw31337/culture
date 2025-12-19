import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';
import path from 'path';

puppeteer.use(StealthPlugin());

// SSSD only has mobile URLs - desktop paths return 404
const TARGET_URL = 'https://www.sssd.co.kr/m/search/class/category?midx=all';
const OUTPUT_FILE = path.join(__dirname, '../src/data/sssd-class.json');

// Korean User Agent for better locale detection
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function setupKoreanLocale(page: any) {
    // Set comprehensive Korean locale settings
    await page.setExtraHTTPHeaders({
        'Accept-Language': 'ko-KR,ko;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    });

    // Set Korean cookies before navigation
    await page.setCookie(
        { name: 'SSSD_MW_LANG', value: 'ko-KR', domain: '.sssd.co.kr', path: '/' },
        { name: 'lang', value: 'ko', domain: '.sssd.co.kr', path: '/' },
        { name: 'locale', value: 'ko_KR', domain: '.sssd.co.kr', path: '/' }
    );

    // Override navigator.language via JavaScript
    await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'language', { get: () => 'ko-KR' });
        Object.defineProperty(navigator, 'languages', { get: () => ['ko-KR', 'ko'] });
    });
}

async function scrape() {
    console.log('Starting SSSD Scraper (Korean Locale Enforced)...');

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

    try {
        const page = await browser.newPage();
        await page.setUserAgent(USER_AGENT);
        await page.setViewport({ width: 1920, height: 1080 });

        // Apply Korean locale settings BEFORE navigation
        await setupKoreanLocale(page);

        console.log(`Navigating to ${TARGET_URL}...`);
        await page.goto(TARGET_URL, { waitUntil: 'networkidle2', timeout: 60000 });

        // Wait for list
        const listSelector = '.class-search-result li';
        try {
            await page.waitForSelector(listSelector, { timeout: 15000 });
        } catch (e) {
            console.error('List selector not found. Waiting longer...');
            await new Promise(r => setTimeout(r, 5000));
        }

        // Scroll to load more items with longer wait for lazy loading
        console.log('Scrolling to load items (with image loading wait)...');
        await page.evaluate(async () => {
            await new Promise<void>((resolve) => {
                let totalHeight = 0;
                const distance = 200;
                let scrolls = 0;
                const maxScrolls = 30;
                const timer = setInterval(() => {
                    const scrollHeight = document.body.scrollHeight;
                    window.scrollBy(0, distance);
                    totalHeight += distance;
                    scrolls++;
                    if (scrolls >= maxScrolls || totalHeight >= scrollHeight) {
                        clearInterval(timer);
                        resolve();
                    }
                }, 200); // Slower scroll for image loading
            });
        });

        // Wait for images to load after scrolling
        console.log('Waiting for images to load...');
        await new Promise(r => setTimeout(r, 5000));

        // Scroll back to top and wait again
        await page.evaluate(() => window.scrollTo(0, 0));
        await new Promise(r => setTimeout(r, 2000));

        // Extract List Items - check for lazy-loaded images
        console.log('Extracting list items...');
        const items = await page.evaluate((selector) => {
            const elements = Array.from(document.querySelectorAll(selector));
            return elements.map(el => {
                const linkEl = el.querySelector('a');
                if (!linkEl) return null;

                const link = linkEl.href;

                // Title is in 3rd child div of anchor
                const titleEl = linkEl.querySelector('div:nth-child(3)');
                const title = titleEl ? (titleEl as HTMLElement).innerText.trim() : '';

                // Image: Try multiple sources for lazy-loaded images
                const imgDiv = linkEl.querySelector('div > div');
                let image = '';

                if (imgDiv) {
                    // Check inline style first
                    const style = (imgDiv as HTMLElement).getAttribute('style');
                    if (style) {
                        const match = style.match(/url\(["']?(.+?)["']?\)/);
                        if (match && !match[1].includes('img_loding_bg')) {
                            image = match[1];
                        }
                    }

                    // Check computed style
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

                    // Check data-bg attribute (common lazy loading pattern)
                    if (!image || image.includes('img_loding_bg')) {
                        const dataBg = (imgDiv as HTMLElement).getAttribute('data-bg') ||
                            (imgDiv as HTMLElement).getAttribute('data-src') ||
                            (imgDiv as HTMLElement).getAttribute('data-lazy');
                        if (dataBg && !dataBg.includes('img_loding_bg')) {
                            image = dataBg;
                        }
                    }
                }

                // Check for img tag inside
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

        console.log(`Found ${items.length} items. Starting detail scraping...`);

        const results: any[] = [];
        const total = items.length;

        // Detail Scraping Loop
        for (let i = 0; i < total; i++) {
            const item = items[i];
            if (!item) continue;

            const progress = `[${i + 1}/${total}]`;
            process.stdout.write(`${progress} Scraping ${item.title.substring(0, 25)}... \r`);

            if (!item.link.startsWith('http')) continue;

            try {
                const detailPage = await browser.newPage();
                await detailPage.setUserAgent(USER_AGENT);
                await detailPage.setViewport({ width: 1920, height: 1080 });

                // Apply Korean locale settings BEFORE navigation
                await setupKoreanLocale(detailPage);

                await detailPage.goto(item.link, { waitUntil: 'networkidle2', timeout: 60000 });

                // Wait for content to hydrate
                await new Promise(r => setTimeout(r, 3000));

                const detailInfo = await detailPage.evaluate(() => {
                    // 1. Address Extraction: PRIORITIZE #placeCopy data-clipboard-text
                    let location = '';
                    const locationEl = document.querySelector('#placeCopy');

                    if (locationEl) {
                        const clipboardText = locationEl.getAttribute('data-clipboard-text');
                        // ONLY USE if it's NOT a URL and not placeholder text
                        if (clipboardText &&
                            clipboardText.trim().length > 0 &&
                            !clipboardText.startsWith('http') &&
                            clipboardText !== 'Copy Address' &&
                            clipboardText !== '주소복사') {
                            location = clipboardText.trim();
                        }
                    }

                    // Fallback 1: .detail-place element
                    if (!location) {
                        const detailPlace = document.querySelector('.detail-place');
                        if (detailPlace) {
                            const text = (detailPlace as HTMLElement).innerText.trim();
                            if (text && text.length > 2) {
                                location = text;
                            }
                        }
                    }

                    // Fallback 2: .overlay_title (desktop selector)
                    if (!location) {
                        const overlayTitle = document.querySelector('.overlay_title');
                        if (overlayTitle) {
                            location = (overlayTitle as HTMLElement).innerText.trim().replace(/\n/g, ' ');
                        }
                    }

                    // Fallback 3: Regex match for Korean address pattern
                    if (!location) {
                        const bodyText = document.body.innerText;
                        const addressMatch = bodyText.match(/(서울|경기|인천|부산|대구|광주|대전|울산|세종|강원|충북|충남|전북|전남|경북|경남|제주)[^\n]{5,50}/);
                        if (addressMatch) {
                            location = addressMatch[0].trim();
                        }
                    }

                    if (!location) location = '상세페이지 참조';

                    // 2. Price: Use precise selectors
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

                    // 3. Tags
                    let parking = '';
                    let time = '';
                    let capacity = '';

                    const parkingEl = document.querySelector('.detail-car');
                    const timeEl = document.querySelector('.detail-time');
                    const peopleEl = document.querySelector('.detail-people');

                    if (parkingEl) parking = (parkingEl as HTMLElement).innerText.trim();
                    if (timeEl) time = (timeEl as HTMLElement).innerText.trim();
                    if (peopleEl) capacity = (peopleEl as HTMLElement).innerText.trim();

                    // 4. Get image from detail page as fallback
                    let detailImage = '';
                    const mainImg = document.querySelector('.class-detail-img img, .swiper-slide img');
                    if (mainImg) {
                        detailImage = (mainImg as HTMLImageElement).src ||
                            (mainImg as HTMLElement).getAttribute('data-src') || '';
                    }

                    return { location, parking, time, capacity, discountRate, originalPrice, finalPrice, detailImage };
                });

                await detailPage.close();

                const tags = [
                    detailInfo.parking,
                    detailInfo.time,
                    detailInfo.capacity
                ].filter(s => s && s.trim() !== '' && !['Copy Address', '주소복사'].includes(s) && !s.includes('http'));

                // Use detail page image as fallback if list image is placeholder
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

        console.log(`\nScraping complete! Saved ${results.length} items to ${OUTPUT_FILE}`);

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

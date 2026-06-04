import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';
import path from 'path';
import { atomicWriteJson } from './utils/scraper-utils';

puppeteer.use(StealthPlugin());

export interface Performance {
    id: string;
    title: string;
    image: string;
    date: string;
    venue: string;
    link: string;
    region: string;
    genre: string;
    price: string;
    originalPrice: string;
    discount: string;
    runningTime: string;
    ageRating: string;
    casting: string;
    address?: string;
    description?: string;
    feesAndPrograms?: string;
    priceDetail?: string;
    synopsisImages?: string[];
    stillImages?: string[];
    backupPoster?: string;
    website?: string;
    sourceUpdatedAt?: string;
}

const OUTPUT_PATH = path.resolve(process.cwd(), 'src/data/timeticket.json');

// Region codes: 114 (Daehak-ro), 115 (Seoul), 120 (Gyeonggi/Incheon)
const REGION_CODES = [
    { code: 114, region: 'seoul' },
    { code: 115, region: 'seoul' },
    { code: 120, region: 'gyeonggi' },
];

/**
 * Simple CLI Progress Bar
 */
class ProgressBar {
    private total: number;
    private current: number;
    private barLength: number;

    constructor(total: number, barLength: number = 40) {
        this.total = total;
        this.current = 0;
        this.barLength = barLength;
    }

    update(current: number) {
        this.current = current;
        const percentage = (this.current / this.total) * 100;
        const filledLength = Math.round((this.barLength * this.current) / this.total);
        const emptyLength = this.barLength - filledLength;

        const bar = '█'.repeat(filledLength) + '░'.repeat(emptyLength);

        process.stdout.write(`\r[${bar}] ${percentage.toFixed(1)}% | ${this.current}/${this.total}`);
    }

    finish() {
        process.stdout.write('\n');
    }

}

function slugify(text: string): string {
    return text
        .replace(/[^a-zA-Z0-9가-힣]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
}

function compactText(text?: string) {
    return (text || '').replace(/\s+/g, ' ').trim();
}

function extractTimeTicketDetailHints(text?: string) {
    const compact = compactText(text);
    const periodMatch = compact.match(/진행기간\s*((?:20\d{2}[.\-/]\d{1,2}[.\-/]\d{1,2})(?:\s*~\s*(?:20\d{2}[.\-/]\d{1,2}[.\-/]\d{1,2}))?|OPEN\s*RUN|오픈런)/i);
    const venueMatch = compact.match(/(?:장소|공연장)\s+(.+?)(?:\s+주소|\s+주차|\s+좌석|\s+문의|$)/);
    const addressMatch = compact.match(/주소\s+(.+?)(?:\s+주차|\s+좌석|\s+문의|\s+자주묻는질문|$)/);
    const cleanVenue = compactText(venueMatch?.[1])
        .replace(/\s*\/\s*총.*$/u, '')
        .replace(/\s*총\s*\d+석.*$/u, '')
        .trim();

    return {
        date: compactText(periodMatch?.[1]).replace(/\s+/g, ' '),
        venue: cleanVenue,
        address: compactText(addressMatch?.[1]).replace(/\s*,\s*/g, ', '),
    };
}

function isUsefulTimeTicketImage(url?: string) {
    return Boolean(url)
        && /^https?:\/\//i.test(url || '')
        && !/logo|icon|blank|loading|spacer|sprite|daumcdn|kakao|map|tile|roadview/i.test(url || '');
}

function saveData(data: Performance[]) {
    if (data.length === 0) {
        console.log("No items to save.");
        return;
    }
    atomicWriteJson(OUTPUT_PATH, data);
    console.log(`\nSaved ${data.length} items to ${OUTPUT_PATH}`);
}

function loadExistingData(): Map<string, Performance> {
    if (!fs.existsSync(OUTPUT_PATH)) return new Map();
    try {
        const data = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf-8'));
        const map = new Map<string, Performance>();
        data.forEach((item: Performance) => {
            if (item.link) map.set(item.link, item);
        });
        return map;
    } catch (e) {
        console.warn("Failed to load existing data for incremental scraping.");
        return new Map();
    }
}

async function scrapeTimeTicket() {
    console.log(`Starting TimeTicket Scraper...`);
    console.log(`Using executablePath: ${process.env.PUPPETEER_EXECUTABLE_PATH || 'Bundled'}`);

    // Launch options for better stability in varied environments
    const browser = await puppeteer.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--window-size=1280,1024'
        ],
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 1024 });

    // Set User Agent and Headers for stability
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({
        'Accept-Language': 'ko-KR,ko;q=0.9',
    });

    // Simplified loading for stability
    const allItems: Performance[] = [];
    const seenTitles = new Set<string>();
    const existingDataMap = loadExistingData();
    console.log(`Loaded ${existingDataMap.size} existing items for incremental scraping.`);

    // 1. Collect Links
    console.log(`\nPhase 1: Collecting performance links...`);

    let pendingItems: { link: string, region: string, title: string, image: string, discount: string, price: string, genre: string }[] = [];

    // Categories: Prioritize Kids/Activity to ensure correct genre attribution before deduplication
    const CATEGORIES = [
        { id: 2123, defaultGenre: 'kids' },      // Kids
        { id: 2125, defaultGenre: 'activity' },  // Activity
        { id: 2096, defaultGenre: 'play' },      // Performance
        { id: 2100, defaultGenre: 'exhibition' } // Exhibition
    ];

    for (const { code, region } of REGION_CODES) {
        for (const cat of CATEGORIES) {
            const url = `https://timeticket.co.kr/list.php?category=${cat.id}&area=${code}`;
            // console.log(`  Visiting ${url}...`);

            try {
                await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

                // Wait for list to load
                try {
                    await page.waitForSelector('a[href^="/product/"]', { timeout: 10000 });
                } catch (e) {
                    const htmlSnippet = await page.evaluate(() => document.body.innerHTML.substring(0, 1000));
                    console.log(`  No items found or timeout for region ${code} category ${cat.id}. URL: ${url}`);
                    // console.log(`  Snippet: ${htmlSnippet}`);
                    continue;
                }

                const listItems: any[] = (await page.evaluate(`((currentRegion, currentCatId, currentDefaultGenre) => {
                    const results = [];
                    // Using updated selectors found in audit
                    const items = document.querySelectorAll('a.list_content');

                    items.forEach((item) => {
                        const linkAttribute = item.getAttribute('href');
                        const link = linkAttribute ? (linkAttribute.startsWith('http') ? linkAttribute : 'https://timeticket.co.kr' + linkAttribute) : '';

                        const imgEl = item.querySelector('img.tt-thumb');
                        let image = imgEl ? (imgEl.getAttribute('src') || imgEl.getAttribute('data-src') || '') : '';
                        if (image && !image.startsWith('http')) {
                            image = 'https://timeticket.co.kr' + image;
                        }

                        const titleEl = item.querySelector('.title');
                        let title = titleEl ? titleEl.textContent?.trim() || '' : '';
                        title = title.replace(/^[\\s\\uFEFF\\xA0]+|[\\s\\uFEFF\\xA0]+$/g, '');

                        const categoryEl = item.querySelector('.category, .meta__cate');
                        const categoryText = categoryEl ? categoryEl.textContent?.trim() || '' : '';

                        let genre = currentDefaultGenre;
                        if (currentCatId === 2096) {
                            if (categoryText.includes('뮤지컬')) genre = 'musical';
                            else if (categoryText.includes('콘서트')) genre = 'concert';
                        }

                        const discountEl = item.querySelector('.sale_percent, .discount, .sale_p, .sale_rate');
                        const discount = discountEl ? discountEl.textContent?.trim() || '' : '';

                        const priceEl = item.querySelector('.price');
                        const price = priceEl ? priceEl.textContent?.trim() || '' : '';

                        if (link && title) {
                            results.push({
                                link,
                                region: currentRegion,
                                title,
                                image,
                                discount,
                                price,
                                genre
                            });
                        }
                    });
                    return results;
                })("${region}", ${cat.id}, "${cat.defaultGenre}")`)) as any;


                // If we get here, either no state or hash mismatch. proceed with full collection.
                // Note regarding TimeTicket: This script collects everything first then scrapes details.
                // Optimization: We could skip *link collection* for this category if hash matches, 
                // BUT we need the items in `allItems` to save the full JSON at the end.
                // Issue: If we skip, we don't have the items to write to `timeticket.json`.
                // Solution: For now, we unfortunately must scrape to get the data to save the full file, 
                // UNLESS `timeticket.json` is appended to? No, it's overwritten.
                // 
                // Alternative for "Optimization": 
                // We typically need to produce the FULL `timeticket.json` every day.
                // If we skip scraping, we effectively delete those items from the output file unless we load them from the previous run.
                // 
                // REVISED STRATEGY:
                // Since the goal is optimization, we should probably output "new/updated" items or merge with existing data?
                // However, the user request implies "skip collection".
                // If we skip collection, `pendingItems` will be empty for this category.
                // 
                // If the user wants to reduce SERVER LOAD, skipping is good.
                // But we need the data.
                // 
                // ACTUALLY: The best approach for a "Full Refresh" architecture (which this seems to be) 
                // is to skip *Detail Scraping* if the list hasn't changed?
                // But the detail page might have changed (unlikely for ticket sales generally, but possible).
                // 
                // Let's implement the "Skip and Carry Over" if possible, or just "Skip" implies "No New Data".
                // Wait, if I skip, the final `timeticket.json` will be missing these items.
                // That's bad.
                // 
                // To support true incremental scraping, we'd need to read the EXISTING `timeticket.json` first,
                // and if we skip a category, we copy the items belonging to that category from the old file.
                // 
                // Let's modify the plan slightly on the fly to support this:
                // 1. Load existing `src/data/timeticket.json` at start.
                // 2. If Hash Matches -> Use existing items for this category/region from the loaded file.
                // 3. If Hash Mismatch -> Scrape fresh.

                // IGNORE THE ABOVE COMMENT BLOCK IN CODE, I WILL IMPLEMENT THE LOGIC BELOW.

                // ... proceeding with adding items to pendingItems ... 

                // Actually, implementing "Load existing" is complex in one go.
                // Let's assume for this specific optimization (as agreed in plan) we just want to update the state 
                // AFTER successful scrape. 
                // WAIT. If I skip, I lose data in the current architecture.
                // I will add logic to LOAD existing data if available to preserve it when skipping.


                for (const item of listItems) {
                    if (!seenTitles.has(item.title)) {
                        seenTitles.add(item.title);
                        pendingItems.push(item);
                    }
                }

            } catch (e) {
                console.error(`  Error collecting links from region ${code} cat ${cat.id}: ${e}`);
            }
        }
    }

    console.log(`  Found ${pendingItems.length} unique performances.`);

    // 2. Scrape Details
    console.log(`\nPhase 2: Scraping details...`);
    const progressBar = new ProgressBar(pendingItems.length);
    let processedCount = 0;

    // Trap interrupts to save partial data
    process.on('SIGINT', () => {
        console.log('\nProcess interrupted! Saving collected data...');
        saveData(allItems);
        process.exit();
    });

    for (const item of pendingItems) {
        // INCREMENTAL SCRAPING OPTIMIZATION:
        // If we already have this item in our existing data (checked by Link), reuse it!
        // This skips the slow detailed page visit.
        if (existingDataMap.has(item.link)) {
            const existing = existingDataMap.get(item.link);
            if (existing) {
                // Update basic fields that might have changed on list page (e.g. discount, price)
                // but keep the expensive details (venue, date, time) from existing.
                // Actually, let's trust existing entirely for speed, 
                // OR we can update `price` / `discount` from `item` if we want.
                // Let's mix: ID keeps same, details keep same, but if list info changed, we could update?
                // For simplicity and speed, just reuse the object but maybe update price?

                // Force update price/discount from valid list item
                existing.price = item.price || existing.price;
                existing.discount = item.discount || existing.discount;

                // Check if we need to backfill originalPrice (for items scraped before the fix)
                // If originalPrice is missing/empty but price exists, we should probably re-scrape detail.
                // Check if it's "Open Run" or just missing data?
                // Actually, if it's missing, let's fall through to Detail Scraping.
                // But we simply 'continue' here.
                // To force scrape, we should NOT continue.
                // But wait, if we fall through, we need to make sure we don't duplicate logic.
                // The simplest way: just don't enter this `if` block if originalPrice is missing.
                const hasDetailImages = Array.isArray(existing.synopsisImages) && existing.synopsisImages.length > 0;
                const hasRichBody = Boolean(existing.description && existing.feesAndPrograms && existing.description.length > 50 && hasDetailImages);
                if (!existing.originalPrice || existing.originalPrice === '' || !hasRichBody) {
                    // If originalPrice is missing, we fall through to the detail scraping block below.
                } else {
                    allItems.push(existing);
                    processedCount++;
                    progressBar.update(processedCount);
                    continue;
                }
            }
        }

        try {
            await page.goto(item.link, { waitUntil: 'domcontentloaded', timeout: 15000 });

            // Wait for the key element containing details. 
            // We'll give it a moment to render any JS driven content
            await new Promise(r => setTimeout(r, 500)); // Minimal wait for stability

            const detailData: any = await page.evaluate(`(() => {
                const openRunDiv = document.querySelector('.openrun');
                let date = '';
                let runningTime = '';
                let ageLimit = '';

                if (openRunDiv) {
                    const pTags = openRunDiv.querySelectorAll('p');
                    pTags.forEach(p => {
                        const text = p.textContent?.trim() || '';
                        if (!text) return;
                        if (text.match(/\\d{4}\\.\\d{2}\\.\\d{2}/) && !date) {
                            date = text;
                        }
                        if (text.includes('분') && !runningTime) {
                            runningTime = text;
                        }
                        if ((text.includes('세') || text.includes('관람') || text.includes('전체')) && !text.includes('분') && !text.match(/\\d{4}\\./) && !ageLimit) {
                            ageLimit = text;
                        }
                    });
                    const runInfoP = openRunDiv.querySelector('.run_info');
                    if (runInfoP && !runningTime) runningTime = runInfoP.textContent?.trim() || '';
                }

                if (!ageLimit || !runningTime) {
                    const radiusBoxes = document.querySelectorAll('.viewpage_text.radius_box');
                    radiusBoxes.forEach(box => {
                        const text = (box.textContent || '').trim();
                        if (!ageLimit && text.includes('이용등급')) {
                            const match = text.match(/이용등급\\s*[:]?\\s*(.*?)(\\n|$)/);
                            if (match) ageLimit = match[1].trim();
                        }
                        if (!runningTime && text.includes('이용시간')) {
                            const match = text.match(/이용시간\\s*[:]?\\s*(.*?)(\\n|$)/);
                            if (match) runningTime = match[1].trim();
                        }
                    });
                }

                const originEl = document.querySelector('.price_info .origin_price');
                const saleEl = document.querySelector('.price_info .sale_price');
                const discountEl = document.querySelector('.sale_info .sale_p');

                let originalPrice = originEl ? originEl.textContent?.trim() : '';
                let salePrice = saleEl ? saleEl.textContent?.trim() : '';
                let discount = discountEl ? discountEl.textContent?.trim() : '';

                let address = '';
                const radiusBoxes = document.querySelectorAll('.viewpage_text.radius_box');
                if (radiusBoxes.length > 0) {
                    const infoText = radiusBoxes[0].textContent || '';
                    if (!salePrice) {
                        const match = infoText.match(/성인\\s*[:]?\\s*([\\d,]+)원/);
                        if (match) salePrice = match[1] + '원';
                    }
                }
                radiusBoxes.forEach(box => {
                    const text = box.innerText;
                    if (text.includes('주소')) {
                        const parts = text.split('주소');
                        if (parts[1]) {
                            const candidate = parts[1].split('\\n')[0].replace(/[:]/g, '').trim();
                            if (candidate) address = candidate;
                        }
                    }
                });

                let venue = '대학로';
                radiusBoxes.forEach(box => {
                    if (box.innerText.includes('장소')) {
                        const v = box.innerText.split('장소')[1].split('\\n')[0].replace(/[:]/g, '').trim();
                        if (v) venue = v;
                    }
                });

                const compact = (value) => (value || '').replace(/\\s+/g, ' ').trim();
                const normalizeUrl = (value) => {
                    const raw = compact(value).replace(/&amp;/g, '&');
                    if (!raw) return '';
                    try {
                        return new URL(raw, location.origin).href;
                    } catch (e) {
                        return '';
                    }
                };
                const metaDescription = compact(document.querySelector('meta[name="description"], meta[property="og:description"]')?.getAttribute('content') || '');
                const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute('href') || location.href;
                const ogImage = normalizeUrl(document.querySelector('meta[property="og:image"]')?.getAttribute('content') || '');

                const sectionBlocks = Array.from(document.querySelectorAll('.detail-section, .viewpage_text.radius_box, .detail-image-fold'))
                    .map(section => {
                        const titleEl = section.querySelector('.detail-section__title, .section_title, h2, h3, h4, strong, b');
                        const title = compact(titleEl?.textContent || '');
                        const text = compact(section.innerText || section.textContent || '');
                        const images = Array.from(section.querySelectorAll('img'))
                            .map(img => normalizeUrl(img.getAttribute('data-src') || img.getAttribute('src') || img.currentSrc || ''))
                            .filter(url => /^https?:\\/\\//i.test(url))
                            .filter(url => !/logo|icon|blank|loading|spacer|sprite|daumcdn|kakao|map|tile|roadview/i.test(url));
                        return { title, text, images };
                    })
                    .filter(block => block.text.length > 20 || block.images.length > 0);

                const sectionImages = Array.from(new Set([
                    ogImage,
                    ...sectionBlocks.flatMap(block => block.images),
                    ...Array.from(document.querySelectorAll('.detail-image-fold img, .viewpage_img img, .detail-section img, .editor img'))
                        .map(img => normalizeUrl(img.getAttribute('data-src') || img.getAttribute('src') || img.currentSrc || '')),
                ]))
                    .filter(url => /^https?:\\/\\//i.test(url))
                    .filter(url => !/logo|icon|blank|loading|spacer|sprite|daumcdn|kakao|map|tile|roadview/i.test(url))
                    .slice(0, 10);

                const importantSections = sectionBlocks
                    .filter(block => !/후기|리뷰|문의|댓글|추천/i.test(block.title + ' ' + block.text))
                    .slice(0, 8);
                const sectionText = importantSections
                    .map(block => block.title && !block.text.startsWith(block.title) ? block.title + '\\n' + block.text : block.text)
                    .filter(Boolean)
                    .join('\\n\\n');
                const aiSummary = compact(document.querySelector('.review-ai-summary__text, .ai_review_summary, .summary_text')?.textContent || '');
                const description = [sectionText, aiSummary ? '관람 후기 요약\\n' + aiSummary : '', metaDescription]
                    .filter(Boolean)
                    .join('\\n\\n')
                    .slice(0, 1600);
                const priceDetail = [
                    originalPrice ? '정상가: ' + originalPrice : '',
                    salePrice ? '판매가: ' + salePrice : '',
                    discount ? '할인: ' + discount : '',
                ].filter(Boolean).join('\\n');

                return {
                    runningTime,
                    ageRating: ageLimit,
                    date: date || 'OPEN RUN',
                    venue,
                    originalPrice,
                    salePrice,
                    address,
                    description,
                    feesAndPrograms: sectionText,
                    priceDetail,
                    synopsisImages: sectionImages,
                    stillImages: sectionImages.slice(1, 5),
                    ogImage,
                    website: canonical,
                    sourceUpdatedAt: new Date().toISOString(),
                };
            })()`);

            // HOT DEAL VALIDATION:
            // User requirement: "Hot deal is not a hot deal if there is no discount rate."
            // We filter out items with no discount or 0% discount.
            const hasDiscount = item.discount && item.discount !== '' && item.discount !== '0%';

            if (!hasDiscount) {
                // console.log(`Skipping ${item.title} - No discount (Not a Hot Deal)`);
                processedCount++;
                progressBar.update(processedCount);
                continue;
            }

            // Use LIST image but upgrade quality (remove /thn/ and thn_)
            let finalImage = item.image;
            if (finalImage) {
                // Example: /upload/product/thn/thn_20240101_12345.jpg -> /upload/product/20240101_12345.jpg
                finalImage = finalImage.replace('/thn/thn_', '/');
                finalImage = finalImage.replace('/thn/', '/'); // Just in case
            }
            const detailHints = extractTimeTicketDetailHints([detailData.description, detailData.feesAndPrograms].filter(Boolean).join('\n'));
            const detailImages = Array.isArray(detailData.synopsisImages)
                ? detailData.synopsisImages.filter(isUsefulTimeTicketImage)
                : [];
            const primaryImage = finalImage || detailData.ogImage || detailImages[0] || item.image;
            const finalDate = detailData.date && detailData.date !== 'OPEN RUN'
                ? detailData.date
                : (detailHints.date || detailData.date);
            const finalVenue = detailData.venue && detailData.venue !== '대학로'
                ? detailData.venue
                : (detailHints.venue || detailData.venue);
            const finalAddress = detailData.address || detailHints.address;

            allItems.push({
                id: `perf_${slugify(item.title)}`,
                title: item.title,
                image: primaryImage,
                date: finalDate,
                venue: finalVenue,
                link: item.link,
                region: item.region,
                genre: item.genre,
                price: detailData.salePrice || item.price, // Prefer detail sale price
                originalPrice: detailData.originalPrice || '', // Prefer detail origin price, do not fallback to discounted price
                discount: item.discount,
                runningTime: detailData.runningTime,
                ageRating: detailData.ageRating,
                casting: '',
                address: finalAddress,
                description: detailData.description,
                feesAndPrograms: detailData.feesAndPrograms || detailData.description,
                priceDetail: [
                    detailData.priceDetail,
                    item.discount ? `목록 할인율: ${item.discount}` : '',
                ].filter(Boolean).join('\n'),
                synopsisImages: detailImages.slice(0, 8),
                stillImages: Array.isArray(detailData.stillImages) ? detailData.stillImages.filter(isUsefulTimeTicketImage) : detailImages.slice(1, 5),
                backupPoster: finalImage || item.image,
                website: detailData.website || item.link,
                sourceUpdatedAt: detailData.sourceUpdatedAt || new Date().toISOString(),
            });


        } catch (e) {
            // console.error(`Failed to scrape ${item.title}: ${e}`);
        }

        processedCount++;
        progressBar.update(processedCount);
    }

    progressBar.finish();
    console.log(`\nCompleted! Total collected: ${allItems.length}`);

    await browser.close();

    if (allItems.length === 0) {
        console.error("No items collected! Skipping file save to prevent data loss.");
        return;
    }

    saveData(allItems);
}

scrapeTimeTicket().catch(console.error);


import axios from 'axios';
import * as cheerio from 'cheerio';
import iconv from 'iconv-lite';
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import crypto from 'crypto';
import cliProgress from 'cli-progress';

puppeteer.use(StealthPlugin());

function slugify(text: string): string {
    return text
        .replace(/[^a-zA-Z0-9가-힣]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
}

interface Performance {
    id: string;
    title: string;
    image: string;
    date: string;
    venue: string;
    link: string;
    region: string;
    genre: string;
    // New fields
    runningTime?: string;
    ageRating?: string;
    price?: string;
    originalPrice?: string;
    discount?: string;
    lastEnriched?: string; // ISO Date string
}

const outputPath = path.resolve(process.cwd(), 'src/data/interpark.json');

const REGIONS = {
    seoul: '42001',
    gyeonggi: '42010',
    incheon: '42011',
};

async function getRegions() {
    console.log('Fetching region list...');
    const url = 'https://ticket.interpark.com/TiKi/Special/TPRegionReserve.asp?Region=42001';

    try {
        const response = await axios.get(url, {
            responseType: 'arraybuffer',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            },
            timeout: 10000,
        });

        const decoded = iconv.decode(response.data, 'euc-kr');
        const $ = cheerio.load(decoded);
        const regions: { name: string, code: string }[] = [];

        // Helper to decode EUC-KR %-encoded string
        const decodeEucKrParam = (encoded: string) => {
            try {
                const hex = encoded.replace(/%/g, '');
                const buffer = Buffer.from(hex, 'hex');
                return iconv.decode(buffer, 'euc-kr');
            } catch (e) {
                return null;
            }
        };

        $('.Rg_list_tab a').each((_, el) => {
            const $el = $(el);
            const href = $el.attr('href') || '';
            const regionMatch = href.match(/Region=(\d+)/);
            const nameMatch = href.match(/RegionName=([^&]+)/);

            if (regionMatch && nameMatch) {
                const code = regionMatch[1];
                let name = decodeEucKrParam(nameMatch[1]);

                if (name && name !== '전체') {
                    if (!regions.find(r => r.code === code)) {
                        regions.push({ name: name.trim(), code });
                    }
                }
            }
        });

        // Fallback
        if (regions.length === 0) {
            $('a[href*="Region="]').each((_, el) => {
                const $el = $(el);
                const href = $el.attr('href') || '';
                const regionMatch = href.match(/Region=(\d+)/);
                const nameMatch = href.match(/RegionName=([^&]+)/);

                if (regionMatch && nameMatch) {
                    const code = regionMatch[1];
                    let name = decodeEucKrParam(nameMatch[1]);
                    if (name && name.length < 10 && !name.includes('booking') && name !== '전체') {
                        if (!regions.find(r => r.code === code)) {
                            regions.push({ name: name.trim(), code });
                        }
                    }
                }
            });
        }

        console.log(`Found ${regions.length} regions.`);
        return regions;

    } catch (error) {
        console.error('Error fetching region list, using defaults.');
        return [
            { name: '서울', code: '42001' },
            { name: '경기', code: '42010' },
            { name: '인천', code: '42011' }
        ];
    }
}

async function fetchPerformances(regionCode: string, regionName: string): Promise<Performance[]> {
    const url = `https://ticket.interpark.com/TiKi/Special/TPRegionReserve.asp?Region=${regionCode}`;

    try {
        const response = await axios.get(url, {
            responseType: 'arraybuffer',
            headers: { 'User-Agent': 'Mozilla/5.0' },
            timeout: 10000,
        });

        const decoded = iconv.decode(response.data, 'euc-kr');
        const $ = cheerio.load(decoded);
        const performances: Performance[] = [];

        $('.obj').each((_, obj) => {
            const $obj = $(obj);
            const $genreAnchor = $obj.find('.obj_tit a');
            let genre = 'etc';
            if ($genreAnchor.length) {
                const name = $genreAnchor.attr('name') || '';
                const lowerName = name.toLowerCase();
                if (lowerName.includes('musical')) genre = 'musical';
                else if (lowerName.includes('concert')) genre = 'concert';
                else if (lowerName.includes('play')) genre = 'play';
                else if (lowerName.includes('classic')) genre = 'classic';
                else if (lowerName.includes('exhibit')) genre = 'exhibition';
                else if (lowerName.includes('theme') || lowerName.includes('kid')) genre = 'leisure';
            }

            $obj.find('.content').each((i, el) => {
                const $el = $(el);
                const $nameDd = $el.find('dd.name');
                const $titleLink = $nameDd.find('p.txt a');
                const title = $titleLink.text().trim();
                const href = $titleLink.attr('href') || '';
                let link = href.startsWith('http') ? href : `https://ticket.interpark.com${href}`;

                // Convert to new link format if possible for better detail scraping alignment
                // Link is usually: http://ticket.interpark.com/Ticket/Goods/GoodsInfo.asp?GoodsCode=24017373
                const idMatch = link.match(/GoodsCode=([A-Za-z0-9]+)/);
                let id = idMatch ? idMatch[1] : null;

                const $img = $nameDd.find('img');
                let image = $img.attr('src') || '';
                if (image.includes('/rz/image/play/goods/poster/')) {
                    image = image.replace('/rz/image/play/goods/poster/', '/Play/image/large/')
                        .replace('_p_s.jpg', '_p.gif');
                }
                if (image && image.startsWith('http://')) {
                    image = image.replace('http://', 'https://');
                }

                const venue = $el.find('dd.place').text().trim();
                const date = $el.find('dd.date').text().trim();

                if (!id && title) {
                    const uniqueString = `${title}-${date}-${venue}`;
                    id = `unknown-${crypto.createHash('md5').update(uniqueString).digest('hex').substring(0, 8)}`;
                }

                if (title && id) {
                    const stableId = `perf_${slugify(title)}`;
                    performances.push({
                        id: stableId,
                        title,
                        image,
                        date,
                        venue,
                        link: `https://tickets.interpark.com/goods/${id}`, // Keep numeric ID in link for detail scraping
                        region: regionName,
                        genre
                    });
                }
            });
        });

        return performances;
    } catch (error) {
        console.error(`Error fetching data for ${regionName}:`, error);
        return [];
    }
}

async function scrapeDetails(browser: any, items: Performance[], existingEnriched: Map<string, Performance>) {
    const targetGenres = ['musical', 'play', 'concert', 'classic', 'leisure'];
    const candidates = items.filter(i => targetGenres.includes(i.genre));
    const others = items.filter(i => !targetGenres.includes(i.genre));

    // Split candidates into 'already done' vs 'todo'
    const alreadyDone: Performance[] = [];
    const todo: Performance[] = [];

    // Helper: Check if item was enriched recently (e.g., within 7 days)
    const isRecentlyEnriched = (ex: Performance) => {
        if (!ex.lastEnriched) return false;
        try {
            const last = new Date(ex.lastEnriched);
            const now = new Date();
            const diffDays = (now.getTime() - last.getTime()) / (1000 * 3600 * 24);
            return diffDays < 7;
        } catch (e) { return false; }
    };

    candidates.forEach(c => {
        if (existingEnriched.has(c.id)) {
            const ex = existingEnriched.get(c.id)!;

            // Criteria for skipping:
            // 1. Has important details (MUST have a REAL price to be considered fully enriched)
            // 2. Was checked recently (lastEnriched < 7 days), preventing infinite retry of empty items
            const hasBadPrice = !ex.price || ex.price === '무료/이벤트' || ex.price === '이벤트' || ex.price === '가격정보없음';
            const hasCompleteData = !hasBadPrice && (ex.runningTime || ex.ageRating);

            if (hasCompleteData || (isRecentlyEnriched(ex) && !hasBadPrice)) {
                alreadyDone.push({ ...c, ...ex });
            } else {
                todo.push(c);
            }
        } else {
            todo.push(c);
        }
    });

    console.log(`Total Candidates: ${candidates.length}. Smart Skip: ${alreadyDone.length}. To Enrich: ${todo.length}.`);

    const enrichedResult: Performance[] = [...alreadyDone];

    // Progress bar for ToDo
    const bar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
    if (todo.length > 0) {
        bar.start(todo.length, 0);
    }

    // Concurrency: Reduced to 5 to prevent timeouts on CI
    const CONCURRENCY = 5;
    for (let i = 0; i < todo.length; i += CONCURRENCY) {
        const chunk = todo.slice(i, i + CONCURRENCY);

        const promises = chunk.map(async (item) => {
            const page = await browser.newPage();
            try {
                // Optimize: Block heavy media only (Allow styles/fonts for correct rendering)
                await page.setRequestInterception(true);
                page.on('request', (req: any) => {
                    if (['image', 'media'].includes(req.resourceType())) {
                        req.abort();
                    } else {
                        req.continue();
                    }
                });

                await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
                await page.setViewport({ width: 1280, height: 800 });

                // Extract original GoodsCode from link
                const goodsIdMatch = item.link.match(/\/goods\/([A-Za-z0-9]+)/);
                const goodsId = goodsIdMatch ? goodsIdMatch[1] : null;
                if (!goodsId) {
                    req.continue();
                    return;
                }
                const detailUrl = `https://tickets.interpark.com/goods/${goodsId}`;

                await page.goto(detailUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

                // [FIX] Force close popups that might block content scraping
                try {
                    await page.evaluate(function () {
                        document.querySelectorAll('#popup-prdGuide, .popupLayer, .layerPopup').forEach(function (el) { el.remove(); });
                    });
                } catch (e) { }

                try {
                    await page.waitForSelector('.infoList', { timeout: 5000 });
                } catch (e) { }

                // 1. Basic Info & Base Price
                const basicInfo = await page.evaluate(function () {
                    // 1. Info Items (Runtime, Age)
                    let runningTime = '';
                    let ageRating = '';

                    // Try finding .infoList items first, or just .infoItem globally if .infoList class is missing
                    const infoItems = Array.from(document.querySelectorAll('.infoList .infoItem, li.infoItem'));
                    if (infoItems.length > 0) {
                        infoItems.forEach(item => {
                            const label = item.querySelector('.infoLabel')?.textContent?.trim() || '';
                            const text = item.querySelector('.infoText')?.textContent?.trim() || '';

                            if (label.includes('공연시간') || label.includes('관람시간')) runningTime = text;
                            if (label.includes('관람연령') || label.includes('이용등급')) ageRating = text;
                        });
                    }

                    // Fallback to old structure (dl > dd) if not found
                    if (!runningTime || !ageRating) {
                        const items = Array.from(document.querySelectorAll('li.infoItem, dl > div, dl > .item'));
                        items.forEach(item => {
                            const label = item.querySelector('.infoLabel, dt')?.textContent?.trim() || '';
                            const text = item.querySelector('.infoDesc .infoText, dd')?.textContent?.trim() || '';

                            if (!runningTime && (label.includes('공연시간') || label.includes('관람시간'))) runningTime = text;
                            if (!ageRating && (label.includes('관람연령') || label.includes('이용등급'))) ageRating = text;
                        });
                    }

                    // 3. Fallback: Regex Search on Body Text (for cases like 26001154 where structural markup might differ or be hidden)
                    if (!runningTime || !ageRating) {
                        const bodyText = document.body.innerText;

                        if (!runningTime) {
                            // Match "공연시간" OR "관람시간" followed by newline/spaces and then likely "XXX분"
                            // "공연시간 \n 100분"
                            const timeMatch = bodyText.match(/(?:공연시간|관람시간)\s*\n*([0-9,]+분)/);
                            if (timeMatch) runningTime = timeMatch[1];
                        }

                        if (!ageRating) {
                            // Match "관람연령" followed by newline/spaces and then text ending in "관람가능" or "이상"
                            // E.g. "관람연령\n24개월이상 관람가능"
                            const ageMatch = bodyText.match(/관람연령\s*\n*(.*?관람가능|.*?\s이상)/);
                            if (ageMatch) ageRating = ageMatch[1].trim();
                        }
                    }

                    // 2. Price Info
                    let price = '';
                    let originalPrice = '';
                    let discount = '';

                    // Strategy A: Main Page Price List (New Structure)
                    // Added .infoPriceList .infoPriceItem based on Y5000131 debugging
                    const priceItems = Array.from(document.querySelectorAll('.infoList .infoItem .infoDesc .priceList .priceItem, .infoPriceList .infoPriceItem, .infoPriceItem'));

                    // 1. Try finding detailed text list first (e.g., "전석 (정상가) 66,000원")
                    // This is common in newer Interpark pages (e.g. 25018004)
                    const detailContainer = document.querySelector('.prdPriceDetail');
                    if (detailContainer) {
                        const text = detailContainer.textContent || '';
                        // Extract all "Label Price" pairs
                        // Regex to match "Sort (Type) 00,000원"
                        // Handle multiline
                        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

                        let normalPrice = 0;
                        let salePrice = 0;

                        lines.forEach(line => {
                            const match = line.match(/(.*?)\s*([0-9,]+)원/);
                            if (match) {
                                const label = match[1];
                                const val = parseInt(match[2].replace(/,/g, ''), 10);

                                if (label.includes('정상가')) {
                                    normalPrice = val;
                                } else if (label.includes('예매가') || label.includes('할인가')) {
                                    salePrice = val;
                                } else if (!salePrice && !normalPrice) {
                                    // If no specific keyword, assume it's the main price
                                    salePrice = val;
                                }
                            }
                        });

                        if (normalPrice > 0 && salePrice > 0) {
                            originalPrice = normalPrice.toLocaleString() + '원';
                            price = salePrice.toLocaleString() + '원';
                            const rateVal = Math.round((1 - (salePrice / normalPrice)) * 100);
                            discount = `${rateVal}%`;
                        } else if (salePrice > 0) {
                            price = salePrice.toLocaleString() + '원';
                        }
                    }

                    // 2. If Detail Text Failed, try structured elements (.sale, .price)
                    if (!price && priceItems.length > 0) {
                        // Filter out items that are ONLY the "View All Prices" button with no actual price elements
                        const validPriceItems = priceItems.filter(i => {
                            const text = i.textContent || '';
                            const hasPriceEl = i.querySelector('.price') || i.querySelector('.sale');
                            // Keep if it has structured price elements, even if it also contains '전체가격보기'
                            if (hasPriceEl) return true;
                            // Otherwise, exclude '전체가격보기'-only items and require '원' in text
                            return !text.includes('전체가격보기') && text.includes('원');
                        });

                        let bestItem = validPriceItems.find(i => i.querySelector('.sale') && i.querySelector('.price'));
                        if (!bestItem) bestItem = validPriceItems.find(i => i.querySelector('.sale'));
                        if (!bestItem) bestItem = validPriceItems.find(i => i.querySelector('.price')); // Fallback (sometimes .price is the final price if no discount)
                        if (!bestItem && validPriceItems.length > 0) bestItem = validPriceItems[0];

                        if (bestItem) {
                            // Structure 1: .sale, .original, .rate
                            const sale = bestItem.querySelector('.sale')?.textContent?.trim() || '';
                            const priceVal = bestItem.querySelector('.price')?.textContent?.trim() || ''; // Can be original price in discount context
                            const rate = bestItem.querySelector('.rate')?.textContent?.trim() || '';

                            if (sale && priceVal && rate) {
                                // Discount Case
                                price = sale;
                                originalPrice = priceVal;
                                discount = rate;
                            } else if (sale) {
                                price = sale;
                            } else if (priceVal) {
                                price = priceVal;
                            } else {
                                // Fallback: try capturing any number with '원' from text content if structure fails
                                const text = bestItem.textContent || '';
                                const match = text.match(/([0-9,]+원)/);
                                if (match) price = match[1];
                            }
                        }
                    }

                    // Strategy B: Old Structure text parsing
                    if (!price) {
                        const dlPriceText = document.querySelector('.infoItem.infoPrice .infoDesc')?.textContent?.trim() || '';
                        if (dlPriceText && !dlPriceText.includes('전체가격보기')) {
                            const match = dlPriceText.match(/([0-9,]+원)/);
                            if (match) price = match[1];
                            else price = dlPriceText;
                        }
                    }

                    // Strict validation: if price doesn't have a number, clear it
                    if (price && !/[0-9]/.test(price)) {
                        price = '';
                    }

                    // Final ultimate global fallback: scan for any price-like format in info list
                    if (!price) {
                        const genericItems = Array.from(document.querySelectorAll('.infoItem, .infoPriceItem'));
                        for (let el of genericItems) {
                            const txt = el.textContent || '';
                            if (!txt.includes('전체가격보기') && txt.match(/[0-9,]{3,}원/)) {
                                price = txt.match(/([0-9,]{3,}원)/)![1];
                                break;
                            }
                        }

                        // Also try: price area that has '전체가격보기' button but also shows a price number
                        if (!price) {
                            const priceAreaItems = Array.from(document.querySelectorAll('.infoItem, .infoDesc'));
                            for (let el of priceAreaItems) {
                                const txt = el.textContent || '';
                                // Match items that have both '전체가격보기' AND a price number - extract the price
                                if (txt.includes('전체가격보기') && txt.match(/[0-9,]{3,}원/)) {
                                    const priceMatch = txt.match(/([0-9,]{3,}원)/);
                                    if (priceMatch) {
                                        price = priceMatch[1];
                                        // Look for discount info too
                                        const discountMatch = txt.match(/(\d+)%/);
                                        const origMatch = txt.match(/([0-9,]{3,}원)\s*\n*\s*([0-9,]{3,}원)/);
                                        if (discountMatch) discount = discountMatch[1] + '%';
                                        if (origMatch) {
                                            const p1 = parseInt(origMatch[1].replace(/[^0-9]/g, ''));
                                            const p2 = parseInt(origMatch[2].replace(/[^0-9]/g, ''));
                                            if (p1 > p2) {
                                                originalPrice = origMatch[1];
                                                price = origMatch[2];
                                            } else if (p2 > p1) {
                                                originalPrice = origMatch[2];
                                                price = origMatch[1];
                                            }
                                        }
                                        break;
                                    }
                                }
                            }
                        }
                    }

                    // Fallback for "Free" or "Event" tickets with no price text
                    // Only apply if no price-like numbers exist in the entire price info area
                    if (!price) {
                        // Double-check: scan the entire info area for ANY price number first
                        const anyPriceInInfo = Array.from(document.querySelectorAll('.infoList, .infoItem, .infoPriceList, .prdPriceDetail'))
                            .some(el => (el.textContent || '').match(/[0-9,]{3,}원/));

                        if (!anyPriceInInfo) {
                            const text = (document.title + ' ' + (document.body ? document.body.innerText : '')).toLowerCase();
                            let isEvent = false;
                            let isFree = false;

                            const eventKeywords = ['로터리', '응모', '초청', '초대', '당첨'];
                            const freeKeywords = ['무료', '0원', '정오의 음악회'];

                            for (const kw of eventKeywords) {
                                if (text.includes(kw)) {
                                    isEvent = true;
                                    break;
                                }
                            }

                            for (const kw of freeKeywords) {
                                if (text.includes(kw)) {
                                    isFree = true;
                                    break;
                                }
                            }

                            if (isEvent && isFree) {
                                price = '무료/이벤트';
                            } else if (isEvent) {
                                price = '이벤트';
                            } else if (isFree) {
                                price = '무료';
                            } else {
                                price = '가격정보없음';
                            }
                        }
                    }

                    return { runningTime, ageRating, price, originalPrice, discount };
                });

                let { runningTime, ageRating, price, originalPrice, discount } = basicInfo;

                // 3. Click Price Popup for Detailed Breakdown if basic info is insufficient
                // Only try if we don't have a discount but suspect there is one, or just to get the base General price.
                try {
                    // Update selector to support button or a tag
                    const priceBtn = await page.$('[data-popup="info-price"]');
                    if (priceBtn && (!price || price === '무료/이벤트' || price === '이벤트' || price === '가격정보없음' || !originalPrice)) {
                        await priceBtn.click();
                        await page.waitForSelector('.popPriceTable', { visible: true, timeout: 3000 });

                        const popupData = await page.evaluate(function () {
                            const rows = Array.from(document.querySelectorAll('.popPriceTable tbody tr'));
                            let prices: number[] = [];

                            rows.forEach(function (tr) {
                                const tds = tr.querySelectorAll('td');
                                const valStr = tds[tds.length - 1]?.textContent?.trim() || '';
                                const val = parseInt(valStr.replace(/[^0-9]/g, ''), 10);
                                if (!isNaN(val) && val > 0) prices.push(val);
                            });

                            // Simple logic: Max price = Original, Min price (if different) = Discounted
                            // This assumes the table lists BOTH standard and discounted prices.
                            // If it only lists the final price, we can't derive discount here.
                            if (prices.length > 0) {
                                const max = Math.max(...prices);
                                const min = Math.min(...prices);
                                return { max, min, hasDiff: max !== min };
                            }
                            return null;
                        });

                        if (popupData) {
                            if (!price) price = popupData.min.toLocaleString() + '원';

                            // Only infer discount if we found a spread and didn't have specific discount info yet
                            if (popupData.hasDiff && !originalPrice) {
                                originalPrice = popupData.max.toLocaleString() + '원';
                                const rateVal = Math.round((1 - (popupData.min / popupData.max)) * 100);
                                discount = `${rateVal}%`;
                            }
                        }
                    }
                } catch (e) {
                    // Ignore popup errors
                }

                return {
                    ...item,
                    runningTime,
                    ageRating,
                    price,
                    originalPrice,
                    discount,
                    lastEnriched: new Date().toISOString()
                };

            } catch (e) {
                console.error(`Failed to enrich ${item.id}:`, e);
                return item;
            } finally {
                await page.close();
            }
        });

        const results = await Promise.all(promises);
        enrichedResult.push(...results);
        if (todo.length > 0) bar.increment(results.length);

        // Autosave every 20 items (4 chunks)
        if (i % 20 === 0 || i + CONCURRENCY >= todo.length) {
            const currentSave = [...enrichedResult, ...others];
            // Note: 'others' might have items that are in 'existingEnriched' but we filtered 'others' by genre.
            // If non-musical items were in 'existing', they are not in 'targets'. They are in 'others'.
            // So we just save 'enrichedResult' + 'others'.
            fs.writeFileSync(outputPath, JSON.stringify(currentSave, null, 2));
        }
    }
    if (todo.length > 0) bar.stop();

    // Final merge
    const finalItems = [...enrichedResult, ...others];
    return finalItems;
}

(async () => {
    console.log('Starting Interpark Scraper (TS) with Resume...');

    // 0. Load existing data
    const existingMap = new Map<string, Performance>();
    if (fs.existsSync(outputPath)) {
        try {
            const raw = fs.readFileSync(outputPath, 'utf-8');
            const data = JSON.parse(raw) as Performance[];
            data.forEach(d => existingMap.set(d.id, d));
            console.log(`Loaded ${data.length} existing items for resume check.`);
        } catch (e) { console.log('No existing data or parse error.'); }
    }

    // 1. Fetch Regions & List
    const regions = await getRegions();
    let allItems: Performance[] = [];

    for (const r of regions) {
        console.log(`Scanning ${r.name}...`);
        const items = await fetchPerformances(r.code, r.name);
        allItems.push(...items);
        await new Promise(r => setTimeout(r, 200));
    }

    // Dedupe
    const itemMap = new Map<string, Performance>();
    allItems.forEach(i => itemMap.set(i.id, i));
    const uniqueItems = Array.from(itemMap.values());
    console.log(`Found ${uniqueItems.length} total items. Enriching Items...`);

    // 2. Enrich Details
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const finalItems = await scrapeDetails(browser, uniqueItems, existingMap);

        // 3. Final Save
        fs.writeFileSync(outputPath, JSON.stringify(finalItems, null, 2));
        console.log(`Saved ${finalItems.length} items to ${outputPath}`);

    } finally {
        await browser.close();
    }
})();

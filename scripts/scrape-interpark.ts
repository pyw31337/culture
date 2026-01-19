
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
                    performances.push({
                        id,
                        title,
                        image,
                        date,
                        venue,
                        link: `https://tickets.interpark.com/goods/${id}`, // Use new URL format for consistency
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
    // Only target relevant genres
    const candidates = items.filter(i => ['musical', 'play', 'concert', 'classic'].includes(i.genre));
    const others = items.filter(i => !['musical', 'play', 'concert', 'classic'].includes(i.genre));

    // Split candidates into 'already done' vs 'todo'
    const alreadyDone: Performance[] = [];
    const todo: Performance[] = [];

    candidates.forEach(c => {
        if (existingEnriched.has(c.id)) {
            const ex = existingEnriched.get(c.id)!;
            // Consider it done if it has runningTime OR price (and date hasn't moved too far?)
            // Just use ID match and existence of details.
            if (ex.runningTime || ex.price || ex.ageRating) {
                alreadyDone.push({ ...c, ...ex }); // Merge to keep fresh list info but old details
            } else {
                todo.push(c);
            }
        } else {
            todo.push(c);
        }
    });

    console.log(`Total Candidates: ${candidates.length}. Already cached: ${alreadyDone.length}. To enrich: ${todo.length}.`);

    const enrichedResult: Performance[] = [...alreadyDone];

    // Progress bar for ToDo
    const bar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
    if (todo.length > 0) {
        bar.start(todo.length, 0);
    } // If 0, no bar needed?

    // Concurrency
    const CONCURRENCY = 5;
    for (let i = 0; i < todo.length; i += CONCURRENCY) {
        const chunk = todo.slice(i, i + CONCURRENCY);

        const promises = chunk.map(async (item) => {
            const page = await browser.newPage();
            try {
                await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
                await page.setViewport({ width: 1280, height: 800 });

                // Determine 
                const goodsId = item.id;
                const detailUrl = `https://tickets.interpark.com/goods/${goodsId}`;

                await page.goto(detailUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
                try {
                    await page.waitForSelector('ul.info', { timeout: 3000 });
                } catch (e) { }

                // 1. Basic Info & Base Price
                const basicInfo = await page.evaluate(() => {
                    const list = document.querySelector('div.summaryBody > ul');
                    if (!list) return {};

                    const getDescByLabel = (labelIn: string) => {
                        const items = Array.from(list.querySelectorAll('li.infoItem'));
                        const match = items.find(li => li.querySelector('.infoLabel')?.textContent?.includes(labelIn));
                        if (match) {
                            // If just text in p.infoText
                            const p = match.querySelector('.infoDesc .infoText');
                            if (p) return p.textContent?.trim();
                            // If just text node
                            return match.querySelector('.infoDesc')?.textContent?.trim();
                        }
                        return null;
                    };

                    const runningTime = getDescByLabel('공연시간');
                    const ageRating = getDescByLabel('관람연령');

                    // Base Price (Initial Attempt from main list)
                    const priceListItems = Array.from(list.querySelectorAll('.infoItem.infoPrice .infoPriceList .infoPriceItem'));
                    let price = '';

                    for (const li of priceListItems) {
                        if (li.classList.contains('is-largePrice')) continue;
                        const name = li.querySelector('.name')?.textContent?.trim();
                        const val = li.querySelector('.price')?.textContent?.trim();
                        if (val) {
                            price = val; // Take first found
                            break;
                        }
                    }

                    return { runningTime, ageRating, price };
                });

                let { runningTime, ageRating, price } = basicInfo;
                let originalPrice = undefined;
                let discount = undefined;

                // 2. Click Price Popup for Discounts
                const priceBtn = await page.$('a[data-popup="info-price"]');
                if (priceBtn) {
                    await priceBtn.click();
                    try {
                        await page.waitForSelector('.popPriceTable', { visible: true, timeout: 2000 });

                        const discountInfo = await page.evaluate(() => {
                            const rows = Array.from(document.querySelectorAll('.popPriceTable tbody tr'));
                            let stdPriceVal = 0;
                            let stdPriceStr = '';
                            let bookingPriceVal = 0;

                            rows.forEach(tr => {
                                const name = tr.querySelector('.name')?.textContent?.trim() || '';
                                const tds = tr.querySelectorAll('td');
                                const valStr = tds[tds.length - 1]?.textContent?.trim() || '';
                                const val = parseInt(valStr.replace(/[^0-9]/g, ''), 10);
                                if (isNaN(val)) return;

                                // Identify "General" (Standard) Price
                                if (name.includes('일반') || name === '전석' || (tr.querySelector('.category')?.textContent?.includes('전석') && name.includes('일반'))) {
                                    if (val > stdPriceVal) {
                                        stdPriceVal = val;
                                        stdPriceStr = valStr;
                                    }
                                }

                                // Identify "Booking" Discount ("예매 할인")
                                if (name.includes('예매 할인') || name.includes('예매할인')) {
                                    bookingPriceVal = val;
                                }
                            });

                            return { stdPriceVal, stdPriceStr, bookingPriceVal };
                        });

                        // Use standard price if missing
                        if (!price && discountInfo.stdPriceStr) {
                            price = discountInfo.stdPriceStr;
                        }

                        // Apply Discount Logic
                        if (discountInfo.bookingPriceVal > 0 && discountInfo.stdPriceVal > 0 && discountInfo.bookingPriceVal < discountInfo.stdPriceVal) {
                            originalPrice = discountInfo.stdPriceStr;
                            price = discountInfo.bookingPriceVal.toLocaleString() + '원';
                            const rate = Math.round((1 - (discountInfo.bookingPriceVal / discountInfo.stdPriceVal)) * 100);
                            discount = `${rate}%`;
                        }

                    } catch (e) { }
                }

                return {
                    ...item,
                    runningTime,
                    ageRating,
                    price,
                    originalPrice,
                    discount
                };

            } catch (e) {
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


import axios from 'axios';
import * as cheerio from 'cheerio';
import iconv from 'iconv-lite';
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import crypto from 'crypto';

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
}

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

async function scrapeDetails(browser: any, items: Performance[]) {
    const enriched: Performance[] = [];
    // Only scrape musicals
    const targets = items.filter(i => i.genre === 'musical');
    const others = items.filter(i => i.genre !== 'musical');

    // Concurrency
    const CONCURRENCY = 5;
    for (let i = 0; i < targets.length; i += CONCURRENCY) {
        const chunk = targets.slice(i, i + CONCURRENCY);
        console.log(`Enriching Musicals: Chunk ${Math.floor(i / CONCURRENCY) + 1}/${Math.ceil(targets.length / CONCURRENCY)}...`);

        const promises = chunk.map(async (item) => {
            const page = await browser.newPage();
            await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            await page.setViewport({ width: 1280, height: 800 });

            try {
                // Determine 
                const goodsId = item.id;
                const detailUrl = `https://tickets.interpark.com/goods/${goodsId}`;

                await page.goto(detailUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
                try {
                    await page.waitForSelector('ul.info', { timeout: 3000 }); // Try waiting for info list
                } catch (e) { }

                const details = await page.evaluate(() => {
                    // Selectors:
                    // #container > div.contents > div.productWrapper > div.productMain > div.productMainTop > div > div.summaryBody > ul > li:nth-child(3) -> Time
                    // ... :nth-child(4) -> Age
                    // ... li.infoItem.infoPrice -> Price

                    // The structure seems to be: 
                    // div.summaryBody > ul.info > li.infoItem

                    const list = document.querySelector('div.summaryBody > ul');
                    if (!list) return {};

                    const timeEl = list.querySelector('li:nth-child(3) .desc');
                    const ageEl = list.querySelector('li:nth-child(4) .desc');
                    const priceEl = list.querySelector('li.infoItem.infoPrice .desc');

                    let priceText = '';
                    if (priceEl) {
                        // Get first price if multiple? 
                        // "VIP석 77,000원 R석 ..."
                        // Look for structure inside price
                        // Usually: <ul class="priceList"> <li> <div class="name">VIP</div> <div class="price">77,000원</div> ...
                        // If complex, just grab text.
                        // Or check specific structure inside infoPrice

                        const priceItems = priceEl.querySelectorAll('.priceItem');
                        if (priceItems.length > 0) {
                            const first = priceItems[0];
                            const name = first.querySelector('.name')?.textContent || '';
                            const val = first.querySelector('.price')?.textContent || '';
                            const dc = first.querySelector('.discount')?.textContent || ''; // if any
                            priceText = `${name} ${val} ${dc}`.trim();
                        } else {
                            priceText = priceEl.textContent?.trim() || '';
                            // Naive formatting if just text
                            const parts = priceText.split('원');
                            if (parts.length > 1) {
                                priceText = parts[0] + '원';
                            }
                        }
                    }

                    return {
                        runningTime: timeEl?.textContent?.trim(),
                        ageRating: ageEl?.textContent?.trim(),
                        price: priceText
                    };
                });

                return { ...item, ...details };

            } catch (e) {
                // console.error(`Failed to scrape detail for ${item.title}:`);
                return item;
            } finally {
                await page.close();
            }
        });

        const results = await Promise.all(promises);
        enriched.push(...results);
    }

    return [...enriched, ...others];
}

(async () => {
    console.log('Starting Interpark Scraper (TS)...');

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
    console.log(`Found ${uniqueItems.length} total items. Enriching Musicals...`);

    // 2. Enrich Details using Puppeteer
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const finalItems = await scrapeDetails(browser, uniqueItems);

        // 3. Save
        const outputPath = path.resolve(process.cwd(), 'src/data/interpark.json');

        // Merge with existing if needed for accumulation? 
        // User didn't request accumulation for Interpark specifically, but let's be safe.
        // Actually, for Interpark list scraping, we get fresh data every time for the list. 
        // If we want to keep old items that might have expired, we can.
        // But typically list scraping implies 'current' availability.
        // Let's stick to overwriting for now unless accumulation is requested, 
        // OR Accumulate IF genre is musical to save scraping time? No, we scrape fresh.
        // The user only asked for data accumulation for Movie and OTT. "OTT 카테고리도 영화카테고리처럼...". 
        // Did not explicitly say for Musical.

        fs.writeFileSync(outputPath, JSON.stringify(finalItems, null, 2));
        console.log(`Saved ${finalItems.length} items to ${outputPath}`);

    } finally {
        await browser.close();
    }
})();

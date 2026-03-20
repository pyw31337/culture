
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';

puppeteer.use(StealthPlugin());

interface UmClassItem {
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
    ageLimit: string;
    casting: string;
    address: string;
    viewCount?: string;
    lastEnriched?: string;
}

const OUTPUT_PATH = path.resolve(process.cwd(), 'src/data/umclass.json');

// Simple progress bar
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
        if (this.total === 0) return;
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

function saveData(data: UmClassItem[]) {
    if (data.length === 0) {
        console.log("No items to save.");
        return;
    }
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(data, null, 2));
    console.log(`\nSaved ${data.length} items to ${OUTPUT_PATH}`);
}

function slugify(text: string): string {
    return text
        .replace(/[^a-zA-Z0-9가-힣]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
}

async function scrapeUmClass() {
    console.log(`Starting UmClass Scraper...`);

    const browser = await puppeteer.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--window-size=1280,800'
        ],
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
    });

    // Load existing items
    const existingMap = new Map<string, UmClassItem>();
    if (fs.existsSync(OUTPUT_PATH)) {
        try {
            const data = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf-8'));
            data.forEach((item: UmClassItem) => existingMap.set(item.link, item));
        } catch (e) {
            console.log('No existing data found or parse error.');
        }
    }

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    // Header settings for Korean context
    await page.setExtraHTTPHeaders({
        'Accept-Language': 'ko-KR,ko;q=0.9',
    });

    const allItems: UmClassItem[] = [];
    const seenTitles = new Set<string>();


    let pendingItems: { link: string, title: string, image: string, discount: string, price: string }[] = [];

    // Phase 1: Collect all classes
    console.log(`\nPhase 1: Collecting all classes (All Regions / All Categories)...`);
    
    let currentPage = 1;
    let hasNextPage = true;
    const MAX_PAGES = 50; 

    // Header settings for Korean context
    const headers = {
        'Accept-Language': 'ko-KR,ko;q=0.9',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    };

    while (hasNextPage && currentPage <= MAX_PAGES) {
        const url = `https://www.umclass.com/class?page=${currentPage}`;
        console.log(`  Visiting Page ${currentPage}: ${url}`);

        try {
            const response = await axios.get(url, { headers, timeout: 15000 });
            const html = response.data;
            const $ = cheerio.load(html);

            const items = $('a[href*="/classInfo/"]');
            
            if (items.length === 0) {
                console.log(`    No items found on page ${currentPage}. Stopping.`);
                hasNextPage = false;
                break;
            }

            let newItemsCount = 0;
            items.each((_: number, anchor: any) => {
                const link = $(anchor).attr('href');
                if (!link || !link.includes('/classInfo/')) return;
                
                const fullLink = link.startsWith('http') ? link : `https://www.umclass.com${link}`;
                
                const titleElem = $(anchor).find('.class-lis-itm-name');
                const title = titleElem.text().trim();
                if (!title) return;

                // Image extraction
                let image = '';
                const imgDiv = $(anchor).find('.class-lis-img');
                const style = imgDiv.attr('style') || '';
                const bgMatch = style.match(/url\(['"]?([^'"]+)['"]?\)/);
                if (bgMatch) {
                    image = bgMatch[1];
                } else if (imgDiv.attr('data-original')) {
                    image = imgDiv.attr('data-original') || '';
                }

                // Price/Discount
                const priceElem = $(anchor).find('.class-lis-mony-txt');
                let price = '';
                let discount = '';

                priceElem.each((_: number, el: any) => {
                    const text = $(el).text().trim();
                    if (text.endsWith('%')) discount = text;
                    if (text.endsWith('원')) price = text;
                });

                if (!seenTitles.has(title)) {
                    seenTitles.add(title);
                    pendingItems.push({
                        title,
                        link: fullLink,
                        image,
                        price,
                        discount
                    });
                    newItemsCount++;
                }
            });

            console.log(`    Found ${items.length} items (${newItemsCount} new).`);
            currentPage++;

        } catch (e: any) {
            console.error(`    Error on page ${currentPage}: ${e.message}`);
            hasNextPage = false;
        }
    }



    console.log(`  Total unique classes found: ${pendingItems.length}`);
    await page.close(); // Close list page

    // Phase 2: Details
    console.log(`\nPhase 2: Scraping details (Smart Incremental - Parallel)...`);

    // Filter what needs enrichment
    const todo: typeof pendingItems = [];
    const done: UmClassItem[] = [];

    const isRecentlyEnriched = (ex: UmClassItem) => {
        if (!ex.lastEnriched) return false;
        try {
            const last = new Date(ex.lastEnriched);
            const now = new Date();
            const diffDays = (now.getTime() - last.getTime()) / (1000 * 3600 * 24);
            return diffDays < 7;
        } catch (e) { return false; }
    };

    for (const item of pendingItems) {
        const existing = existingMap.get(item.link);
        if (existing && isRecentlyEnriched(existing)) {
            // Updated basic info from list if needed, but keep detail info?
            // Usually list partial info is fresher (discount/price) but detail info is heavy.
            // We'll trust existing full record.
            done.push({
                ...existing,
                title: item.title, // Update mutable fields from list
                image: item.image,
                price: item.price || existing.price,
                discount: item.discount || existing.discount
            });
        } else {
            todo.push(item);
        }
    }

    console.log(`Skipped (Recently Enriched): ${done.length}. To Enrich: ${todo.length}`);
    allItems.push(...done);

    if (todo.length > 0) {
        const progressBar = new ProgressBar(todo.length);
        let processedCount = 0;
        const CONCURRENCY = 3;

        // Trap SIGINT
        process.on('SIGINT', () => {
            console.log('\nProcess interrupted! Saving collected data...');
            saveData(allItems);
            process.exit();
        });

        for (let i = 0; i < todo.length; i += CONCURRENCY) {
            const chunk = todo.slice(i, i + CONCURRENCY);
            const promises = chunk.map(async (item) => {
                const p = await browser.newPage();
                try {
                    await p.goto(item.link, { waitUntil: 'domcontentloaded', timeout: 15000 });
                    // await new Promise(r => setTimeout(r, 500)); // Remove wait for speed

                    const detailData = await p.evaluate(() => {
                        function getTxt(sel: string) {
                            return document.querySelector(sel)?.textContent?.trim() || '';
                        }

                        // Use class-based selectors instead of deep nth-child paths
                        const semiInfoDivs = document.querySelectorAll('.voucher-semi-info-area > div');
                        const duration = semiInfoDivs[0]?.querySelector('span:nth-child(2)')?.textContent?.trim() || '';
                        const people = semiInfoDivs[1]?.querySelector('span:nth-child(2)')?.textContent?.trim() || '';
                        const totalCount = semiInfoDivs[2]?.querySelector('span:nth-child(2)')?.textContent?.trim() || '';

                        // Price info - use class-based selectors
                        const paymentArea = document.querySelector('.pc-payment-btn-area');
                        const priceSpans = paymentArea ? paymentArea.querySelectorAll('span') : [];
                        const discount = priceSpans[0]?.textContent?.trim() || '';
                        const originPrice = priceSpans[1]?.textContent?.trim() || '';
                        const salePrice = priceSpans[2]?.textContent?.trim() || '';

                        // Use time info - try multiple selectors
                        let useTime = '';
                        const infoSections = document.querySelectorAll('.voucher-contents > div');
                        for (const section of infoSections) {
                            const text = section.textContent || '';
                            if (text.includes('이용시간') || text.includes('소요시간')) {
                                const spans = section.querySelectorAll('span');
                                for (const span of spans) {
                                    const t = span.textContent?.trim() || '';
                                    if (t.includes('분') || t.includes('시간')) {
                                        useTime = t;
                                        break;
                                    }
                                }
                                if (useTime) break;
                            }
                        }

                        // Heuristic address finding for UmClass
                        const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, span, div'));
                        let address = '';

                        for (let i = 0; i < headings.length; i++) {
                            if (headings[i].textContent?.trim() === '클래스 장소') {
                                const container = headings[i].closest('div')?.parentElement;
                                if (container) {
                                    const text = container.textContent || '';
                                    if (text.includes('복사')) {
                                        const parts = text.split('복사');
                                        if (parts[0]) {
                                            address = parts[0].replace('클래스 장소', '').trim();
                                        }
                                    } else {
                                        address = text.replace('클래스 장소', '').trim();
                                    }
                                }
                                break;
                            }
                            if (headings[i].textContent?.trim() === '장소') {
                                const nextSibling = headings[i].nextElementSibling;
                                if (nextSibling) {
                                    address = nextSibling.textContent?.trim() || '';
                                }
                                break;
                            }
                        }

                        if (!address) {
                            for (const el of headings) {
                                const text = el.textContent?.trim() || '';
                                if ((text.includes('대한민국') || text.includes('동구') || text.includes('중구') || text.includes('서구') || text.includes('남구') || text.includes('북구') || text.includes('시 ') || text.includes('도 ') || text.includes('로 ') || text.includes('길 ')) && text.length > 10 && text.length < 100 && !text.includes('솜씨당')) {
                                    if (text.match(/([가-힣]+(도|시|구|군|동|로|길)\s*)+/)) {
                                        address = text;
                                        if (text.includes('대한민국')) break;
                                    }
                                }
                            }
                        }

                        // Strip trailing UI garbage
                        address = address.replace(/지도보기주소복사/g, '').replace(/주소복사/g, '').replace(/지도보기/g, '').trim();

                        return { rawAddress: address, duration, people, totalCount, discount, originPrice, salePrice, useTime };
                    });

                    let venue = '솜씨당 클래스';
                    let address = detailData.rawAddress || '서울';
                    address = address.replace(/^대한민국\s*/, '').trim();

                    if (address.length > 5) {
                        const tokens = address.split(/\s+/);
                        if (tokens.length > 1) {
                            venue = tokens[tokens.length - 1]; // Assume last word might be the venue name, or just use the whole address
                        }
                        // To be safe, let's just use the full accurate address as the venue
                        venue = address;
                    }

                    // Stable ID
                    const id = `class_${slugify(item.title)}`;

                    return {
                        id,
                        title: item.title,
                        date: detailData.duration || '2024-01-01',
                        venue: venue,
                        image: item.image,
                        link: item.link,
                        genre: 'class',
                        region: address,
                        runningTime: detailData.useTime || detailData.duration,
                        viewCount: detailData.totalCount,
                        originalPrice: detailData.originPrice,
                        price: detailData.salePrice || detailData.originPrice,
                        discount: detailData.discount,
                        ageLimit: 'all',
                        address: address,
                        casting: `정원: ${detailData.people}, 총회차: ${detailData.totalCount}`,
                        lastEnriched: new Date().toISOString()
                    };

                } catch (e) {
                    // console.error(e);
                    return null;
                } finally {
                    await p.close();
                }
            });

            const results = await Promise.all(promises);
            results.forEach(r => {
                if (r) allItems.push(r);
                else {
                    // Failed to scrape details? Add fallback or skip
                    // Add basic item?
                }
            });
            processedCount += results.length;
            progressBar.update(processedCount);

            if (i % 20 === 0) saveData(allItems);
        }
        progressBar.finish();
    }

    console.log(`\nCompleted! Total collected: ${allItems.length}`);
    await browser.close();

    saveData(allItems);
}

scrapeUmClass().catch(console.error);

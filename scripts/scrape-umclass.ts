
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';
import path from 'path';
import { atomicWriteJson } from './utils/scraper-utils';

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
    description?: string;
    priceDetail?: string;
    feesAndPrograms?: string;
    synopsisImages?: string[];
    stillImages?: string[];
    backupPoster?: string;
    targetAudience?: string;
    website?: string;
    sourceUpdatedAt?: string;
    lastEnriched?: string;
    keywords?: string[];
}

const OUTPUT_PATH = path.resolve(process.cwd(), 'src/data/umclass.json');
const BROWSER_EVAL_BOOTSTRAP = 'window.__name = window.__name || function(fn){ return fn; };';
const DETAIL_ENRICH_LIMIT = Number(process.env.UMCLASS_DETAIL_LIMIT || 300);
const LIST_PAGE_LIMIT = Number(process.env.UMCLASS_MAX_PAGES || 100);

async function preparePageForEvaluate(page: any) {
    await page.evaluateOnNewDocument(BROWSER_EVAL_BOOTSTRAP);
}

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
    atomicWriteJson(OUTPUT_PATH, data);
    console.log(`\nSaved ${data.length} items to ${OUTPUT_PATH}`);
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

function isUsefulUmclassImage(url?: string) {
    return Boolean(url)
        && /^https?:\/\//i.test(url || '')
        && /(umclassuploadboardimg|umclassupload\.s3|s3\.ap-northeast-2\.amazonaws\.com\/umclassupload)/i.test(url || '')
        && !/\/app\/|static\/img|icon|logo|review|map|coupon|close|sprite|blank|loading|spacer|sample|\.svg(?:\?|$)/i.test(url || '');
}

function buildUmclassDescription(title: string, detailText?: string, metaDescription?: string, keywords: string[] = []) {
    const detail = compactText(detailText);
    const meta = compactText(metaDescription);
    const keywordLine = keywords.length > 0 ? `키워드: ${keywords.slice(0, 8).join(', ')}` : '';
    const merged = [detail, meta, keywordLine].filter(Boolean).join('\n\n').trim();
    if (merged.length >= 80) return merged.slice(0, 1600);

    return [
        `${title.replace(/^\[[^\]]+\]\s*/, '').trim()} 클래스입니다.`,
        detail || meta,
        keywordLine,
        '운영 일정과 세부 구성은 공식 예약 페이지 기준으로 확인됩니다.',
    ].filter(Boolean).join('\n\n').slice(0, 900);
}

function firstWonText(...values: Array<string | undefined>) {
    for (const value of values) {
        const match = compactText(value).match(/([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{4,})\s*원?/);
        if (match) return `${Number.parseInt(match[1].replace(/,/g, ''), 10).toLocaleString('ko-KR')}원`;
    }
    return '';
}

function buildFallbackItem(item: { link: string, title: string, image: string, discount: string, price: string }, existing?: UmClassItem): UmClassItem {
    return {
        ...(existing || {}),
        id: existing?.id || `class_${slugify(item.title)}`,
        title: item.title,
        date: existing?.date || '상시/예약',
        venue: existing?.venue || '솜씨당 클래스',
        image: item.image || existing?.image || '',
        link: item.link,
        genre: 'class',
        region: existing?.region || 'seoul',
        runningTime: existing?.runningTime || '예약페이지 참조',
        viewCount: existing?.viewCount,
        originalPrice: existing?.originalPrice || item.price || '',
        price: item.price || existing?.price || '',
        discount: item.discount || existing?.discount || '',
        ageLimit: existing?.ageLimit || 'all',
        address: existing?.address || '',
        casting: existing?.casting || '',
        synopsisImages: existing?.synopsisImages || [],
        stillImages: existing?.stillImages || [],
        backupPoster: existing?.backupPoster || item.image || '',
    };
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
    await preparePageForEvaluate(page);
    await page.setViewport({ width: 1280, height: 800 });

    // Header settings for Korean context
    await page.setExtraHTTPHeaders({
        'Accept-Language': 'ko-KR,ko;q=0.9',
    });

    const allItems: UmClassItem[] = [];
    const seenTitles = new Set<string>();


    let pendingItems: { link: string, title: string, image: string, discount: string, price: string }[] = [];

    // Scrape "All" list from main class page
    // URL provided by user: https://www.umclass.com/class?page=1
    let currentPage = 1;
    let hasNextPage = true;
    const MAX_PAGES = LIST_PAGE_LIMIT; // Increased limit for full scrape

    console.log(`\nPhase 1: Collecting all classes (All Regions / All Categories)...`);

    while (hasNextPage && currentPage <= MAX_PAGES) {
        const url = `https://www.umclass.com/class?page=${currentPage}`;
        console.log(`  Visiting Page ${currentPage}: ${url}`);

        try {
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
            await page.evaluate(BROWSER_EVAL_BOOTSTRAP).catch(() => undefined);
            // Wait for list container - selector might differ on main class page vs plan page
            // Plan page used .classPlan-contents-list. Main class page might use .class-list-wrapper or similar.
            // Let's use a generic wait or check if the previous selector works.
            // If the user says https://www.umclass.com/class?page=1, checking generic list items.
            try {
                await page.waitForSelector('a[href*="/classInfo/"]', { timeout: 5000 });
            } catch (e) {
                console.log(`    No items found on page ${currentPage} (Timeout). Ending.`);
                break;
            }

            const pageItems = await page.evaluate(() => {
                const anchors = document.querySelectorAll('a[href*="/classInfo/"]');
                const results: any[] = [];

                anchors.forEach((anchor) => {
                    const link = (anchor as HTMLAnchorElement).href;
                    if (!link.includes('/classInfo/')) return;

                    // Updated selectors from audit
                    const titleElem = anchor.querySelector('.class-lis-itm-name');
                    let title = titleElem ? titleElem.textContent?.trim() : '';
                    if (!title) return;

                    // Image extraction from div.class-lis-img background-image
                    let image = '';
                    const imgDiv = anchor.querySelector('.class-lis-img');
                    if (imgDiv) {
                        const style = window.getComputedStyle(imgDiv);
                        const bgImage = style.backgroundImage;
                        if (bgImage && bgImage !== 'none') {
                            image = bgImage.slice(4, -1).replace(/"/g, '');
                        }
                    }

                    // Price/Discount extraction from .class-lis-mony-txt
                    // Usually contains both discount % and price
                    const priceElem = anchor.querySelector('.class-lis-mony-txt');
                    let price = '';
                    let discount = '';

                    if (priceElem) {
                        const text = priceElem.textContent || '';
                        // Extract % for discount
                        const discMatch = text.match(/(\d+)%/);
                        if (discMatch) discount = discMatch[1] + '%';

                        // Extract "원" for price
                        const priceMatch = text.match(/([\d,]+)원/);
                        if (priceMatch) price = priceMatch[1] + '원';
                    }

                    results.push({
                        title,
                        link,
                        image,
                        price,
                        discount
                    });
                });
                return results;
            });

            if (pageItems.length === 0) {
                console.log(`    No items found on page ${currentPage}. Stopping.`);
                hasNextPage = false;
            } else {
                let newItems = 0;
                for (const item of pageItems) {
                    if (!seenTitles.has(item.title)) {
                        seenTitles.add(item.title);
                        pendingItems.push(item);
                        newItems++;
                    }
                }
                console.log(`    Found ${pageItems.length} items (${newItems} new).`);

                // If page had items but all were duplicates, we still continue because order isn't guaranteed unique across pages?
                // Or maybe we stop? Safer to continue a bit.
                if (pageItems.length < 5) {
                    // Start calling it quits if very few items
                }

                currentPage++;
            }

        } catch (e) {
            console.error(`    Error on page ${currentPage}: ${e}`);
            hasNextPage = false;
        }
    }



    console.log(`  Total unique classes found: ${pendingItems.length}`);
    await page.close(); // Close list page
    if (pendingItems.length === 0) {
        throw new Error('UmClass list scrape found 0 items.');
    }

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
        const hasDetailImages = Array.isArray(existing?.synopsisImages) && existing.synopsisImages.some(isUsefulUmclassImage);
        const hasRichDetail = Boolean(
            existing?.description &&
            compactText(existing.description).length >= 80 &&
            (existing?.price || existing?.priceDetail) &&
            hasDetailImages
        );
        if (existing && isRecentlyEnriched(existing) && hasRichDetail) {
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

    const enrichQueue = todo.slice(0, DETAIL_ENRICH_LIMIT);
    const deferred = todo.slice(DETAIL_ENRICH_LIMIT).map((item) => buildFallbackItem(item, existingMap.get(item.link)));

    console.log(`Skipped (Recently Enriched): ${done.length}. To Enrich this run: ${enrichQueue.length}. Deferred/retained: ${deferred.length}`);
    allItems.push(...done, ...deferred);

    if (enrichQueue.length > 0) {
        const progressBar = new ProgressBar(enrichQueue.length);
        let processedCount = 0;
        const CONCURRENCY = Number(process.env.UMCLASS_CONCURRENCY || 4);
        const CHUNK_DELAY_MS = Number(process.env.UMCLASS_CHUNK_DELAY_MS || 250);

        // Trap SIGINT
        process.on('SIGINT', () => {
            console.log('\nProcess interrupted! Saving collected data...');
            saveData(allItems);
            process.exit();
        });

        for (let i = 0; i < enrichQueue.length; i += CONCURRENCY) {
            const chunk = enrichQueue.slice(i, i + CONCURRENCY);
            const promises = chunk.map(async (item) => {
                const p = await browser.newPage();
                try {
                    await preparePageForEvaluate(p);
                    await p.goto(item.link, { waitUntil: 'domcontentloaded', timeout: 15000 });
                    await p.evaluate(BROWSER_EVAL_BOOTSTRAP).catch(() => undefined);
                    await p.waitForSelector('.voucher-contents, .class-main-img, img[src]', { timeout: 10000 }).catch(() => undefined);
                    await new Promise(r => setTimeout(r, 800));

                    const detailData = await p.evaluate(() => {
                        const compact = (value?: string | null) => value?.replace(/\s+/g, ' ').trim() || '';
                        const normalizeImageUrl = (value?: string | null) => {
                            const raw = compact(value)
                                .replace(/^url\(["']?/i, '')
                                .replace(/["']?\)$/i, '')
                                .replace(/&amp;/g, '&');
                            if (!raw) return '';
                            try {
                                return new URL(raw, location.origin).href;
                            } catch {
                                return '';
                            }
                        };
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
                        const metaDescription = document.querySelector('meta[name="description"], meta[property="og:description"]')?.getAttribute('content')?.trim() || '';
                        const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute('href') || location.href;
                        const keywords = document.querySelector('meta[name="keywords"]')?.getAttribute('content')?.split(',')
                            .map((keyword) => keyword.trim())
                            .filter(Boolean)
                            .slice(0, 12) || [];

                        const imageUrls = Array.from(new Set([
                            ...Array.from(document.querySelectorAll('img')).flatMap((img) => [
                                (img as HTMLImageElement).currentSrc,
                                img.getAttribute('src'),
                                img.getAttribute('data-src'),
                                img.getAttribute('data-original'),
                            ].map(normalizeImageUrl)),
                            ...Array.from(document.querySelectorAll<HTMLElement>('*')).map((el) => {
                                const background = window.getComputedStyle(el).backgroundImage;
                                const match = background.match(/url\(["']?(.+?)["']?\)/i);
                                return normalizeImageUrl(match?.[1]);
                            }),
                        ]))
                            .filter((url) => /^https?:\/\//i.test(url))
                            .filter((url) => /(umclassuploadboardimg|umclassupload\.s3|s3\.ap-northeast-2\.amazonaws\.com\/umclassupload)/i.test(url))
                            .filter((url) => !/\/app\/|static\/img|icon|logo|review|map|coupon|close|sprite|blank|loading|spacer|sample|\.svg(?:\?|$)/i.test(url))
                            .slice(0, 12);

                        const root = (document.querySelector('.voucher-contents') || document.querySelector('#um_contents') || document.body) as HTMLElement;
                        const genericFragments = [
                            '예약하기',
                            '할인 쿠폰',
                            '링크복사',
                            '카카오맵',
                            '네이버 지도',
                            '취소 및 환불',
                            '예약 대기',
                            '예약확정',
                            '예약불가',
                            '판매자',
                            '개인정보',
                            '이용약관',
                        ];
                        const detailLines = Array.from(new Set((root.innerText || '')
                            .split(/\n+/)
                            .map((line) => compact(line))
                            .filter((line) => line.length >= 8 && line.length <= 240)
                            .filter((line) => !genericFragments.some((fragment) => line.includes(fragment)))
                            .filter((line) => !/^[0-9,]+\s*원$/.test(line))
                        ));
                        const detailText = detailLines.slice(0, 36).join('\n');
                        const priceTexts = Array.from(document.querySelectorAll('span, p, div'))
                            .map((el) => compact(el.textContent))
                            .filter((text) => /[0-9,]+\s*원/.test(text) && text.length <= 120)
                            .slice(0, 40);

                        return {
                            rawAddress: address,
                            duration,
                            people,
                            totalCount,
                            discount,
                            originPrice,
                            salePrice,
                            useTime,
                            metaDescription,
                            canonical,
                            keywords,
                            images: imageUrls,
                            detailText,
                            priceTexts,
                        };
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
                    const detailImages = Array.isArray(detailData.images) ? detailData.images.filter(isUsefulUmclassImage) : [];
                    const description = buildUmclassDescription(item.title, detailData.detailText, detailData.metaDescription, detailData.keywords);
                    const salePrice = firstWonText(detailData.salePrice, item.price, ...(detailData.priceTexts || []));
                    const originalPrice = firstWonText(detailData.originPrice) || salePrice;

                    return {
                        id,
                        title: item.title,
                        date: detailData.duration || '2024-01-01',
                        venue: venue,
                        image: detailImages[0] || item.image,
                        link: item.link,
                        genre: 'class',
                        region: address,
                        runningTime: detailData.useTime || detailData.duration,
                        viewCount: detailData.totalCount,
                        originalPrice,
                        price: salePrice || originalPrice,
                        discount: detailData.discount || item.discount,
                        ageLimit: 'all',
                        address: address,
                        casting: `정원: ${detailData.people}, 총회차: ${detailData.totalCount}`,
                        description,
                        priceDetail: [
                            originalPrice ? `정상가: ${originalPrice}` : '',
                            (detailData.discount || item.discount) ? `할인율: ${detailData.discount || item.discount}` : '',
                            (salePrice || originalPrice) ? `판매가: ${salePrice || originalPrice}` : '',
                        ].filter(Boolean).join('\n'),
                        feesAndPrograms: [
                            description ? `클래스 안내\n${description}` : '',
                            detailData.duration ? `일정/기간: ${detailData.duration}` : '',
                            detailData.useTime ? `이용시간: ${detailData.useTime}` : '',
                            detailData.people ? `인원: ${detailData.people}` : '',
                            detailData.totalCount ? `총회차/조회: ${detailData.totalCount}` : '',
                        ].filter(Boolean).join('\n'),
                        synopsisImages: detailImages.slice(0, 8),
                        stillImages: detailImages.slice(1, 5),
                        backupPoster: item.image,
                        targetAudience: detailData.people,
                        website: detailData.canonical,
                        sourceUpdatedAt: new Date().toISOString(),
                        keywords: detailData.keywords,
                        lastEnriched: new Date().toISOString()
                    };

                } catch (e) {
                    // console.error(e);
                    return buildFallbackItem(item, existingMap.get(item.link));
                } finally {
                    await p.close().catch(() => undefined);
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
            await new Promise(r => setTimeout(r, CHUNK_DELAY_MS));
        }
        progressBar.finish();
    }

    console.log(`\nCompleted! Total collected: ${allItems.length}`);
    await browser.close();

    saveData(allItems);
}

scrapeUmClass()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

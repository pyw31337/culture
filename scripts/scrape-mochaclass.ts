
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';
import path from 'path';

puppeteer.use(StealthPlugin());

interface MochaClassItem {
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

const OUTPUT_PATH = path.resolve(process.cwd(), 'src/data/mochaclass.json');
const BROWSER_EVAL_BOOTSTRAP = 'window.__name = window.__name || function(fn){ return fn; };';

function positiveInt(value: string | undefined, fallback: number) {
    const parsed = Number.parseInt(value || '', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const DETAIL_ENRICH_LIMIT = positiveInt(process.env.MOCHACLASS_DETAIL_LIMIT, 360);
const LIST_PAGE_LIMIT = positiveInt(process.env.MOCHACLASS_MAX_PAGES, 100);
const DETAIL_TIMEOUT_MS = positiveInt(process.env.MOCHACLASS_DETAIL_TIMEOUT_MS, 30000);
const SELECTOR_TIMEOUT_MS = positiveInt(process.env.MOCHACLASS_SELECTOR_TIMEOUT_MS, 10000);
const POST_LOAD_DELAY_MS = positiveInt(process.env.MOCHACLASS_POST_LOAD_DELAY_MS, 1200);
const RETAIN_UNSEEN_EXISTING = process.env.MOCHACLASS_RETAIN_UNSEEN_EXISTING === '1';

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

function saveData(data: MochaClassItem[]) {
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

function buildFallbackItem(item: { link: string, title: string, image: string, price: string, originalPrice: string }, existing?: MochaClassItem): MochaClassItem {
    return {
        ...(existing || {}),
        id: existing?.id || `class_${slugify(item.title)}`,
        title: item.title,
        image: item.image || existing?.image || '',
        date: existing?.date || 'OPEN RUN',
        venue: existing?.venue || '모카클래스',
        link: item.link,
        region: existing?.region || 'seoul',
        genre: 'class',
        price: item.price || existing?.price || '',
        originalPrice: item.originalPrice || existing?.originalPrice || '',
        discount: existing?.discount || '',
        runningTime: existing?.runningTime || '예약페이지 참조',
        ageLimit: existing?.ageLimit || '전체',
        casting: existing?.casting || '',
        address: existing?.address || '',
    };
}

function compactText(text?: string) {
    return (text || '').replace(/\s+/g, ' ').trim();
}

function isGenericMochaDescription(text?: string) {
    const compact = compactText(text);
    if (compact.length < 40) return true;
    const genericFragments = [
        '모카클래스는',
        '원데이클래스 플랫폼',
        '단체 클래스',
        '단체 수업 신청',
        '클래스 등록',
        '주변의 다양한 클래스를',
        '원데이 클래스 평균',
        '기업교육',
        '취미 클래스',
        '클래스 예약',
        'B2B',
    ];
    return genericFragments.some((fragment) => compact.includes(fragment));
}

function isUsefulMochaImage(url?: string) {
    return Boolean(url)
        && /^https?:\/\//i.test(url || '')
        && !/logo|icon|avatar|profile|blank|sprite|kakao|naver|static\/media\/main_|without_circle|mochaclass\.com\/static\/media|\.svg(?:\?|$)/i.test(url || '');
}

function buildMochaDescription(title: string, detailText?: string, metaDescription?: string, keywords: string[] = []) {
    const detail = compactText(detailText);
    const meta = isGenericMochaDescription(metaDescription) ? '' : compactText(metaDescription);
    const keywordLine = keywords.length > 0 ? `키워드: ${keywords.slice(0, 8).join(', ')}` : '';
    const merged = [detail, meta, keywordLine].filter(Boolean).join('\n\n').trim();
    if (merged.length >= 80) return merged.slice(0, 1400);

    const titleWithoutRegion = title.replace(/^\[[^\]]+\]\s*/, '').trim();
    return [
        `${titleWithoutRegion} 클래스입니다.`,
        detail || meta || '',
        keywordLine,
        '운영 일정과 세부 구성은 공식 예약 페이지 기준으로 확인됩니다.',
    ].filter(Boolean).join('\n\n').slice(0, 900);
}

async function scrapeMochaClass() {
    console.log(`Starting MochaClass Scraper...`);

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
    const existingMap = new Map<string, MochaClassItem>();
    if (fs.existsSync(OUTPUT_PATH)) {
        try {
            const data = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf-8'));
            data.forEach((item: MochaClassItem) => existingMap.set(item.link, item));
        } catch (e) {
            console.log('No existing data or parse error.');
        }
    }

    const page = await browser.newPage();
    await preparePageForEvaluate(page);
    await page.setViewport({ width: 1280, height: 800 });

    // Header settings
    await page.setExtraHTTPHeaders({
        'Accept-Language': 'ko-KR,ko;q=0.9',
    });

    const allItems: MochaClassItem[] = [];
    const seenTitles = new Set<string>();
    const seenLinks = new Set<string>();

    let currentPage = 1;
    let hasNextPage = true;
    const MAX_PAGES = LIST_PAGE_LIMIT;

    console.log(`\nPhase 1: Collecting all class links...`);

    let pendingItems: { link: string, title: string, image: string, price: string, originalPrice: string }[] = [];

    while (hasNextPage && currentPage <= MAX_PAGES) {
        const url = `https://mochaclass.com/Search?page=${currentPage}&where=list&sort=%EA%B1%B0%EB%A6%AC%EC%88%9C`;
        console.log(`    Visiting Page ${currentPage}: ${url}`);

        try {
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
            await page.evaluate(BROWSER_EVAL_BOOTSTRAP).catch(() => undefined);

            try {
                await page.waitForSelector('.MuiGrid-root.css-2xazwd', { timeout: 10000 });
            } catch (e) {
                console.log(`    No list container found on page ${currentPage}. Ending or Timeout.`);
                break;
            }

            const pageItems = await page.evaluate(() => {
                const grids = document.querySelectorAll('.MuiGrid-root.css-2xazwd');
                let targetGrid: Element | null = null;
                grids.forEach((g: any) => {
                    if (!targetGrid || g.querySelectorAll('a').length > targetGrid.querySelectorAll('a').length) {
                        targetGrid = g;
                    }
                });

                if (!targetGrid) return [];

                const anchors = (targetGrid as Element).querySelectorAll('a');
                const results: any[] = [];

                anchors.forEach((anchor: any) => {
                    const link = anchor.href;
                    if (!link || !link.includes('/class/')) return;

                    const titleElem = anchor.querySelector('div > div.css-76zbcf > p');
                    const title = titleElem ? titleElem.textContent?.trim() : '';
                    if (!title) return;

                    const imgElem = anchor.querySelector('div > div.css-11udqdf > img');
                    const image = imgElem ? imgElem.getAttribute('src') || '' : '';

                    const priceContainer = anchor.querySelector('div > div.css-76zbcf > div.css-1k8tf8v');
                    let price = '';
                    let originalPrice = '';

                    if (priceContainer) {
                        const allTexts = Array.from(priceContainer.querySelectorAll('p, span, div'))
                            .map((el: any) => el.textContent?.trim() || '')
                            .filter((t: string) => t.length > 0 && !t.includes('포인트') && !t.includes('적립'));

                        const priceLike = allTexts.filter((t: string) => /[0-9,]+원/.test(t) || /[0-9]+%/.test(t));
                        const values = priceLike.map((t: string) => {
                            // Clean up text like "25%120,000원" into just "120,000원"
                            const cleanText = t.replace(/^[0-9]+%/, '');
                            return { text: cleanText, val: parseInt(cleanText.replace(/[^0-9]/g, '')) || 0 };
                        }).filter((v: any) => v.val > 0);

                        if (values.length >= 2) {
                            values.sort((a: any, b: any) => b.val - a.val);
                            originalPrice = values[0].text;
                            price = values[values.length - 1].text;
                        } else if (values.length === 1) {
                            price = values[0].text;
                            originalPrice = price;
                        }
                    }

                    results.push({
                        title,
                        link,
                        image,
                        price,
                        originalPrice
                    });
                });
                return results;
            });

            if (pageItems.length === 0) {
                console.log(`    No items found on page ${currentPage}. Stopping.`);
                hasNextPage = false;
            } else {
                console.log(`    Found ${pageItems.length} items.`);
                let newItemsCount = 0;
                for (const item of pageItems) {
                    if (!seenTitles.has(item.title)) {
                        seenTitles.add(item.title);
                        seenLinks.add(item.link);
                        pendingItems.push(item);
                        newItemsCount++;
                    }
                }
                currentPage++;
            }

        } catch (error) {
            console.error(`    Error on page ${currentPage}: ${error}`);
            hasNextPage = false;
        }
    }

    console.log(`  Total unique classes found: ${pendingItems.length}`);
    await page.close();
    if (pendingItems.length === 0) {
        throw new Error('MochaClass list scrape found 0 items.');
    }

    // Phase 2: Details
    console.log(`\nPhase 2: Scraping details (Smart Incremental - Parallel)...`);

    // Filter
    const todo: typeof pendingItems = [];
    const done: MochaClassItem[] = [];

    const isRecentlyEnriched = (ex: MochaClassItem) => {
        if (!ex.lastEnriched) return false;
        try {
            const last = new Date(ex.lastEnriched);
            const now = new Date();
            const diffDays = (now.getTime() - last.getTime()) / (1000 * 3600 * 24);
            return diffDays < 7; // Only re-enrich if older than 7 days
        } catch (e) { return false; }
    };

    for (const item of pendingItems) {
        const existing = existingMap.get(item.link);
        const hasDetailImages = Array.isArray(existing?.synopsisImages) && existing.synopsisImages.some(isUsefulMochaImage);
        const hasRichDetail = Boolean(
            existing?.description &&
            !isGenericMochaDescription(existing.description) &&
            existing?.priceDetail &&
            existing?.feesAndPrograms &&
            hasDetailImages
        );
        if (existing && isRecentlyEnriched(existing) && hasRichDetail) {
            done.push({
                ...existing,
                title: item.title,
                image: item.image,
                price: item.price || existing.price,
                originalPrice: item.originalPrice || existing.originalPrice
            });
        } else {
            todo.push(item);
        }
    }

    const enrichQueue = todo.slice(0, DETAIL_ENRICH_LIMIT);
    const deferred = todo.slice(DETAIL_ENRICH_LIMIT).map((item) => buildFallbackItem(item, existingMap.get(item.link)));

    console.log(`Skipped: ${done.length}. To Enrich this run: ${enrichQueue.length}. Deferred/retained: ${deferred.length}`);
    allItems.push(...done, ...deferred);

    if (RETAIN_UNSEEN_EXISTING) {
        const retainedExisting = Array.from(existingMap.values()).filter((item) => item.link && !seenLinks.has(item.link));
        if (retainedExisting.length > 0) {
            console.log(`Retaining ${retainedExisting.length} existing items outside the fallback page window.`);
            allItems.push(...retainedExisting);
        }
    }

    if (enrichQueue.length > 0) {
        const progressBar = new ProgressBar(enrichQueue.length);
        let processedCount = 0;
        const CONCURRENCY = positiveInt(process.env.MOCHACLASS_CONCURRENCY, 8);
        const CHUNK_DELAY_MS = positiveInt(process.env.MOCHACLASS_CHUNK_DELAY_MS, 250);

        for (let i = 0; i < enrichQueue.length; i += CONCURRENCY) {
            const chunk = enrichQueue.slice(i, i + CONCURRENCY);
            const promises = chunk.map(async (item) => {
                const p = await browser.newPage();
                try {
                    await preparePageForEvaluate(p);
                    await p.goto(item.link, { waitUntil: 'domcontentloaded', timeout: DETAIL_TIMEOUT_MS });
                    await p.evaluate(BROWSER_EVAL_BOOTSTRAP).catch(() => {});
                    await p.waitForSelector('img[src], h1, h2, h3, p', { timeout: SELECTOR_TIMEOUT_MS }).catch(() => {});
                    await new Promise(r => setTimeout(r, POST_LOAD_DELAY_MS));

                    const detailData = await p.evaluate(async () => {
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
                        const isVisible = (el: Element) => {
                            const style = window.getComputedStyle(el);
                            const rect = el.getBoundingClientRect();
                            return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
                        };
                        const allNodes = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, span, div, p.MuiTypography-root, li'));
                        
                        // Extract summary location from header (e.g. "부산 · 금정구")
                        let headerSummary = '';
                        const summaryElements = document.querySelectorAll('p.MuiTypography-body2');
                        for (const el of Array.from(summaryElements)) {
                            const text = el.textContent?.trim() || '';
                            if (text.includes('·')) {
                                headerSummary = text;
                                break;
                            }
                        }

                        // Try to click '위치' (Location) tab to load detailed data
                        const tabs = Array.from(document.querySelectorAll('button, div, span'));
                        const locationTab = tabs.find(t => t.textContent?.trim() === '위치');
                        if (locationTab) {
                            (locationTab as HTMLElement).click();
                            // Pause briefly for DOM update (evaluate can't easily wait with true sleep, but we can try a tight loop or just hope)
                        }

                        let rawAddress = '';

                        // Wait a tiny bit for the click to process if possible
                        // High priority: Specific known address locations in Mochaclass DOM
                        const addrElements = document.querySelectorAll('p.MuiTypography-body1, .MuiBox-root p, .css-1vscdpm p, .css-1u8m1s p');
                        for (const el of Array.from(addrElements)) {
                            const text = el.textContent?.trim() || '';
                            // Address usually starts with '대한민국' or contains '시/도'
                            if (text.includes('대한민국') || /^[가-힣]+[시|도]/.test(text)) {
                                rawAddress = text.replace(/^.*?위치\s*/, '').trim();
                                break;
                            }
                        }

                        // Fallback 1: search text content for labels
                        if (!rawAddress) {
                            const labels = ['위치', '장소', '스튜디오', '공방'];
                            for (const label of labels) {
                                for (let i = 0; i < allNodes.length; i++) {
                                    if (allNodes[i].textContent?.trim() === label) {
                                        const container = allNodes[i].closest('div')?.parentElement;
                                        if (container) {
                                            const text = container.textContent || '';
                                            const match = text.match(/(대한민국\s+)?([가-힣]+[시|도|구|군|동|로|길]\s*)+[\d-]+\s*.*?(?=(찾아오는|지도|$))/);
                                            if (match) {
                                                rawAddress = match[0].trim();
                                                break;
                                            }
                                        }
                                    }
                                }
                                if (rawAddress) break;
                            }
                        }

                        // Fallback 2: header summary
                        if (!rawAddress && headerSummary) {
                            rawAddress = headerSummary.split('·').map(s => s.trim()).join(' ');
                        }

                        const timeEl = document.querySelector('#topleft > div:nth-child(11) > section');
                        const priceEl = document.querySelector('#topleft > div:nth-child(2) > div.css-7df1aj > div.css-q3pnu7');
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
                            .filter((url) => /(firebasestorage|FCMImages|mocha|class|upload|image|cdn)/i.test(url))
                            .filter((url) => !/logo|icon|avatar|profile|blank|sprite|kakao|naver|static\/media\/main_|without_circle|mochaclass\.com\/static\/media|\.svg(?:\?|$)/i.test(url))
                            .slice(0, 10);

                        const root = (document.querySelector('main') || document.querySelector('#root') || document.body) as HTMLElement;
                        const genericLineFragments = [
                            '로그인',
                            '회원가입',
                            '마이페이지',
                            '장바구니',
                            '개인정보',
                            '이용약관',
                            '고객센터',
                            '모카클래스는',
                            '기업교육',
                            '단체 클래스',
                            '단체 수업 신청',
                            '클래스 등록',
                            '주변의 다양한 클래스를',
                            '원데이 클래스 평균',
                            'B2B',
                            'TOP',
                            '카카오',
                            '네이버',
                            '공유하기',
                        ];
                        const detailLines = Array.from(new Set((root.innerText || '')
                            .split(/\n+/)
                            .map((line) => compact(line))
                            .filter((line) => line.length >= 6 && line.length <= 220)
                            .filter((line) => !genericLineFragments.some((fragment) => line.includes(fragment)))
                            .filter((line) => !/^(예약|문의|상담|찜하기|공유|전체|추천순|거리순)$/u.test(line))
                            .filter((line) => !/^[\d,]+원$/.test(line))
                        ));
                        const headingLines = Array.from(document.querySelectorAll('h1, h2, h3, h4'))
                            .filter(isVisible)
                            .map((el) => compact(el.textContent))
                            .filter((line) => line.length >= 4 && line.length <= 120);
                        const detailText = Array.from(new Set([...headingLines, ...detailLines])).slice(0, 32).join('\n');

                        return {
                            rawAddress: rawAddress,
                            time: timeEl ? (timeEl as HTMLElement).innerText?.trim() || '' : '',
                            detailPrice: priceEl ? (priceEl as HTMLElement).innerText?.trim() || '' : '',
                            metaDescription,
                            canonical,
                            keywords,
                            images: imageUrls,
                            detailText
                        };
                    });

                    let detailPrice = detailData.detailPrice;
                    if (detailPrice) {
                        const match = detailPrice.match(/[\d,]+원/);
                        if (match) detailPrice = match[0];
                    }

                    // Extract tag from title (e.g. [제주], [강남])
                    const tagMatch = item.title.match(/\[([^\]]+)\]/);
                    const titleTag = tagMatch ? tagMatch[1] : '';

                    let address = detailData.rawAddress || '서울';
                    address = address.replace(/^대한민국\s*/, '').trim();

                    let district = '';
                    // Try to extract district from address or title tag
                    const districtMatch = address.match(/([가-힣]+[구|시|군])/);
                    if (districtMatch) {
                        district = districtMatch[1];
                    } else if (titleTag) {
                        const tagDistrictMatch = titleTag.match(/([가-힣]+[구|시|군])/);
                        if (tagDistrictMatch) district = tagDistrictMatch[1];
                    }

                    // Map region based on address or title tag
                    const regionKeywords: Record<string, string> = {
                        '서울': 'seoul', '강남': 'seoul', '홍대': 'seoul', '경기': 'gyeonggi', '인천': 'gyeonggi',
                        '부산': 'busan', '서면': 'busan', '제주': 'jeju', '광주': 'gwangju', '대구': 'daegu', '대전': 'daejeon'
                    };
                    
                    let mappedRegion = address.includes('서울') ? 'seoul' : (address.includes('경기') ? 'gyeonggi' : '');
                    if (!mappedRegion && titleTag) {
                        for (const [k, v] of Object.entries(regionKeywords)) {
                            if (titleTag.includes(k)) {
                                mappedRegion = v;
                                break;
                            }
                        }
                    }

                    // Try to extract facility name from address (last part after street address)
                    let facilityName = '';
                    const facilityMatch = address.match(/(?:로|길)\s+\d+(?:-\d+)?\s+(?:.*?,?\s*)?([가-힣\w\s&]+)$/);
                    if (facilityMatch) {
                        facilityName = facilityMatch[1].trim();
                        // Clean up if it's just floor info
                        if (/^\d+층$/.test(facilityName) || /^[A-Z]\d+층$/.test(facilityName)) facilityName = '';
                    }

                    // Use accurate address as venue, fallback to Tag or District
                    let venue = (facilityName && facilityName.length > 1 && !facilityName.includes('대한민국')) ? facilityName : 
                                ((address && address.length > 10) ? address : 
                                (titleTag || (district ? `모카클래스 (${district})` : '모카클래스')));

                    // If address has studio name, we can format it nicer
                    // E.g. "대한민국 서울특별시 송파구 송파동 90-7 1층 개더링스튜디오"
                    // Venue is the full string, address is also full string. Usually `fix-venue-coordinates` will handle it.

                    // Calculate discount properly
                    let discountCalc = '';
                    const actualPrice = detailPrice || item.price;
                    const pVal = parseInt(actualPrice.replace(/[^0-9]/g, '')) || 0;
                    const opVal = parseInt(item.originalPrice.replace(/[^0-9]/g, '')) || 0;
                    if (pVal > 0 && opVal > 0 && pVal < opVal) {
                        discountCalc = Math.round((1 - pVal / opVal) * 100) + '%';
                    }

                    // Stable ID
                    const id = `class_${slugify(item.title)}`;
                    const detailImages = Array.isArray(detailData.images) ? detailData.images.filter(isUsefulMochaImage) : [];
                    const description = buildMochaDescription(item.title, detailData.detailText, detailData.metaDescription, detailData.keywords);

                    return {
                        id,
                        title: item.title,
                        image: detailImages[0] || item.image,
                        date: 'OPEN RUN',
                        venue: venue,
                        link: item.link,
                        region: mappedRegion || (address.includes('서울') ? 'seoul' : 'gyeonggi'),
                        genre: 'class',
                        price: detailPrice || item.price,
                        originalPrice: item.originalPrice,
                        discount: discountCalc,
                        runningTime: detailData.time || '예약페이지 참조',
                        ageLimit: '전체',
                        casting: '',
                        address: address,
                        description,
                        priceDetail: [
                            item.originalPrice ? `정상가: ${item.originalPrice}` : '',
                            (detailPrice || item.price) ? `판매가: ${detailPrice || item.price}` : '',
                        ].filter(Boolean).join('\n'),
                        feesAndPrograms: [
                            description ? `클래스 안내\n${description}` : '',
                            detailData.time ? `운영/수업 안내\n${detailData.time}` : '',
                            address ? `장소: ${address}` : '',
                        ].filter(Boolean).join('\n'),
                        synopsisImages: detailImages.slice(0, 8),
                        stillImages: detailImages.slice(1, 5),
                        backupPoster: item.image,
                        targetAudience: '전체',
                        website: detailData.canonical,
                        sourceUpdatedAt: new Date().toISOString(),
                        keywords: detailData.keywords,
                        lastEnriched: new Date().toISOString()
                    };
                } catch (e: any) {
                    console.error(`Error processing ${item.link}:`, e.message);
                    return buildFallbackItem(item, existingMap.get(item.link));
                } finally {
                    await p.close().catch(() => undefined);
                }
            });

            const results = await Promise.all(promises);
            results.forEach(r => { if (r) allItems.push(r); });
            processedCount += results.length;
            progressBar.update(processedCount);

            if (i % 20 === 0) saveData(allItems);
            
            // Small stabilizer delay between chunks
            await new Promise(r => setTimeout(r, CHUNK_DELAY_MS));
        }
        progressBar.finish();
    }

    console.log(`\nCompleted! Total collected: ${allItems.length}`);
    await browser.close();

    saveData(allItems);
}

scrapeMochaClass()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

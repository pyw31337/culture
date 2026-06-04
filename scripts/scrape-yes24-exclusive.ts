import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';
import path from 'path';
import { processImage } from './utils/image-processor';
import cliProgress from 'cli-progress';
import { atomicWriteJson } from './utils/scraper-utils';

puppeteer.use(StealthPlugin());

const CATEGORIES = [
    { name: '콘서트', id: '15456', genre: 'concert' },
    { name: '뮤지컬', id: '15457', genre: 'musical' },
    { name: '연극', id: '15458', genre: 'play' },
    { name: '클래식', id: '15459', genre: 'classic' },
    { name: '전시/행사', id: '15460', genre: 'exhibition' },
    { name: '가족/어린이', id: '999', genre: 'kids' }
];

const DATA_DIR = path.join(process.cwd(), 'src', 'data');
const OUTPUT_FILE = path.join(DATA_DIR, 'yes24-exclusive.json');
const BROWSER_EVAL_BOOTSTRAP = 'window.__name = window.__name || function(fn){ return fn; };';
const DETAIL_ENRICH_LIMIT = Number(process.env.YES24_DETAIL_LIMIT || 160);

function slugify(text: string): string {
    return text
        .replace(/[^a-zA-Z0-9가-힣]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
}

function needsDetailRefresh(item: any) {
    return !item
        || !item.ageRating
        || !item.runningTime
        || !item.performanceTime
        || !item.reservationInfo
        || !item.description
        || !item.priceDetail;
}

async function scrapeYes24() {
    console.log('Starting Yes24 Multi-Category Exclusive Scraper...');

    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

    // Load existing data to avoid redundant enrichment
    let allEnrichedItems: any[] = [];
    let detailAttempts = 0;
    if (fs.existsSync(OUTPUT_FILE)) {
        try {
            allEnrichedItems = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf-8'));
            console.log(`Loaded ${allEnrichedItems.length} existing items.`);
        } catch (e) {
            console.error('Failed to load existing data:', e);
        }
    }

    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
    });

    try {
        const page = await browser.newPage();
        await page.evaluateOnNewDocument(BROWSER_EVAL_BOOTSTRAP);
        // Set a realistic User-Agent
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
        await page.setViewport({ width: 1280, height: 800 });

        for (const cat of CATEGORIES) {
            const url = `https://ticket.yes24.com/New/Genre/GenreList.aspx?genretype=1&genre=${cat.id}`;
            console.log(`\n--- Processing Category: ${cat.name} ---`);
            console.log(`Navigating to: ${url}`);
            
            try {
                await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
                await page.evaluate(BROWSER_EVAL_BOOTSTRAP).catch(() => undefined);
                await page.waitForSelector('.ms-list-imgs', { timeout: 30000 });

                // Scroll to load all items (lazy loading)
                await page.evaluate(async () => {
                    await new Promise<void>((resolve) => {
                        let totalHeight = 0;
                        let distance = 400;
                        let timer = setInterval(() => {
                            let scrollHeight = document.body.scrollHeight;
                            window.scrollBy(0, distance);
                            totalHeight += distance;
                            if (totalHeight >= scrollHeight || totalHeight > 15000) {
                                clearInterval(timer);
                                resolve();
                            }
                        }, 150);
                    });
                });
                await new Promise(r => setTimeout(r, 2000));

                // Extract basic info
                const items = await page.evaluate((genre) => {
                    const results: any[] = [];
                    const cards = document.querySelectorAll('.ms-list-imgs a');
                    
                    cards.forEach((card) => {
                        const exclusiveBadge = card.querySelector('p.list-b-circle');
                        const badgeText = exclusiveBadge?.textContent?.trim() || '';
                        
                        if (badgeText === '단독') {
                            const title = card.querySelector('.list-b-tit1')?.textContent?.trim() || '';
                            const img = card.querySelector('img');
                            const poster = img?.getAttribute('data-src') || img?.getAttribute('src') || '';
                            
                            const infoTexts = card.querySelectorAll('.list-b-tit2');
                            const dateRaw = infoTexts[0]?.textContent?.trim() || '';
                            const venue = infoTexts[1]?.textContent?.trim() || '';
                            
                            const onclick = card.getAttribute('onclick') || '';
                            const idMatch = onclick.match(/\((\d+)\)/);
                            const perfId = idMatch ? idMatch[1] : '';

                            if (title && perfId) {
                                results.push({
                                    id: `yes24_${perfId}`,
                                    title,
                                    poster: poster && !poster.startsWith('http') ? `https:${poster}` : poster,
                                    date: dateRaw,
                                    venue,
                                    link: `https://ticket.yes24.com/Perf/${perfId}`,
                                    genre: genre,
                                    region: '서울'
                                });
                            }
                        }
                    });
                    return results;
                }, cat.genre);

                console.log(`Found ${items.length} exclusive items in ${cat.name}.`);

                const progressBar = new cliProgress.SingleBar({
                    format: `${cat.name} 상세 수집 | {bar} | {percentage}% | {value}/{total} | {item}`,
                    hideCursor: true
                }, cliProgress.Presets.shades_classic);

                progressBar.start(items.length, 0, { item: '대기 중' });

                for (const item of items) {
                    progressBar.update({ item: item.title.substring(0, 15) });
                    
                    // Check if already enriched to save time and requests.
                    // Older rows only had price/description, so refresh them when detail fields are missing.
                    const existing = allEnrichedItems.find(i => i.id === item.id);
                    if (existing && !needsDetailRefresh(existing)) {
                        progressBar.increment();
                        continue;
                    }

                    if (detailAttempts >= DETAIL_ENRICH_LIMIT) {
                        if (existing) {
                            Object.assign(existing, { ...existing, ...item });
                        } else if (!allEnrichedItems.some(i => i.id === item.id)) {
                            allEnrichedItems.push(item);
                        }
                        progressBar.increment();
                        continue;
                    }

                    let detailPage: any = null;
                    try {
                        detailAttempts++;
                        detailPage = await browser.newPage();
                        await detailPage.evaluateOnNewDocument(BROWSER_EVAL_BOOTSTRAP);
                        await detailPage.goto(item.link, { waitUntil: 'domcontentloaded', timeout: 30000 });
                        await detailPage.evaluate(BROWSER_EVAL_BOOTSTRAP).catch(() => undefined);
                        
                        const detail = await detailPage.evaluate(async (perfId: string) => {
                            const compact = (value?: string | null) => (value || '')
                                .replace(/\r/g, '')
                                .replace(/\u00a0/g, ' ')
                                .replace(/[ \t]+/g, ' ')
                                .trim();

                            const cleanLines = (value?: string | null) => (value || '')
                                .replace(/\r/g, '')
                                .replace(/\u00a0/g, ' ')
                                .split('\n')
                                .map(line => line.replace(/[ \t]+/g, ' ').trim())
                                .filter(Boolean)
                                .join('\n')
                                .trim();

                            const readDlValues = (selector: string) => {
                                const result: Record<string, string> = {};
                                const root = document.querySelector(selector);
                                if (!root) return result;

                                root.querySelectorAll('dt').forEach((dt) => {
                                    const label = compact(dt.textContent);
                                    if (!label) return;

                                    const values: string[] = [];
                                    let node = dt.nextElementSibling;
                                    while (node && node.tagName.toLowerCase() !== 'dt') {
                                        values.push((node as HTMLElement).innerText || node.textContent || '');
                                        node = node.nextElementSibling;
                                    }
                                    result[label] = cleanLines(values.join('\n'));
                                });

                                return result;
                            };

                            const htmlToReadableText = (html?: string) => {
                                if (!html) return '';
                                const doc = new DOMParser().parseFromString(html, 'text/html');
                                doc.querySelectorAll('script, style, img').forEach(el => el.remove());

                                const blocks = Array.from(doc.body.querySelectorAll('p, li, dt, dd, div'))
                                    .filter(el => !el.querySelector('p, li, dt, dd'))
                                    .map(el => compact((el as HTMLElement).innerText || el.textContent || ''))
                                    .filter(Boolean);

                                const unique = blocks.filter((line, index) => {
                                    return blocks.findIndex(candidate => candidate === line || candidate.includes(line)) === index;
                                });

                                const blockText = unique.join('\n').trim();
                                return blockText || cleanLines(doc.body.textContent || '');
                            };

                            const extractImageUrls = (html?: string) => {
                                if (!html) return [];
                                const doc = new DOMParser().parseFromString(html, 'text/html');
                                const urls = Array.from(doc.querySelectorAll('img'))
                                    .map((img) => img.getAttribute('data-src') || img.getAttribute('src') || '')
                                    .map((src) => {
                                        const trimmed = compact(src)
                                            .replace(/&amp;/g, '&')
                                            .replace(/[),.;]+$/u, '');
                                        if (!trimmed) return '';
                                        if (trimmed.startsWith('//')) return `https:${trimmed}`;
                                        if (trimmed.startsWith('/')) return `https://ticket.yes24.com${trimmed}`;
                                        return trimmed;
                                    })
                                    .filter((url) => /^https?:\/\//i.test(url))
                                    .filter((url) => !/logo|blank|pixel|loading|spacer/i.test(url));
                                return Array.from(new Set(urls)).slice(0, 8);
                            };

                            const parseYes24Json = (text: string) => {
                                try {
                                    return JSON.parse(text);
                                } catch {
                                    return JSON.parse(text.replace(/\r/gi, '\\r').replace(/\n/gi, '\\n'));
                                }
                            };

                            const parsePriceItem = (raw: string) => {
                                const text = compact(raw);
                                const priceMatch = text.match(/([0-9,]+)\s*원/);
                                if (!priceMatch) return null;
                                const label = compact(text.slice(0, priceMatch.index).replace(/[:：]/g, '')) || '가격';
                                return { label, price: `${priceMatch[1]}원` };
                            };

                            const area1 = readDlValues('.rn-product-area1');
                            const area3 = readDlValues('.rn-product-area3');
                            const priceTexts = Array.from(document.querySelectorAll('.rn-product-price1 li'))
                                .map(li => compact(li.textContent))
                                .filter(Boolean);
                            const priceList = priceTexts.map(parsePriceItem).filter(Boolean);
                            const discountSummary = compact(document.querySelector('.rn-product-price2')?.textContent)
                                .replace(/자세히$/u, '')
                                .trim();

                            let ajaxDetail: {
                                notice?: string;
                                promotion?: string;
                                content?: string;
                                organization?: string;
                                images?: string[];
                            } = {};
                            try {
                                const response = await fetch(`/New/Perf/Detail/Ajax/axPerfContents.aspx?IdPerf=${perfId}`, {
                                    credentials: 'include'
                                });
                                const text = await response.text();
                                const parsed = parseYes24Json(text);
                                if (parsed?.Result === '00') {
                                    const detailHtml = [
                                        parsed.PerfNotice,
                                        parsed.PerfPromotion,
                                        parsed.PerfContent,
                                        parsed.PerfOrganization,
                                    ].filter(Boolean).join('\n');
                                    ajaxDetail = {
                                        notice: htmlToReadableText(parsed.PerfNotice),
                                        promotion: htmlToReadableText(parsed.PerfPromotion),
                                        content: htmlToReadableText(parsed.PerfContent),
                                        organization: htmlToReadableText(parsed.PerfOrganization),
                                        images: extractImageUrls(detailHtml),
                                    };
                                }
                            } catch {
                                ajaxDetail = {};
                            }

                            const organizationLines = cleanLines(ajaxDetail.organization).split('\n').filter(Boolean);
                            const organizationValue = (label: string) => {
                                const row = organizationLines.find(line => line.replace(/\s/g, '').startsWith(label.replace(/\s/g, '')));
                                return row ? compact(row.replace(new RegExp(`^${label}\\s*[:：]?\\s*`, 'u'), '')) : '';
                            };

                            const priceDetail = cleanLines([
                                discountSummary,
                                ajaxDetail.promotion ? `할인정보\n${ajaxDetail.promotion}` : '',
                            ].filter(Boolean).join('\n\n'));

                            return {
                                price: priceTexts.join(', '),
                                priceList,
                                priceDetail,
                                ageRating: area1['등급'] || '',
                                runningTime: area1['관람시간'] || '',
                                performanceTime: area3['공연시간 안내'] || '',
                                reservationInfo: area3['배송정보'] || '',
                                host: organizationValue('주최'),
                                organizer: organizationValue('주관/홍보') || organizationValue('주관'),
                                contact: organizationValue('문의'),
                                description: ajaxDetail.notice || ajaxDetail.content || '',
                                synopsisImages: ajaxDetail.images || [],
                                dataCollectedAt: new Date().toISOString(),
                            };
                        }, item.id.replace(/^yes24_/, ''));
                        
                        const safeTitle = slugify(item.title);
                        const existingImage = existing?.image;
                        const localPoster = existingImage || await processImage(item.poster, `yes24_${safeTitle}`, `posters/${cat.genre}`);
                        
                        const enrichedItem = {
                            ...existing,
                            ...item,
                            ...detail,
                            image: localPoster,
                            backupPoster: item.poster,
                            category: '독점공연'
                        };

                        if (existing) {
                            Object.assign(existing, enrichedItem);
                        } else {
                            allEnrichedItems.push(enrichedItem);
                        }

                        // Random delay between requests: 1-2.5s
                        await new Promise(r => setTimeout(r, 1000 + Math.random() * 1500));
                    } catch (e: any) {
                        console.error(`\nFailed to enrich ${item.title}:`, e.message);
                        if (existing) {
                            Object.assign(existing, { ...existing, ...item });
                        } else if (!allEnrichedItems.some(i => i.id === item.id)) {
                            allEnrichedItems.push(item);
                        }
                    } finally {
                        await detailPage?.close().catch(() => undefined);
                    }
                    progressBar.increment();
                }
                progressBar.stop();

                // Save after each category
                atomicWriteJson(OUTPUT_FILE, allEnrichedItems);
                console.log(`Saved progress to ${OUTPUT_FILE}`);

                // Random delay between categories: 3-6s
                await new Promise(r => setTimeout(r, 3000 + Math.random() * 3000));

            } catch (e: any) {
                console.error(`Error processing category ${cat.name}:`, e.message);
            }
        }

        console.log(`\nScraping complete. Total items: ${allEnrichedItems.length}. Detail attempts: ${detailAttempts}. Deferred limit: ${DETAIL_ENRICH_LIMIT}.`);

    } catch (e) {
        console.error('Global Scraping Error:', e);
    } finally {
        await browser.close();
    }
}

scrapeYes24();

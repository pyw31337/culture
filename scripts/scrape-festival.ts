/**
 * VisitKorea Festival Scraper (Nationwide) - Fully Parallel Version
 * Scrapes festival data from korean.visitkorea.or.kr for all Korean provinces.
 * Parallelized List Scraping AND Detail Scraping.
 */



import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Browser, Page } from 'puppeteer';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import sharp from 'sharp';
import * as cheerio from 'cheerio';

// --- Image Processor Utility (Inlined) ---
const DOWNLOAD_DOMAINS = ['namu.wiki', 'i.namu.wiki', 'pstatic.net', 'naver.com', 'kakaocdn.net', 'daumcdn.net', 'justwatch.com', 'images.justwatch.com', 'kfescdn.visitkorea.or.kr', 'tong.visitkorea.or.kr', 'cdn.visitkorea.or.kr'];
const PUBLIC_DIR = path.join(process.cwd(), 'public');

// Ensure directory exists
const ensureDir = (dir: string) => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
};

/**
 * Downloads and processes an image if it matches specific domains.
 * Converts to WebP.
 * 
 * @param url The original image URL
 * @param filenameBase The desired filename (without extension)
 * @param subDir Optional subdirectory inside public/images/ (e.g. 'posters/festivals')
 * @returns The final URL to use (local path if downloaded, original URL otherwise)
 */
async function processImage(url: string, filenameBase: string, subDir: string = 'posters'): Promise<string> {
    if (!url) return '';
    if (url.startsWith('data:')) return url; // Skip data URIs

    // Construct target directory
    const targetDir = path.join(PUBLIC_DIR, 'images', subDir);
    ensureDir(targetDir);

    try {
        if (url.includes('search.pstatic.net')) {
            // Clean Naver Image URL
            // Keep only 'src', remove 'type', 'quality'
            try {
                const u = new URL(url);
                const src = u.searchParams.get('src');
                if (src) {
                    url = decodeURIComponent(src); // Use the direct source URL
                }
            } catch (e) { }
        }

        const urlObj = new URL(url);
        const shouldDownload = DOWNLOAD_DOMAINS.some(d => urlObj.hostname.includes(d));

        if (!shouldDownload) {
            return url;
        }

        // Sanitize filename
        const safeFilename = filenameBase.replace(/[^a-z0-9가-힣]/gi, '_').substring(0, 100);
        const relativePath = `/images/${subDir}/${safeFilename}.webp`;
        const absolutePath = path.join(targetDir, `${safeFilename}.webp`);

        // Check if already exists (optimistic skipping)
        if (fs.existsSync(absolutePath)) {
            // Optional: Check file size or age to re-download? For now, skip if exists.
            // console.log(`[Image] cache hit: ${relativePath}`);
            return relativePath;
        }

        console.log(`[Image] Downloading: ${url} -> ${relativePath}`);

        let referer = 'https://www.naver.com/';
        if (url.includes('namu.wiki') || url.includes('namu.mirror')) referer = 'https://namu.wiki/';
        if (url.includes('daum') || url.includes('kakao')) referer = 'https://daum.net/';
        if (url.includes('visitkorea')) referer = 'https://korean.visitkorea.or.kr/';

        const response = await axios({
            url,
            method: 'GET',
            responseType: 'arraybuffer',
            headers: {
                'Referer': referer,
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            timeout: 10000
        });

        await sharp(response.data)
            .resize({ width: 600, withoutEnlargement: true }) // Reasonable max width for posters
            .webp({ quality: 80 })
            .toFile(absolutePath);

        return relativePath;

    } catch (error: any) {
        // Handle specific HTTP errors
        const statusCode = error?.response?.status;
        if (statusCode === 404) {
            console.warn(`[Image] 404 Not Found: ${url} - using empty fallback`);
            return ''; // Return empty to use frontend placeholder
        }
        console.error(`[Image] Failed to process ${url}:`, error instanceof Error ? error.message : String(error));
        // Return empty string instead of broken URL for better UX
        return '';
    }
}
// -------------------------------------

// ... existing code

// Remove unused Browser import if it was there (it was removed in previous step but linter complained)

// ... existing code

// Fix the end of file call
// function call removed from here

puppeteer.use(StealthPlugin());

const OUTPUT_FILE = path.join(process.cwd(), 'src/data/festivals.json');
const BASE_URL = 'https://korean.visitkorea.or.kr';
const LIST_URL = 'https://korean.visitkorea.or.kr/kfes/list/wntyFstvlList.do';
const DETAIL_BASE_URL = `${BASE_URL}/kfes/detail/fstvlDetail.do`;

// Configuration
const CONCURRENCY = 5;
const SAVE_INTERVAL = 50;
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';

const REGION_MAP: Record<string, string> = {
    '서울': 'seoul', '경기': 'gyeonggi', '인천': 'incheon', '부산': 'busan', '대구': 'daegu',
    '광주': 'gwangju', '대전': 'daejeon', '울산': 'ulsan', '세종': 'sejong', '강원': 'gangwon',
    '충북': 'chungbuk', '충남': 'chungnam', '전북': 'jeonbuk', '전남': 'jeonnam', '경북': 'gyeongbuk',
    '경남': 'gyeongnam', '제주': 'jeju',
};

function slugify(text: string): string {
    return text
        .replace(/[^a-zA-Z0-9가-힣]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface FestivalItem {
    id: string; title: string; image: string; date: string; venue: string; region: string; link: string; genre: string;
    description?: string;
    tagline?: string;
    address?: string;
    price?: string;
    priceDetail?: string;
    time?: string;
    performanceTime?: string;
    runningTime?: string;
    feesAndPrograms?: string;
    contact?: string;
    website?: string;
    instagram?: string;
    sourceUpdatedAt?: string;
    host?: string;
    organizer?: string;
    foodInfo?: string;
    foodVendors?: string[];
    latitude?: number | string;
    longitude?: number | string;
    lastEnriched?: string;
}

interface ListItem {
    id: string;
    title: string;
    thumbnailImage: string;
    date?: string;
    venue?: string;
    link?: string;
}

function parseRegion(address: string): string {
    for (const [k, v] of Object.entries(REGION_MAP)) {
        if (address.includes(k)) return v;
    }
    return 'etc';
}

function isBroadAdministrativeVenue(value: unknown): boolean {
    const venue = normalizeInlineText(value);
    if (!venue) return false;
    if (/특별자치시\s*세종시$/.test(venue)) return true;
    if (/^(서울|부산|대구|인천|광주|대전|울산|세종)(특별시|광역시|특별자치시)?$/.test(venue)) return true;
    if (/^[가-힣]+(도|특별자치도)$/.test(venue)) return true;
    return false;
}

function normalizeInlineText(value: unknown): string {
    return String(value || '')
        .replace(/\u00a0/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function normalizeBlockText(value: unknown): string {
    return String(value || '')
        .replace(/\r/g, '')
        .replace(/\u00a0/g, ' ')
        .split('\n')
        .map(line => line.replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .join('\n')
        .trim();
}

function formatFestivalProgram(value: string): string {
    const text = normalizeBlockText(value);
    if (!text) return '';

    return text
        .replace(/\[행사내용\]\s*/g, '[행사내용]\n')
        .replace(/\s+(\d+\.\s*)/g, '\n$1')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

function buildPerformanceTime(timeText: string, runningTimeText: string): string {
    const time = normalizeInlineText(timeText).replace(/\s*~\s*$/, '');
    const runningTime = normalizeInlineText(runningTimeText);
    if (!time) return '';
    if (runningTime && !time.includes(runningTime)) {
        return `${time} 시작 (${runningTime})`;
    }
    return time;
}

function extractRunningTimeFromText(...values: Array<string | undefined>): string {
    const joined = values.filter(Boolean).join(' ');
    const match = joined.match(/약\s*\d+\s*시간|약\s*\d+\s*분|\d+\s*시간\s*가량/);
    return match ? normalizeInlineText(match[0]) : '';
}

async function fetchText(url: string): Promise<string> {
    const response = await axios.get(url, {
        timeout: 15000,
        headers: {
            'User-Agent': USER_AGENT,
            'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
        },
    });
    return String(response.data || '');
}

type OfficialSiteSupplement = {
    venue?: string;
    performanceTime?: string;
    runningTime?: string;
};

async function enrichFromOfficialSite(homepageUrl: string, title: string, fallbackProgramText: string): Promise<OfficialSiteSupplement> {
    const supplement: OfficialSiteSupplement = {};
    if (!homepageUrl) return supplement;

    let parsedUrl: URL;
    try {
        parsedUrl = new URL(homepageUrl);
    } catch {
        return supplement;
    }

    // Keep this intentionally conservative. The first known enhancer covers the
    // Sejong festival site where VisitKorea has rich content but omits start time.
    if (!parsedUrl.hostname.includes('sjfestival.kr')) {
        return supplement;
    }

    try {
        const listUrl = new URL('/dh_board/lists/news_notice2', parsedUrl).toString();
        const listHtml = await fetchText(listUrl);
        const $ = cheerio.load(listHtml);
        const plainTitle = title.replace(/\[[^\]]+\]/g, '').trim();

        const candidates = $('a.board-list__record').toArray()
            .map((el) => {
                const link = $(el);
                return {
                    href: link.attr('href') || '',
                    title: normalizeInlineText(link.find('.board-list__tit').text() || link.text()),
                };
            })
            .filter(item => item.href && item.title.includes(plainTitle))
            .filter(item => !/(자주\s*묻는|FAQ|리플렛|공간\s*안내|주차|버스|교통|먹거리|모집|영문|英文|世宗|이야기)/i.test(item.title));

        const target = candidates[0];
        if (!target) return supplement;

        const detailUrl = new URL(target.href, parsedUrl).toString();
        const detailHtml = await fetchText(detailUrl);
        const detail$ = cheerio.load(detailHtml);
        const detailText = normalizeBlockText(
            detail$('.board-view__cont, .board-view__content, .board-page, article, body').text()
        );
        const detailLines = detailText.split('\n').map(normalizeInlineText).filter(Boolean);
        const compactText = normalizeInlineText(detailText);

        const dateTimeMatch = compactText.match(/일시\s*[lㅣ|:]\s*([0-9]{4}\.[0-9]{2}\.[0-9]{2}\.?\s*\([^)]+\))\s*([0-9]{1,2}:[0-9]{2}\s*~?)/);
        const runningTime = extractRunningTimeFromText(fallbackProgramText, compactText);
        if (dateTimeMatch) {
            supplement.performanceTime = buildPerformanceTime(dateTimeMatch[2], runningTime);
        }
        if (runningTime) {
            supplement.runningTime = runningTime;
        }

        const venueLine = detailLines.find(line => /^장소\s*[lㅣ|:]/.test(line));
        const venueMatch = venueLine?.match(/^장소\s*[lㅣ|:]\s*(.+)$/);
        if (venueMatch) {
            supplement.venue = normalizeInlineText(venueMatch[1]).replace(/<\/?[^>]+>/g, '');
        }
    } catch (error: any) {
        console.warn(`[Festival] official supplement failed for ${title}: ${error?.message || error}`);
    }

    return supplement;
}

function hasDetailedFestivalData(item: FestivalItem): boolean {
    const venue = normalizeInlineText(item.venue);
    const suspiciousVenue = venue.length > 120 || /(이전\s*글|다음\s*글|목록으로|COPYRIGHT|사업자등록번호)/i.test(venue);
    const genericVenue = isBroadAdministrativeVenue(venue) && Boolean(item.address);
    return Boolean(
        !suspiciousVenue
        && !genericVenue
        &&
        normalizeInlineText(item.description).length > 80
        && (item.address || item.price || item.contact || item.website || item.feesAndPrograms)
    );
}

async function scrapeListPage(page: Page, pageNum: number): Promise<ListItem[]> {
    try {
        // Updated Selectors for New Layout
        return (await page.evaluate(`(() => {
            const slugify = (text) => {
                return text
                    .replace(/[^a-zA-Z0-9가-힣]/g, '_')
                    .replace(/_+/g, '_')
                    .replace(/^_|_$/g, '');
            };
            const items = [];
            const lis = document.querySelectorAll('#fstvlList > li');

            lis.forEach((el) => {
                const linkEl = el.querySelector('a');
                if (!linkEl) return;

                const href = linkEl.getAttribute('href') || '';
                const url = new URL(href, 'https://korean.visitkorea.or.kr');
                const id = url.searchParams.get('fstvlCntntsId') || '';

                if (!id) return;

                const titleEl = el.querySelector('.other_festival_content strong');
                const title = titleEl?.textContent?.trim() || '';

                const imgEl = el.querySelector('.other_festival_img img');
                let thumbnailImage = imgEl?.src || '';
                // Upgrade image quality by using original instead of 300_ thumbnail
                if (thumbnailImage.includes('/300_')) {
                    thumbnailImage = thumbnailImage.replace('/300_', '/');
                }

                const dateEl = el.querySelector('.date');
                const date = dateEl?.textContent?.trim() || '';

                const locEl = el.querySelector('.loc');
                const venue = locEl?.textContent?.trim() || '';

                const festId = id;

                items.push({ id: festId, title, thumbnailImage, date, venue, link: href });
            });
            return items;
        })()`)) as any;
    } catch (e) {
        console.error(`Page ${pageNum} scrape error:`, e);
        return [];
    }
}

async function scrapeDetailPage(page: Page, item: ListItem): Promise<FestivalItem | null> {
    // Navigate to detail page to get high-quality poster/cover
    let url = `${DETAIL_BASE_URL}?fstvlCntntsId=${item.id}`;

    try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

        const detailData = await page.evaluate(`(() => {
            const normalizeInline = (value) => String(value || '')
                .replace(/\\u00a0/g, ' ')
                .replace(/\\s+/g, ' ')
                .trim();
            const normalizeBlock = (value) => String(value || '')
                .replace(/\\r/g, '')
                .replace(/\\u00a0/g, ' ')
                .split('\\n')
                .map((line) => line.replace(/\\s+/g, ' ').trim())
                .filter(Boolean)
                .join('\\n')
                .trim();
            const escapeRegExp = (value) => value
                .replace(/[.*+?^()|[\\]\\\\]/g, '\\\\$&')
                .replace(/\\$/g, '\\\\$')
                .replace(/[{}]/g, '\\\\$&');
            const stripLabel = (text, label) => {
                const value = normalizeBlock(text);
                const safeLabel = normalizeInline(label);
                if (!safeLabel) return value;
                return value.replace(new RegExp('^' + escapeRegExp(safeLabel) + '\\\\s*'), '').trim();
            };

            // 1. Try Poster Selector
            // Selector: #mainTab > div > div > section.poster_detail > div > div.poster_detail_wrap > div > div.detail_img_box > a > img
            const posterImg = document.querySelector('#mainTab .detail_img_box img');
            let detailImage = null;
            if (posterImg) {
                detailImage = posterImg.src;
            }

            // 2. Try Background Cover Selector
            // Selector: #mainTab > div > section > div > div
            // Need to extract 'url("...")' from style
            const bgEl = document.querySelector('#mainTab > div > section > div > div');
            if (!detailImage && bgEl) {
                const style = window.getComputedStyle(bgEl);
                const bgImage = style.backgroundImage; // e.g., 'url("https://...")'
                if (bgImage && bgImage !== 'none') {
                    // Extract URL from 'url("...")' or 'url(...)'
                    const match = bgImage.match(/url\(["']?(.*?)["']?\)/);
                    if (match && match[1]) {
                        detailImage = match[1];
                    }
                }
            }

            // 3. Try to capture the first inner CDN image
            if (!detailImage) {
                const innerImages = Array.from(document.querySelectorAll('#mainTab img'));
                for (const img of innerImages) {
                    if (img.src.includes('kfescdn.visitkorea.or.kr')) {
                        detailImage = img.src;
                        break;
                    }
                }
            }

            const info = {};
            Array.from(document.querySelectorAll('.img_info_box li')).forEach((li) => {
                const label = normalizeInline(li.querySelector('.blind')?.textContent || li.querySelector('.info_ico')?.textContent || '');
                const value = stripLabel(li.innerText || li.textContent || '', label);
                if (label && value) info[label] = value;
            });

            const description = normalizeBlock(
                document.querySelector('.poster_info_content .slide_content.fst')?.innerText
                || document.querySelector('.detail_img_box p')?.innerText
                || ''
            );
            const programText = normalizeBlock(
                document.querySelector('.poster_info_content .slide_content.lst')?.innerText
                || document.querySelector('.poster_info_content .m_more')?.innerText
                || ''
            );
            const tagline = normalizeInline(
                document.querySelector('.poster_detail_top p, .visual_title p, .poster_title p')?.textContent
                || ''
            );

            const homepageEl = document.querySelector('a.homepage_link_btn[href]');
            const instagramEl = Array.from(document.querySelectorAll('a[href*="instagram.com"]'))
                .find((a) => normalizeInline(a.textContent || a.href).length > 0);
            const message = normalizeBlock(document.querySelector('.foodinfo_section .message')?.innerText || '');
            const updatedMatch = message.match(/최종\\s*업데이트\\s*:\\s*([0-9.]+)/);
            const foodVendors = Array.from(document.querySelectorAll('.foodinfo_section .sel_list a'))
                .map((a) => normalizeInline(a.textContent))
                .filter(Boolean);
            const foodInfo = foodVendors.length
                ? '먹거리 정보\\n' + foodVendors.slice(0, 24).join(', ') + (foodVendors.length > 24 ? ' 외 ' + (foodVendors.length - 24) + '곳' : '')
                : '';

            let latitude = '';
            let longitude = '';
            const scriptText = Array.from(document.scripts).map((script) => script.textContent || '').join('\\n');
            const latMatch = scriptText.match(/var\\s+lat\\s*=\\s*['"]([^'"]+)['"]/);
            const lngMatch = scriptText.match(/var\\s+lang\\s*=\\s*['"]([^'"]+)['"]/);
            if (latMatch) latitude = latMatch[1];
            if (lngMatch) longitude = lngMatch[1];

            let jsonLdAddress = '';
            Array.from(document.querySelectorAll('script[type="application/ld+json"]')).some((script) => {
                try {
                    const parsed = JSON.parse(script.textContent || '{}');
                    const attraction = Array.isArray(parsed.itinerary) ? parsed.itinerary[0] : null;
                    const address = attraction?.address?.streetAddress || parsed.address?.streetAddress || '';
                    if (address) {
                        jsonLdAddress = normalizeInline(address);
                        return true;
                    }
                } catch {}
                return false;
            });

            return {
                image: detailImage,
                description,
                feesAndPrograms: programText,
                tagline,
                date: info['날짜'] || '',
                address: info['위치'] || jsonLdAddress || '',
                price: info['가격'] || '',
                host: info['업체'] || '',
                contact: info['전화번호'] || '',
                instagram: info['인스타 그램'] || info['인스타그램'] || normalizeInline(instagramEl?.textContent || ''),
                instagramUrl: instagramEl?.href || '',
                website: homepageEl?.href || '',
                sourceUpdatedAt: updatedMatch ? updatedMatch[1] : '',
                foodInfo,
                foodVendors,
                latitude,
                longitude
            };
        })()`) as {
            image?: string | null;
            description?: string;
            feesAndPrograms?: string;
            tagline?: string;
            date?: string;
            address?: string;
            price?: string;
            host?: string;
            contact?: string;
            instagram?: string;
            instagramUrl?: string;
            website?: string;
            sourceUpdatedAt?: string;
            foodInfo?: string;
            foodVendors?: string[];
            latitude?: string;
            longitude?: string;
        };

        // Regex Fallback if DOM extraction failed
        let finalImage = detailData.image || null;
        if (!finalImage) {
            const html = await page.content();
            // Look for common content image patterns if specific selectors failed
            // Example: https://kfescdn.visitkorea.or.kr/kfes/upload/contents/db/...
            const urlMatch = html.match(/https:\/\/kfescdn\.visitkorea\.or\.kr\/kfes\/upload\/contents\/db\/[^"'\s)]+/);
            if (urlMatch) {
                finalImage = urlMatch[0];
            }
        }

        // Use thumbnail if detail scrape failed
        let imageUrl = finalImage || item.thumbnailImage;

        // LOCALIZATION: Download Image
        if (imageUrl) {
            // Use ID as filename to ensure uniqueness and easy cleanup
            const localPath = await processImage(imageUrl, item.id, 'posters/festivals');
            if (localPath) {
                imageUrl = localPath;
            }
        }

        const feesAndPrograms = formatFestivalProgram(detailData.feesAndPrograms || '');
        const description = normalizeBlockText(detailData.description).replace(/\n?더보기$/u, '').trim();
        const officialSupplement = await enrichFromOfficialSite(detailData.website || '', item.title, feesAndPrograms);
        const runningTime = officialSupplement.runningTime || extractRunningTimeFromText(feesAndPrograms);
        const performanceTime = officialSupplement.performanceTime || buildPerformanceTime('', runningTime);
        const address = normalizeInlineText(detailData.address);
        const price = normalizeInlineText(detailData.price);
        const website = normalizeInlineText(detailData.website);
        const instagram = normalizeInlineText(detailData.instagram).replace(/^@/, '');
        const listVenue = normalizeInlineText(item.venue);
        const venue = officialSupplement.venue || (isBroadAdministrativeVenue(listVenue) ? address : listVenue) || address || '';

        return {
            id: item.id,
            title: item.title,
            image: imageUrl,
            date: detailData.date || item.date || '',
            venue,
            region: parseRegion(address || item.venue || ''),
            link: url,
            genre: 'festival',
            description,
            tagline: normalizeInlineText(detailData.tagline),
            address,
            price,
            priceDetail: price,
            time: performanceTime,
            performanceTime,
            runningTime,
            feesAndPrograms,
            contact: normalizeInlineText(detailData.contact),
            website,
            instagram,
            sourceUpdatedAt: normalizeInlineText(detailData.sourceUpdatedAt),
            host: normalizeInlineText(detailData.host),
            organizer: normalizeInlineText(detailData.host),
            foodInfo: normalizeBlockText(detailData.foodInfo),
            foodVendors: detailData.foodVendors || [],
            latitude: detailData.latitude,
            longitude: detailData.longitude,
            lastEnriched: new Date().toISOString()
        };
    } catch (error) {
        console.error(`Detail scrape error for ${item.id}:`, error);

        // Fallback to list data if detailed scrape fails
        // Still try to download the thumbnail
        let imageUrl = item.thumbnailImage;
        if (imageUrl) {
            const localPath = await processImage(imageUrl, item.id, 'posters/festivals');
            if (localPath) imageUrl = localPath;
        }

        return {
            id: item.id,
            title: item.title,
            image: imageUrl,
            date: item.date || '',
            venue: item.venue || '',
            region: parseRegion(item.venue || ''),
            link: url,
            genre: 'festival',
            lastEnriched: new Date().toISOString()
        };
    }
}

async function scrapeFestivals() {
    console.log('Starting VisitKorea Festival Scraper (Sequential List / Parallel Details)...');
    console.log(`Target Concurrency: ${CONCURRENCY}`);

    let existingItems: FestivalItem[] = [];
    let results: FestivalItem[] = []; // Hoisted for safe saving
    const existingMap = new Map<string, FestivalItem>();

    if (fs.existsSync(OUTPUT_FILE)) {
        try {
            const loaded = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf-8'));
            existingItems = loaded.filter((item: FestivalItem) => item.date && item.venue);
            existingItems.forEach(item => existingMap.set(item.id, item));
            console.log(`Loaded ${existingItems.length} valid existing items.`);
            results = [...existingItems]; // Initialize results with existing Items
        } catch (e) {
            console.error('Failed to load existing data:', e);
        }
    }

    const browser: Browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
    });

    try {
        const listPage = await browser.newPage();
        await listPage.setViewport({ width: 1280, height: 1024 });
        await listPage.setUserAgent(USER_AGENT);
        // Clean headers for stealth
        await listPage.setExtraHTTPHeaders({
            'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
        });

        console.log(`Loading festival list from: ${LIST_URL}`);
        await listPage.goto(LIST_URL, { waitUntil: 'networkidle0', timeout: 60000 });

        // LOAD MORE SCRAPING (New Layout uses 'Load More' button)
        console.log('Starting Load More Scraping...');

        const uniqueListItems = new Map<string, ListItem>();
        const maxPages = 20; // Safety limit

        // Initial scrape
        let prevCount = 0;
        let noChangeCount = 0;

        for (let p = 1; p <= maxPages; p++) {
            // Intelligent Throttling: Random delay between actions
            await delay(Math.random() * 2000 + 1000);

            // Scrape current visible items
            const items = await scrapeListPage(listPage, p);
            items.forEach(item => {
                if (!uniqueListItems.has(item.id)) uniqueListItems.set(item.id, item);
            });

            const currentCount = uniqueListItems.size;
            // console.log(`  Iteration ${p}: Found ${items.length} visible items. Total Unique: ${currentCount}`);

            if (currentCount === prevCount) {
                noChangeCount++;
                if (noChangeCount >= 3) {
                    console.log(`No new items found for 3 iterations (Stuck at ${currentCount}). Stopping.`);
                    break;
                }
            } else {
                noChangeCount = 0;
                console.log(`  Iteration ${p}: Total Unique Items: ${currentCount}`);
            }
            prevCount = currentCount;

            // Click "Load More" button
            const hasMore = await listPage.evaluate(async () => {
                const buttons = Array.from(document.querySelectorAll('a, button'));
                const loadMoreBtn = buttons.find(b => b.textContent?.includes('더보기'));
                if (loadMoreBtn) {
                    (loadMoreBtn as HTMLElement).click();
                    return true;
                }
                return false;
            });

            if (!hasMore) {
                console.log('No "Load More" button found. Reached end of list.');
                break;
            }

            // Wait for list to expand
            await new Promise(resolve => setTimeout(resolve, 3000));
        }

        await listPage.close();
        console.log(`Found ${uniqueListItems.size} unique festivals in list.`);

        // Smart Incremental Filtering
        const newItems: ListItem[] = [];
        const skippedItems: FestivalItem[] = [];

        const isRecentlyEnriched = (ex: FestivalItem) => {
            if (!ex.lastEnriched) return false;
            try {
                const last = new Date(ex.lastEnriched);
                const now = new Date();
                const diffDays = (now.getTime() - last.getTime()) / (1000 * 3600 * 24);
                return diffDays < 7;
            } catch (e) { return false; }
        };

        const isItemExpired = (dateStr: string): boolean => {
            if (!dateStr || !dateStr.includes('~')) return false; 
            try {
                // Format: "2024.01.01 ~ 2024.01.31"
                const parts = dateStr.split('~');
                if (parts.length < 2) return false;
                
                const endDateStr = parts[1].trim(); 
                // Convert YYYY.MM.DD to YYYY-MM-DD
                const cleanDate = endDateStr.replace(/\./g, '-');
                // Set time to end of day to be inclusive
                const endDate = new Date(cleanDate);
                if (isNaN(endDate.getTime())) return false;

                endDate.setHours(23, 59, 59, 999);

                const now = new Date();
                return endDate < now;
            } catch (e) {
                return false; // conservative: keep if parsing fails
            }
        };

        for (const item of Array.from(uniqueListItems.values())) {
            // OPTIMIZATION: Discard expired items immediately
            if (isItemExpired(item.date || '')) {
                // console.log(`Skipping Expired: ${item.title} (${item.date})`);
                continue;
            }

            const existing = existingMap.get(item.id);
            if (existing && isRecentlyEnriched(existing) && hasDetailedFestivalData(existing)) {
                // Force update image from list (high-res)
                if (item.thumbnailImage && (!existing.image || existing.image.startsWith('http'))) {
                    existing.image = item.thumbnailImage;
                }
                skippedItems.push(existing);
            } else {
                newItems.push(item);
            }
        }

        console.log(`Skipped (Recent): ${skippedItems.length}. To Enrich: ${newItems.length}`);

        if (newItems.length === 0) {
            console.log('No new items to enrich. Done.');
            // Save skipped items just in case order changed
            // Use atomic save here too
            const tempFile = `${OUTPUT_FILE}.temp`;
            fs.writeFileSync(tempFile, JSON.stringify(skippedItems, null, 2));
            fs.renameSync(tempFile, OUTPUT_FILE);

            await browser.close();
            return;
        }

        // PARALLEL DETAIL SCRAPING
        console.log('Starting Parallel Detail Scraping...');
        results = [...skippedItems]; // Start with skipped items

        let processedCount = 0;
        let lastSaveCount = 0;
        const detailQueue = [...newItems];
        const totalDetails = detailQueue.length;

        // Reuse browser for workers
        const workers = await Promise.all(Array(CONCURRENCY).fill(null).map(async () => {
            const p = await browser.newPage();
            await p.setViewport({ width: 1280, height: 1024 });
            await p.setUserAgent(USER_AGENT);
            return p;
        }));

        const workerTask = async (page: Page) => {
            while (detailQueue.length > 0) {
                const item = detailQueue.shift();
                if (!item) break;

                // Throttling for detail pages
                await delay(Math.random() * 1000 + 500);

                const detail = await scrapeDetailPage(page, item);
                if (detail) results.push(detail);

                processedCount++;
                if (processedCount % 10 === 0) {
                    const percent = Math.round((processedCount / totalDetails) * 100);
                    const bar = '='.repeat(Math.floor(percent / 5)) + '-'.repeat(20 - Math.floor(percent / 5));
                    console.log(`[${bar}] ${percent}% (${processedCount}/${totalDetails})`);
                }

                if (processedCount - lastSaveCount >= SAVE_INTERVAL) {
                    // Safe Intermediate Save (Atomic)
                    const tempFile = `${OUTPUT_FILE}.temp`;
                    fs.writeFileSync(tempFile, JSON.stringify(results, null, 2));
                    fs.renameSync(tempFile, OUTPUT_FILE);

                    console.log(`  [Saved] ${results.length} items total.`);
                    lastSaveCount = processedCount;
                }
            }
        };

        await Promise.all(workers.map(p => workerTask(p)));
        console.log('Done.');

    } catch (e) {
        console.error('Fatal Error:', e);
    } finally {
        await browser.close();

        // Final Atomic Save (Circuit Breaker)
        if (results.length > 0) {
            // Final Save
            console.log(`Final Save: ${results.length} items to ${OUTPUT_FILE}`);
            const tempFile = `${OUTPUT_FILE}.temp`;
            fs.writeFileSync(tempFile, JSON.stringify(results, null, 2));
            fs.renameSync(tempFile, OUTPUT_FILE);

            // Cleanup Logic
            cleanupExpiredImages(results.map(i => i.id));

            console.log(`Scraping Complete. Exit code: 0`);
        } else {
            // Safety measure: Do NOT overwrite if results are empty, unless the list was genuinely empty (handled earlier)
            console.warn('Scraper finished with 0 items. Aborting save to protect existing data.');
        }
    }
}

function cleanupExpiredImages(validIds: string[]) {
    const posterDir = path.join(process.cwd(), 'public', 'images', 'posters', 'festivals');
    if (!fs.existsSync(posterDir)) return;

    console.log(`Cleaning up expired festival images... (Valid IDs count: ${validIds.length})`);

    // Generate valid filenames based on the same logic as processImage
    const validFilenames = new Set(validIds.map(id => {
        return id.replace(/[^a-z0-9가-힣]/gi, '_').substring(0, 100) + '.webp';
    }));

    const files = fs.readdirSync(posterDir);
    let deletedCount = 0;

    files.forEach(file => {
        if (!file.endsWith('.webp')) return;

        if (!validFilenames.has(file)) {
            try {
                fs.unlinkSync(path.join(posterDir, file));
                console.log(`Deleted expired image: ${file}`);
                deletedCount++;
            } catch (e) {
                console.error(`Failed to delete ${file}:`, e);
            }
        }
    });
    console.log(`Cleanup complete. Deleted ${deletedCount} expired images.`);
}

scrapeFestivals().then(() => {
    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});

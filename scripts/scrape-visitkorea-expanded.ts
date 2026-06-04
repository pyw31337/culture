
import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import { Performance } from '../src/types';
import pLimit from 'p-limit';
import { atomicWriteJson } from './utils/scraper-utils';

const DATA_FILE = path.join(process.cwd(), 'src/data/tourism.json');
const baseApiUrl = 'https://korean.visitkorea.or.kr';
const baseImageURL = 'https://cdn.visitkorea.or.kr/img/call?cmd=VIEW&id=';
const PUPPETEER_DETAIL_TIMEOUT_MS = Number(process.env.TOURISM_PUPPETEER_TIMEOUT_MS || 25000);
const BROWSER_EVAL_BOOTSTRAP = 'window.__name = window.__name || function(fn){ return fn; };';
const TOURISM_MAX_PAGES = Number(process.env.TOURISM_MAX_PAGES || 25);

const AREA_MAP: Record<string, string> = {
    '1': '서울', '2': '인천', '3': '대전', '4': '대구', '5': '광주', '6': '부산', '7': '울산', '8': '세종',
    '31': '경기', '32': '강원', '33': '충북', '34': '충남', '35': '경북', '36': '경남', '37': '전북', '38': '전남', '39': '제주'
};

const limit = pLimit(5);

function parseTourismPrice(priceDetail: string): string {
    if (!priceDetail) return '무료';
    if (priceDetail.trim() === '무료') return '무료';

    // Look for prices like "3,000원", "10,000원"
    const priceRegex = /(\d{1,3}(,\d{3})*원)/g;
    const matches = priceDetail.match(priceRegex);

    if (matches && matches.length > 0) {
        // Find the maximum price found (usually Adult/Individual price)
        const numericPrices = matches.map(m => parseInt(m.replace(/[^0-9]/g, ''), 10));
        const maxPrice = Math.max(...numericPrices);
        return `${maxPrice.toLocaleString()}원`;
    }

    if (priceDetail.includes('무료')) return '무료';
    return priceDetail; // Fallback to raw string if no numeric price found
}

/**
 * Clean string by removing extra whitespace and newlines
 */
function clean(str: string | undefined): string {
    return str ? str.replace(/\s+/g, ' ').trim() : '';
}

function normalizeExternalUrl(value?: string | null) {
    const raw = clean(value || '');
    if (!raw) return '';
    if (raw.startsWith('//')) return `https:${raw}`;
    if (raw.startsWith('/')) return `${baseApiUrl}${raw}`;
    return raw;
}

function normalizeHomepageUrl(value?: string | null) {
    return normalizeExternalUrl(value).replace(/\/+$/, '');
}

function getMetaContent($: cheerio.CheerioAPI, selector: string) {
    return normalizeExternalUrl($(selector).attr('content'));
}

function extractRepresentativeImage($: cheerio.CheerioAPI) {
    return (
        getMetaContent($, 'meta[property="og:image"]') ||
        getMetaContent($, 'meta[name="twitter:image"]') ||
        getMetaContent($, 'meta[id="ogimage"]')
    );
}

function normalizePageAssetUrl(value: string | undefined, pageUrl: string) {
    const raw = clean(value || '');
    if (!raw || raw.startsWith('data:') || raw.startsWith('javascript:')) return '';
    try {
        return new URL(raw, pageUrl).href;
    } catch {
        return '';
    }
}

function looksLikeContentImage(url: string) {
    const normalized = url.toLowerCase();
    if (!normalized) return false;
    if (/\.(svg|ico)(?:[?#]|$)/.test(normalized)) return false;
    if (/(logo|favicon|weather|btn-|button|footer|accessibility|banner|dummy_icon|sticker|sns|facebook|twitter|instagram|kakao|naver|map_dim|pop_img|photoevent)/.test(normalized)) {
        return false;
    }
    if (/\/resources\/images\//.test(normalized) && !/\/theme\/travel|\/theme\/story|\/upload\//.test(normalized)) {
        return false;
    }
    return (
        /\/img\/call\?/.test(normalized) ||
        /\/story\//.test(normalized) ||
        /\/upload\//.test(normalized) ||
        /\.(jpe?g|png|webp|gif)(?:[?#]|$)/.test(normalized)
    );
}

function dedupeImages(images: string[]) {
    const seen = new Set<string>();
    return images.filter((image) => {
        const normalized = normalizeExternalUrl(image);
        if (!normalized || !looksLikeContentImage(normalized)) return false;
        const key = normalized.replace(/([?&])(?:w|h|width|height|thumb|thumbnail)=[^&]+/gi, '$1');
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

async function fetchVisitKoreaBodyDetail(cotId: string, refererUrl: string) {
    try {
        const body = new URLSearchParams({
            cmd: 'TOUR_CONTENT_BODY_DETAIL',
            cotId,
            locationx: '',
            locationy: '',
            stampId: '',
        });
        const response = await axios.post(`${baseApiUrl}/call`, body.toString(), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': refererUrl,
                'X-Requested-With': 'XMLHttpRequest',
            },
            timeout: 10000,
        });

        const images = Array.isArray(response.data?.body?.image) ? response.data.body.image : [];
        const publicImages = images
            .filter((item: any) => item?.imgType === 'Public' && item?.imgPath)
            .sort((a: any, b: any) => Number(a.orderby || 0) - Number(b.orderby || 0))
            .map((item: any) => `${baseImageURL}${item.imgPath}`);

        return {
            image: publicImages[0] || '',
            synopsisImages: dedupeImages(publicImages).slice(0, 12),
        };
    } catch (error: any) {
        console.warn(`[VisitKorea body WARN] ${cotId}: ${error.message}`);
        return { image: '', synopsisImages: [] as string[] };
    }
}

function extractImageGallery($: cheerio.CheerioAPI, pageUrl: string) {
    const images: string[] = [];
    const html = $.root().html() || '';
    const selectors = [
        '#section1 img',
        '.figureGrid img',
        '.detail-infor img',
        '.swiper-slide img',
        '.wrap_contView img',
        '.box_txtPhoto img',
        '.img_typeBox img',
        '.photo img',
        'article img',
        'main img',
        'img',
    ];

    selectors.forEach((selector) => {
        $(selector).each((_, el) => {
            const image = normalizePageAssetUrl(
                $(el).attr('src')
                    || $(el).attr('data-src')
                    || $(el).attr('data-original')
                    || $(el).attr('data-lazy')
                    || $(el).attr('data-image'),
                pageUrl,
            );
            if (image) images.push(image);
        });
    });

    html.match(/https?:\/\/(?:cdn|kfescdn|tong)\.visitkorea\.or\.kr\/[^"'\s<>]+/g)
        ?.forEach((image) => images.push(image.replace(/&amp;/g, '&').replace(/[),.;]+$/g, '')));

    return dedupeImages(images);
}

const OFFICIAL_GALLERY_HOST_ALLOWLIST = [
    'icjg.go.kr',
];

function canFetchOfficialGallery(url: string) {
    try {
        const { hostname } = new URL(url);
        return OFFICIAL_GALLERY_HOST_ALLOWLIST.some((host) => hostname === host || hostname.endsWith(`.${host}`));
    } catch {
        return false;
    }
}

async function fetchOfficialWebsiteGallery(url: string) {
    const normalizedUrl = normalizeExternalUrl(url);
    if (!normalizedUrl || !canFetchOfficialGallery(normalizedUrl)) return [];

    try {
        const response = await axios.get(normalizedUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': baseApiUrl,
            },
            timeout: 8000,
        });
        const $ = cheerio.load(response.data);
        return extractImageGallery($, normalizedUrl).slice(0, 10);
    } catch (error: any) {
        console.warn(`[Official gallery WARN] ${normalizedUrl}: ${error.message}`);
        return [];
    }
}

async function fetchDetails(cotId: string) {
    const url = `${baseApiUrl}/detail/ms_detail.do?cotid=${cotId}`;
    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            },
            timeout: 10000
        });
        const html = response.data;
        const $ = cheerio.load(html);
        const image = extractRepresentativeImage($);
        const bodyDetail = await fetchVisitKoreaBodyDetail(cotId, url);

        // 1. Improved Introduction Selectors
        let description = clean($('.inr_wrap .inr p, .char_cont p, .detail_cont, #detailinfoview .inr_wrap p').first().text());
        
        // 2. Info List processing (improved to find items even without .detail_info class)
        const infoList: Record<string, string> = {};
        $('#detailinfoview li').each((_, el) => {
            const label = $(el).find('strong').text().trim().replace(':', '');
            // For values, look for span, a, or direct text nodes excluding the label
            let value = '';
            const aTag = $(el).find('a');
            if (aTag.length && (label.includes('홈페이지') || label.includes('예매'))) {
                value = aTag.attr('href') || aTag.text().trim();
            } else {
                value = $(el).find('span').text().trim() || $(el).text().replace(label, '').replace(':', '').trim();
            }
            if (label && value) infoList[label] = value;
        });

        // 3. Robust field mapping
        const contact = infoList['문의 및 안내'] || infoList['전화번호'] || infoList['문의'] || '';
        const priceDetail = infoList['입장료'] || infoList['이용요금'] || infoList['관람료'] || '';
        const operatingHours = infoList['이용시간'] || infoList['운영시간'] || '';
        const address = infoList['주소'] || '';
        const closedDays = infoList['휴일'] || infoList['쉬는날'] || '';
        const website = normalizeHomepageUrl(infoList['홈페이지'] || '');
        const parking = infoList['주차'] || '';
        const parkingFee = infoList['주차요금'] || infoList['주차 요금'] || infoList['주차비'] || '';
        const status = infoList['지정현황'] || '';
        const ageDetail = infoList['체험가능 연령'] || infoList['관람소요시간'] || '';
        const facilities = infoList['주요시설'] || '';
        const restrooms = infoList['화장실'] || '';
        const visitKoreaImages = extractImageGallery($, url);
        const officialImages = await fetchOfficialWebsiteGallery(website);
        const representativeImage = image || bodyDetail.image;
        const synopsisImages = dedupeImages([...bodyDetail.synopsisImages, ...visitKoreaImages, ...officialImages])
            .filter((galleryImage) => galleryImage !== representativeImage)
            .slice(0, 10);

        // Case for missing data via Cheerio -> Usually means JS-only rendering
        if (!description && !contact && !operatingHours && !address) {
            console.log(`[DEBUG] No details for ${cotId} via Cheerio. Trying Puppeteer fallback...`);
            const fallback = await fetchDetailsWithPuppeteer(url);
            return fallback
                ? {
                    ...fallback,
                    image: fallback.image || representativeImage,
                    synopsisImages,
                }
                : {
                    image: representativeImage,
                    synopsisImages,
                    description,
                    contact,
                    priceDetail,
                    operatingHours,
                    address,
                    closedDays,
                    website,
                    parking,
                    parkingFee,
                    status,
                    ageDetail,
                    facilities,
                    restrooms,
                };
        }

        return {
            description,
            contact,
            priceDetail,
            operatingHours,
            address,
            closedDays,
            website,
            parking,
            parkingFee,
            status,
            ageDetail,
            facilities,
            restrooms,
            image: representativeImage,
            synopsisImages
        };
    } catch (error: any) {
        console.error(`Error fetching details for ${cotId}:`, error.message);
        return null;
    }
}

// Global browser instance for detail fetching (reusable)
let _browser: any = null;

async function closeSharedBrowser() {
    if (!_browser) return;
    const browser = _browser;
    _browser = null;
    await Promise.race([
        browser.close(),
        new Promise((resolve) => setTimeout(resolve, 5000)),
    ]).catch((error: any) => {
        console.warn(`[Puppeteer WARN] browser close failed: ${error.message}`);
    });
}

async function fetchDetailsWithPuppeteer(url: string) {
    const puppeteer = require('puppeteer-extra');
    const StealthPlugin = require('puppeteer-extra-plugin-stealth');
    puppeteer.use(StealthPlugin());

    if (!_browser) {
        _browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
    }

    const page = await _browser.newPage();
    await page.setDefaultNavigationTimeout(PUPPETEER_DETAIL_TIMEOUT_MS);
    // Shim for tsx/esbuild injected __name helper
    await page.evaluateOnNewDocument(BROWSER_EVAL_BOOTSTRAP);
    try {
        await page.setViewport({ width: 1280, height: 800 });
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: PUPPETEER_DETAIL_TIMEOUT_MS });
        await page.evaluate(BROWSER_EVAL_BOOTSTRAP).catch(() => undefined);
        
        // Wait for potential dynamic content
        await page.waitForSelector('.inr_wrap', { timeout: 5000 }).catch(() => {});
        
        // Scroll slightly to trigger lazy loads
        await page.evaluate(() => window.scrollBy(0, 1000));
        await new Promise(r => setTimeout(r, 500));

            const data = await page.evaluate(() => {
                const getMeta = (selector: string) => document.querySelector(selector)?.getAttribute('content') || '';
                const image =
                    getMeta('meta[property="og:image"]') ||
                    getMeta('meta[name="twitter:image"]') ||
                    getMeta('meta[id="ogimage"]');

                // Description
                const descEl = document.querySelector('.inr_wrap .inr p, .char_cont p, .detail_cont, #detailinfoview .inr_wrap p');
                const description = descEl ? descEl.textContent?.replace(/\s+/g, ' ').trim() || '' : '';

            // Info items
            const info: Record<string, string> = {};
            document.querySelectorAll('#detailinfoview li, .detail_info li').forEach(li => {
                    const strong = li.querySelector('strong');
                    const label = (strong ? strong.textContent?.replace(/\s+/g, ' ').trim() : '')?.replace(':', '') || '';
                    const span = li.querySelector('span');
                    const anchor = li.querySelector('a') as HTMLAnchorElement | null;
                    let value = anchor && (label.includes('홈페이지') || label.includes('예매'))
                        ? (anchor.href || anchor.textContent?.replace(/\s+/g, ' ').trim() || '')
                        : (span ? span.textContent?.replace(/\s+/g, ' ').trim() : '');
                
                if (!value && label) {
                    value = li.textContent?.replace(label, '').replace(':', '').trim() || '';
                }
                if (label) info[label] = value || '';
            });

                return {
                    image,
                    description,
                contact: info['문의 및 안내'] || info['전화번호'] || info['문의'] || '',
                priceDetail: info['입장료'] || info['이용요금'] || info['관람료'] || '',
                operatingHours: info['이용시간'] || info['운영시간'] || '',
                address: info['주소'] || '',
                closedDays: info['휴일'] || info['쉬는날'] || '',
                    website: info['홈페이지'] || '',
                parking: info['주차'] || '',
                parkingFee: info['주차요금'] || info['주차 요금'] || info['주차비'] || '',
                status: info['지정현황'] || '',
                ageDetail: info['체험가능 연령'] || '',
                facilities: info['주요시설'] || '',
                restrooms: info['화장실'] || ''
            };
        });

            return data
                ? {
                    ...data,
                    image: normalizeExternalUrl(data.image),
                    website: normalizeHomepageUrl(data.website),
                }
                : data;
    } catch (e: any) {
        console.warn(`[Puppeteer WARN] ${url}: ${e.message}`);
        return null;
    } finally {
        await page.close();
    }
}

async function scrapeVisitKoreaPlaces(maxPages = 25) {
    console.log(`Starting VisitKorea Expanded Scraper (Max Pages: ${maxPages})...`);
    const endpoint = `${baseApiUrl}/api/v2/hot-place/place/list`;
    const results: Performance[] = [];

    for (let page = 1; page <= maxPages; page++) {
        console.log(`  Processing Page ${page}...`);
        try {
            const response = await axios.get(endpoint, {
                params: {
                    page,
                    offset: 15,
                    device: 'PC',
                    hotPlaceType: 'Place',
                    regionCode: '',
                    order: 'POPULAR',
                    type: 'place'
                },
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Referer': 'https://korean.visitkorea.or.kr/main/area_list.do?type=Place',
                },
                timeout: 10000,
            });

            if (response.data?.code === 0 && response.data?.data?.items) {
                const items = response.data.data.items;
                console.log(`    Found ${items.length} items on page ${page}.`);
                
                const enrichedItems = await Promise.all(items.map((item: any) => limit(async () => {
                    const details = await fetchDetails(item.cotId);
                    const areaCode = item.detailDatabase?.areaCode || '';
                    const region = AREA_MAP[areaCode] || '전국';
                    const listImage = item.detailDatabase?.firstImage
                        ? (item.detailDatabase.firstImage.startsWith('http') ? item.detailDatabase.firstImage : `${baseImageURL}${item.detailDatabase.firstImage}`)
                        : '';
                    const representativeImage = details?.image || listImage;
                    const collectedAt = new Date().toISOString();
                    
                    const perf: Performance = {
                        id: `visitkorea_${item.cotId}`,
                        title: item.title,
                        venue: item.title,
                        region: region,
                        date: '상시',
                        image: representativeImage,
                        poster: representativeImage,
                        backupPoster: representativeImage,
                        link: `${baseApiUrl}/detail/ms_detail.do?cotid=${item.cotId}`,
                        genre: 'tourism',
                        category: '관광/여행',
                        description: details?.description || '',
                        synopsisImages: details?.synopsisImages || [],
                        price: parseTourismPrice(details?.priceDetail || ''),
                        priceDetail: details?.priceDetail || '',
                        operatingHours: details?.operatingHours || '',
                        contact: details?.contact || '',
                        address: details?.address || item.detailDatabase?.addr1 || '',
                        closedDays: details?.closedDays || '',
                        website: normalizeHomepageUrl(details?.website || ''),
                        parking: details?.parking || '',
                        parkingFee: details?.parkingFee || '',
                        status: details?.status || '',
                        ageDetail: details?.ageDetail || '',
                        facilities: details?.facilities || '',
                        restrooms: details?.restrooms || '',
                        source: 'tourism',
                        dataCollectedAt: collectedAt,
                        lat: item.detailDatabase?.mapCoords?.latitude,
                        lng: item.detailDatabase?.mapCoords?.longitude
                    };

                    return perf;
                })));

                results.push(...enrichedItems);
            } else {
                console.log(`    No more items found at page ${page}.`);
                break;
            }
        } catch (error: any) {
            console.error(`Error on page ${page}:`, error.message);
            break;
        }
    }

    await closeSharedBrowser();

    return results;
}

async function main() {
    const results = await scrapeVisitKoreaPlaces(TOURISM_MAX_PAGES); // Set to 25 pages for full coverage
    
    // Deduplicate
    const uniqueMap = new Map();
    results.forEach(r => uniqueMap.set(r.id, r));
    const uniqueResults = Array.from(uniqueMap.values());

    console.log(`Total unique VisitKorea places: ${uniqueResults.length}`);

    let existingData: Performance[] = [];
    if (fs.existsSync(DATA_FILE)) {
        existingData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    }

    // Replace VK entries in existing tourism data
    const filteredData = existingData.filter(p => !p.id.startsWith('visitkorea_'));
    const finalData = [...filteredData, ...uniqueResults];

    atomicWriteJson(DATA_FILE, finalData);
    console.log(`Saved ${uniqueResults.length} unique VisitKorea items to tourism.json`);
}

main()
    .then(async () => {
        await closeSharedBrowser();
        process.exit(0);
    })
    .catch(async (error) => {
        console.error(error);
        await closeSharedBrowser();
        process.exit(1);
    });

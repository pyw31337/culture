import axios from 'axios';
import * as cheerio from 'cheerio';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { Performance } from '../src/types';
import { atomicWriteJson } from './utils/scraper-utils';

const PUBLIC_DIR = path.join(process.cwd(), 'public');
const KINTEX_OUTPUT = path.join(process.cwd(), 'src/data/kintex-exhibitions.json');
const BEXCO_OUTPUT = path.join(process.cwd(), 'src/data/bexco-exhibitions.json');
const SETEC_OUTPUT = path.join(process.cwd(), 'src/data/setec-exhibitions.json');

const ensureDir = (dir: string) => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
};

function hashString(text: string): string {
    return crypto.createHash('md5').update(text).digest('hex').substring(0, 16);
}

/**
 * Downloads and processes an image, converting to WebP.
 */
async function processImage(url: string, filenameBase: string, subDir: string): Promise<string> {
    if (!url) return '';
    if (url.startsWith('data:')) return url;

    const targetDir = path.join(PUBLIC_DIR, 'images', subDir);
    ensureDir(targetDir);

    try {
        const safeFilename = filenameBase.replace(/[^a-z0-9]/gi, '_').substring(0, 100);
        const relativePath = `/images/${subDir}/${safeFilename}.webp`;
        const absolutePath = path.join(targetDir, `${safeFilename}.webp`);

        if (fs.existsSync(absolutePath)) {
            return relativePath;
        }

        console.log(`[Image Processing] Downloading: ${url} -> ${relativePath}`);

        const response = await axios({
            url,
            method: 'GET',
            responseType: 'arraybuffer',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            timeout: 15000
        });

        await sharp(response.data)
            .resize({ width: 600, withoutEnlargement: true })
            .webp({ quality: 80 })
            .toFile(absolutePath);

        return relativePath;
    } catch (error: any) {
        console.error(`[Image Processing] Failed to process ${url}:`, error.message);
        return '';
    }
}

function formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}.${m}.${d}`;
}

function isPublicExhibition(title: string): boolean {
    const blacklist = [
        '회의', '세미나', '설명회', '학술대회', '학회', '포럼',
        '입찰', '연수', '워크숍', '워크샵', '간담회', '공청회',
        '필기시험', '채용시험', '대행사', '조회', '포상',
        '기념식', '이사회', '정기총회', '총회', '심사', '평가'
    ];
    return !blacklist.some(word => title.includes(word));
}

// ==========================================
// 1. KINTEX Scraper
// ==========================================
async function scrapeKintex(): Promise<Performance[]> {
    console.log('🚀 Starting KINTEX Scraper...');
    const items: Performance[] = [];
    const todayStr = formatDate(new Date());
    const sixMonthsLater = new Date();
    sixMonthsLater.setMonth(sixMonthsLater.getMonth() + 6);
    const endStr = formatDate(sixMonthsLater);

    try {
        // Scrape first 2 pages
        for (let page = 1; page <= 2; page++) {
            console.log(`[KINTEX] Fetching page ${page}...`);
            const res = await axios.get('https://www.kintex.com/web/ko/event/list.do', {
                params: {
                    pageIndex: String(page),
                    pageUnit: '20',
                    searchStartDt: todayStr,
                    searchEndDt: endStr
                },
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                },
                timeout: 20000
            });

            const $ = cheerio.load(res.data);
            const cards = $('.grid-frame-cell.grid-03').toArray();
            console.log(`[KINTEX] Found ${cards.length} items on page ${page}`);

            for (const card of cards) {
                const title = $(card).find('.item-subject').text().trim();
                if (!isPublicExhibition(title)) continue;
                const rawDate = $(card).find('.item-date').text().trim();
                const hall = $(card).find('.item-client').text().trim().replace(/\s+/g, ' ');
                const rawImg = $(card).find('.thumb img').attr('src') || '';
                const btnHref = $(card).find('a.btn-square-item').attr('href') || '';
                
                // Extract sequence number from javascript:fnView('./view.do', 26030510);
                let seq = '';
                const match = btnHref.match(/fnView\('[^']+',\s*(\d+)\)/);
                if (match) {
                    seq = match[1];
                } else {
                    seq = hashString(title).substring(0, 8);
                }

                const id = `kintex_${seq}`;
                const detailUrl = seq ? `https://www.kintex.com/web/ko/event/view.do?seq=${seq}` : 'https://www.kintex.com/web/ko/event/list.do';
                const dateStr = rawDate.replace(/\s*~\s*/g, ' ~ ').trim();

                // Process image
                let imgUrl = '';
                if (rawImg) {
                    imgUrl = rawImg.startsWith('http') ? rawImg : `https://www.kintex.com${rawImg}`;
                }
                const localImage = imgUrl ? await processImage(imgUrl, id, 'posters/kintex') : '';

                const perf: Performance = {
                    id,
                    title,
                    venue: `킨텍스 ${hall}`,
                    venueKey: `킨텍스 ${hall}`,
                    address: '경기 고양시 일산서구 킨텍스로 217-60',
                    lat: 37.6698,
                    lng: 126.7471,
                    region: 'gyeonggi',
                    date: dateStr,
                    image: localImage || '',
                    poster: localImage || '',
                    backupPoster: localImage || '',
                    link: detailUrl,
                    genre: 'exhibition',
                    category: '전시',
                    price: '상세페이지 참고',
                    priceDetail: '상세페이지 참고',
                    contact: '031-810-8114',
                    website: 'https://www.kintex.com/',
                    source: 'kintex',
                    dataCollectedAt: new Date().toISOString()
                };

                items.push(perf);
            }
        }
    } catch (e: any) {
        console.error('[KINTEX] Scrape failed:', e.message);
    }
    return items;
}

// ==========================================
// 2. BEXCO Scraper
// ==========================================
async function fetchBexcoDetailPoster(url: string): Promise<string> {
    try {
        const res = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            timeout: 10000
        });
        const $ = cheerio.load(res.data);
        const img = $('.EventVtop .imgBox img, .view-img img, .img-box img, .photo img, .photo-box img, td img, .contents-view img').first().attr('src');
        if (img) {
            return img.startsWith('http') ? img : `https://www.bexco.co.kr${img}`;
        }
    } catch (e: any) {
        console.warn(`[BEXCO Detail] Failed to fetch details from ${url}:`, e.message);
    }
    return '';
}

async function scrapeBexco(): Promise<Performance[]> {
    console.log('🚀 Starting BEXCO Scraper...');
    const items: Performance[] = [];
    const seen = new Set<string>();

    try {
        for (let page = 1; page <= 2; page++) {
            console.log(`[BEXCO] Fetching page ${page}...`);
            const res = await axios.get('https://www.bexco.co.kr/kor/CMS/EventScheduleMgr/list.do', {
                params: {
                    robot: 'Y',
                    mCode: 'MN214',
                    page: String(page)
                },
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                },
                timeout: 20000
            });

            const $ = cheerio.load(res.data);
            const anchors = $('a').toArray();
            let count = 0;

            for (const el of anchors) {
                const href = $(el).attr('href') || '';
                if (!href.includes('view.do') || !href.includes('event_seq=')) continue;

                const seqMatch = href.match(/event_seq=(\d+)/);
                if (!seqMatch) continue;
                const seq = seqMatch[1];
                const id = `bexco_${seq}`;

                if (seen.has(id)) continue;
                seen.add(id);
                count++;

                const text = $(el).text().trim().replace(/\s+/g, ' ');
                const titleMatch = text.match(/상세보기\s+(?:D-\d+|진행중|마감|오늘오픈)\s+(?:이벤트|회의|전시)?\s*(.*?)\s*\d{4}-\d{2}-\d{2}/i);
                const title = titleMatch ? titleMatch[1].trim() : '벡스코 행사';
                if (!isPublicExhibition(title)) continue;

                const dateMatch = text.match(/(\d{4}-\d{2}-\d{2})\s*~\s*(\d{4}-\d{2}-\d{2})/);
                const rawDate = dateMatch ? `${dateMatch[1].replace(/-/g, '.')} ~ ${dateMatch[2].replace(/-/g, '.')}` : formatDate(new Date());

                const afterDateText = dateMatch ? text.split(dateMatch[0])[1] || '' : '';
                const hall = afterDateText.trim().substring(0, 100) || '전시장';

                const detailUrl = `https://www.bexco.co.kr${href}`;
                const remoteImgUrl = await fetchBexcoDetailPoster(detailUrl);
                const localImage = remoteImgUrl ? await processImage(remoteImgUrl, id, 'posters/bexco') : '';

                const perf: Performance = {
                    id,
                    title,
                    venue: `벡스코 ${hall}`,
                    venueKey: `벡스코 ${hall}`,
                    address: '부산 해운대구 APEC로 55',
                    lat: 35.1695,
                    lng: 129.1357,
                    region: 'busan',
                    date: rawDate,
                    image: localImage || '',
                    poster: localImage || '',
                    backupPoster: localImage || '',
                    link: detailUrl,
                    genre: 'exhibition',
                    category: '전시',
                    price: '상세페이지 참고',
                    priceDetail: '상세페이지 참고',
                    contact: '051-740-7300',
                    website: 'https://www.bexco.co.kr/',
                    source: 'bexco',
                    dataCollectedAt: new Date().toISOString()
                };

                items.push(perf);
            }
            console.log(`[BEXCO] Processed ${count} new items on page ${page}`);
        }
    } catch (e: any) {
        console.error('[BEXCO] Scrape failed:', e.message);
    }
    return items;
}

// ==========================================
// 3. SETEC Scraper
// ==========================================
async function scrapeSetec(): Promise<Performance[]> {
    console.log('🚀 Starting SETEC Scraper...');
    const items: Performance[] = [];

    try {
        const res = await axios.get('https://www.setec.or.kr/front/schedule/list.do', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            timeout: 20000
        });

        const $ = cheerio.load(res.data);
        const listItems = $('.list_type li, .exhibit_list li, .tbl_list tr, .board_list tbody tr, li:has(a[onclick*="fn_view"])').toArray();
        console.log(`[SETEC] Found ${listItems.length} items in list.`);

        for (const el of listItems) {
            const anchor = $(el).find('a[onclick*="fn_view"]');
            if (!anchor.length) continue;

            const onclick = anchor.attr('onclick') || '';
            const idxMatch = onclick.match(/fn_view\('(\d+)'\)/);
            if (!idxMatch) continue;
            const sIdx = idxMatch[1];
            const id = `setec_${sIdx}`;

            const title = anchor.find('.txt strong').text().trim() || '세텍 전시';
            if (!isPublicExhibition(title)) continue;
            const rawImg = anchor.find('.img img').attr('src') || '';

            let rawDate = '';
            let hall = '전시장';

            anchor.find('.txt ul li').each((i, li) => {
                const text = $(li).text().trim();
                if (text.includes('기간')) {
                    rawDate = text.replace('기간 :', '').trim().replace(/-/g, '.');
                } else if (text.includes('장소')) {
                    hall = text.replace('장소 :', '').trim();
                }
            });

            if (!rawDate) rawDate = formatDate(new Date());

            const detailUrl = `https://www.setec.or.kr/front/schedule/view.do?sIdx=${sIdx}`;
            let imgUrl = '';
            if (rawImg) {
                imgUrl = rawImg.startsWith('http') ? rawImg : `https://www.setec.or.kr${rawImg}`;
            }
            const localImage = imgUrl ? await processImage(imgUrl, id, 'posters/setec') : '';

            const perf: Performance = {
                id,
                title,
                venue: `세텍 ${hall}`,
                venueKey: `세텍 ${hall}`,
                address: '서울 강남구 남부순환로 3104',
                lat: 37.4968,
                lng: 127.0628,
                region: 'seoul',
                date: rawDate,
                image: localImage || '',
                poster: localImage || '',
                backupPoster: localImage || '',
                link: detailUrl,
                genre: 'exhibition',
                category: '전시',
                price: '상세페이지 참고',
                priceDetail: '상세페이지 참고',
                contact: '02-2222-3811',
                website: 'https://www.setec.or.kr/',
                source: 'setec',
                dataCollectedAt: new Date().toISOString()
            };

            items.push(perf);
        }
    } catch (e: any) {
        console.error('[SETEC] Scrape failed:', e.message);
    }
    return items;
}

// ==========================================
// Main Runner
// ==========================================
async function scrapeAllConventions() {
    console.log('🎬 Starting Convention Centers Integrated Scraper...');

    const kintexItems = await scrapeKintex();
    atomicWriteJson(KINTEX_OUTPUT, kintexItems);
    console.log(`✅ Saved ${kintexItems.length} KINTEX exhibitions.`);

    const bexcoItems = await scrapeBexco();
    atomicWriteJson(BEXCO_OUTPUT, bexcoItems);
    console.log(`✅ Saved ${bexcoItems.length} BEXCO exhibitions.`);

    const setecItems = await scrapeSetec();
    atomicWriteJson(SETEC_OUTPUT, setecItems);
    console.log(`✅ Saved ${setecItems.length} SETEC exhibitions.`);

    console.log('🎉 Convention Centers Scrape Completed Successfully!');
}

scrapeAllConventions();

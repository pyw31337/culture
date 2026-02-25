
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import pLimit from 'p-limit';
import cliProgress from 'cli-progress';

// import { processImage } from './utils/image-processor'; // Removed
import axios from 'axios';
import sharp from 'sharp';

// --- CONFIG ---
const OUTPUT_FILE = path.resolve(process.cwd(), 'src/data/ott.json');
const PUBLIC_OUTPUT_FILE = path.resolve(process.cwd(), 'public/data/ott.json');
const RAW_OUTPUT_FILE = path.resolve(process.cwd(), 'src/data/ott-naver-raw.json');
const POSTER_DIR = path.join(process.cwd(), 'public', 'images', 'posters', 'ott');

// Platforms & Types
const PLATFORMS = [
    { name: 'coupang', keyword: '쿠팡플레이' },
    { name: 'netflix', keyword: '넷플릭스' },
    { name: 'disney', keyword: '디즈니플러스' },
    { name: 'tving', keyword: '티빙' },
    { name: 'wavve', keyword: '웨이브' }
];
const TYPES = ['추천', '신작', '많이 찾는', '주간 순위', '오리지널'];

// --- HELPERS ---
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function processImage(url: string, filenameBase: string): Promise<string> {
    if (!url || url.startsWith('data:')) return '';

    const MAX_RETRIES = 2;
    // Sanitize
    const safeFilename = filenameBase.replace(/[^a-z0-9가-힣]/gi, '_').substring(0, 100);
    const relativePath = `/images/posters/ott/${safeFilename}.webp`;
    const absolutePath = path.join(process.cwd(), 'public', relativePath);
    const dir = path.dirname(absolutePath);

    if (fs.existsSync(absolutePath)) return relativePath; // Cache hit

    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    for (let i = 0; i < MAX_RETRIES; i++) {
        try {
            const response = await axios({
                url,
                responseType: 'arraybuffer',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
                },
                timeout: 5000
            });

            await sharp(response.data)
                .resize(300, 430, { fit: 'cover' })
                .webp({ quality: 80 })
                .toFile(absolutePath);

            return relativePath;
        } catch (e) {
            if (i === MAX_RETRIES - 1) {
                // console.error(`[Image] Failed to download ${url}:`, e.message);
            }
            await new Promise(r => setTimeout(r, 1000));
        }
    }
    return '';
}

function cleanupOldOTTImages(validItems: any[]) {
    if (!fs.existsSync(POSTER_DIR)) return;

    console.log(`Cleaning up orphan OTT images... (Valid items: ${validItems.length})`);
    const validFilenames = new Set<string>();
    validItems.forEach(m => {
        if (m.poster && m.poster.startsWith('/images/posters/ott/')) {
            validFilenames.add(path.basename(m.poster));
        }
    });

    const files = fs.readdirSync(POSTER_DIR);
    let deletedCount = 0;

    files.forEach(file => {
        if (!file.endsWith('.webp')) return;
        if (!validFilenames.has(file)) {
            try {
                fs.unlinkSync(path.join(POSTER_DIR, file));
                deletedCount++;
            } catch (e) {
                console.error(`Failed to delete ${file}:`, e);
            }
        }
    });
    console.log(`Cleanup complete. Deleted ${deletedCount} orphan images.`);
}

async function scrapeList(context: any, platform: any, type: string) {
    const page = await context.newPage();
    const query = `${platform.keyword} ${type}`;
    const url = `https://search.naver.com/search.naver?where=nexearch&sm=tab_etc&mra=bkdJ&qvt=0&query=${encodeURIComponent(query)}`;

    let items: any[] = [];
    try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

        // Pagination Limit
        const MAX_PAGES = 15;
        let pageNum = 1;

        while (pageNum <= MAX_PAGES) {
            const newItems = await page.evaluate((arg: { pName: string, tType: string }) => {
                const { pName, tType } = arg;
                const els = document.querySelectorAll('#main_pack .cm_content_area ul li.info_box, .cs_common_module li.info_box');
                const list: any[] = [];
                els.forEach(el => {
                    const titleEl = el.querySelector('strong.title a._text') || el.querySelector('a._text');
                    const img = el.querySelector('a.thumb img');

                    if (titleEl) {
                        const title = titleEl.textContent?.trim() || '';
                        let link = titleEl.getAttribute('href') || '';
                        if (link.startsWith('?')) link = `https://search.naver.com/search.naver${link}`;

                        let poster = img?.getAttribute('src') || img?.getAttribute('data-src') || '';
                        if (poster.includes('type=')) {
                            poster = poster.replace(/type=[^&]+/, 'type=o').replace(/size=[^&]+&?/, '');
                        }

                        if (title && link && !link.includes('#')) {
                            list.push({
                                title,
                                link,
                                poster,
                                platform: pName,
                                type: tType,
                                source: 'naver'
                            });
                        }
                    }
                });
                return list;
            }, { pName: platform.name, tType: type });

            items.push(...newItems);
            // console.log(`   ${platform.name} (${type}) Page ${pageNum}: Found ${newItems.length} items.`);

            const nextBtn = await page.$('a.pg_next.on');
            if (nextBtn) {
                await nextBtn.click();
                await page.waitForTimeout(1500 + Math.random() * 1000);
                pageNum++;
            } else {
                break;
            }
        }
    } catch (e) {
        console.error(`Error scraping ${platform.name} ${type}:`, e);
    } finally {
        await page.close();
    }
    return items;
}

// --- MAIN ---
(async () => {
    console.log('Starting Naver OTT Scraper...');
    const browser = await chromium.launch({ headless: true });
    let finalRaw: any[] = [];

    try {
        // --- Scrape List (Phase 1) ---
        const context = await browser.newContext({ userAgent: 'Mozilla/5.0 (Mac)' });
        const limit = pLimit(1); // Reduced from 2 to 1 for Phase 1 list scraping
        const tasks = [];

        const phase1Bar = new cliProgress.SingleBar({
            format: 'Phase 1 | {bar} | {percentage}% | ETA: {eta}s | {value}/{total} | {platform} - {type}',
            hideCursor: true
        }, cliProgress.Presets.shades_classic);
        phase1Bar.start(PLATFORMS.length * TYPES.length, 0, { platform: 'Ready', type: '' });

        for (const p of PLATFORMS) {
            for (const t of TYPES) {
                tasks.push(limit(async () => {
                    phase1Bar.update({ platform: p.name, type: t });
                    const res = await scrapeList(context, p, t);
                    phase1Bar.increment();
                    return res;
                }));
            }
        }

        const results = await Promise.all(tasks);
        phase1Bar.stop();
        const flatResults = results.flat();

        const dedupedCtx: Record<string, any> = {};
        for (const it of flatResults) {
            const id = `ott_naver_${it.title.replace(/\s+/g, '')}`;
            if (!dedupedCtx[id]) {
                dedupedCtx[id] = { ...it, id, platforms: [it.platform] };
            } else {
                if (!dedupedCtx[id].platforms.includes(it.platform)) {
                    dedupedCtx[id].platforms.push(it.platform);
                }
            }
        }

        finalRaw = Object.values(dedupedCtx);
        console.log(`Raw Collection Complete. Total Unique: ${finalRaw.length}`);
        fs.writeFileSync(RAW_OUTPUT_FILE, JSON.stringify(finalRaw, null, 2));

    } finally {
        await browser.close();
    }

    console.log('Phase 1 Done. Starting Phase 2 (Enrichment)...');

    // --- Enrichment (Phase 2) ---
    const enrichedItems: any[] = [];
    const browser2 = await chromium.launch({ headless: true });

    try {
        // Use slightly taller viewport for NamuWiki scrolling
        const context2 = await browser2.newContext({
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            viewport: { width: 1280, height: 1080 }
        });

        const limitEnrich = pLimit(2); // Reduced from 5 to 2 for Phase 2 enrichment
        const progressBar = new cliProgress.SingleBar({
            format: 'Phase 2 | {bar} | {percentage}% | ETA: {eta}s | {value}/{total} | {status}',
            hideCursor: true
        }, cliProgress.Presets.shades_classic);
        progressBar.start(finalRaw.length, 0, { status: 'Starting...' });

        const enrichTasks = finalRaw.map(item => limitEnrich(async () => {
            const page = await context2.newPage();
            page.setDefaultTimeout(15000);
            page.setDefaultNavigationTimeout(15000);
            try {
                progressBar.update({ status: item.title.substring(0, 20) });
                await page.goto(item.link, { waitUntil: 'domcontentloaded', timeout: 15000 });
                // Increased delay to reduce CPU spikes
                await sleep(1500 + Math.random() * 2000);

                const detail = await page.evaluate(async () => {
                    const res: any = {};

                    // 1. Basic Info Parsing using Iteration (Robust)
                    const infoGroups = document.querySelectorAll('.info_group, .detail_info dl, .cm_content_area .info_group');
                    let realGenre = '';

                    infoGroups.forEach(group => {
                        const dt = group.querySelector('dt');
                        const dd = group.querySelector('dd');
                        if (!dt || !dd) return;

                        const label = dt.textContent?.trim() || '';
                        const value = dd.textContent?.trim() || '';

                        if (label.includes('개요') || label.includes('장르')) {
                            if (value.includes('·')) {
                                const parts = value.split('·').map(s => s.trim());
                                parts.forEach(p => {
                                    if (p.endsWith('분')) res.runningTime = p;
                                    else if (['한국', '미국', '일본', '중국', '영국', '독일', '프랑스'].some(c => p.includes(c)) || p.length < 5) res.productionCountry = p;
                                    else realGenre = p;
                                });
                            } else {
                                if (!value.match(/(\d+분)/) && !value.match(/(한국|미국|일본|중국|영국|독일|프랑스)/)) {
                                    realGenre = value;
                                }
                            }
                        }
                        if (label === '등급') res.ageRating = value;
                        if (label === '국가') res.productionCountry = value;
                        if (label === '러닝타임') res.runningTime = value;
                    });

                    if (!res.date) {
                        const groups = Array.from(document.querySelectorAll('.info_group'));
                        for (const g of groups) {
                            const dt = g.querySelector('dt');
                            const dd = g.querySelector('dd');
                            if (dt && dd && (dt.textContent?.includes('개봉') || dt.textContent?.includes('방영') || dt.textContent?.includes('공개') || dt.textContent?.includes('오픈') || dt.textContent?.includes('출시') || dt.textContent?.includes('제작'))) {
                                const text = dd.textContent?.trim() || '';
                                const match = text.match(/20\d{2}[년\.\-\s]+[0-1]?\d[월\.\-\s]+[0-3]?\d[일\.\-\s]*/);
                                if (match) {
                                    let dateStr = match[0].replace(/[년월일\s]/g, '.').replace(/\.+/g, '.').replace(/\.$/, '');
                                    const parts = dateStr.split('.');
                                    if (parts.length === 3) {
                                        const y = parts[0];
                                        const m = parts[1].padStart(2, '0');
                                        const d = parts[2].padStart(2, '0');
                                        res.date = `${y}.${m}.${d}`;
                                    } else {
                                        res.date = dateStr;
                                    }
                                } else {
                                    const matchYM = text.match(/20\d{2}[년\.\-\s]+[0-1]?\d[월\.\-\s]*/);
                                    if (matchYM) {
                                        let temp = matchYM[0].replace(/[년월\s]/g, '.').replace(/\.+/g, '.').replace(/\.$/, '');
                                        const parts = temp.split('.');
                                        res.date = `${parts[0]}.${parts[1].padStart(2, '0')}.01`;
                                    } else {
                                        res.date = text.replace(/\(.*\)/, '').replace(/[가-힣\s]/g, '').replace(/\.$/, '').trim();
                                    }
                                }
                                break;
                            }
                        }
                    }

                    if (!res.ageRating) {
                        const groups = Array.from(document.querySelectorAll('.info_group'));
                        for (const g of groups) {
                            const dt = g.querySelector('dt');
                            const dd = g.querySelector('dd');
                            if (dt && dd && (dt.textContent?.includes('등급') || dt.textContent?.includes('연령'))) {
                                res.ageRating = dd.textContent?.trim();
                                break;
                            }
                        }
                    }

                    if (!realGenre) {
                        const subGenre = document.querySelector('.sub_title span.txt');
                        if (subGenre) realGenre = subGenre.textContent?.trim() || '';
                    }

                    res.genre = 'ott';
                    res.description = [realGenre, res.productionCountry, res.runningTime].filter(Boolean).join(' | ');

                    // 2. Cast Parsing (Scoped)
                    const cast: string[] = [];
                    // Primary container for cast in Naver SDS
                    const castContainer = document.querySelector('.cm_content_area._cast_area, ._actor_wrap, .sec_scroll_cast_member');
                    if (castContainer) {
                        const members = castContainer.querySelectorAll('.card_item, .item');
                        members.forEach(m => {
                            const nameEl = m.querySelector('.name') || m.querySelector('a._text');
                            const roleEl = m.querySelector('.sub_text');
                            let name = nameEl?.textContent?.trim() || '';
                            let role = roleEl?.textContent?.trim() || '';

                            if (name.includes(' 역')) {
                                if (role) name = role;
                                else name = name.split(' 역')[0];
                            }

                            // Stricter name validation
                            if (name && name.length < 15 && !name.includes('배역') && !name.includes('출연') && !name.includes('더보기')) {
                                const isDirector = role.includes('감독') || role.includes('연출');
                                if (isDirector) res.director = name;
                                else cast.push(name);
                            }
                        });
                    }
                    if (cast.length > 0) res.cast = [...new Set(cast)].slice(0, 8);

                    return res;
                });

                if (detail) Object.assign(item, detail);

                // --- 3. Interactive Cast Fallback ---
                if ((!item.cast || item.cast.length === 0) && item.link.includes('search.naver.com')) {
                    try {
                        const foundTab = await page.evaluate(() => {
                            const tabs = Array.from(document.querySelectorAll('a, div[role="tab"]'));
                            const t = tabs.find(el => el.textContent?.includes('출연진') || el.textContent?.includes('등장인물'));
                            if (t) { (t as HTMLElement).click(); return true; }
                            return false;
                        });

                        if (foundTab) {
                            await page.waitForTimeout(1500);
                            const newCastData = await page.evaluate(() => {
                                const newCast: string[] = [];
                                let director = '';
                                // Strictly scope to the active content wrap
                                const container = document.querySelector('.cm_content_wrap .list_image_info._content, .cm_content_wrap .list_info');
                                if (container) {
                                    const members = container.querySelectorAll('li, .item');
                                    members.forEach(m => {
                                        const nameEl = m.querySelector('strong.name, .name') || m.querySelector('a._text');
                                        const roleEl = m.querySelector('span.sub_text, .sub_text');
                                        let name = nameEl?.textContent?.trim() || '';
                                        let role = roleEl?.textContent?.trim() || '';

                                        if (name.includes(' 역')) name = name.split(' 역')[0];

                                        // Strict name check
                                        if (name && name.length < 15 && !name.includes('배역') && !name.includes('출연') && !name.includes('더보기')) {
                                            if (role.includes('감독') || role.includes('연출')) director = name;
                                            else newCast.push(name);
                                        }
                                    });
                                }
                                return { cast: Array.from(new Set(newCast)).slice(0, 8), director };
                            });
                            if (newCastData.cast.length > 0) item.cast = newCastData.cast;
                            if (newCastData.director && !item.director) item.director = newCastData.director;
                        }
                    } catch (err) { }
                }

                // --- 4. IMAGE PROCESSING & NamuWiki Fallback ---
                // Try downloading original poster first
                let localPoster = '';
                if (item.poster && !item.poster.startsWith('data:')) {
                    localPoster = await processImage(item.poster, item.title);
                    if (localPoster) item.poster = localPoster;
                }

                // If failed or invalid, try NamuWiki
                const isInvalidPoster = !localPoster; // If processImage returned '', we still need a poster
                const forcedFallbackTitles = ['프랑켄슈타인: 더 뮤지컬 라이브', '좀비딸'];

                if ((isInvalidPoster || forcedFallbackTitles.some(t => item.title.includes(t))) && !item.posterSource) {
                    try {
                        await page.goto(`https://namu.wiki/Go?q=${encodeURIComponent(item.title)}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
                        await sleep(2000);

                        const searchResultLink = await page.$('.search-item a, .search-result-list a');
                        if (searchResultLink) {
                            const txt = await searchResultLink.innerText();
                            if (!txt.includes('User:') && !txt.includes('Talk:') && !txt.includes('사용자:') && !txt.includes('토론:')) {
                                await searchResultLink.click();
                                await page.waitForTimeout(2000);
                            }
                        }

                        await page.evaluate(() => window.scrollTo(0, 800));
                        await page.waitForTimeout(1000);

                        const namuPoster = await page.evaluate(() => {
                            const imgs = Array.from(document.querySelectorAll('table img, .wiki-table img, div[class*="wiki-table"] img, .wiki-heading-content img'));
                            let candidate = imgs.find(img => {
                                const el = img as HTMLImageElement;
                                return el.width > 150 && el.src.includes('namu.wiki') && !el.src.includes('icon') && !el.src.includes('logo');
                            });

                            if (!candidate) {
                                const allImgs = Array.from(document.querySelectorAll('img'));
                                candidate = allImgs.find(img => {
                                    const el = img as HTMLImageElement;
                                    return el.width > 200 && el.height > 250 && el.src.includes('namu.wiki');
                                });
                            }
                            return candidate ? (candidate as HTMLImageElement).src : null;
                        });

                        if (namuPoster) {
                            const newLocal = await processImage(namuPoster, item.title);
                            if (newLocal) {
                                item.poster = newLocal;
                                item.posterSource = 'namuwiki';
                            }
                        }
                    } catch (namuErr) {
                        // Fail silently
                    }
                }

            } catch (e) {
                // console.error(`Error enriching ${item.title}:`, e);
            } finally {
                await page.close();
                progressBar.increment();
            }
            enrichedItems.push(item);
        }));

        await Promise.all(enrichTasks);
        progressBar.stop();
        console.log(`Phase 2 Done. Saving ${enrichedItems.length} items...`);
        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(enrichedItems, null, 2));
        fs.writeFileSync(PUBLIC_OUTPUT_FILE, JSON.stringify(enrichedItems, null, 2));

    } finally {
        await browser2.close();
    }
})().then(() => {
    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});

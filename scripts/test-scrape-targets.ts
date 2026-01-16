
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const TARGETS = [
    { title: '영화 좀비딸', link: 'https://search.naver.com/search.naver?query=%EC%98%81%ED%99%94%20%EC%A2%80%EB%B9%84%EB%94%B8%20%EC%A0%95%EB%B3%B4' },
    { title: '프랑켄슈타인: 더 뮤지컬 라이브', link: 'https://search.naver.com/search.naver?query=%ED%94%84%EB%9E%91%EC%BC%8A%EC%8A%88%ED%83%80%EC%9D%B8%3A%20%EB%8D%94%20%EB%AE%A4%EC%A7%80%EC%BB%AC%20%EB%9D%BC%EC%9D%B4%EB%B8%8C' },
    { title: '언더커버 미쓰홍', link: 'https://search.naver.com/search.naver?query=%EC%96%B8%EB%8D%94%EC%BB%A4%EB%B2%84%20%EB%AF%B8%EC%93%B0%ED%99%8D' },
    { title: '모범택시3', link: 'https://search.naver.com/search.naver?query=%EB%AA%A8%EB%B2%94%ED%83%9D%EC%8B%9C3' }
];

(async () => {
    console.log('Starting Targeted Verification Scrape...');
    const browser = await chromium.launch({ headless: true });

    // Taller viewport for scrolling test
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1280, height: 1000 }
    });
    const page = await context.newPage();
    const results: any[] = [];

    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

    for (const item of TARGETS) {
        console.log(`Checking ${item.title}...`);
        await page.goto(item.link, { waitUntil: 'domcontentloaded' });
        await sleep(1000);

        const detail = await page.evaluate(async () => {
            const res: any = {};
            // 1. Basic Info Parsing (Refined)
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

                if (label === '개봉' || label === '방영') {
                    res.date = value.replace(/\(.*\)/, '').trim().replace(/\.$/, '');
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
                    if (dt && dd && (dt.textContent?.includes('개봉') || dt.textContent?.includes('방영'))) {
                        res.date = dd.textContent?.trim().replace(/\(.*\)/, '').replace(/\.$/, '');
                        break;
                    }
                }
            }

            if (!realGenre) {
                const subGenre = document.querySelector('.sub_title span.txt, .title_area + .item_info span, .cm_top_wrap .item_info span');
                if (subGenre) realGenre = subGenre.textContent?.trim() || '';
            }

            res.genre = 'ott';
            res.description = [realGenre, res.productionCountry, res.runningTime].filter(Boolean).join(' | ');

            // 2. Cast Parsing
            const members = document.querySelectorAll('.sec_scroll_cast_member .card_item, ._actor_wrap .card_item, .cm_content_area._cast_area .card_item');
            const cast: string[] = [];
            members.forEach(m => {
                let name = m.querySelector('.name')?.textContent?.trim() || m.querySelector('a._text')?.textContent?.trim() || '';
                const role = m.querySelector('.sub_text')?.textContent?.trim() || '';

                if (name.includes(' 역')) {
                    if (role) name = role;
                    else name = name.split(' 역')[0];
                }

                if (name && !name.includes('배역') && !name.includes('출연') && name.length < 20) {
                    if (role.includes('감독') || role.includes('연출')) res.director = name;
                    else cast.push(name);
                }
            });
            if (cast.length > 0) res.cast = cast.slice(0, 5);

            const img = document.querySelector('a.thumb img') || document.querySelector('.detail_info a.thumb img');
            let poster = img?.getAttribute('src') || img?.getAttribute('data-src') || '';
            if (poster.includes('type=')) {
                poster = poster.replace(/type=[^&]+/, 'type=o').replace(/size=[^&]+&?/, '');
            }
            res.poster = poster;

            return res;
        });

        // --- NamuWiki Fallback Logic ---
        const isInvalidPoster = !detail.poster || detail.poster.length < 50 || detail.poster.startsWith('data:');
        const forcedFallbackTitles = ['프랑켄슈타인: 더 뮤지컬 라이브', '좀비딸'];

        if ((isInvalidPoster || forcedFallbackTitles.some(t => item.title.includes(t))) && !detail.posterSource) {
            try {
                console.log(`[NamuWiki] Searching poster for ${item.title}...`);
                await page.goto(`https://namu.wiki/Go?q=${encodeURIComponent(item.title)}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
                await sleep(2000);

                // Check for Search Result Page
                const searchResultLink = await page.$('.search-item a, .search-result-list a');
                if (searchResultLink) {
                    const txt = await searchResultLink.innerText();
                    // Ensure it's not a wiki meta page
                    if (!txt.includes('User:') && !txt.includes('Talk:') && !txt.includes('사용자:') && !txt.includes('토론:')) {
                        console.log('[NamuWiki] Found search results, clicking first item...');
                        await searchResultLink.click();
                        await page.waitForTimeout(2000);
                    }
                }

                // Scroll and Wait for Image
                await page.evaluate(() => window.scrollTo(0, 800));
                await page.waitForTimeout(1000);

                const namuPoster = await page.evaluate(() => {
                    // 1. Try Table/Infobox
                    const imgs = Array.from(document.querySelectorAll('table img, .wiki-table img, div[class*="wiki-table"] img, .wiki-heading-content img'));
                    // Width > 150 (relaxed)
                    let candidate = imgs.find(img => {
                        const el = img as HTMLImageElement;
                        return el.width > 200 && el.src.includes('namu.wiki') && !el.src.includes('icon') && !el.src.includes('logo');
                    });

                    // 2. Global fallback
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
                    detail.poster = namuPoster;
                    detail.posterSource = 'namuwiki';
                    console.log(`[NamuWiki] Found poster: ${namuPoster}`);
                }
            } catch (e) {
                console.log(`[NamuWiki] Failed: ${e}`);
            }
        }

        console.log(`[${item.title}] Result:`, JSON.stringify(detail, null, 2));
        results.push({ ...detail, title: item.title, link: item.link, source: 'naver', id: `ott_naver_${item.title.replace(/\s+/g, '')}` });
    }

    fs.writeFileSync(path.resolve(process.cwd(), 'src/data/ott-targets.json'), JSON.stringify(results, null, 2));
    await browser.close();
})();

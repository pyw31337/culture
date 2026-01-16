
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const TARGETS = [
    { title: '모범택시3', link: 'https://search.naver.com/search.naver?query=%EB%AA%A8%EB%B2%94%ED%83%9D%EC%8B%9C3' },
    { title: '언더커버 미쓰홍', link: 'https://search.naver.com/search.naver?query=%EC%96%B8%EB%8D%94%EC%BB%A4%EB%B2%84%20%EB%AF%B8%EC%93%B0%ED%99%8D' },
    { title: '아이 엠 복서', link: 'https://search.naver.com/search.naver?query=%EC%95%84%EC%9D%B4%20%EC%97%A0%20%EB%B3%B5%EC%84%9C' },
    { title: '미스트롯4', link: 'https://search.naver.com/search.naver?query=%EB%AF%B8%EC%8A%A4%ED%8A%B8%EB%A1%AF4' },
    { title: 'Predator: Badlands', link: 'https://search.naver.com/search.naver?query=%ED%94%84%EB%A0%88%EB%8D%B0%ED%84%B0%20%EB%B0%B0%EB%93%9C%EB%9E%9C%EB%93%9C' },
    { title: '동네멋집', link: 'https://search.naver.com/search.naver?query=%EB%8F%99%EB%84%A4%EB%A9%8B%EC%A7%91' }
];

(async () => {
    console.log('Starting Targeted Verification Scrape...');
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();
    const results: any[] = [];

    for (const item of TARGETS) {
        console.log(`Checking ${item.title}...`);
        await page.goto(item.link, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(1000);

        // --- ENRICHMENT LOGIC (COPIED FROM scrape-naver-ott.ts) ---
        const detail = await page.evaluate(async () => {
            const res: any = {};
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
                        let temp = value;
                        const timeMatch = temp.match(/(\d+분)/);
                        if (timeMatch) { res.runningTime = timeMatch[1]; temp = temp.replace(timeMatch[1], '').trim(); }
                        const countryMatch = temp.match(/(한국|미국|일본|중국|영국|독일|프랑스|이탈리아|스페인|캐나다|홍콩|대만|인도|태국|베트남|대한민국)/);
                        if (countryMatch) {
                            res.productionCountry = countryMatch[1];
                            if (res.productionCountry === '대한민국') res.productionCountry = '한국';
                            temp = temp.replace(countryMatch[1], '').trim();
                        }
                        if (temp.length > 0) realGenre = temp;
                    }
                }
                else if (label.includes('개봉') || label.includes('편성') || label.includes('방영')) {
                    let cleanDate = value;
                    const dateMatch = cleanDate.match(/(\d{4}\.\s*\d{1,2}\.\s*\d{1,2}\.?)/);
                    if (dateMatch) {
                        cleanDate = dateMatch[1];
                    }
                    res.date = cleanDate.replace(/\.$/, '').trim();
                }
                else if (label.includes('등급')) {
                    res.ageRating = value;
                }
            });

            if (!realGenre) {
                const subGenre = document.querySelector('.sub_title span.txt, .title_area + .item_info span, .cm_top_wrap .item_info span');
                if (subGenre) realGenre = subGenre.textContent?.trim() || '';
            }

            res.genre = 'ott';
            res.description = [realGenre, res.productionCountry, res.runningTime].filter(Boolean).join(' | ');

            // --- 2. Cast Extraction (Summary) ---
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
                    const roleText = m.textContent || '';
                    if ((roleText.includes(' 감독') || roleText.includes('연출')) && !res.director) res.director = name;
                    else cast.push(name);
                }
            });
            if (cast.length > 0) res.cast = cast.slice(0, 5);

            // Poster
            const img = document.querySelector('a.thumb img') || document.querySelector('.detail_info a.thumb img');
            let poster = img?.getAttribute('src') || img?.getAttribute('data-src') || '';
            if (poster.includes('type=')) {
                poster = poster.replace(/type=[^&]+/, 'type=o').replace(/size=[^&]+&?/, '');
            }
            res.poster = poster;

            return res;
        });

        // --- Interactive Fallback ---
        if (!detail.cast || detail.cast.length === 0) {
            try {
                const possibleTabs = [
                    'a[href*="cast"]',
                    'a[href*="tab=cast"]',
                    '._main_tab a',
                    '.tab[role="tab"]',
                    'div[role="tablist"] > a'
                ];

                let castTab = null;
                const allLinks = await page.$$('a, div[role="tab"], ._main_tab a');
                for (const el of allLinks) {
                    const txt = await el.innerText();
                    if (txt.includes('출연진') || txt.includes('등장인물')) {
                        castTab = el;
                        break;
                    }
                }

                if (castTab) {
                    await castTab.click({ timeout: 2000 });
                    await new Promise(r => setTimeout(r, 1000));

                    const newCastData = await page.evaluate(() => {
                        const newCast: string[] = [];
                        let director = '';
                        const members = document.querySelectorAll('.card_item, .area_link_box li, .sec_scroll_cast_member .card_item, .item, .cm_content_wrap li, .list_info .item');

                        members.forEach(m => {
                            let name = '';
                            let roleOrSub = '';

                            const nameEl = m.querySelector('strong.name, .name');
                            const subEl = m.querySelector('span.sub_text, .sub_text');

                            if (nameEl) {
                                let nameTxt = nameEl.textContent?.trim() || '';
                                let subTxt = subEl?.textContent?.trim() || '';
                                if (nameTxt.includes(' 역')) {
                                    name = subTxt;
                                } else {
                                    name = nameTxt;
                                }
                                roleOrSub = subTxt;
                            } else {
                                if (m.classList.contains('_text')) {
                                    name = m.textContent?.trim() || '';
                                } else {
                                    name = m.querySelector('.name')?.textContent?.trim() || m.querySelector('a._text')?.textContent?.trim() || '';
                                }
                            }

                            if (name && name.length < 20 && !name.includes('배역') && !name.includes('출연') && !name.includes('전체삭제')) {
                                if (roleOrSub.includes('감독') || roleOrSub.includes('연출')) director = name;
                                else newCast.push(name);
                            }
                        });
                        const uniqueCast = Array.from(new Set(newCast));
                        return { cast: uniqueCast.slice(0, 5), director };
                    });
                    if (newCastData.cast.length > 0) detail.cast = newCastData.cast;
                    if (newCastData.director) detail.director = newCastData.director;
                }
            } catch (e) { }
        }

        console.log(`[${item.title}] Result:`, JSON.stringify(detail, null, 2));
        results.push({ ...detail, title: item.title, link: item.link, source: 'naver', id: `ott_naver_${item.title.replace(/\s+/g, '')}` });
    }

    fs.writeFileSync(path.resolve(process.cwd(), 'src/data/ott-targets.json'), JSON.stringify(results, null, 2));
    await browser.close();
})();

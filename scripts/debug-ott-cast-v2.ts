
import { chromium } from 'playwright';

async function debugNaverCast() {
    const targets = [
        '아이돌아이',
        '내게 거짓말을 해봐 시즌3'
    ];

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));

    for (const query of targets) {
        console.log(`\nChecking: ${query}`);
        const url = `https://search.naver.com/search.naver?query=${encodeURIComponent(query)}`;
        await page.goto(url, { waitUntil: 'domcontentloaded' });

        // Try Clicking Tabs like the real scraper
        try {
            await page.evaluate(() => {
                const tabs = Array.from(document.querySelectorAll('a, div[role="tab"], span[role="button"]'));
                // Prioritize "Cast" tabs over "Basic Info"
                let t = tabs.find(el => {
                    const txt = el.textContent?.trim() || '';
                    return txt.length < 10 && (txt === '출연/제작' || txt === '등장인물' || txt === '출연');
                });

                if (!t) {
                    t = tabs.find(el => {
                        const txt = el.textContent?.trim() || '';
                        return txt.length < 10 && (txt === '기본정보' || txt === '정보');
                    });
                }

                if (t) {
                    console.log('Found tab:', t.textContent);
                    (t as HTMLElement).click();
                } else {
                    console.log('No relevant tab found');
                }
            });
            await page.waitForTimeout(3000);
            await page.screenshot({ path: `debug-${query.replace(/\s/g, '_')}.png` });
        } catch (e) { }

        const result = await page.evaluate(() => {
            const res: any = { cast: [], director: null };

            // --- PASTE LOGIC FROM scrape-ott.ts ---
            const cast: string[] = [];

            // Strategy 1: "출연진" container
            const allContentAreas = Array.from(document.querySelectorAll('.cm_content_area, .api_subject_bx'));
            const castContainer = allContentAreas.find(area => {
                const title = area.querySelector('h2, h3, .cm_title')?.textContent?.trim();
                return title && (title.includes('출연진') || title.includes('출연') || title.includes('제작진'));
            });

            if (castContainer) {
                castContainer.querySelectorAll('.card_item, .area_card, li, a.inner, .item').forEach(el => {
                    const fullText = el.textContent?.trim() || '';

                    if (fullText.includes('출연') || fullText.includes('감독') || fullText.includes('연출')) {
                        const nameEl = el.querySelector('.name, strong span, strong, a._text');
                        let name = nameEl?.textContent?.trim() || '';

                        if (!name) {
                            const link = el.querySelector('a:not(.area_link_box)');
                            name = link?.textContent?.trim() || '';
                        }

                        if (name.includes(' 역')) name = name.split(' 역')[0];
                        if (name.includes('출연')) name = '';
                        if (name.includes('감독')) name = '';

                        // STRICT NAME VALIDATION
                        if (name.length > 15) name = '';
                        if (name.includes('시즌')) name = '';
                        if (/[0-9?!]/.test(name)) name = '';

                        if (name && !name.includes('더보기')) {
                            const isDirector = fullText.includes('감독') || fullText.includes('연출');
                            if (isDirector && !res.director) res.director = name;
                            else if (!isDirector) cast.push(name);
                        }
                    }
                });
            }

            // Strategy 2: Movie "a.inner" structure
            if (cast.length === 0) {
                // ... (Existing Strategy 2 Logic) ...
                const castContainers = document.querySelectorAll('.cm_content_area._cast_area, .cm_content_area[data-tab="cast"], .sec_scroll_cast_member');
                castContainers.forEach(container => {
                    if (container.querySelector('h2')?.textContent?.includes('추천') || container.querySelector('h2')?.textContent?.includes('비슷한')) return;
                    container.querySelectorAll('a.inner').forEach(a => {
                        // ... (Reuse logic logic from prev step if needed, but for now assuming Strategy 3 is what's needed)
                    });
                });
            }

            // Strategy 3: Drama/Variety (Interactive Fallback Logic)
            const dramaItems = document.querySelectorAll('.list_image_info._content .item, .list_image_info .item');
            dramaItems.forEach(item => {
                const titleBox = item.querySelector('.title_box');
                if (titleBox) {
                    const links = Array.from(titleBox.querySelectorAll('a._text'));
                    let name = '';
                    if (links.length >= 2) {
                        name = links[1].textContent?.trim() || '';
                    } else if (links.length === 1) {
                        name = links[0].textContent?.trim() || '';
                    }

                    if (name) {
                        if (name.includes(' 역')) name = name.split(' 역')[0];
                        if (name.length > 15) return;
                        if (/[0-9?!%*]/.test(name)) return;
                        if (name.includes('시즌')) return;
                        if (name.includes('더보기')) return;
                        if (name === '출연') return;
                        if (name.includes('통역') || name.includes('도적') || name.includes('리플리')) return;

                        cast.push(name);
                    }
                }
            });
            // --- DEBUG: Reverse Lookup for '수영' ---
            const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
            let node;
            while (node = walker.nextNode()) {
                if (node.textContent?.includes('수영')) {
                    const parent = node.parentElement;
                    console.log('FOUND "수영" IN:', parent?.tagName, 'CLASS:', parent?.className);
                    // traverse up to find a container with a class
                    let p = parent;
                    let path = [];
                    while (p && p !== document.body && path.length < 5) {
                        path.push(`${p.tagName}.${p.className}`);
                        p = p.parentElement;
                    }
                    console.log('PATH:', path.join(' < '));
                }
            }
            // --- END DEBUG ---

            // --- END LOGIC ---

            // Strategy 4: SDS Modern UI (e.g. Idol Eyes)
            if (cast.length === 0) {
                const sdsItems = document.querySelectorAll('a[class*="fender"] .sds-comps-text-content, .sds-comps-text-content');

                sdsItems.forEach(el => {
                    const txt = el.textContent?.trim() || '';
                    const parentA = el.closest('a');

                    if (txt && parentA) {
                        console.log('Candidate:', txt); // DEBUG LINE
                        let name = txt;

                        // STRICT VALIDATION
                        const isKorean = /[가-힣]/.test(name);
                        if (isKorean && name.length > 6) return;
                        if (!isKorean && name.length > 15) return;

                        const garbage = ['위키', '저장', '바로가기', '뉴스', '관련', '순', '검색', '사이트', '웹', '더보기', '시즌', '톡', '전체'];
                        if (garbage.some(g => name.includes(g))) return;

                        if (/[0-9?!%*]/.test(name)) return;
                        if (name === '출연') return;

                        if (!cast.includes(name)) cast.push(name);
                    }
                });
            }

            if (cast.length > 0) res.cast = [...new Set(cast)].slice(0, 8);
            return res;
        });

        console.log(`Result for ${query}:`, JSON.stringify(result, null, 2));
    }

    await browser.close();
}

debugNaverCast().catch(console.error);

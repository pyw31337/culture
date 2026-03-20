
import { chromium } from 'playwright';

async function testMetadata() {
    const browser = await chromium.launch({ headless: false }); // Visible for debugging

    const targets = [
        {
            name: '얼굴 (Face)',
            url: 'https://search.naver.com/search.naver?where=nexearch&sm=tab_etc&mra=bkEw&pkid=68&os=35046360&qvt=0&query=%EC%98%81%ED%99%94%20%EC%96%BC%EA%B5%B4'
        },
        {
            name: '메이즈 러너: 스코치 트라이얼 (Maze Runner 2)',
            url: 'https://search.naver.com/search.naver?where=nexearch&sm=tab_etc&mra=bkEw&pkid=68&os=2064210&qvt=0&query=%EB%A9%94%EC%9D%B4%EC%A6%88%20%EB%9F%AC%EB%84%88%3A%20%EC%8A%A4%EC%BD%94%EC%B9%98%20%ED%8A%B8%EB%9D%BC%EC%9D%B4%EC%96%BC'
        }
    ];

    for (const t of targets) {
        const page = await browser.newPage();
        console.log(`\nTesting ${t.name}...`);
        await page.goto(t.url, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(2000);

        const extractMetadata = () => {
            const res: any = {};
            // Unified Metadata Extraction (Header + Basic Info + Pattern Matching)
            const metadataSources = [
                ...Array.from(document.querySelectorAll('.title_area .sub_title > span, .cm_top_wrap .sub_title > span')),
                ...Array.from(document.querySelectorAll('.info_group dd, .detail_info dd, .cm_content_area .info_group dd, .intro_box .intro_desc'))
            ];

            const patterns = {
                age: /(전체\s*관람가|전체\s*시청가|\d{1,2}세\s*(?:이상)?\s*(?:관람가|시청가)?|청소년\s*관람불가|청불|미성년자\s*관람불가)/,
                runtime: /(\d{1,3}분)/,
                country: /(한국|미국|일본|중국|영국|프랑스|독일|캐나다|스페인|이탈리아|홍콩|대만|태국)/,
                genre: /(드라마|액션|스릴러|로맨스|판타지|SF|코미디|애니메이션|범죄|모험|미스터리|가족|공포|다큐멘터리|전쟁|역사|음악|서부|느와르|멜로|애정)/
            };

            let realGenre = '';

            metadataSources.forEach(el => {
                const text = el.textContent?.trim() || '';
                if (!text) return;

                // 1. Explicit Parsing
                const dt = el.previousElementSibling?.tagName === 'DT' ? el.previousElementSibling : null;
                const label = dt?.textContent?.trim() || '';

                if (label === '등급') res.ageRating = text;
                if (label === '국가') res.productionCountry = text;
                if (label === '러닝타임') res.runningTime = text;
                if (label === '장르' || label === '개요') realGenre = text;
                if (label === '원제') res.originalTitle = text;

                // 2. Pattern Matching
                if (!res.ageRating && text.match(patterns.age)) res.ageRating = text.match(patterns.age)![0];
                if (!res.runningTime && text.match(patterns.runtime)) res.runningTime = text.match(patterns.runtime)![0];
                if (!res.productionCountry && text.match(patterns.country)) res.productionCountry = text.match(patterns.country)![0];

                const link = el.querySelector('a');
                if (link && !res.subGenre && patterns.genre.test(link.textContent || '')) {
                    res.subGenre = link.textContent?.trim();
                }
            });

            // Refine Genre
            if (realGenre && !res.subGenre) {
                if (realGenre.includes('·')) {
                    realGenre.split('·').forEach(p => {
                        p = p.trim();
                        if (patterns.genre.test(p)) res.subGenre = p;
                    });
                } else {
                    const match = realGenre.match(patterns.genre);
                    if (match) {
                        res.subGenre = match[0];
                    } else {
                        res.subGenre = realGenre;
                    }
                }
            }
            return res;
        };

        let data: any = await page.evaluate(extractMetadata);
        console.log('Initial Data:', data);

        // Fallback Logic
        if (!data.ageRating) {
            console.log('Age rating missing, attempting click...');
            const clicked = await page.evaluate(() => {
                const tabs = Array.from(document.querySelectorAll('a, div[role="tab"], span[role="button"]'));
                const t = tabs.find(el => {
                    const txt = el.textContent?.trim();
                    return txt === '기본정보' || txt === '정보';
                });
                if (t) { (t as HTMLElement).click(); return true; }
                return false;
            });
            if (clicked) {
                console.log('Clicked tab, waiting...');
                await page.waitForTimeout(2000);
                const newData = await page.evaluate(extractMetadata);
                console.log('Data after click:', newData);
                Object.assign(data, newData);
            } else {
                console.log('Tab not found!');
            }
        }

        // Final Body Fallback check
        if (!data.ageRating) {
            console.log('Still missing age, checking body text...');
            const bodyAge = await page.evaluate(() => {
                const patterns = {
                    age: /(전체\s*관람가|전체\s*시청가|\d{1,2}세\s*(?:이상)?\s*(?:관람가|시청가)?|청소년\s*관람불가|청불|미성년자\s*관람불가)/
                };
                const match = document.body.innerText.match(patterns.age);
                return match ? match[0] : null;
            });
            if (bodyAge) {
                console.log('Found in body:', bodyAge);
                data.ageRating = bodyAge;
            }
        }

        console.log('Final Data:', data);
        await page.close();
    }

    await browser.close();
}

testMetadata();

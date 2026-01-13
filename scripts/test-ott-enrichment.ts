import puppeteer from 'puppeteer';

const TEST_URL = 'https://m.kinolights.com/title/148455'; // Use ID 148455 (Expected: Netflix)
const TARGET_TITLE = '개와 늑대의 시간 시즌 2';

(async () => {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
    });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1');
    await page.setViewport({ width: 390, height: 844 });

    try {
        console.log(`Navigating to ${TEST_URL}...`);
        await page.goto(TEST_URL, { waitUntil: 'networkidle2' });

        // Use string evaluation to avoid tsx/esbuild injecting __name helpers
        const extractionCode = `
            (() => {
                const cleanText = (t) => (t || '').replace(/\\s+/g, ' ').trim();

                const items = Array.from(document.querySelectorAll('.metadata__item'));
                const getMeta = (keys) => {
                    for (const item of items) {
                        const titleEl = item.querySelector('.item__title');
                        if (titleEl) {
                            const t = cleanText(titleEl.textContent);
                            if (keys.some(k => t.includes(k))) {
                                return cleanText(item.textContent).replace(t, '').trim();
                            }
                        }
                    }
                    return '';
                };

                let director = '';
                const staffs = Array.from(document.querySelectorAll('.staff'));
                for (const staff of staffs) {
                    const titleEl = staff.querySelector('.staff__title');
                    if (titleEl && cleanText(titleEl.textContent).includes('감독')) {
                        const nameEl = staff.querySelector('.names__name');
                        if (nameEl) director = cleanText(nameEl.textContent);
                        break;
                    }
                }

                const cast = Array.from(document.querySelectorAll('[id^="actorList-"] .name'))
                    .slice(0, 5)
                    .map(el => cleanText(el.textContent))
                    .filter(Boolean);

                const platforms = [];
                const providerMap = {
                    'netflix.com': 'netflix',
                    'tving.com': 'tving',
                    'wavve.com': 'wavve',
                    'watcha.com': 'watcha',
                    'disneyplus.com': 'disney',
                    'coupangplay.com': 'coupang',
                    'tv.apple.com': 'apple'
                };
                const links = Array.from(document.querySelectorAll('a'));
                for (const link of links) {
                    const href = link.href;
                    for (const domain in providerMap) {
                        if (href.includes(domain)) {
                            const key = providerMap[domain];
                            if (platforms.indexOf(key) === -1) platforms.push(key);
                        }
                    }
                }

                const genre = getMeta(['장르']);
                const runtime = getMeta(['러닝타임']);
                const date = getMeta(['방영일', '개봉일']);
                const grade = getMeta(['연령등급']);

                const headerDateEl = document.querySelector('.movie-header-area .title-area .year');
                const headerDate = headerDateEl ? cleanText(headerDateEl.textContent) : '';

                const headerGradeEl = document.querySelector('.movie-header-area .title-area .age');
                const headerGrade = headerGradeEl ? cleanText(headerGradeEl.textContent) : '';

                return {
                    movieInfo: [genre, runtime].filter(Boolean).join(' / '),
                    grade: grade,
                    director: director,
                    cast: cast,
                    detailDate: date,
                    platforms: platforms,
                    debug: {
                        genre, date, grade, headerDate, headerGrade
                    }
                };
            })()
        `;

        const details = await page.evaluate(extractionCode) as any;

        console.log(`[Enrichment Test] Starting...`);
        console.log(`Target URL: ${TEST_URL}`);
        console.log('Details:', JSON.stringify(details, null, 2));

    } catch (e) {
        console.error(`Failed to test enrichment:`, e);
    } finally {
        await browser.close();
    }
})();

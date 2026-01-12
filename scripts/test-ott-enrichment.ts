
import puppeteer from 'puppeteer';

const TARGET_URL = 'https://m.kinolights.com/title/149368';
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
        console.log(`Navigating to ${TARGET_URL}...`);
        await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 20000 });

        const details = await page.evaluate(function () {
            function cleanText(text: string) {
                return text.replace(/\s+/g, ' ').trim();
            }

            // Helper to find value by label in metadata list
            function getMetadataValue(labelKeywords: string[]) {
                const items = Array.from(document.querySelectorAll('.metadata__item'));
                for (const item of items) {
                    const titleEl = item.querySelector('.item__title');
                    if (titleEl) {
                        const titleText = cleanText(titleEl.textContent || '');
                        if (labelKeywords.some(function (k) { return titleText.includes(k); })) {
                            const fullText = cleanText(item.textContent || '');
                            return fullText.replace(titleText, '').trim();
                        }
                    }
                }
                return '';
            }

            function getDirector() {
                const staffs = Array.from(document.querySelectorAll('.staff'));
                for (const staff of staffs) {
                    const titleEl = staff.querySelector('.staff__title');
                    if (titleEl && cleanText(titleEl.textContent || '').includes('감독')) {
                        const nameEl = staff.querySelector('.names__name');
                        return nameEl ? cleanText(nameEl.textContent || '') : '';
                    }
                }
                return '';
            }

            function getCast() {
                const actors = Array.from(document.querySelectorAll('[id^="actorList-"] .name'));
                return actors.slice(0, 5).map(function (el) { return cleanText(el.textContent || ''); }).filter(Boolean);
            }

            const genre = getMetadataValue(['장르']);
            const runtime = getMetadataValue(['러닝타임']);
            const date = getMetadataValue(['방영일', '개봉일']);
            const grade = getMetadataValue(['연령등급']);

            // Try to find header year/date fallback
            const headerDateEl = document.querySelector('.movie-header-area .title-area .year');
            const headerDate = headerDateEl ? cleanText(headerDateEl.textContent || '') : '';

            // Try to find header grade fallback
            const headerGradeEl = document.querySelector('.movie-header-area .title-area .age');
            const headerGrade = headerGradeEl ? cleanText(headerGradeEl.textContent || '') : '';

            return {
                movieInfo: [genre, runtime].filter(Boolean).join(' / '),
                grade: grade,
                director: getDirector(),
                cast: getCast(),
                detailDate: date,
                debug: {
                    genreRaw: genre,
                    dateRaw: date,
                    gradeRaw: grade,
                    headerDate: headerDate,
                    headerGrade: headerGrade
                }
            };
        });

        console.log('--- Enrichment Results ---');
        console.log('Title:', TARGET_TITLE);
        console.log('Details:', JSON.stringify(details, null, 2));

    } catch (e) {
        console.error(`Failed to test enrichment:`, e);
    } finally {
        await browser.close();
    }
})();

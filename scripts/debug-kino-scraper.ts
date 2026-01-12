
import puppeteer from 'puppeteer';

const TARGET_URL = 'https://m.kinolights.com/title/149368';

(async () => {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
    });
    const page = await browser.newPage();

    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    try {
        console.log(`Navigating to ${TARGET_URL}...`);
        await page.goto(TARGET_URL, { waitUntil: 'networkidle2' });

        const content = await page.evaluate(function () {
            function cleanText(text: string) {
                return text.replace(/\s+/g, ' ').trim();
            }

            const titleElement = document.querySelector('.movie-header-area .title-area h3');
            const title = titleElement ? cleanText(titleElement.textContent || '') : 'Not Found';

            // Extract all metadata items to see what's available
            const metadataItems = Array.from(document.querySelectorAll('.metadata__item'));
            const metadataLog = metadataItems.map(function (item) {
                const titleEl = item.querySelector('.item__title');
                const title = titleEl ? cleanText(titleEl.textContent || '') : 'No Title';
                const fullText = cleanText(item.textContent || '');
                const value = fullText.replace(title, '').trim();
                return { title: title, value: value };
            });

            // Extract tags/grade
            const ageBadge = document.querySelector('.movie-header-area .title-area .age');
            const grade = ageBadge ? cleanText(ageBadge.textContent || '') : 'Not Found';

            // Extract Date specifically if possible
            const releaseDateEl = document.querySelector('.movie-header-area .title-area .year');
            const releaseDate = releaseDateEl ? cleanText(releaseDateEl.textContent || '') : 'Not Found';

            return {
                title: title,
                grade: grade,
                releaseDate: releaseDate,
                metadataLog: metadataLog,
                htmlPreview: document.querySelector('.movie-header-area') ? document.querySelector('.movie-header-area')!.outerHTML.substring(0, 500) : 'No Header'
            };
        });

        console.log('--- Extraction Results ---');
        console.log('Title:', content.title);
        console.log('Grade (Header):', content.grade);
        console.log('Release Date (Header):', content.releaseDate);
        console.log('Metadata Log:', JSON.stringify(content.metadataLog, null, 2));

    } catch (error) {
        console.error('Error during scraping:', error);
    } finally {
        await browser.close();
    }
})();

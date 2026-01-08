
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

async function debugOTT() {
    const url = 'https://m.kinolights.com/title/140689'; // Spring Fever
    console.log(`Debugging ${url}...`);

    const browser = await puppeteer.launch({
        headless: true, // Set to false to see what's happening if needed
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 390, height: 844 });

        await page.goto(url, { waitUntil: 'networkidle2' });

        // Wait for metadata
        try {
            await page.waitForSelector('.metadata__item', { timeout: 5000 });
            console.log('Metadata items found.');
        } catch (e) {
            console.log('Metadata items NOT found immediately.');
        }

        const details = await page.evaluate(() => {
            const cleanText = (text: string) => text.replace(/\s+/g, ' ').trim();

            const items = Array.from(document.querySelectorAll('.metadata__item'));
            const logs: string[] = [];

            const data = items.map(item => {
                const titleEl = item.querySelector('.item__title');
                return {
                    title: titleEl ? cleanText(titleEl.textContent || '') : 'NO_TITLE',
                    text: cleanText(item.textContent || '')
                };
            });

            const staff = Array.from(document.querySelectorAll('.staff'));
            const staffData = staff.map(s => {
                const t = s.querySelector('.staff__title');
                return {
                    title: t ? cleanText(t.textContent || '') : 'NO_TITLE',
                    full: cleanText(s.textContent || '')
                };
            });

            return { metadata: data, staff: staffData };
        });

        console.log('Scraped Data:', JSON.stringify(details, null, 2));

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await browser.close();
    }
}

debugOTT();

import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

async function probe() {
    console.log('Starting Deep Probe...');
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    // 1. Monitor Network for API calls
    page.on('request', req => {
        if (req.resourceType() === 'xhr' || req.resourceType() === 'fetch') {
            console.log(`[NETWORK] ${req.method()} ${req.url()}`);
        }
    });

    try {
        await page.goto('https://timeticket.co.kr/list.php?category=2096&area=114', { waitUntil: 'networkidle2' });

        // 2. Dump First Item HTML
        const firstItemHTML = await page.evaluate(() => {
            const item = document.querySelector('.ticket_list_wrap > a');
            return item ? item.outerHTML : 'NO_ITEM_FOUND';
        });

        console.log('\n--- FIRST ITEM HTML ---');
        console.log(firstItemHTML);
        console.log('-----------------------\n');

        // 3. Dump Computed Style of Thumb
        const thumbStyle = await page.evaluate(() => {
            const thumb = document.querySelector('.ticket_list_wrap > a .thumb');
            if (!thumb) return 'NO_THUMB';
            const style = window.getComputedStyle(thumb);
            return {
                backgroundImage: style.backgroundImage,
                background: style.background
            };
        });
        console.log('--- COMPUTED THUMB STYLE ---');
        console.log(thumbStyle);

    } catch (e) {
        console.error(e);
    } finally {
        await browser.close();
    }
}

probe();

import puppeteer from 'puppeteer';

const TARGET_URL = 'https://www.ticketlink.co.kr/sports/1191/574';

async function diagnoseTicketlink() {
    console.log(`Starting Ticketlink Diagnostic...`);
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 1024 });

    // Enable request interception to log API calls
    await page.setRequestInterception(true);
    page.on('request', request => {
        const url = request.url();
        if (url.includes('api') || url.includes('json') || url.includes('schedule')) {
            console.log('Request:', url);
        }
        request.continue();
    });

    page.on('response', async response => {
        const url = response.url();
        if ((url.includes('api') || url.includes('json')) && response.request().method() === 'GET') {
            try {
                const contentType = response.headers()['content-type'];
                if (contentType && contentType.includes('application/json')) {
                    console.log(`\n--- Response from ${url} ---`);
                    // Log first 500 chars to avoid flood
                    const text = await response.text();
                    console.log(text.slice(0, 500));
                    console.log('------------------------------\n');
                }
            } catch (e) {
                // Ignore JSON parse errors for non-json
            }
        }
    });

    console.log(`Navigating to ${TARGET_URL}...`);
    try {
        await page.goto(TARGET_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    } catch (e) {
        console.log('Navigation timeout or error, but continuing to inspect...');
    }

    // Wait for a bit to let client-side render finish
    await new Promise(r => setTimeout(r, 5000));

    const content = await page.evaluate(() => {
        return {
            title: document.title,
            bodyText: document.body.innerText.split('\n').slice(0, 100).join('\n'), // First 100 lines
            links: Array.from(document.querySelectorAll('a')).map(a => a.href).slice(0, 10),
            // Look for potential match elements
            matchElements: document.querySelectorAll('li, tr, div[class*="match"], div[class*="list"]').length
        };
    });

    console.log('Page Content:', JSON.stringify(content, null, 2));

    await browser.close();
}

diagnoseTicketlink().catch(console.error);


import puppeteer from 'puppeteer';

async function testScrape() {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    // Set viewport
    await page.setViewport({ width: 1280, height: 800 });

    const targetUrl = 'https://www.umclass.com/plan/29?page=1&area=2';
    console.log(`Navigating to ${targetUrl}...`);

    try {
        await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 30000 });

        // Wait for list to load
        await page.waitForSelector('.classPlan-contents-list', { timeout: 10000 });

        // Get list items
        const items = await page.evaluate(() => {
            const listItems = document.querySelectorAll('.classPlan-contents-list > div');
            const results: any[] = [];

            listItems.forEach((item, index) => {
                if (index >= 5) return; // Limit to 5 items for testing

                const anchor = item.querySelector('a');
                if (!anchor) return;

                const link = anchor.href;
                const titleElem = anchor.querySelector('div:nth-child(2) > span');
                const title = titleElem ? titleElem.textContent?.trim() : 'No Title';

                // Image is often a background image on this div
                const imgDiv = anchor.querySelector('.classPlan-lazy.class-lis-img');
                let image = '';
                if (imgDiv) {
                    const style = window.getComputedStyle(imgDiv);
                    image = style.backgroundImage.slice(4, -1).replace(/"/g, "");
                }

                // Price info
                const discountElem = anchor.querySelector('.class-lis-mony-mt > span:nth-child(1)');
                const priceElem = anchor.querySelector('.class-lis-mony-mt > span:nth-child(2)');

                const discount = discountElem ? discountElem.textContent?.trim() : '';
                const price = priceElem ? priceElem.textContent?.trim() : '';

                results.push({
                    title,
                    link,
                    image,
                    discount,
                    price
                });
            });

            return results;
        });

        console.log(`Found ${items.length} items. Processing details...`);

        // Visit each detail page
        for (const item of items) {
            console.log(`Scraping detail for: ${item.title}`);
            const detailPage = await browser.newPage();
            await detailPage.setViewport({ width: 1280, height: 800 });

            try {
                await detailPage.goto(item.link, { waitUntil: 'domcontentloaded', timeout: 15000 });
                // Wait a bit for dynamic content if any
                // User provided specific selector for address:
                // #um_contents > div.landing-content > div.voucher-contents > div:nth-child(6) > div:nth-child(1) > div:nth-child(14) > div:nth-child(2) > span

                // Let's try to find it. Since nth-child is brittle, we'll try to look for the "location" text or map container if possible, 
                // but we will stick to the user's selector as a primary attempt.

                // Note: The user selector is very deep. 
                // Let's try to get the full address string first.

                const addressSelector = '#um_contents > div.landing-content > div.voucher-contents > div:nth-child(6) > div:nth-child(1) > div:nth-child(14) > div:nth-child(2) > span';

                // Sometimes structure varies. Let's try evaluate with a more flexible search if selector fails.
                const rawAddress = await detailPage.evaluate((sel) => {
                    const el = document.querySelector(sel);
                    return el ? el.textContent?.trim() : null;
                }, addressSelector);

                item.rawAddress = rawAddress;
                console.log(`  - Address: ${rawAddress}`);

            } catch (e) {
                console.error(`  - Failed to load detail page: ${e}`);
            } finally {
                await detailPage.close();
            }

            // Random delay
            await new Promise(r => setTimeout(r, 1000));
        }

        console.log("---------------------------------------------------");
        console.log("SAMPLE DATA:");
        console.log(JSON.stringify(items, null, 2));
        console.log("---------------------------------------------------");

    } catch (error) {
        console.error("Error during scraping:", error);
    } finally {
        await browser.close();
    }
}

testScrape();

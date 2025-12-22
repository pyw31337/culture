
import puppeteer from 'puppeteer';

async function testMochaScrape() {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    // Set viewport
    await page.setViewport({ width: 1280, height: 800 });

    const targetUrl = 'https://mochaclass.com/Search?page=1&is_online_class=false&where=list&course=%EC%9B%90%EB%8D%B0%EC%9D%B4&sort=%EA%B1%B0%EB%A6%AC%EC%88%9C&location=%EC%84%9C%EC%9A%B8';
    console.log(`Navigating to ${targetUrl}...`);

    try {
        await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 30000 });

        // Wait for list to load - the user selector starts with #root > div > div.css-1ndybjf...
        // Let's try to find a container that holds the list items.
        // Based on user selector: #root > div > div.css-1ndybjf > div.jss1.jss2 > div > div > div.css-10fjw1o > div > div.MuiGrid-root.css-2xazwd
        // It seems MuiGrid-root css-2xazwd might be the container, and `a` tags are items.

        await page.waitForSelector('.MuiGrid-root.css-2xazwd', { timeout: 10000 });

        // Get list items
        const items = await page.evaluate(() => {
            // Generalize the selector to find the grid container
            // We search for the grid container that has multiple anchor tags as children
            const grids = document.querySelectorAll('.MuiGrid-root.css-2xazwd');
            // Assuming the main list is one of these. 
            // User selector: ... > div.MuiGrid-root.css-2xazwd > a:nth-child(3)

            let targetGrid: Element | null = null;
            // Simple heuristic: find the grid with the most 'a' children
            grids.forEach((g: any) => {
                if (!targetGrid || g.querySelectorAll('a').length > targetGrid.querySelectorAll('a').length) {
                    targetGrid = g;
                }
            });

            if (!targetGrid) return [];

            const anchors = (targetGrid as Element).querySelectorAll('a');
            const results: any[] = [];

            anchors.forEach((anchor: any, index: number) => {
                if (index >= 3) return; // Limit to 3 items for testing

                const link = anchor.href;

                // Title
                // User selector: ... > div > div.css-76zbcf > p
                const titleElem = anchor.querySelector('div > div.css-76zbcf > p');
                const title = titleElem ? titleElem.textContent?.trim() : 'No Title';

                // Image
                // User selector: ... > div > div.css-11udqdf > img
                const imgElem = anchor.querySelector('div > div.css-11udqdf > img');
                const image = imgElem ? imgElem.getAttribute('src') : '';

                // Price
                // User selector: ... > div > div.css-76zbcf > div.css-1k8tf8v > div > p
                const priceElem = anchor.querySelector('div > div.css-76zbcf > div.css-1k8tf8v > div > p');
                const price = priceElem ? priceElem.textContent?.trim() : '';

                results.push({
                    title,
                    link,
                    image,
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
                // Detail selector provided: #topleft > div:nth-child(10) > div > p

                // Wait briefly
                await new Promise(r => setTimeout(r, 1000));

                const rawAddress = await detailPage.evaluate(() => {
                    const el = document.querySelector('#topleft > div:nth-child(10) > div > p');
                    return el ? el.textContent?.trim() : null;
                });

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

testMochaScrape();

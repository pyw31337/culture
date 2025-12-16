
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';
import path from 'path';

puppeteer.use(StealthPlugin());

export interface Performance {
    id: string;
    title: string;
    image: string;
    date: string;
    venue: string;
    link: string;
    region: string;
    genre: string;
    price?: string;
    discount?: string;
}

const OUTPUT_PATH = path.resolve(process.cwd(), 'src/data/timeticket.json');

// Region codes: 114 (Daehak-ro), 115 (Seoul), 120 (Gyeonggi/Incheon)
const REGION_CODES = [
    { code: 114, region: 'seoul' },
    { code: 115, region: 'seoul' },
    { code: 120, region: 'gyeonggi' }, // Mapping Gyeonggi/Incheon to gyeonggi for now
];

async function scrapeTimeTicket() {
    console.log(`Using executablePath: ${process.env.PUPPETEER_EXECUTABLE_PATH || 'Bundled'}`);
    const browser = await puppeteer.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu'
        ],
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 1024 });
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    const allItems: Performance[] = [];
    const seenTitles = new Set<string>();

    for (const { code, region } of REGION_CODES) {
        const url = `https://timeticket.co.kr/list.php?category=2096&area=${code}`;
        console.log(`Navigating to ${url}...`);

        try {
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

            // Extract items from the list
            const listItems = await page.evaluate((currentRegion) => {
                const results: any[] = [];
                const items = document.querySelectorAll('section.wrap_1100 > div.ticket_list_wrap > a');

                items.forEach((item) => {
                    const link = item.getAttribute('href');
                    const fullLink = link ? (link.startsWith('http') ? link : 'https://timeticket.co.kr' + link) : '';

                    const imgEl = item.querySelector('div.ticket_img > img');
                    const image = imgEl ? imgEl.getAttribute('src') || '' : '';

                    const titleEl = item.querySelector('div.ticket_info > p.ticket_title');
                    // If .ticket_title doesn't exist, try just generic p in info
                    const title = titleEl ? titleEl.textContent?.trim() : item.querySelector('div.ticket_info > p')?.textContent?.trim();

                    const discountEl = item.querySelector('div.ticket_price > span.sale');
                    const discount = discountEl ? discountEl.textContent?.trim() : '';

                    const priceEl = item.querySelector('div.ticket_price > span.price');
                    const price = priceEl ? priceEl.textContent?.trim() : '';

                    const categoryEl = item.querySelector('p.category');
                    const categoryText = categoryEl ? categoryEl.textContent?.trim() || '' : '';

                    // Map category
                    let genre = 'play'; // Default
                    if (categoryText.includes('뮤지컬')) genre = 'musical';
                    else if (categoryText.includes('콘서트')) genre = 'concert';
                    // "연극" remains "play"

                    if (fullLink && title) {
                        results.push({
                            title,
                            image,
                            link: fullLink,
                            region: currentRegion,
                            genre,
                            price,
                            discount
                        });
                    }
                });
                return results;
            }, region);

            console.log(`Found ${listItems.length} items for region code ${code}.`);

            for (const item of listItems) {
                if (seenTitles.has(item.title)) continue;
                seenTitles.add(item.title);

                // Visit detail page to get Date and Venue
                console.log(`  Scraping detail: ${item.title}`);
                try {
                    await page.goto(item.link, { waitUntil: 'domcontentloaded', timeout: 30000 });

                    // Wait for AJAX content
                    // The venue info is in #ajaxcontentarea
                    await page.waitForSelector('#ajaxcontentarea', { timeout: 10000 }).catch(() => { });
                    // Sometimes it takes a moment for the text to load
                    await new Promise(r => setTimeout(r, 1500));

                    const detailData = await page.evaluate(() => {
                        const content = (document.querySelector('#ajaxcontentarea') as HTMLElement)?.innerText || '';

                        // Parse Venue and Address
                        // "· 장소: 라온아트홀 / 총 206석"
                        // "· 주소: 서울 종로구 대학로10길 11"
                        // "· 기간: 2024.01.01 ~ OpenRun"

                        let venue = '';
                        let address = '';
                        let date = '';

                        const venueMatch = content.match(/· 장소:\s*(.+)/);
                        if (venueMatch) {
                            venue = venueMatch[1].split('/')[0].trim(); // Remove seat count if present
                        }

                        const addressMatch = content.match(/· 주소:\s*(.+)/);
                        if (addressMatch) {
                            address = addressMatch[1].trim();
                        }

                        const dateMatch = content.match(/· 기간:\s*(.+)/);
                        if (dateMatch) {
                            date = dateMatch[1].trim();
                        }

                        return { venue, address, date };
                    });

                    // If address is Incheon, update region to 'incheon' if currently 'gyeonggi'
                    if (item.region === 'gyeonggi' && detailData.address.includes('인천')) {
                        item.region = 'incheon';
                    }

                    allItems.push({
                        id: `timeticket_${Math.random().toString(36).substr(2, 9)}`,
                        title: item.title,
                        image: item.image,
                        date: detailData.date, // If empty, might need fallback or keep empty
                        venue: detailData.venue,
                        link: item.link,
                        region: item.region,
                        genre: item.genre,
                        price: item.price,
                        discount: item.discount
                    });

                } catch (e) {
                    console.error(`  Failed to scrape detail for ${item.title}:`, e);
                }
            }

        } catch (e) {
            console.error(`Error scraping region ${code}:`, e);
        }
    }

    console.log(`Total collected: ${allItems.length}`);
    await browser.close();

    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(allItems, null, 2));
    console.log(`Saved to ${OUTPUT_PATH}`);
}

scrapeTimeTicket().catch(console.error);

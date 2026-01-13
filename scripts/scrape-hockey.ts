
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';
import path from 'path';

puppeteer.use(StealthPlugin());

interface Performance {
    id: string;
    title: string;
    date: string;
    venue: string;
    link: string;
    genre: string;
    image: string;
    region: string;
    price?: string;
    homeTeam?: string;
    awayTeam?: string;
    homeTeamLogo?: string;
    awayTeamLogo?: string;
}

const HOCKEY_URL = 'https://web.archive.org/web/20251017171733/https://www.hlicehockey.com/%EC%9D%BC%EC%A0%95-%EA%B2%B0%EA%B3%BC/';

async function scrapeHockey() {
    console.log('Starting Hockey Scraper (HL Anyang) [Clean Run]...');

    const browser = await puppeteer.launch({
        headless: true,
        ignoreHTTPSErrors: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--ignore-certificate-errors',
            '--disable-blink-features=AutomationControlled' // Extra stealth
        ]
    });

    try {
        const page = await browser.newPage();

        // Comprehensive Headers to bypass 406/403
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.setExtraHTTPHeaders({
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
            'Referer': 'https://www.hlicehockey.com/',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'same-origin',
            'Sec-Fetch-User': '?1'
        });

        console.log(`Navigating to ${HOCKEY_URL}...`);
        await page.goto(HOCKEY_URL, { waitUntil: 'networkidle2', timeout: 60000 });

        // Wait for table or generic row
        try {
            await page.waitForSelector('.sp-event-list, .sp-post', { timeout: 15000 });
        } catch (e) {
            console.log('Table selector warning: might not have loaded properly.');
        }

        // String Evaluation to avoid __name error with tsx
        const extractionCode = `
            (() => {
                const rows = Array.from(document.querySelectorAll('tr.sp-row'));
                const results = [];

                const VENUE_MAP = {
                    'ANYANG': '안양 종합운동장 실내빙상장',
                };

                const cleanText = (t) => t ? t.textContent.trim() : '';
                
                function processLogo(src) {
                    if (!src) return '';
                    let abs = src;
                    if (!abs.startsWith('http')) {
                        const base = 'https://www.hlicehockey.com';
                        abs = base + (abs.startsWith('/') ? '' : '/') + abs;
                    }
                    // Remove resolution pattern like -32x32, -150x150 before extension
                    return abs.replace(/-\\d+x\\d+(?=\\.[a-zA-Z]+$)/, '');
                }

                for (const row of rows) {
                    // Selectors
                    const dateEl = row.querySelector('.data-date');
                    const timeEl = row.querySelector('.data-time');
                    const homeEl = row.querySelector('.data-home');
                    const awayEl = row.querySelector('.data-away');
                    const venueEl = row.querySelector('.data-venue');

                    if (!dateEl || !homeEl || !awayEl) continue;

                    // Date Parsing
                    // Text often looks like "2025-09-08 12:00:262025-09-08" due to hidden elements
                    // Try to get pure text or date tag
                    let dateStr = '';
                    const dateTag = dateEl.querySelector('date');
                    if (dateTag) {
                        dateStr = dateTag.textContent.trim().split(' ')[0]; // 2025-09-08
                    } else {
                        // Fallback
                        dateStr = cleanText(dateEl).substring(0, 10);
                    }

                    const timeText = cleanText(timeEl).replace(/\\s/g, ''); 
                    // Time cell often contains result like "5 - 0" if game passed, or time "17:00" if future.
                    
                    let fullDate = dateStr;
                    // Check if timeText looks like time (HH:MM)
                    if (timeText.includes(':')) {
                         fullDate += ' ' + timeText; // 2025-09-08 17:00
                    } else {
                        // Default to noon if no time, or keep parsing? 
                        // Often date tag has full ISO string in content attr, but let's stick to visible for now.
                        fullDate += ' 12:00'; 
                    }
                    
                    // Convert to ISO 8601-like
                    const date = fullDate.replace(' ', 'T').replace(/\\./g, '-');

                    // Team Names (remove logo text/img from content if possible)
                    // Usually .data-home textContent includes everything. 
                    // We can try to get text node only, or just trim.
                    // Or look for specific name container if exists (not always).
                    const homeTeam = cleanText(homeEl).replace('HL안양', 'HL 안양').trim(); 
                    const awayTeam = cleanText(awayEl).trim();
                    
                    const venueRaw = cleanText(venueEl);
                    const venue = VENUE_MAP[venueRaw] || venueRaw;

                    // Logos
                    const homeImg = row.querySelector('.data-home img');
                    const awayImg = row.querySelector('.data-away img');

                    const homeTeamLogo = processLogo(homeImg ? homeImg.src : null);
                    const awayTeamLogo = processLogo(awayImg ? awayImg.src : null);

                    const title = homeTeam + ' vs ' + awayTeam;

                    // Region Logic
                    let region = 'etc';
                    if (venue.includes('안양')) {
                        region = 'gyeonggi';
                    } else if (['HACHINOHE', 'AMAGASAKI', 'TOMAKOMAI', 'NIKKO', 'KUSHIRO', 'YOKOHAMA', 'TOKYO', 'SEOUL'].includes(venueRaw)) {
                         region = 'etc';
                    }

                     // ID
                    const safeDate = date.replace(/[- :T]/g, '');
                    const safeTitle = title.replace(/\\s/g, '');
                    const id = 'hockey_' + safeDate + '_' + safeTitle;

                    results.push({
                        id,
                        title,
                        date,
                        venue,
                        link: 'https://www.hlicehockey.com/%EC%9D%BC%EC%A0%95-%EA%B2%B0%EA%B3%BC/',
                        genre: 'hockey',
                        image: 'https://www.hlicehockey.com/wp-content/uploads/2022/09/HL300.png', // Default or specific
                        region,
                        homeTeam,
                        awayTeam,
                        homeTeamLogo,
                        awayTeamLogo
                    });
                }
                return results;
            })()
        `;

        const data = await page.evaluate(extractionCode) as any[];

        console.log(`Extracted ${data.length} matches.`);

        if (data.length === 0) {
            console.log('No matches found. Dumping page content for debugging...');
            const html = await page.content();
            const debugPath = path.resolve(process.cwd(), 'debug-hockey-fail.html');
            fs.writeFileSync(debugPath, html);
            console.log(`Saved debug HTML to ${debugPath}`);

            const title = await page.title();
            console.log(`Page Title: ${title}`);
        }

        const outputPath = path.resolve(process.cwd(), 'src/data/hockey.json');

        // Load existing data for persistence
        let existingItems: any[] = [];
        if (fs.existsSync(outputPath)) {
            try {
                const fileContent = fs.readFileSync(outputPath, 'utf-8');
                existingItems = JSON.parse(fileContent);
                console.log(`Loaded ${existingItems.length} existing items for merging.`);
            } catch (e) {
                console.error('Error loading existing data:', e);
            }
        }

        // Create a map of existing items by ID
        const itemMap = new Map<string, any>();
        existingItems.forEach(item => itemMap.set(item.id, item));

        // Merge new items: Existing items take precedence to preserve manual edits
        data.forEach(newItem => {
            if (itemMap.has(newItem.id)) {
                itemMap.set(newItem.id, { ...newItem, ...itemMap.get(newItem.id) });
            } else {
                itemMap.set(newItem.id, newItem);
            }
        });

        const finalItems = Array.from(itemMap.values());
        fs.writeFileSync(outputPath, JSON.stringify(finalItems, null, 2));
        console.log(`Saved ${finalItems.length} items to ${outputPath} (Merged with existing data)`);

    } catch (error) {
        console.error('Scraping failed:', error);
    } finally {
        await browser.close();
    }
}

scrapeHockey();

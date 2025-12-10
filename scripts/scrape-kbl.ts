import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

// Try the root URL
const KBL_URL = 'https://www.kbl.or.kr';
// User requested static thumbnail
const KBL_POSTER = '/culture/images/kbl_poster.png';
const OUTPUT_PATH = path.resolve(process.cwd(), 'src/data/kbl_debug.txt');

async function scrapeKbl() {
    console.log('Launching browser...');
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 1024 });
    // User Agent
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    console.log(`Navigating to ${KBL_URL}...`);
    await page.goto(KBL_URL, { waitUntil: 'networkidle0', timeout: 60000 });

    console.log(`Current URL: ${page.url()}`);

    // Wait a bit
    await new Promise(r => setTimeout(r, 5000));

    // Dump content
    const content = await page.evaluate(() => document.body.innerText);
    fs.writeFileSync(OUTPUT_PATH, content);
    console.log(`Saved text content to ${OUTPUT_PATH}`);

    const lines = (content as string).split('\n').map(l => l.trim()).filter(l => l);
    const performances: any[] = []; // Use explicit type if possible, or matches Performance interface

    // Helper to map venue to region
    function classifyRegion(venue: string): string {
        if (venue.includes('서울') || venue.includes('잠실')) return 'seoul';
        if (venue.includes('안양') || venue.includes('수원') || venue.includes('고양')) return 'gyeonggi';
        if (venue.includes('인천')) return 'incheon';
        return 'etc';
    }

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Date Pattern: "25.12.10 수 19:00 대구체육관"
        // Regex: ^(\d{2})\.(\d{2})\.(\d{2})\s[월화수목금토일]\s(\d{2}:\d{2})\s(.+)$
        const dateMatch = line.match(/^(\d{2})\.(\d{2})\.(\d{2})\s[월화수목금토일]\s(\d{2}:\d{2})\s(.+)$/);

        if (dateMatch) {
            const year = `20${dateMatch[1]}`;
            const month = dateMatch[2];
            const day = dateMatch[3];
            const time = dateMatch[4];
            const venue = dateMatch[5];

            // Expected structure based on debug:
            // i   : Date/Venue
            // i+1 : Team 1 (Home usually)
            // i+2 : Score 1
            // i+3 : Team 2 (Away usually)
            // i+4 : Score 2
            // i+5 : Status (예정/종료)

            // Note: The debug file had empty lines between them, but our `lines` array filters empty lines.
            // So indices should be contiguous in `lines`.

            if (i + 3 < lines.length) {
                const team1 = lines[i + 1];
                const score1 = lines[i + 2]; // might be number
                const team2 = lines[i + 3];
                // validation: ensure team names are not scores
                if (team1 && team2 && isNaN(Number(team1)) && isNaN(Number(team2))) {
                    const title = `[농구] ${team1} vs ${team2}`;
                    const dateStr = `${year}-${month}-${day}`;
                    const id = `kbl_${dateStr.replace(/-/g, '')}_${team1}_${team2}`;

                    performances.push({
                        id,
                        title,
                        image: KBL_POSTER,
                        date: `${dateStr} ${time}`,
                        venue,
                        link: KBL_URL,
                        region: classifyRegion(venue),
                        genre: 'basketball'
                    });
                }
            }
        }
    }

    console.log(`Extracted ${performances.length} matches.`);
    fs.writeFileSync(path.resolve(process.cwd(), 'src/data/kbl.json'), JSON.stringify(performances, null, 2));
    console.log(`Saved to src/data/kbl.json`);

    // Also screenshot might be useful if I could view it, but text is safer.

    await browser.close();
}

scrapeKbl().catch(console.error);

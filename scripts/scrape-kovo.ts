
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

// Type definition matching the project's Performance interface
export interface Performance {
    id: string;
    title: string;
    image: string;
    date: string;
    venue: string;
    link: string;
    region: string;
    genre: string;
}

const KOVO_URL = 'https://kovo.co.kr/tickets/single';
const OUTPUT_PATH = path.resolve(process.cwd(), 'src/data/kovo.json');

// User requested static thumbnail
// NOTE: Must include basePath '/culture' as defined in next.config.ts because we use standard <img> tags
const VOLLEYBALL_POSTER = '/culture/images/volleyball_poster.png';
// const TEAM_LOGOS: Record<string, string> = { ... } // Removed
// Static poster defined above.

async function scrapeKovo() {
    console.log('Launching browser...');
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
    });

    const page = await browser.newPage();

    // Set viewport to desktop for clear rendering
    await page.setViewport({ width: 1280, height: 1024 });

    console.log(`Navigating to ${KOVO_URL}...`);
    await page.goto(KOVO_URL, { waitUntil: 'networkidle0', timeout: 60000 });

    // Wait for the main list container or some specific text to confirm load
    console.log('Waiting for schedule list...');
    // Looking at the innerText screenshot, the list seems to be a custom flex layout.
    // We'll wait for a common element like "Home" or "VS" which appears in match cards.
    try {
        await page.waitForFunction(
            () => document.body.innerText.includes('VS'),
            { timeout: 10000 }
        );
    } catch (e) {
        console.warn("Timed out waiting for 'VS', but continuing in case content is loaded otherwise.");
    }

    // Attempt to extract data
    // Since class names are obfuscated (e.g. css-184u2kf), we might iterate over structure or use text heuristics.
    // Based on the text dump, matches look like:
    // 12.11(목) 19:00
    // 대전 충무체육관
    // Home
    // 삼성화재
    // VS
    // 현대캐피탈
    // Away
    // [일반예매]

    // Attempt to extract data
    // Just grab the full text content. The structure is linear enough.
    const matches = await page.evaluate(() => {
        return document.body.innerText;
    });

    await browser.close();

    // Parse the text content outside details
    // The text pattern is:
    // 12.11(목) 19:00 \n 대전 충무체육관 \n Home \n 삼성화재 \n VS \n 현대캐피탈 ...

    // We'll split by double newlines or scan line by line.
    console.log('Parsing text content...');
    // console.log(matches); // It's just a string

    const lines = (matches as string).split('\n').map(l => l.trim()).filter(l => l);
    const performances: Performance[] = [];

    // Simple state machine parser
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Identify Date/Time line: e.g. "12.11(목) 19:00"
        // Regex: \d{1,2}\.\d{1,2}\([월화수목금토일]\)\s\d{2}:\d{2}
        const dateMatch = line.match(/^(\d{1,2})\.(\d{1,2})\(([월화수목금토일])\)\s(\d{2}:\d{2})$/);

        if (dateMatch) {
            // Found a match start
            // Next line should be venue: "대전 충무체육관"
            // Then "Home" (optional?)
            // Then Team 1
            // Then "VS"
            // Then Team 2

            const month = dateMatch[1];
            const day = dateMatch[2];
            const time = dateMatch[4];

            // Current year is safe assumption? Or derived from month (if Dec -> 2024, if Jan -> 2025)
            // KOVO season spans 2 years. 
            // Simple logic: if month >= 10, use 2025 (current season start), wait.
            // Current date is Dec 2025. 
            const currentYear = new Date().getFullYear();
            // Note: Data might be for 2025-2026 season given "도드람 2025~2026 V-리그" title in text dump.
            // If month is 12, it's Dec 2025. If 1, it's Jan 2026.

            let year = currentYear;
            if (parseInt(month) < 6) year = currentYear + 1; // Basic heuristic for spring part of season

            const dateStr = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;

            const venue = lines[i + 1]; // Venue is usually next

            // Find teams. Scan forward a few lines for "VS".
            // usually:
            // i+1: Venue
            // i+2: "Home" or Team
            // i+3: Team Name 1 (if i+2 was Home)

            // Let's look for VS index
            let vsIndex = -1;
            for (let j = i + 1; j < i + 10 && j < lines.length; j++) {
                if (lines[j] === 'VS') {
                    vsIndex = j;
                    break;
                }
            }

            if (vsIndex !== -1) {
                // Teams are around VS
                const homeTeam = lines[vsIndex - 1];
                const awayTeam = lines[vsIndex + 1];

                // Avoid capturing "Home" tag if present
                // If line before VS is HomeTeam, and line before that is "Home", clean it up.
                // Text dump: "Home" \n "삼성화재" \n "VS"
                // So homeTeam = lines[vsIndex-1] is correct ("삼성화재")

                const title = `[배구] ${homeTeam} vs ${awayTeam}`;

                // Construct ID
                const id = `kovo_${dateStr.replace(/-/g, '')}_${homeTeam}_${awayTeam}`;

                // Static user-provided poster
                const image = VOLLEYBALL_POSTER;

                performances.push({
                    id,
                    title,
                    image,
                    date: `${dateStr} ${time}`,
                    venue,
                    link: KOVO_URL, // Generic link to ticket page
                    region: classifyRegion(venue),
                    genre: 'volleyball'
                });
            }
        }
    }

    console.log(`Extracted ${performances.length} matches.`);

    // Save to file
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(performances, null, 2));
    console.log(`Saved to ${OUTPUT_PATH}`);
}

function classifyRegion(venue: string): string {
    if (venue.includes('서울') || venue.includes('장충')) return 'seoul';
    if (venue.includes('인천') || venue.includes('계양')) return 'incheon';
    if (venue.includes('수원') || venue.includes('의정부') || venue.includes('안산') || venue.includes('화성')) return 'gyeonggi';
    return 'etc'; // Daejeon, Cheonan, Gimcheon etc. will be 'etc' or filtered out? 
    // The app currently filters by Seoul/Gyeonggi/Incheon. 'etc' items might not show unless we add a 'All' or 'Other' region, 
    // OR we just include them and let the user see them if they select "All Regions".
}

scrapeKovo().catch(console.error);

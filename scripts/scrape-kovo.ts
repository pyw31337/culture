import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

export interface Performance {
    id: string;
    title: string;
    image: string;
    date: string;
    venue: string;
    link: string;
    region: string;
    genre: string;
    homeTeam?: string;
    awayTeam?: string;
    homeTeamLogo?: string;
    awayTeamLogo?: string;
}

const KOVO_SCHEDULE_URL = 'https://kovo.co.kr/games/v-leagues/schedules?season=022&gender=all&league=201&round=all';
const OUTPUT_PATH = path.resolve(process.cwd(), 'src/data/kovo.json');
const VOLLEYBALL_POSTER = '/culture/images/volleyball_poster.png';

const TEAMS = [
    '대한항공', '현대캐피탈', '한국전력', '우리카드', 'OK저축은행', '삼성화재', 'KB손해보험',
    '현대건설', '흥국생명', '정관장', 'IBK기업은행', 'GS칼텍스', '한국도로공사', '페퍼저축은행'
];

async function scrapeKovo() {
    console.log(`Starting KOVO Scraper (Full Schedule)...`);

    const MAX_RETRIES = 3;
    let retries = 0;

    while (retries < MAX_RETRIES) {
        try {
            if (retries > 0) {
                console.log(`Retry attempt ${retries + 1}/${MAX_RETRIES}...`);
                await new Promise(r => setTimeout(r, 5000)); // Wait 5s before retry
            }

            const browser = await puppeteer.launch({
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
                executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
            });

            const page = await browser.newPage();
            // Set a real User-Agent to avoid blocking
            await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
            await page.setViewport({ width: 1280, height: 1024 });

            console.log(`Navigating to ${KOVO_SCHEDULE_URL}...`);
            await page.goto(KOVO_SCHEDULE_URL, { waitUntil: 'networkidle2', timeout: 60000 });

            // Ensure page is fully loaded (wait for any table or list content, not specific text)
            try {
                // Wait for the main schedule table or list
                await page.waitForSelector('table, .schedule_list, .game-list', { timeout: 10000 });
            } catch (e) {
                console.log('Timeout waiting for selector, potentially checking text content...');
            }

            // Ensure page is fully loaded
            try {
                await page.waitForSelector('.MuiBox-root.css-1233kbt', { timeout: 10000 });
            } catch (e) {
                console.log('Timeout waiting for rows, checking generic content...');
            }

            // Scrape Data using DOM evaluation
            const scrapedItems = await page.evaluate(() => {
                const results: any[] = [];

                // KOVO Schedule is structured as:
                // Date Header -> Row Container -> Match Row
                // But looking at the DOM, it seems to be Date Box (class css-1821gv5) containing Header + Rows?
                // Let's try to iterate through all major blocks and find Dates and Matches.

                // Strategy: Find all Match Rows (.css-1233kbt), then find their closest Date header?
                // Or iterate the main container's children.

                // Let's try iterating all .MuiBox-root that look like Date Headers or Match Rows.
                // Based on inspection:
                // Date Container: .css-1821gv5 (Contains Date Text)
                // Match Row: .css-1233kbt (Contains Match Info)

                // Actually, let's use a more robust traversal.
                const allElements = Array.from(document.querySelectorAll('#root > div > div > div > div > div > div > div > div'));
                // That selector is brittle.

                // Let's select the Date Blocks if possible
                const dateBlocks = document.querySelectorAll('.MuiBox-root.css-1821gv5');

                if (dateBlocks.length > 0) {
                    dateBlocks.forEach(block => {
                        // Extract Date
                        const dateText = (block.textContent || '').match(/(\d{4}\.\d{2}\.\d{2})/)?.[1];
                        if (!dateText) return;

                        // Find match rows inside this date block
                        // The rows seem to be in a sibling or child container. 
                        // Assuming structure: DateBlock contains rows or is a wrapper.
                        // If wrapper:
                        const rows = block.querySelectorAll('.MuiBox-root.css-1233kbt');

                        rows.forEach(row => {
                            const text = row.textContent || '';

                            // Extract Time (HH:mm)
                            const time = text.match(/(\d{2}:\d{2})/)?.[1] || '00:00';

                            // Teams & Logos
                            // Home (Left)
                            const homeImg = row.querySelector('.MuiBox-root.css-18arn4l img');
                            const homeLogo = homeImg?.getAttribute('src') || '';
                            const homeTeamFull = homeImg?.getAttribute('alt') || '';
                            const homeTeam = homeTeamFull.split(' ').pop() || ''; // "인천 흥국생명 핑크스파이더스" -> "핑크스파이더스"

                            // Away (Right)
                            const awayImg = row.querySelector('.MuiBox-root.css-3cjh58 img');
                            const awayLogo = awayImg?.getAttribute('src') || '';
                            const awayTeamFull = awayImg?.getAttribute('alt') || '';
                            const awayTeam = awayTeamFull.split(' ').pop() || '';

                            // Venue
                            // Venue is usually just text in the row, e.g., "인천삼산체육관"
                            // Let's extract generic text and filter out teams/time/VS
                            // Simplistic approach: Match known stadium names? 
                            // Or look for text nodes that are not time/score.
                            // The textContent includes "19:00\n흥국생명\n3 : 1\n페퍼저축은행\n인천삼산체육관\n중계..."
                            // The venue is usually after the score/teams.

                            let venue = '정보없음';
                            const venueMatch = text.match(/(장충|인천|삼산|계양|수원|안산|상록수|의정부|화성|김천|천안|대전|충무|페퍼|광주)/);
                            if (venueMatch) {
                                // Extract the full word/phrase around the match if possible, or mapping
                                // Actually scrapeKovo classifyRegion handles mapping, we just need the string.
                                // Let's try to get the raw text line that contains the venue.
                                const textLines = (row as HTMLElement).innerText.split('\n');
                                venue = textLines.find(l => l.includes('체육관') || l.includes('상록수') || l.includes('스타디움')) || venueMatch[0]; // Fallback to matched keyword
                            }

                            if (homeTeam && awayTeam) {
                                results.push({
                                    date: dateText.replace(/\./g, '-'),
                                    time,
                                    homeTeam,
                                    awayTeam,
                                    homeLogo,
                                    awayLogo,
                                    venue,
                                    fullDate: `${dateText.replace(/\./g, '-')} ${time}`
                                });
                            }
                        });
                    });
                } else {
                    // Fallback for when css-1821gv5 is not found (class name change?)
                    // Try finding all rows and inferring date? No, tough.
                    // Try text parsing fallback if results empty?
                }

                return results;
            });

            console.log(`DOM Scraping complete. Found ${scrapedItems.length} items.`);
            const performances: Performance[] = [];

            for (const item of scrapedItems) {
                const id = `kovo_${item.date.replace(/-/g, '')}_${item.homeTeam}_${item.awayTeam}`;
                const title = `${item.homeTeam} vs ${item.awayTeam}`;

                performances.push({
                    id,
                    title,
                    image: VOLLEYBALL_POSTER,
                    date: item.fullDate,
                    venue: item.venue,
                    link: KOVO_SCHEDULE_URL,
                    region: classifyRegion(item.venue),
                    genre: 'volleyball',
                    homeTeam: item.homeTeam,
                    awayTeam: item.awayTeam,
                    homeTeamLogo: item.homeLogo,
                    awayTeamLogo: item.awayLogo
                });
            }

            console.log(`Total collected: ${performances.length}`);

            if (performances.length > 0) {
                fs.writeFileSync(OUTPUT_PATH, JSON.stringify(performances, null, 2));
                console.log(`Saved to ${OUTPUT_PATH}`);
                return; // Success, exit function
            } else {
                throw new Error('No items collected (0 items).');
            }

        } catch (e) {
            console.error(`Error during scraping (Attempt ${retries + 1}):`, e);
            retries++;
        }
    }

    console.error(`Failed to scrape KOVO data after ${MAX_RETRIES} attempts.`);
    process.exit(1);
}

function classifyRegion(venue: string): string {
    if (!venue) return 'etc';
    if (venue.includes('서울') || venue.includes('장충')) return 'seoul';
    if (venue.includes('인천') || venue.includes('계양') || venue.includes('삼산')) return 'incheon';
    if (venue.includes('수원') || venue.includes('의정부') || venue.includes('안산') || venue.includes('화성')) return 'gyeonggi';
    return 'etc';
}

scrapeKovo().catch(console.error);

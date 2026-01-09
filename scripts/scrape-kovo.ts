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

            // Auto Scroll to load all data
            await autoScroll(page);

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
                            // Past Games: Home(.css-18arn4l), Away(.css-3cjh58)
                            // Future Games: Home(.css-g4ckpe), Away(.css-1h8qpou)

                            const homeImg = row.querySelector('.MuiBox-root.css-18arn4l img') || row.querySelector('.MuiBox-root.css-g4ckpe img');
                            const homeLogo = homeImg?.getAttribute('src') || '';
                            const homeTeamFull = homeImg?.getAttribute('alt') || '';
                            const homeTeam = homeTeamFull.split(' ').pop() || '';

                            const awayImg = row.querySelector('.MuiBox-root.css-3cjh58 img') || row.querySelector('.MuiBox-root.css-1h8qpou img');
                            const awayLogo = awayImg?.getAttribute('src') || '';
                            const awayTeamFull = awayImg?.getAttribute('alt') || '';
                            const awayTeam = awayTeamFull.split(' ').pop() || '';

                            // Venue Extraction
                            let venue = '정보없음';

                            // 1. Try finding the specific venue text node
                            // Based on inspection, venue is often in a span or p tag.
                            // Let's try to find a node that contains '체육관' or '스타디움'
                            const allText = (row as HTMLElement).innerText;
                            const venueMatch = allText.match(/[가-힣\s]*(체육관|스타디움|경기장)/);

                            if (venueMatch) {
                                // Clean up match
                                venue = venueMatch[0].trim();
                                const lines = allText.split('\n');
                                const venueLine = lines.find(l => l.includes('체육관') || l.includes('스타디움') || l.includes('경기장'));
                                if (venueLine) venue = venueLine.trim();
                            } else {
                                // Fallback mapping based on Home Team (using full name from ALT)
                                // If venue is missing from text, infer from Home Team
                                if (homeTeamFull.includes('현대건설')) venue = '수원실내체육관';
                                else if (homeTeamFull.includes('흥국생명')) venue = '인천삼산월드체육관';
                                else if (homeTeamFull.includes('정관장')) venue = '대전충무체육관';
                                else if (homeTeamFull.includes('기업은행')) venue = '화성종합경기타운 실내체육관';
                                else if (homeTeamFull.includes('GS칼텍스') || homeTeamFull.includes('Kixx')) venue = '서울장충체육관';
                                else if (homeTeamFull.includes('도로공사')) venue = '김천실내체육관';
                                else if (homeTeamFull.includes('페퍼저축은행')) venue = '페퍼스타디움';
                                else if (homeTeamFull.includes('대한항공') || homeTeamFull.includes('점보스')) venue = '인천계양체육관';
                                else if (homeTeamFull.includes('현대캐피탈') || homeTeamFull.includes('스카이워커스')) venue = '천안유관순체육관';
                                else if (homeTeamFull.includes('한국전력') || homeTeamFull.includes('빅스톰')) venue = '수원실내체육관';
                                else if (homeTeamFull.includes('우리카드')) venue = '서울장충체육관';
                                else if (homeTeamFull.includes('OK저축은행') || homeTeamFull.includes('읏맨')) venue = '안산상록수체육관';
                                else if (homeTeamFull.includes('삼성화재') || homeTeamFull.includes('블루팡스')) venue = '대전충무체육관';
                                else if (homeTeamFull.includes('KB손해보험') || homeTeamFull.includes('스타즈')) venue = '의정부체육관';
                            }

                            // Specific fix for abbreviated names
                            if (venue === '삼산체육관') venue = '인천삼산월드체육관';

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

async function autoScroll(page: any) {
    await page.evaluate(async () => {
        await new Promise<void>((resolve) => {
            let totalHeight = 0;
            const distance = 100;
            const timer = setInterval(() => {
                const scrollHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;

                if (totalHeight >= scrollHeight) {
                    clearInterval(timer);
                    resolve();
                }
            }, 100);
        });
    });
}

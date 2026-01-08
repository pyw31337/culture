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
            await page.setViewport({ width: 1280, height: 1024 });

            console.log(`Navigating to ${KOVO_SCHEDULE_URL}...`);
            await page.goto(KOVO_SCHEDULE_URL, { waitUntil: 'networkidle2', timeout: 60000 });

            // Ensure page is fully loaded (wait for a known team name)
            try {
                await page.waitForFunction(() => document.body.innerText.includes('대한항공'), { timeout: 10000 });
            } catch (e) {
                console.log('Timeout waiting for "대한항공", proceeding to check content anyway...');
            }

            const textContent = await page.evaluate(() => document.body.innerText);
            await browser.close();

            console.log('Parsing content...');
            const matchLines = textContent.split('\n').map(l => l.trim()).filter(l => l);
            const performances: Performance[] = [];

            let currentDate = '';

            for (let i = 0; i < matchLines.length; i++) {
                const line = matchLines[i];

                // Date Pattern: 2025.10.18 (토)
                const dateMatch = line.match(/^(\d{4})\.(\d{2})\.(\d{2})\s\([가-힣]\)$/);
                if (dateMatch) {
                    currentDate = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
                    continue;
                }

                // Time Pattern: 16:00 or 19:00 (Start of a match block)
                if (line.match(/^\d{2}:\d{2}$/) && currentDate) {
                    const time = line;
                    const venue = matchLines[i + 1];

                    // Search for teams
                    let homeTeam = '';
                    let awayTeam = '';
                    let foundTeams = 0;

                    for (let j = i + 2; j < i + 12 && j < matchLines.length; j++) {
                        const txt = matchLines[j];
                        if (TEAMS.some(t => txt.includes(t))) {
                            const matchedTeam = TEAMS.find(t => txt.includes(t)) || txt;

                            if (foundTeams === 0) {
                                homeTeam = matchedTeam;
                                foundTeams++;
                            } else if (foundTeams === 1) {
                                awayTeam = matchedTeam;
                                foundTeams++;
                                break;
                            }
                        }
                    }

                    if (homeTeam && awayTeam) {
                        const id = `kovo_${currentDate.replace(/-/g, '')}_${homeTeam}_${awayTeam}`;
                        const title = `${homeTeam} vs ${awayTeam}`;

                        performances.push({
                            id,
                            title,
                            image: VOLLEYBALL_POSTER,
                            date: `${currentDate} ${time}`,
                            venue,
                            link: KOVO_SCHEDULE_URL,
                            region: classifyRegion(venue),
                            genre: 'volleyball'
                        });
                    }
                }
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

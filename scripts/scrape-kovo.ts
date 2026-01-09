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

async function scrapeKovo() {
    console.log(`Starting KOVO Scraper (Targeted Selectors)...`);

    const MAX_RETRIES = 3;
    let retries = 0;

    while (retries < MAX_RETRIES) {
        try {
            if (retries > 0) {
                console.log(`Retry attempt ${retries + 1}/${MAX_RETRIES}...`);
                await new Promise(r => setTimeout(r, 5000));
            }

            const browser = await puppeteer.launch({
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
                executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
            });

            const page = await browser.newPage();
            // Set a real User-Agent
            await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
            await page.setViewport({ width: 1280, height: 1024 });

            console.log(`Navigating to ${KOVO_SCHEDULE_URL}...`);
            await page.goto(KOVO_SCHEDULE_URL, { waitUntil: 'networkidle2', timeout: 60000 });

            try {
                await page.waitForSelector('.MuiBox-root', { timeout: 10000 });
            } catch (e) {
                console.log('Timeout waiting for selector, proceeding...');
            }

            // Auto Scroll
            await autoScroll(page);

            const scrapedItems = await page.evaluate(() => {
                const results: any[] = [];
                const TEAMS = [
                    '대한항공', '현대캐피탈', '한국전력', '우리카드', 'OK저축은행', '삼성화재', 'KB손해보험',
                    '현대건설', '흥국생명', '정관장', 'IBK기업은행', 'GS칼텍스', '한국도로공사', '페퍼저축은행'
                ];

                // Strategy: Find Time elements (most stable anchor based on format or class)
                // Use specific class from inspection if available, else fallback to span search
                let timeElements = Array.from(document.querySelectorAll('span.css-hwx9jd'));

                if (timeElements.length === 0) {
                    console.log('Specific time class .css-hwx9jd not found, falling back to regex search');
                    timeElements = Array.from(document.querySelectorAll('span')).filter(s => /^\d{2}:\d{2}$/.test(s.innerText.trim()));
                }

                console.log(`Found ${timeElements.length} time elements`);

                timeElements.forEach(timeEl => {
                    try {
                        const time = timeEl.innerText.trim();
                        // Find the row container. It's an ancestor.
                        let row = timeEl.parentElement;
                        let foundImgs: HTMLImageElement[] = [];
                        let depth = 0;

                        // Traverse up until we find a container that has at least 2 team-like images
                        while (row && depth < 10) {
                            const imgs = Array.from(row.querySelectorAll('img')).filter((img: HTMLImageElement) =>
                                img.src.includes('cdn') || img.src.includes('kovo') || img.src.includes('svg')
                            );
                            if (imgs.length >= 2) {
                                foundImgs = imgs as HTMLImageElement[];
                                break;
                            }
                            row = row.parentElement;
                            depth++;
                        }

                        if (!row || foundImgs.length < 2) return;

                        // Now find Date (Traverse deeper/higher/siblings from the Row)
                        let currentDate = '';
                        // Strategy: Look for the closest preceding date structure
                        // 1. Previous Sibling of Row?
                        // 2. Previous Sibling of Row's Parent?
                        let dateCandidate = row.previousElementSibling;
                        let steps = 0;
                        while (dateCandidate && steps < 10) {
                            if (/^\d{4}\.\d{2}\.\d{2}$/.test((dateCandidate as HTMLElement).innerText.trim())) {
                                currentDate = (dateCandidate as HTMLElement).innerText.trim();
                                break;
                            }
                            dateCandidate = dateCandidate.previousElementSibling;
                            steps++;
                        }

                        // If not found, try going up one level and checking siblings
                        if (!currentDate && row.parentElement) {
                            let parentPrev = row.parentElement.previousElementSibling;
                            while (parentPrev && steps < 20) {
                                const txt = (parentPrev as HTMLElement).innerText;
                                const match = txt.match(/(\d{4}\.\d{2}\.\d{2})/);
                                if (match) {
                                    currentDate = match[1];
                                    break;
                                }
                                parentPrev = parentPrev.previousElementSibling;
                                steps++; // Shared step counter limits infinite search
                            }
                        }

                        if (!currentDate) return;

                        const homeImg = foundImgs[0];
                        const awayImg = foundImgs[1];

                        const homeLogo = homeImg.src;
                        let homeTeam = (homeImg.alt || '').split(' ').pop() || '';

                        const awayLogo = awayImg.src;
                        let awayTeam = (awayImg.alt || '').split(' ').pop() || '';

                        const text = (row as HTMLElement).innerText;

                        // Team Name Fallback
                        if (!TEAMS.includes(homeTeam)) {
                            const foundHome = TEAMS.find(t => text.includes(t));
                            if (foundHome) homeTeam = foundHome;
                        }
                        if (!TEAMS.includes(awayTeam)) {
                            // Try to find away team by removing home team
                            const remaining = text.replace(homeTeam, '');
                            const foundAway = TEAMS.find(t => remaining.includes(t));
                            if (foundAway) awayTeam = foundAway;
                        }

                        if (!homeTeam || !awayTeam) return;

                        // Venue Extraction
                        let venue = '정보없음';
                        // Try specific venue class if possible
                        const venueEl = row.querySelector('.css-1og2kxg');
                        if (venueEl) {
                            venue = (venueEl as HTMLElement).innerText.trim();
                        } else {
                            const venueMatch = text.match(/[가-힣\s]*(체육관|스타디움|경기장)/);
                            if (venueMatch) venue = venueMatch[0].trim();
                        }

                        // Fallback Mappings
                        if (venue === '정보없음' || venue.length < 2) {
                            if (homeTeam.includes('현대건설')) venue = '수원실내체육관';
                            else if (homeTeam.includes('흥국생명')) venue = '인천삼산월드체육관';
                            else if (homeTeam.includes('정관장')) venue = '대전충무체육관';
                            else if (homeTeam.includes('IBK')) venue = '화성종합경기타운';
                            else if (homeTeam.includes('GS')) venue = '장충체육관';
                            else if (homeTeam.includes('도로공사')) venue = '김천실내체육관';
                            else if (homeTeam.includes('페퍼')) venue = '페퍼스타디움';
                            else if (homeTeam.includes('대한항공')) venue = '계양체육관';
                            else if (homeTeam.includes('현대캐피탈')) venue = '천안유관순체육관';
                            else if (homeTeam.includes('한국전력')) venue = '수원실내체육관';
                            else if (homeTeam.includes('우리카드')) venue = '장충체육관';
                            else if (homeTeam.includes('OK')) venue = '안산상록수체육관';
                            else if (homeTeam.includes('삼성화재')) venue = '대전충무체육관';
                            else if (homeTeam.includes('KB')) venue = '의정부체육관';
                        }
                        if (venue === '삼산체육관') venue = '인천삼산월드체육관';

                        results.push({
                            date: currentDate.replace(/\./g, '-'),
                            time,
                            homeTeam,
                            awayTeam,
                            homeLogo,
                            awayLogo,
                            venue,
                            fullDate: `${currentDate.replace(/\./g, '-')} ${time}`
                        });

                    } catch (e) {
                        // ignore
                    }
                });

                return results;
            });

            console.log(`DOM Scraping complete. Found ${scrapedItems.length} items.`);
            await browser.close();

            const performances: Performance[] = scrapedItems.map((item: any) => ({
                id: `kovo_${item.date.replace(/-/g, '')}_${item.homeTeam}_${item.awayTeam}`.replace(/\s+/g, ''),
                title: `[배구] ${item.homeTeam} vs ${item.awayTeam}`,
                image: item.image || VOLLEYBALL_POSTER,
                date: item.fullDate,
                venue: item.venue,
                link: KOVO_SCHEDULE_URL,
                region: classifyRegion(item.venue),
                genre: 'volleyball',
                homeTeam: item.homeTeam,
                awayTeam: item.awayTeam,
                homeTeamLogo: item.homeLogo,
                awayTeamLogo: item.awayLogo
            }));

            if (performances.length > 0) {
                fs.writeFileSync(OUTPUT_PATH, JSON.stringify(performances, null, 2));
                console.log(`Saved to ${OUTPUT_PATH}`);
                return;
            } else {
                console.log('No items found (0 length). Retrying...');
                retries++;
            }

        } catch (error) {
            console.error(`Error (attempt ${retries + 1}):`, error);
            retries++;
        }
    }
}

function classifyRegion(venue: string): string {
    if (venue.includes('서울')) return 'seoul';
    if (venue.includes('인천') || venue.includes('경기') || venue.includes('수원') || venue.includes('안산') || venue.includes('화성') || venue.includes('의정부')) return 'gyeonggi';
    if (venue.includes('강원')) return 'gangwon';
    if (venue.includes('충청') || venue.includes('천안') || venue.includes('대전')) return 'chungcheong';
    if (venue.includes('전라') || venue.includes('광주')) return 'jeolla';
    if (venue.includes('경상') || venue.includes('부산') || venue.includes('대구') || venue.includes('김천')) return 'gyeongsang';
    if (venue.includes('제주')) return 'jeju';
    return 'seoul';
}

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

scrapeKovo();

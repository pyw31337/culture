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

const TARGET_URL = 'https://www.koreahandball.com/game/schedule_list.php';
const OUTPUT_PATH = path.resolve(process.cwd(), 'src/data/handball.json');
const HANDBALL_POSTER = '/images/handball_poster.png'; // Placeholder or generic

function getKstTodayStart() {
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });
    const [year, month, day] = formatter.format(new Date()).split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day));
}

function getScheduleDate(value: string) {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return null;
    return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

function isUpcomingOrToday(value: string) {
    const scheduleDate = getScheduleDate(value);
    if (!scheduleDate) return false;
    return scheduleDate >= getKstTodayStart();
}

async function scrapeHandball() {
    console.log(`Starting Korea Handball Scraper...`);
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 1024 });

        console.log(`Navigating to ${TARGET_URL}...`);
        await page.goto(TARGET_URL, { waitUntil: 'networkidle2', timeout: 60000 });

        // Wait for table to ensure load
        try {
            await page.waitForSelector('.record_table.pc_only table tbody tr', { timeout: 30000 });
        } catch (e) {
            console.log('Table not found or timed out');
        }

        const performances: Performance[] = (await page.evaluate(`(() => {
            const rows = Array.from(document.querySelectorAll('.record_table.pc_only table tbody tr'));
            const results = [];
            let currentDate = '';

            function slugify(text) {
                return text
                    .replace(/[^a-zA-Z0-9가-힣]/g, '_')
                    .replace(/_+/g, '_')
                    .replace(/^_|_$/g, '');
            }

            rows.forEach(tr => {
                const cells = Array.from(tr.children);
                if (cells.length === 0) return;

                let dateStr = '';
                let timeStr = '';
                let venueStr = '';
                let teamsStr = '';

                // Check if this row initiates a new date (first cell has date pattern)
                const firstCellText = cells[0].innerText.trim();
                const dateMatch = firstCellText.match(/(\\d{4})\\.(\\d{2})\\.(\\d{2})/);

                let contentCell = null;

                if (dateMatch) {
                    // New Date Row
                    currentDate = \`\${dateMatch[1]}-\${dateMatch[2]}-\${dateMatch[3]}\`;
                    dateStr = currentDate;
                    timeStr = cells[1]?.innerText.trim() || '00:00';
                    contentCell = cells[3];
                    venueStr = cells[5]?.innerText.trim() || '';
                } else {
                    // Continuation Row (No date cell)
                    if (!currentDate) return; 
                    dateStr = currentDate;
                    timeStr = cells[0]?.innerText.trim() || '00:00';
                    contentCell = cells[2];
                    venueStr = cells[4]?.innerText.trim() || '';
                }

                // Extract Teams and Logos from Content Cell
                const HANDBALL_LOGOS = {
                    "두산": "/images/logos/handball/doosan_official.png",
                    "SK호크스": "/images/logos/handball/sk_hawks_official.png",
                    "하남시청": "/images/logos/handball/hanam_official.png",
                    "상무 피닉스": "/images/logos/handball/sangmu_official.png",
                    "인천도시공사": "/images/logos/handball/incheon_official.png",
                    "충남도청": "/images/logos/handball/chungnam_official.png",
                    "상무": "/images/logos/handball/sangmu_official.png",
                    "대구광역시청": "/images/logos/handball/daegu_official.png",
                    "경남개발공사": "/images/logos/handball/gyeongnam_official.png",
                    "삼척시청": "/images/logos/handball/samcheok_official.png",
                    "서울시청": "/images/logos/handball/seoul_official.png",
                    "광주도시공사": "/images/logos/handball/gwangju_official.png",
                    "부산시설공단": "/images/logos/handball/busan_official.png",
                    "인천광역시청": "/images/logos/handball/incheon_women_official.png"
                };

                const VENUE_MAP = {
                    "SK핸드볼경기장": "올림픽공원SK핸드볼경기장",
                    "기장체육관": "부산기장체육관",
                    "남동체육관": "인천남동체육관",
                    "광명체육관": "광명시민체육관",
                    "수원체육관": "수원실내체육관",
                    "빛고을체육관": "광주빛고을체육관",
                    "청주대석우문화체육관": "청주대학교석우문화체육관"
                };

                let homeTeam = '';
                let awayTeam = '';
                let homeTeamLogo = '';
                let awayTeamLogo = '';

                if (contentCell) {
                    const homeEl = contentCell.querySelector('.team.home .name');
                    const awayEl = contentCell.querySelector('.team.away .name');

                    if (homeEl) homeTeam = homeEl.innerText.trim();
                    if (awayEl) awayTeam = awayEl.innerText.trim();

                    homeTeamLogo = HANDBALL_LOGOS[homeTeam] || '';
                    awayTeamLogo = HANDBALL_LOGOS[awayTeam] || '';
                }

                if (homeTeam && awayTeam) {
                    const title = \`\${homeTeam} vs \${awayTeam}\`;
                    const safeMatchup = slugify(title);
                    results.push({
                        id: \`handball_\${dateStr.replace(/-/g, '')}_\${safeMatchup}\`,
                        title,
                        date: \`\${dateStr} \${timeStr}\`,
                        venue: (typeof VENUE_MAP !== 'undefined' && VENUE_MAP[venueStr]) ? VENUE_MAP[venueStr] : venueStr,
                        link: 'https://www.koreahandball.com/game/schedule_list.php',
                        genre: 'handball',
                        homeTeam,
                        awayTeam,
                        homeTeamLogo,
                        awayTeamLogo
                    });
                }
            });

            return results;
        })()`)) as any;

        // Post-process to add region and image
        const finalData = performances
            .filter((p) => process.env.SCRAPE_KEEP_PAST_SPORTS === '1' || isUpcomingOrToday(p.date))
            .map(p => ({
                ...p,
                image: HANDBALL_POSTER,
                region: classifyRegion(p.venue)
            }));

        console.log(`Total matches collected: ${performances.length}`);
        console.log(`Upcoming/current matches retained: ${finalData.length}`);
        if (performances.length > 0 && finalData.length === 0) {
            console.log('No upcoming handball matches remain. Writing an empty seasonal file so the category stays hidden until the season returns.');
        }
        fs.writeFileSync(OUTPUT_PATH, JSON.stringify(finalData, null, 2));
        console.log(`Saved to ${OUTPUT_PATH}`);

    } finally {
        await browser.close();
    }
}

function classifyRegion(venue: string): string {
    if (!venue) return 'etc';
    if (venue.includes('서울') || venue.includes('SK핸드볼') || venue.includes('핸드볼경기장')) return 'seoul';
    if (venue.includes('인천') || venue.includes('남동')) return 'incheon';
    if (venue.includes('광명') || venue.includes('수원')) return 'gyeonggi';
    if (venue.includes('부산') || venue.includes('기장체육관') || venue.match(/\b기장\b/)) return 'busan';
    if (venue.includes('대구')) return 'daegu';
    if (venue.includes('광주')) return 'gwangju';
    if (venue.includes('청주') || venue.includes('충북')) return 'etc'; // Example for others
    return 'etc';
}

scrapeHandball().then(() => {
    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});

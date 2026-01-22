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
const HANDBALL_POSTER = '/culture/images/handball_poster.png'; // Placeholder or generic

async function scrapeHandball() {
    console.log(`Starting Korea Handball Scraper...`);
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 1024 });

    console.log(`Navigating to ${TARGET_URL}...`);
    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });

    // Wait for table to ensure load
    try {
        await page.waitForSelector('.record_table.pc_only table tbody tr', { timeout: 10000 });
    } catch (e) {
        console.log('Table not found or timed out');
    }

    const performances: Performance[] = await page.evaluate(() => {
        const rows = Array.from(document.querySelectorAll('.record_table.pc_only table tbody tr'));
        const results: any[] = [];
        let currentDate = '';

        rows.forEach(tr => {
            const cells = Array.from(tr.children) as HTMLElement[];
            if (cells.length === 0) return;

            let dateStr = '';
            let timeStr = '';
            let venueStr = '';
            let teamsStr = '';

            // Check if this row initiates a new date (first cell has date pattern)
            const firstCellText = cells[0].innerText.trim();
            const dateMatch = firstCellText.match(/(\d{4})\.(\d{2})\.(\d{2})/);

            let contentCell: HTMLElement | null = null;

            if (dateMatch) {
                // New Date Row
                currentDate = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
                dateStr = currentDate;
                timeStr = cells[1]?.innerText.trim() || '00:00';
                contentCell = cells[2] as HTMLElement;
                venueStr = cells[4]?.innerText.trim() || '';
                // Note: Index 4 based on diagnostic (Date, Time, Content, Broadcaster, Venue, ...)
                // Diagnostic showed: 
                // 0: Date
                // 1: Time
                // 2: Content
                // 3: Broadcaster
                // 4: Venue
            } else {
                // Continuation Row (No date cell)
                if (!currentDate) return; // Should not happen if data is sorted
                dateStr = currentDate;
                timeStr = cells[0]?.innerText.trim() || '00:00';
                contentCell = cells[1] as HTMLElement;
                venueStr = cells[3]?.innerText.trim() || '';
                // Diagnostic showed:
                // 0: Time
                // 1: Content
                // 2: Broadcaster
                // 3: Venue
            }

            // Extract Teams and Logos from Content Cell
            const HANDBALL_LOGOS = {
                "두산": "/images/logos/handball/doosan_official.png",
                "SK호크스": "/images/logos/handball/sk_hawks_official.png",
                "하남시청": "/images/logos/handball/hanam_official.png",
                "상무 피닉스": "/images/logos/handball/sangmu_official.png",
                "충남도청": "/images/logos/handball/chungnam_official.png",
                "인천도시공사": "/images/logos/handball/incheon_official.png",
                "SK슈가글라이더즈": "/images/logos/handball/sk_sugar_official.png",
                "광주도시공사": "/images/logos/handball/gwangju_official.png",
                "서울시청": "/images/logos/handball/seoul_official.png",
                "인천광역시청": "/images/logos/handball/incheon_city_official.png",
                "부산시설공단": "/images/logos/handball/busan_official.png",
                "경남개발공사": "/images/logos/handball/gyeongnam_official.png",
                "삼척시청": "/images/logos/handball/samcheok_official.png",
                "대구광역시청": "/images/logos/handball/daegu_official.png"
            };

            let homeTeam = '';
            let awayTeam = '';
            let homeTeamLogo = '';
            let awayTeamLogo = '';

            if (contentCell) {
                const homeEl = contentCell.querySelector('.team.home .name');
                const awayEl = contentCell.querySelector('.team.away .name');

                if (homeEl) homeTeam = (homeEl as HTMLElement).innerText.trim();
                if (awayEl) awayTeam = (awayEl as HTMLElement).innerText.trim();

                homeTeamLogo = (HANDBALL_LOGOS as any)[homeTeam] || '';
                awayTeamLogo = (HANDBALL_LOGOS as any)[awayTeam] || '';
            }

            if (homeTeam && awayTeam) {
                results.push({
                    id: `handball_${dateStr.replace(/-/g, '')}_${homeTeam}_${awayTeam}`,
                    title: `${homeTeam} vs ${awayTeam}`,
                    date: `${dateStr} ${timeStr}`,
                    venue: venueStr,
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
    });

    // Post-process to add region and image
    const finalData = performances.map(p => ({
        ...p,
        image: HANDBALL_POSTER,
        region: classifyRegion(p.venue)
    }));

    console.log(`Total matches collected: ${finalData.length}`);
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(finalData, null, 2));
    console.log(`Saved to ${OUTPUT_PATH}`);

    await browser.close();
}

function classifyRegion(venue: string): string {
    if (!venue) return 'etc';
    if (venue.includes('서울') || venue.includes('SK핸드볼')) return 'seoul';
    if (venue.includes('인천') || venue.includes('남동')) return 'incheon';
    if (venue.includes('광명') || venue.includes('수원')) return 'gyeonggi';
    if (venue.includes('부산') || venue.includes('기장')) return 'busan';
    if (venue.includes('대구')) return 'daegu';
    if (venue.includes('광주')) return 'gwangju';
    return 'etc';
}

scrapeHandball().catch(console.error);

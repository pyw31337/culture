import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';
import path from 'path';

puppeteer.use(StealthPlugin());

interface Performance {
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

const OUTPUT_PATH = path.resolve(process.cwd(), 'src/data/kbo.json');
const THUMBNAIL_PATH = '/culture/images/kbo-thumbnail.png'; // Path in public

// Venue Mapping
const VENUE_MAP: Record<string, string> = {
    '잠실': '잠실종합운동장잠실야구장',
    '문학': '인천SSG 랜더스필드',
    '수원': '수원KT위즈파크',
    '고척': '고척스카이돔',
    '광주': '광주기아챔피언스필드',
    '대구': '대구삼성라이온즈파크',
    '대전': '한화생명이글스파크', // Or new stadium if opened in 2026? Stick to standard map.
    '사직': '부산사직종합운동장사직야구장',
    '창원': '창원NC파크',
    '포항': '포항야구장',
    '울산': '울산문수야구장',
    '청주': '청주야구장',
    // Futures/Exhibition might have others
    '이천': '이천LG챔피언스파크', // Or Doosan
    '상동': '상동야구장',
    '함평': '함평기아챌린저스필드',
    '경산': '삼성라이온즈볼파크',
    '강화': 'SSG퓨처스필드',
    '서산': '한화이글스서산구장'
};

function mapVenue(rawVenue: string): string {
    const cleaned = rawVenue.trim();
    return VENUE_MAP[cleaned] || cleaned;
}

function classifyRegion(venue: string): string {
    const v = venue;
    if (v.includes('잠실') || v.includes('고척') || v.includes('서울')) return 'seoul';
    if (v.includes('수원') || v.includes('이천') || v.includes('고양')) return 'gyeonggi';
    if (v.includes('인천') || v.includes('문학') || v.includes('강화')) return 'incheon';
    return 'etc';
}

async function scrapeKBO() {
    console.log(`Starting KBO Scraper...`);
    const browser = await puppeteer.launch({
        headless: true, // Run headless
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--window-size=1280,1024'
        ],
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 1024 });
    const TARGET_URL = 'https://www.koreabaseball.com/Schedule/Schedule.aspx';
    await page.goto(TARGET_URL, { waitUntil: 'networkidle2', timeout: 60000 });

    const allPerformances: Performance[] = [];
    const seenIds = new Set<string>();

    // 2026 Year
    const TARGET_YEAR = '2026';
    // Series: 1 (Exhibition), 0,9,6 (Regular - catch all?), 3,4,5,7 (Post)
    // Actually, looking at KBO logic, '0,9,6' is typically regular season + etc.
    // The dropdown values might be distinct.
    // Let's iterate months first, then check if we need to switch series?
    // Actually, KBO page behavior: Year -> Month -> Series.
    // If we select Month, it updates. Series usually defaults or persists.
    // We should try to scrape distinct Series batches.
    // Series IDs to iterate:
    // Regular: '0,9,6'
    // Exhibition: '1'
    // Post: '3,4,5,7'
    const SERIES_LIST = [
        { id: '1', name: 'Exhibition' },
        { id: '0,9,6', name: 'Regular' },
        { id: '3,4,5,7', name: 'Post' }
    ];

    // Months 01 - 12
    const MONTHS = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];

    // Helper to select dropdown and wait for update
    async function selectOption(selector: string, value: string) {
        const currentVal = await page.$eval(selector, el => (el as HTMLSelectElement).value);
        if (currentVal === value) return; // Already selected

        console.log(`Selecting ${selector} = ${value}`);
        // KBO triggers postback on change
        // We catch the navigation or ajax
        // Promise.all to ensure we don't miss the event
        // Note: Sometimes it hangs if we wait for navigation that doesn't happen (AJAX)
        // KBO uses ASP.NET UpdatePanel mostly? Or full postback?
        // Let's try waiting for networkidle first.

        await Promise.all([
            // page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 5000 }).catch(() => {}), // catch timeout if it's just ajax
            // actually, better to wait for a known element to stabilize or disappear/reappear
            // simple sleep might be safer if unsure
            page.select(selector, value)
        ]);
        // Give time for update
        await new Promise(r => setTimeout(r, 2000));
    }

    // Set Year First
    try {
        await selectOption('#ddlYear', TARGET_YEAR);
    } catch (e: any) {
        console.error(`Error selecting year ${TARGET_YEAR}: ${e}`);
    }

    // Team Logo Map (Extracted from Probe)
    const TEAM_LOGOS: Record<string, string> = {
        "LG": "https://6ptotvmi5753.edge.naverncp.com/KBO_IMAGE/emblem/regular/2026/initial_LG.png",
        "한화": "https://6ptotvmi5753.edge.naverncp.com/KBO_IMAGE/emblem/regular/2026/initial_HH.png",
        "SSG": "https://6ptotvmi5753.edge.naverncp.com/KBO_IMAGE/emblem/regular/2026/initial_SK.png",
        "삼성": "https://6ptotvmi5753.edge.naverncp.com/KBO_IMAGE/emblem/regular/2026/initial_SS.png",
        "NC": "https://6ptotvmi5753.edge.naverncp.com/KBO_IMAGE/emblem/regular/2026/initial_NC.png",
        "KT": "https://6ptotvmi5753.edge.naverncp.com/KBO_IMAGE/emblem/regular/2026/initial_KT.png",
        "롯데": "https://6ptotvmi5753.edge.naverncp.com/KBO_IMAGE/emblem/regular/2026/initial_LT.png",
        "KIA": "https://6ptotvmi5753.edge.naverncp.com/KBO_IMAGE/emblem/regular/2026/initial_HT.png",
        "두산": "https://6ptotvmi5753.edge.naverncp.com/KBO_IMAGE/emblem/regular/2026/initial_OB.png",
        "키움": "https://6ptotvmi5753.edge.naverncp.com/KBO_IMAGE/emblem/regular/2026/initial_WO.png"
    };

    // Futures League Team Logos (emblemF versions)
    const FUTURES_TEAM_LOGOS: Record<string, string> = {
        "한화": "https://6ptotvmi5753.edge.naverncp.com/KBO_IMAGE/emblem/regular/2026/emblemF_HH.png",
        "LG": "https://6ptotvmi5753.edge.naverncp.com/KBO_IMAGE/emblem/regular/2026/emblemF_LG.png",
        "SSG": "https://6ptotvmi5753.edge.naverncp.com/KBO_IMAGE/emblem/regular/2026/emblemF_SK.png",
        "두산": "https://6ptotvmi5753.edge.naverncp.com/KBO_IMAGE/emblem/regular/2026/emblemF_OB.png",
        "고양": "https://6ptotvmi5753.edge.naverncp.com/KBO_IMAGE/emblem/regular/2026/emblemF_WO.png",
        "상무": "https://6ptotvmi5753.edge.naverncp.com/KBO_IMAGE/emblem/regular/2026/emblemF_SM.png",
        "KT": "https://6ptotvmi5753.edge.naverncp.com/KBO_IMAGE/emblem/regular/2026/emblemF_KT.png",
        "NC": "https://6ptotvmi5753.edge.naverncp.com/KBO_IMAGE/emblem/regular/2026/emblemF_NC.png",
        "롯데": "https://6ptotvmi5753.edge.naverncp.com/KBO_IMAGE/emblem/regular/2026/emblemF_LT.png",
        "삼성": "https://6ptotvmi5753.edge.naverncp.com/KBO_IMAGE/emblem/regular/2026/emblemF_SS.png",
        "KIA": "https://6ptotvmi5753.edge.naverncp.com/KBO_IMAGE/emblem/regular/2026/emblemF_HT.png"
    };

    // Scrape Futures Logos
    try {
        console.log('Fetching Futures League Logos...');
        const FUTURES_URL = 'https://www.koreabaseball.com/Futures/Schedule/GameList.aspx';
        await page.goto(FUTURES_URL, { waitUntil: 'networkidle2', timeout: 30000 });

        const futuresLogos = await page.evaluate(() => {
            const ul = document.querySelector('#cphContents_cphContents_cphContents_udpRecord > ul');
            if (!ul) return [];

            return Array.from(ul.querySelectorAll('li')).map(li => {
                const img = li.querySelector('img');
                const span = li.querySelector('span');
                if (!img || !span) return null;
                const name = span.textContent?.trim() || '';
                const src = img.src;
                if (name === '전체') return null;
                return { name, src };
            }).filter(Boolean) as { name: string, src: string }[];
        });

        console.log(`Found ${futuresLogos.length} Futures teams.`);
        futuresLogos.forEach(item => {
            // "고양" replaces "Goyang" etc.
            if (!TEAM_LOGOS[item.name]) {
                TEAM_LOGOS[item.name] = item.src;
                console.log(`Added logo for ${item.name}`);
            } else {
                // Update existing if needed? KBO logos might differ for Futures (e.g. "emblemF_HH.png")
                // User said "put logos... here". Maybe overwrite? 
                // Regular logos are usually preferred for main teams.
                // Let's keep Regular unless missing.
            }
        });

    } catch (e) {
        console.error('Failed to fetch futures logos:', e);
    }

    // Navigate back to Standard Schedule for main scraping
    console.log('Navigating back to Regular Schedule...');
    await page.goto(TARGET_URL, { waitUntil: 'networkidle2', timeout: 60000 });

    for (const series of SERIES_LIST) {
        console.log(`\n--- Scraping Series: ${series.name} (${series.id}) ---`);

        try {
            await selectOption('#ddlSeries', series.id);
        } catch (e: any) {
            console.log(`Skipping series ${series.name} (maybe unavailable): ${e.message}`);
            continue;
        }

        for (const month of MONTHS) {
            // console.log(`  Checking Month: ${month}`);
            try {
                // Select Month
                await selectOption('#ddlMonth', month);

                // Scrape Table
                // Selector: #tblScheduleList > tbody > tr
                const rows = await page.$$eval('#tblScheduleList > tbody > tr', (trs) => {
                    return trs.map(tr => {
                        // Check empty/no schedule
                        if ((tr as HTMLElement).innerText.includes('데이터가 없습니다')) return null;

                        // Columns:
                        // 1: day (e.g. "03.09(토)") - NOTE: "day" class might be on the TD
                        // 2: time (e.g. "13:00")
                        // 3: play (e.g. "LG vs 한화")
                        // ...
                        // 8: venue (e.g. "잠실")

                        const dayEl = tr.querySelector('.day');
                        const timeEl = tr.querySelector('.time');
                        const playEl = tr.querySelector('.play');
                        // Venue is 8th td? OR 7th?
                        // Let's get all TDs
                        const tds = Array.from(tr.querySelectorAll('td'));
                        // Usually: Day, Time, Play, Relay, ... , Venue, ...
                        // Venue is often near the end.
                        // User says: nth-child(8) -> index 7
                        const venueEl = tds[7];

                        if (!dayEl || !timeEl || !playEl || !venueEl) return null;

                        return {
                            day: dayEl.textContent?.trim(),
                            time: timeEl.textContent?.trim(),
                            play: playEl.textContent?.trim(),
                            venue: venueEl.textContent?.trim()
                        };
                    });
                });

                // Process Rows
                let currentDay = ''; // The 'day' col sometimes merges rows? KBO usually repeats or matches
                // Actually KBO site structure:
                // If multiple games on same day, "day" cell might assume rowspan?
                // Let's inspect user description: "#tblScheduleList > tbody > tr:nth-child(1) > td.day"
                // Puppeteer $$eval iterates TRs. If rowspan is used, subsequent TRs might miss the 'day' column if it's physically missing in DOM structure (only in first TR).
                // But typically `td.day` exists?
                // Wait, if rowspan is used, subsequent trs will have fewer TDs and NO day td.
                // We need to handle rowspan logic.
                // Or simplified: KBO schedule usually shows date for every game?
                // Let's check logic: if day is empty/null, use previous?
                // But if rowspan is used, the 'row' object from eval won't have the day text if the element is not there.
                // ACTUALLY: `page.$$eval` runs on the distinct TR elements.
                // If `td.day` has `rowspan="5"`, the next 4 trs will NOT have that `td` as a child.
                // So `tr.querySelector('.day')` will be null for them.

                // We need to reconstruct the data carefully.
                // Better to grab raw text of ALL tds and logic it out?
                // Or just do a client-side iteration in evaluate that handles state.

            } catch (e) {
                // console.error(`Error scraping ${month}: ${e}`);
            }
        }
    }

    // Redoing extraction logic with rowspans in mind
    // Reset page to initial state? No, iterate again properly.
    // Actually, let's just push the logic into the evaluate function.

    // We need to iterate again with the "Robust" evaluate
    console.log("Starting Main Extraction Loop...");

    for (const series of SERIES_LIST) {
        // Force refresh series selection to be safe
        console.log(`Series: ${series.name}`);
        await selectOption('#ddlSeries', series.id);

        for (const month of MONTHS) {
            console.log(`  Month: ${month}`);
            await selectOption('#ddlMonth', month);

            const results = await page.evaluate((targetYear) => {
                const rows = Array.from(document.querySelectorAll('#tblScheduleList > tbody > tr'));
                const scraped = [];
                let lastDate = '';

                for (const tr of rows) {
                    if ((tr as HTMLElement).innerText.includes('데이터가 없습니다')) continue;

                    const tds = Array.from(tr.querySelectorAll('td'));

                    // Handle Rowspan / Missing Date Column
                    // If rowspan was active, this row has fewer cells?
                    // First col is Day. Second is Time.
                    // If Day is present (className='day'), update lastDate.
                    // If not present, use lastDate.

                    let dayText = '';
                    let timeText = '';
                    let playText = '';
                    let venueText = '';

                    // Check if first cell has class 'day'
                    const firstTd = tds[0];
                    if (firstTd && firstTd.classList.contains('day')) {
                        dayText = firstTd.innerText.trim();
                        lastDate = dayText; // Update current date

                        // If day is present, Time is next (index 1), Play (2), ... Venue (7 / index 7 if 0-based?)
                        // User said venue is nth-child(8) -> index 7.
                        // Day(1), Time(2), Play(3), Relay(4), TV(5), Radio(6), Mobile(7), Venue(8) -> Index 7
                        timeText = tds[1]?.innerText.trim() || '';
                        playText = tds[2]?.innerText.trim() || '';
                        venueText = tds[7]?.innerText.trim() || '';
                    } else {
                        // Date column is missing due to rowspan in previous row
                        // So columns shift left by 1
                        // Time(0), Play(1), ... Venue(6)
                        dayText = lastDate;
                        timeText = tds[0]?.innerText.trim() || '';
                        playText = tds[1]?.innerText.trim() || '';
                        venueText = tds[6]?.innerText.trim() || '';
                    }

                    if (playText && venueText) {
                        scraped.push({
                            dateStr: dayText, // "01.01(금)"
                            time: timeText,   // "18:30"
                            title: playText.replace('vs', ' vs '), // "LG vs KT"
                            venue: venueText,
                            year: targetYear
                        });
                    }
                }
                return scraped;
            }, TARGET_YEAR);

            // Process results
            for (const item of results) {
                // Parse date "03.09(토)" -> "2026-03-09"
                // Remove day of week
                const datePart = item.dateStr.split('(')[0]; // "03.09"
                const isoDate = `${item.year}-${datePart.replace('.', '-')}`; // "2026-03-09"

                // Construct ID
                // kbo_20260309_LG_KT
                const cleanTitle = item.title.replace(/\s/g, '');
                const id = `kbo_${isoDate.replace(/-/g, '')}_${cleanTitle}`;

                if (seenIds.has(id)) continue;
                seenIds.add(id);

                const mappedVenue = mapVenue(item.venue);

                // Parse Teams (Assuming standard "Away vs Home" schedule format)
                // e.g. "한화 vs LG" (at Jamsil) -> Hanwha(Away), LG(Home)
                const parts = item.title.split('vs');
                let homeTeam = '';
                let awayTeam = '';
                let homeTeamLogo = '';
                let awayTeamLogo = '';

                if (parts.length === 2) {
                    homeTeam = parts[0].trim();
                    awayTeam = parts[1].trim();

                    homeTeamLogo = TEAM_LOGOS[homeTeam] || '';
                    awayTeamLogo = TEAM_LOGOS[awayTeam] || '';
                }

                allPerformances.push({
                    id,
                    title: item.title,
                    image: THUMBNAIL_PATH,
                    date: `${isoDate} ${item.time}`,
                    venue: mappedVenue,
                    link: TARGET_URL, // Link to schedule page
                    region: classifyRegion(mappedVenue),
                    genre: 'baseball',
                    homeTeam,
                    awayTeam,
                    homeTeamLogo,
                    awayTeamLogo
                });
            }
        }
    }

    console.log(`Total collected: ${allPerformances.length}`);

    // Load existing data for persistence
    let existingItems: any[] = [];
    if (fs.existsSync(OUTPUT_PATH)) {
        try {
            const fileContent = fs.readFileSync(OUTPUT_PATH, 'utf-8');
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
    allPerformances.forEach(newItem => {
        if (itemMap.has(newItem.id)) {
            itemMap.set(newItem.id, { ...newItem, ...itemMap.get(newItem.id) });
        } else {
            itemMap.set(newItem.id, newItem);
        }
    });

    const finalItems = Array.from(itemMap.values());
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(finalItems, null, 2));
    console.log(`Saved ${finalItems.length} items to ${OUTPUT_PATH} (Merged with existing data)`);
    await browser.close();
}

scrapeKBO().catch(console.error);

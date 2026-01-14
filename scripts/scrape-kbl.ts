import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const KBL_URL = 'https://www.kbl.or.kr/match/schedule';
const KBL_POSTER = '/culture/images/kbl_poster.png';
const OUTPUT_PATH = path.resolve(process.cwd(), 'src/data/kbl.json');

async function scrapeKbl() {
    const KBL_LOGOS: Record<string, string> = {
        "서울 SK": "https://www.kbl.or.kr/assets/img/ico/logo/ic-sk.svg",
        "원주 DB": "https://www.kbl.or.kr/assets/img/ico/logo/ic-db.svg",
        "울산 현대모비스": "https://www.kbl.or.kr/assets/img/ico/logo/ic-hd.svg",
        "서울 삼성": "https://www.kbl.or.kr/assets/img/ico/logo/ic-ss.svg",
        "고양 소노": "https://www.kbl.or.kr/assets/img/ico/logo/ic-sono.svg",
        "대구 한국가스공사": "https://www.kbl.or.kr/assets/img/ico/logo/ic-pega.svg",
        "안양 정관장": "https://www.kbl.or.kr/assets/img/ico/logo/ic-kgc.svg",
        "창원 LG": "https://www.kbl.or.kr/assets/img/ico/logo/ic-lg.svg",
        "수원 KT": "https://www.kbl.or.kr/assets/img/ico/logo/ic-kt.svg",
        "부산 KCC": "https://www.kbl.or.kr/assets/img/ico/logo/ic-kcc.svg",
        "상무": "https://www.kbl.or.kr/assets/img/ico/logo/ic-kaf.svg",
        "소노": "https://www.kbl.or.kr/assets/img/ico/logo/ic-sono.svg"
    };

    console.log(`Starting KBL Scraper (UI Interaction)...`);

    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 1024 });
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    const collectedMatches: any[] = [];

    // 1. Setup Network Listener
    page.on('response', async res => {
        const url = res.url();
        if (url.includes('match/list') && res.status() === 200 && res.request().method() === 'GET') {
            try {
                const json = await res.json();
                const list = Array.isArray(json) ? json : (json.list || []);
                console.log(`Captured API response with ${list.length} matches from ${url}`);
                if (list.length > 0) {
                    console.log('Sample Match Data:', JSON.stringify(list[list.length - 1], null, 2));
                }
                collectedMatches.push(...list);
            } catch (e) {
                console.error('Error parsing response:', e);
            }
        }
    });

    // 2. Navigate (Triggers Jan data)
    console.log(`Navigating to ${KBL_URL}...`);
    await page.goto(KBL_URL, { waitUntil: 'networkidle2', timeout: 60000 });


    // 4. Click Next Month button 3 times (Feb, Mar, Apr)
    // Selector: .ic-date-nav-next or parent button
    try {
        const nextBtnSelector = '.ic-date-nav-next';
        await page.waitForSelector(nextBtnSelector, { timeout: 10000 });

        for (let i = 0; i < 3; i++) {
            console.log(`Clicking next month (${i + 1}/3)...`);
            try {
                // Ensure button is clickable
                await page.waitForSelector(nextBtnSelector, { visible: true, timeout: 5000 });
                await page.click(nextBtnSelector);
                // Wait for network activity
                await new Promise(r => setTimeout(r, 3000));
            } catch (clickErr) {
                console.log('Next button click failed/timeouts, stopping navigation:', clickErr);
                break;
            }
        }
    } catch (e) {
        console.error('Error in navigation sequence:', e);
    }

    // 5. Process Data
    const allPerformances: any[] = [];
    const seenIds = new Set<string>();

    for (const match of collectedMatches) {
        const d = match.gameDate;
        if (!d || d.length !== 8) continue;

        const dateStr = `${d.substring(0, 4)}-${d.substring(4, 6)}-${d.substring(6, 8)}`;
        const t = match.gameStart || '0000';
        const timeStr = `${t.substring(0, 2)}:${t.substring(2, 4)}`;

        // Filter: Keep only Jan-Apr 2026? Or just keep all fetched.
        if (!dateStr.startsWith('2026')) continue;

        const title = `${match.tnameH} vs ${match.tnameA}`;
        const id = `kbl_${match.gameDate}_${match.tcodeH}_${match.tcodeA}`;

        if (seenIds.has(id)) continue;
        seenIds.add(id);

        // Logo Construction
        // Pattern: https://www.kbl.or.kr/assets/img/ico/logo/ic-{logoCode}.svg
        const homeLogoUrl = KBL_LOGOS[match.tnameH] || (match.logoH ? `https://www.kbl.or.kr/assets/img/ico/logo/ic-${match.logoH}.svg` : '');
        const awayLogoUrl = KBL_LOGOS[match.tnameA] || (match.logoA ? `https://www.kbl.or.kr/assets/img/ico/logo/ic-${match.logoA}.svg` : '');

        allPerformances.push({
            id,
            title,
            image: KBL_POSTER,
            date: `${dateStr} ${timeStr}`,
            venue: match.stadiumname,
            link: KBL_URL,
            region: classifyRegion(match.stadiumname),
            genre: 'basketball',
            homeTeam: match.tnameH,
            awayTeam: match.tnameA,
            homeTeamLogo: homeLogoUrl,
            awayTeamLogo: awayLogoUrl
        });
    }

    console.log(`Total collected: ${allPerformances.length}`);
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(allPerformances, null, 2));
    console.log(`Saved to ${OUTPUT_PATH}`);

    await browser.close();
}

function classifyRegion(venue: string): string {
    if (!venue) return 'etc';
    if (venue.includes('서울') || venue.includes('잠실')) return 'seoul';
    if (venue.includes('안양') || venue.includes('수원') || venue.includes('고양')) return 'gyeonggi';
    if (venue.includes('인천')) return 'incheon';
    if (venue.includes('부산')) return 'busan';
    if (venue.includes('창원') || venue.includes('대구') || venue.includes('울산')) return 'etc';
    return 'etc';
}

scrapeKbl().catch(console.error);

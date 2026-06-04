import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { atomicWriteJson } from './utils/scraper-utils';

function slugify(text: string): string {
    return text
        .replace(/[^a-zA-Z0-9가-힣]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
}

const KBL_URL = 'https://www.kbl.or.kr/match/schedule';
const KBL_POSTER = '/images/kbl_poster.png';
const OUTPUT_PATH = path.resolve(process.cwd(), 'src/data/kbl.json');

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

async function scrapeKbl() {
    const KBL_LOGOS: Record<string, string> = {
        "서울 SK": "/images/logos/kbl/sk_official.svg",
        "서울SK": "/images/logos/kbl/sk_official.svg",
        "SK": "/images/logos/kbl/sk_official.svg",
        "원주 DB": "/images/logos/kbl/db_official.svg",
        "DB": "/images/logos/kbl/db_official.svg",
        "울산 현대모비스": "/images/logos/kbl/mobis_official.svg",
        "현대모비스": "/images/logos/kbl/mobis_official.svg",
        "서울 삼성": "/images/logos/kbl/samsung_official.svg",
        "삼성": "/images/logos/kbl/samsung_official.svg",
        "고양 소노": "/images/logos/kbl/sono_official.svg",
        "소노": "/images/logos/kbl/sono_official.svg",
        "대구 한국가스공사": "/images/logos/kbl/kogas_official.svg",
        "한국가스공사": "/images/logos/kbl/kogas_official.svg",
        "안양 정관장": "/images/logos/kbl/kgc_official.svg",
        "정관장": "/images/logos/kbl/kgc_official.svg",
        "창원 LG": "/images/logos/kbl/lg_official.svg",
        "창원LG": "/images/logos/kbl/lg_official.svg",
        "LG": "/images/logos/kbl/lg_official.svg",
        "수원 KT": "/images/logos/kbl/kt_official.svg",
        "KT": "/images/logos/kbl/kt_official.svg",
        "부산 KCC": "/images/logos/kbl/kcc_official.svg",
        "KCC": "/images/logos/kbl/kcc_official.svg",
        "상무": "/images/logos/kbl/sangmu.svg"
    };

    const VENUE_MAP: Record<string, string> = {
        "잠실학": "잠실학생체육관",
        "잠실실": "잠실실내체육관",
        "수원": "수원KT소닉붐아레나",
        "대구": "대구실내체육관",
        "창원": "창원체육관",
        "부산": "부산사직실내체육관",
        "울산": "울산동천체육관",
        "원주": "원주종합체육관",
        "안양": "안양실내체육관",
        "고양": "고양소노아레나"
    };

    console.log(`Starting KBL Scraper (UI Interaction)...`);

    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 1024 });
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        const collectedMatches: any[] = [];
        page.on('response', async res => {
            const url = res.url();
            if (url.includes('match/list') && res.status() === 200 && res.request().method() === 'GET') {
                try {
                    const json = await res.json();
                    const list = Array.isArray(json) ? json : (json.list || []);
                    collectedMatches.push(...list);
                } catch (e) {
                    console.error('Error parsing response:', e);
                }
            }
        });

        console.log(`Navigating to ${KBL_URL}...`);
        await page.goto(KBL_URL, { waitUntil: 'networkidle2', timeout: 60000 });

        const nextBtnSelector = '.ic-date-nav-next';
        try {
            await page.waitForSelector(nextBtnSelector, { timeout: 10000 });
            const lookaheadMonths = Number.parseInt(process.env.KBL_MONTH_LOOKAHEAD || '8', 10);
            for (let i = 0; i < lookaheadMonths; i++) {
                console.log(`Clicking next month (${i + 1}/${lookaheadMonths})...`);
                await page.waitForSelector(nextBtnSelector, { visible: true, timeout: 5000 });
                await page.click(nextBtnSelector);
                await new Promise(r => setTimeout(r, 3000));
            }
        } catch (e) {
            console.error('Error in navigation sequence:', e);
        }

        const allPerformances: any[] = [];
        const seenIds = new Set<string>();

        for (const match of collectedMatches) {
            const d = match.gameDate;
            if (!d || d.length !== 8) continue;

            const dateStr = `${d.substring(0, 4)}-${d.substring(4, 6)}-${d.substring(6, 8)}`;
            const t = match.gameStart || '0000';
            const timeStr = `${t.substring(0, 2)}:${t.substring(2, 4)}`;

            const title = `${match.tnameH} vs ${match.tnameA}`;
            const safeMatchup = slugify(title);
            const id = `kbl_${match.gameDate}_${safeMatchup}`;

            if (seenIds.has(id)) continue;
            if (process.env.SCRAPE_KEEP_PAST_SPORTS !== '1' && !isUpcomingOrToday(`${dateStr} ${timeStr}`)) continue;
            seenIds.add(id);

            const homeLogoUrl = KBL_LOGOS[match.tnameH] || (match.logoH ? `https://www.kbl.or.kr/assets/img/ico/logo/ic-${match.logoH}.svg` : '');
            const awayLogoUrl = KBL_LOGOS[match.tnameA] || (match.logoA ? `https://www.kbl.or.kr/assets/img/ico/logo/ic-${match.logoA}.svg` : '');

            allPerformances.push({
                id,
                title,
                image: KBL_POSTER,
                date: `${dateStr} ${timeStr}`,
                venue: VENUE_MAP[match.stadiumname] || match.stadiumname,
                link: KBL_URL,
                region: classifyRegion(match.stadiumname),
                genre: 'basketball',
                homeTeam: match.tnameH,
                awayTeam: match.tnameA,
                homeTeamLogo: homeLogoUrl,
                awayTeamLogo: awayLogoUrl
            });
        }

        console.log(`Total upcoming/current collected: ${allPerformances.length}`);
        if (collectedMatches.length > 0 && allPerformances.length === 0) {
            console.log('No upcoming KBL matches remain. Writing an empty seasonal file so the category stays hidden until the season returns.');
        }
        atomicWriteJson(OUTPUT_PATH, allPerformances);
        console.log(`Saved ${allPerformances.length} matches to ${OUTPUT_PATH}`);

    } finally {
        await browser.close();
    }
}

function classifyRegion(venue: string): string {
    if (!venue) return 'etc';
    if (venue.includes('서울') || venue.includes('잠실')) return 'seoul';
    if (venue.includes('안양') || venue.includes('수원') || venue.includes('고양')) return 'gyeonggi';
    if (venue.includes('인천')) return 'incheon';
    if (venue.includes('부산')) return 'busan';
    return 'etc';
}

scrapeKbl().then(() => {
    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});

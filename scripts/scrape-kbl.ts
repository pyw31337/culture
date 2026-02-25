import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

function slugify(text: string): string {
    return text
        .replace(/[^a-zA-Z0-9가-힣]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
}

const KBL_URL = 'https://www.kbl.or.kr/match/schedule';
const KBL_POSTER = '/culture/images/kbl_poster.png';
const OUTPUT_PATH = path.resolve(process.cwd(), 'src/data/kbl.json');

async function scrapeKbl() {
    const KBL_LOGOS: Record<string, string> = {
        "서울 SK": "/culture/images/logos/kbl/sk_official.svg",
        "서울SK": "/culture/images/logos/kbl/sk_official.svg",
        "SK": "/culture/images/logos/kbl/sk_official.svg",
        "원주 DB": "/culture/images/logos/kbl/db_official.svg",
        "DB": "/culture/images/logos/kbl/db_official.svg",
        "울산 현대모비스": "/culture/images/logos/kbl/mobis_official.svg",
        "현대모비스": "/culture/images/logos/kbl/mobis_official.svg",
        "서울 삼성": "/culture/images/logos/kbl/samsung_official.svg",
        "삼성": "/culture/images/logos/kbl/samsung_official.svg",
        "고양 소노": "/culture/images/logos/kbl/sono_official.svg",
        "소노": "/culture/images/logos/kbl/sono_official.svg",
        "대구 한국가스공사": "/culture/images/logos/kbl/kogas_official.svg",
        "한국가스공사": "/culture/images/logos/kbl/kogas_official.svg",
        "안양 정관장": "/culture/images/logos/kbl/kgc_official.svg",
        "정관장": "/culture/images/logos/kbl/kgc_official.svg",
        "창원 LG": "/culture/images/logos/kbl/lg_official.svg",
        "창원LG": "/culture/images/logos/kbl/lg_official.svg",
        "LG": "/culture/images/logos/kbl/lg_official.svg",
        "수원 KT": "/culture/images/logos/kbl/kt_official.svg",
        "KT": "/culture/images/logos/kbl/kt_official.svg",
        "부산 KCC": "/culture/images/logos/kbl/kcc_official.svg",
        "KCC": "/culture/images/logos/kbl/kcc_official.svg",
        "상무": "/culture/images/logos/kbl/sangmu.svg"
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
            for (let i = 0; i < 3; i++) {
                console.log(`Clicking next month (${i + 1}/3)...`);
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

            if (!dateStr.startsWith('2026')) continue;

            const title = `${match.tnameH} vs ${match.tnameA}`;
            const safeMatchup = slugify(title);
            const id = `kbl_${match.gameDate}_${safeMatchup}`;

            if (seenIds.has(id)) continue;
            seenIds.add(id);

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

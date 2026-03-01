import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import cliProgress from 'cli-progress';

function slugify(text: string): string {
    return text
        .replace(/[^a-zA-Z0-9가-힣]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
}

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
const API_URL_PATTERN = 'stat/broadcaster';
const OUTPUT_PATH = path.resolve(process.cwd(), 'src/data/kovo.json');
const VOLLEYBALL_POSTER = '/images/volleyball_poster.png';

async function scrapeKovo() {
    console.log(`Starting KOVO Scraper (API Interception)...`);

    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    });

    try {
        const page = await browser.newPage();
        // Use a common mobile user agent to see if it triggers the API differently
        await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1');

        const allItems: any[] = [];

        // Iterate through rounds to gather full season data
        for (let round = 1; round <= 6; round++) {
            const apiRoundUrl = `https://user-api.kovo.co.kr/stat/game-schedule?gcode=001&seasonCode=022&leagueCode=201&round=${round}`;
            console.log(`Fetching Round ${round} from API...`);

            await page.goto(apiRoundUrl, { waitUntil: 'networkidle2', timeout: 60000 });

            const apiResponse = await page.evaluate(() => {
                try {
                    return JSON.parse(document.body.innerText);
                } catch (e) {
                    return null;
                }
            });

            if (!apiResponse || !apiResponse.payload || !apiResponse.payload.content) {
                console.log(`Failed to fetch Round ${round} or reached end of season.`);
                continue;
            }

            const roundItems = apiResponse.payload.content.map((item: any) => ({
                date: item.gdate,
                time: item.gstime,
                homeTeam: item.hname,
                awayTeam: item.aname,
                venue: item.place,
                homeLogo: item.homeEmblemUrl,
                awayLogo: item.awayEmblemUrl
            }));

            console.log(`Retrieved ${roundItems.length} items for Round ${round}.`);
            allItems.push(...roundItems);
        }

        const items = allItems;
        console.log(`Successfully extracted ${items.length} total items from DOM.`);

        const KOVO_LOGOS: Record<string, string> = {
            "서울Kixx": "/images/logos/kovo/kixx.svg",
            "알토스": "/images/logos/kovo/altos.svg",
            "VIXTORM": "/images/logos/kovo/vixtorm.svg",
            "우리WON": "/images/logos/kovo/wooriwon.svg",
            "블루팡스": "/images/logos/kovo/bluefangs.svg",
            "읏맨": "/images/logos/kovo/okman.svg",
            "PEPPERS": "/images/logos/kovo/aipeppers.svg",
            "하이패스": "/images/logos/kovo/hipass.svg",
            "스카이워커스": "/images/logos/kovo/skywalkers.svg",
            "스타즈": "/images/logos/kovo/stars.svg",
            "핑크스파이더스": "/images/logos/kovo/pinkspiders.svg",
            "힐스테이트": "/images/logos/kovo/hillstate.svg",
            "점보스": "/images/logos/kovo/jumbos.svg",
            "레드스파크스": "/images/logos/kovo/redsparks.svg"
        };

        const VENUE_MAP: Record<string, string> = {
            "장충체육관": "서울장충체육관",
            "수원실내": "수원실내체육관",
            "계양체육관": "인천계양체육관",
            "안산상록": "안산상록수체육관",
            "천안유관순": "천안유관순체육관",
            "의정부체육관": "의정부실내체육관",
            "충무체육관": "대전충무체육관",
            "삼산월드체육관": "인천삼산월드체육관",
            "유관순체육관": "천안유관순체육관",
            "화성종합경기타운": "화성종합경기타운실내체육관",
            "페퍼스타디움": "광주페퍼스타디움",
            "김천실내": "김천실내체육관"
        };

        const progressBar = new cliProgress.SingleBar({
            format: '배구 일정 변환 | {bar} | {percentage}% | {value}/{total} | {status}',
            hideCursor: true
        }, cliProgress.Presets.shades_classic);

        progressBar.start(items.length, 0, { status: '준비 중' });

        const performances: Performance[] = items.map((item: any) => {
            const date = item.date;
            const time = item.time;
            const home = item.homeTeam;
            const away = item.awayTeam;
            const fullVenue = item.venue;

            // Simple team name matching from logos record
            const homeKey = Object.keys(KOVO_LOGOS).find(k => home.includes(k)) || home;
            const awayKey = Object.keys(KOVO_LOGOS).find(k => away.includes(k)) || away;

            const title = `[배구] ${homeKey} vs ${awayKey}`;
            const safeMatchup = slugify(`${homeKey} vs ${awayKey}`);
            const id = `kovo_${date.replace(/-/g, '')}_${safeMatchup}`;

            progressBar.increment({ status: `${homeKey} vs ${awayKey}` });

            const venue = VENUE_MAP[fullVenue] || fullVenue;

            return {
                id,
                title,
                image: VOLLEYBALL_POSTER,
                date: `${date} ${time}`,
                venue,
                link: KOVO_SCHEDULE_URL,
                region: classifyRegion(venue),
                genre: 'volleyball',
                homeTeam: homeKey,
                awayTeam: awayKey,
                homeTeamLogo: item.homeLogo || KOVO_LOGOS[homeKey] || '',
                awayTeamLogo: item.awayLogo || KOVO_LOGOS[awayKey] || '',
            };
        });

        progressBar.stop();

        if (performances.length > 0) {
            fs.writeFileSync(OUTPUT_PATH, JSON.stringify(performances, null, 2));
            console.log(`Saved ${performances.length} items to ${OUTPUT_PATH}`);
        } else {
            console.log('No performances found in API response.');
        }

    } catch (error) {
        console.error(`Fatal Error in KOVO Scraper:`, error);
    } finally {
        await browser.close();
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

scrapeKovo().then(() => {
    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});

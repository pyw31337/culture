import axios from 'axios';
import fs from 'fs';
import path from 'path';
import cliProgress from 'cli-progress';
import { atomicWriteJson, atomicWriteJsonPreserve } from './utils/scraper-utils';
import { runScraperJob } from './utils/scraper-runner';

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
    versusLink?: string;
    highlightsLink?: string;
}

const KOVO_SCHEDULE_URL = 'https://kovo.co.kr/games/v-leagues/schedules?season=022&gender=all&league=201&round=all';
const OUTPUT_PATH = path.resolve(process.cwd(), 'src/data/kovo.json');
const VOLLEYBALL_POSTER = '/images/volleyball_poster.png';

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

function isUpcomingOrToday(dateStr: string, timeStr?: string) {
    const match = String(dateStr || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return false;
    const d = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    return d >= getKstTodayStart();
}


async function detectKovoSeasons(): Promise<string[]> {
    const env = (process.env.KOVO_SEASONS || '').split(',').map((s) => s.trim()).filter(Boolean);
    if (env.length) return env;
    const found: string[] = [];
    for (let n = 20; n <= 30; n++) {
        const code = String(n).padStart(3, '0');
        try {
            const url = 'https://user-api.kovo.co.kr/stat/game-schedule?gcode=001&seasonCode=' + code + '&leagueCode=201&round=1';
            const res = await axios.get(url, {
                headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://kovo.co.kr/' },
                timeout: 15000,
            });
            const content = res.data?.payload?.content;
            if (Array.isArray(content) && content.length > 0) found.push(code);
        } catch {
            // ignore
        }
    }
    if (!found.length) {
        console.warn('[kovo] season probe empty; fallback 022,023');
        return ['022', '023'];
    }
    console.log('[kovo] detected seasons:', found.join(','));
    return found;
}

async function scrapeKovo() {
    console.log(`Starting KOVO Scraper (Axios)...`);

    try {
        const allItems: any[] = [];

        // 022 = 2025-26 (mostly past), 023 = 2026-27 upcoming
        const seasons = await detectKovoSeasons();
        const leagues = [201, 202]; // 201: Regular, 202: Post-season
        for (const seasonCode of seasons) {
        for (const league of leagues) {
            console.log(`Fetching season ${seasonCode} league ${league}...`);
            for (let round = 1; round <= 6; round++) {
                const apiRoundUrl = `https://user-api.kovo.co.kr/stat/game-schedule?gcode=001&seasonCode=${seasonCode}&leagueCode=${league}&round=${round}`;
                console.log(`Fetching League ${league} Round ${round} from API...`);

                try {
                    const response = await axios.get(apiRoundUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1',
                        'Referer': 'https://kovo.co.kr/'
                    },
                    timeout: 30000
                });

                const apiResponse = response.data;

                if (!apiResponse || !apiResponse.payload || !apiResponse.payload.content || apiResponse.payload.content.length === 0) {
                    console.log(`No items found for Round ${round}.`);
                    continue;
                }

                const roundItems = apiResponse.payload.content.map((item: any) => ({
                    ...item,
                    round: round // Attach round number for link generation
                }));

                console.log(`Retrieved ${roundItems.length} items for Round ${round}.`);
                allItems.push(...roundItems);
                } catch (err: any) {
                    console.error(`Error fetching League ${league} Round ${round}: ${err.message}`);
                }
            }
        }

        } // seasons

        if (allItems.length === 0) {
            console.log('No performances found in any round.');
            atomicWriteJsonPreserve(OUTPUT_PATH, [], { allowEmpty: process.env.SCRAPE_ALLOW_EMPTY === '1', label: 'kovo.json' });
            return;
        }

        const items = allItems;
        console.log(`Successfully extracted ${items.length} total items.`);

        const KOVO_LOGOS: Record<string, string> = {
            "서울Kixx": "/images/logos/kovo/kixx.svg",
            "GS칼텍스": "/images/logos/kovo/kixx.svg",
            "알토스": "/images/logos/kovo/altos.svg",
            "IBK기업은행": "/images/logos/kovo/altos.svg",
            "VIXTORM": "/images/logos/kovo/vixtorm.svg",
            "한국전력": "/images/logos/kovo/vixtorm.svg",
            "우리WON": "/images/logos/kovo/wooriwon.svg",
            "우리카드": "/images/logos/kovo/wooriwon.svg",
            "블루팡스": "/images/logos/kovo/bluefangs.svg",
            "삼성화재": "/images/logos/kovo/bluefangs.svg",
            "읏맨": "/images/logos/kovo/okman.svg",
            "OK금융그룹": "/images/logos/kovo/okman.svg",
            "PEPPERS": "/images/logos/kovo/aipeppers.svg",
            "AI페퍼스": "/images/logos/kovo/aipeppers.svg",
            "페퍼저축은행": "/images/logos/kovo/aipeppers.svg",
            "하이패스": "/images/logos/kovo/hipass.svg",
            "한국도로공사": "/images/logos/kovo/hipass.svg",
            "스카이워커스": "/images/logos/kovo/skywalkers.svg",
            "현대캐피탈": "/images/logos/kovo/skywalkers.svg",
            "스타즈": "/images/logos/kovo/stars.svg",
            "KB손해보험": "/images/logos/kovo/stars.svg",
            "핑크스파이더스": "/images/logos/kovo/pinkspiders.svg",
            "흥국생명": "/images/logos/kovo/pinkspiders.svg",
            "힐스테이트": "/images/logos/kovo/hillstate.svg",
            "현대건설": "/images/logos/kovo/hillstate.svg",
            "점보스": "/images/logos/kovo/jumbos.svg",
            "대한항공": "/images/logos/kovo/jumbos.svg",
            "레드스파크스": "/images/logos/kovo/redsparks.svg",
            "정관장": "/images/logos/kovo/redsparks.svg"
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
            const date = item.gdate;
            const time = item.gstime;
            const home = item.hname;
            const away = item.aname;
            const fullVenue = item.place;
            
            const gnum = item.gnum;
            const hcode = item.hcode;
            const acode = item.acode;
            const gender = item.gender;
            const season = item.seasonCode || '022';
            const round = item.round;

            const homeKey = Object.keys(KOVO_LOGOS).find(k => home.includes(k)) || home;
            const awayKey = Object.keys(KOVO_LOGOS).find(k => away.includes(k)) || away;

            const title = `[배구] ${homeKey} vs ${awayKey}`;
            const safeMatchup = slugify(`${homeKey} vs ${awayKey}`);
            const id = `kovo_${date.replace(/-/g, '')}_${safeMatchup}`;

            progressBar.increment({ status: `${homeKey} vs ${awayKey}` });

            const venue = VENUE_MAP[fullVenue] || fullVenue;

            const versusLink = `https://kovo.co.kr/games/v-leagues/versus?season=${season}&gender=${gender}&league=201&round=${round}&homeTeam=${hcode}&awayTeam=${acode}`;
            const highlightsLink = `https://kovo.co.kr/games/v-leagues/result/highlights?gameNo=${gnum}&season=${season}&league=201&gender=${gender}`;

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
                homeTeamLogo: item.homeEmblemUrl || KOVO_LOGOS[homeKey] || '',
                awayTeamLogo: item.awayEmblemUrl || KOVO_LOGOS[awayKey] || '',
                versusLink,
                highlightsLink
            };
        });

        progressBar.stop();

        const keepPast = process.env.SCRAPE_KEEP_PAST_SPORTS === '1';
        const upcoming = keepPast
            ? performances
            : performances.filter((p) => isUpcomingOrToday(p.date));

        console.log(`Total extracted: ${performances.length}, upcoming/current: ${upcoming.length}`);
        if (!keepPast && performances.length > 0 && upcoming.length === 0) {
            console.log('No upcoming KOVO matches remain. Writing empty seasonal file.');
        }
        atomicWriteJsonPreserve(OUTPUT_PATH, upcoming, { allowEmpty: process.env.SCRAPE_ALLOW_EMPTY === '1', label: 'kovo.json' });
        console.log(`Saved ${upcoming.length} items to ${OUTPUT_PATH}`);

    } catch (error) {
        console.error(`Fatal Error in KOVO Scraper:`, error);
    }
}

function classifyRegion(venue: string): string {
    if (!venue) return 'etc';
    if (venue.includes('서울') || venue.includes('장충')) return 'seoul';
    if (venue.includes('인천') || venue.includes('계양') || venue.includes('삼산')) return 'incheon';
    if (venue.includes('수원') || venue.includes('안산') || venue.includes('화성') || venue.includes('의정부') || venue.includes('경기')) return 'gyeonggi';
    if (venue.includes('강원')) return 'gangwon';
    if (venue.includes('대전') || venue.includes('충무')) return 'daejeon';
    if (venue.includes('천안') || venue.includes('충남') || venue.includes('유관순')) return 'chungnam';
    if (venue.includes('광주') || venue.includes('페퍼')) return 'gwangju';
    if (venue.includes('전북') || venue.includes('전주')) return 'jeonbuk';
    if (venue.includes('전남') || venue.includes('여수')) return 'jeonnam';
    if (venue.includes('부산')) return 'busan';
    if (venue.includes('대구')) return 'daegu';
    if (venue.includes('김천') || venue.includes('경북')) return 'gyeongbuk';
    if (venue.includes('경남') || venue.includes('창원')) return 'gyeongnam';
    if (venue.includes('제주')) return 'jeju';
    return 'etc';
}

runScraperJob({
    name: 'kovo',
    timeoutMs: 180_000,
    run: async () => {
        await scrapeKovo();
        // scrapeKovo writes file; approximate count from output path if needed
        try {
            const fs = await import('fs');
            const path = await import('path');
            const raw = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'src/data/kovo.json'), 'utf8'));
            return { itemCount: Array.isArray(raw) ? raw.length : 0 };
        } catch {
            return { itemCount: 0 };
        }
    },
}).then(() => {
    process.exit(process.exitCode ?? 0);
});

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import cliProgress from 'cli-progress';
import { atomicWriteJson } from './utils/scraper-utils';

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

async function scrapeKovo() {
    console.log(`Starting KOVO Scraper (Axios)...`);

    try {
        const allItems: any[] = [];

        const leagues = [201, 202]; // 201: Regular, 202: Post-season
        for (const league of leagues) {
            console.log(`Fetching League ${league}...`);
            for (let round = 1; round <= 6; round++) {
                const apiRoundUrl = `https://user-api.kovo.co.kr/stat/game-schedule?gcode=001&seasonCode=022&leagueCode=${league}&round=${round}`;
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

        if (allItems.length === 0) {
            console.log('No performances found in any round.');
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

        if (performances.length > 0) {
            atomicWriteJson(OUTPUT_PATH, performances);
            console.log(`Saved ${performances.length} items to ${OUTPUT_PATH}`);
        }

    } catch (error) {
        console.error(`Fatal Error in KOVO Scraper:`, error);
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

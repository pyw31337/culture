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
const OUTPUT_PATH = path.resolve(process.cwd(), 'src/data/kovo.json');
const VOLLEYBALL_POSTER = '/images/volleyball_poster.png';

async function scrapeKovo() {
    console.log(`Starting KOVO Scraper (Targeted Selectors)...`);

    const MAX_RETRIES = 2; // Reduced to 2 to minimize CI impact
    let retries = 0;
    let browser: any;

    try {
        while (retries < MAX_RETRIES) {
            if (retries > 0) {
                console.log(`Retry attempt ${retries + 1}/${MAX_RETRIES}...`);
                await new Promise(r => setTimeout(r, 5000));
            }

            browser = await puppeteer.launch({
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
            });

            try {
                const page = await browser.newPage();
                await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
                await page.setViewport({ width: 1280, height: 1024 });

                console.log(`Navigating to ${KOVO_SCHEDULE_URL}...`);
                await page.goto(KOVO_SCHEDULE_URL, { waitUntil: 'networkidle2', timeout: 60000 });

                // Auto Scroll with safety timeout
                await Promise.race([
                    autoScroll(page),
                    new Promise(r => setTimeout(r, 15000))
                ]);

                console.log(`기존 데이터를 분석하고 있습니다...`);

                const progressBar = new cliProgress.SingleBar({
                    format: '배구 일정 수집 | {bar} | {percentage}% | {value}/{total} | {status}',
                    hideCursor: true
                }, cliProgress.Presets.shades_classic);

                const scrapedItems = await page.evaluate(() => {
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

                    const TEAMS = Object.keys(KOVO_LOGOS);
                    let timeElements = Array.from(document.querySelectorAll('span')).filter(s => /^\d{2}:\d{2}$/.test(s.innerText.trim()));

                    const results: any[] = [];
                    const VENUE_MAP: Record<string, string> = {
                        "장충체육관": "서울장충체육관",
                        "수원실내": "수원실내체육관",
                        "수원실내체육관": "수원실내체육관",
                        "계양체육관": "인천계양체육관",
                        "인천계양": "인천계양체육관",
                        "안산상록": "안산상록수체육관",
                        "안산상록수체육관": "안산상록수체육관",
                        "천안유관순": "천안유관순체육관",
                        "의정부체육관": "의정부실내체육관",
                        "충무체육관": "대전충무체육관",
                        "삼산월드체육관": "인천삼산월드체육관",
                        "유관순체육관": "천안유관순체육관",
                        "화성종합경기타운": "화성종합경기타운실내체육관",
                        "페퍼스타디움": "광주페퍼스타디움",
                        "김천실내": "김천실내체육관"
                    };

                    timeElements.forEach(timeEl => {
                        try {
                            const time = (timeEl as HTMLElement).innerText.trim();
                            // Look for the closest container that likely holds team names and venue
                            let row = timeEl.closest('.MuiGrid-container') || timeEl.closest('.MuiBox-root') || timeEl.parentElement;
                            if (!row) return;

                            const text = (row as HTMLElement).innerText;
                            const teamsFound = TEAMS.filter(t => text.includes(t));
                            if (teamsFound.length < 2) return;

                            const sortedTeams = teamsFound.sort((a, b) => text.indexOf(a) - text.indexOf(b));
                            const home = sortedTeams[0];
                            const away = sortedTeams[1];
                            if (!home || !away) return;

                            const homeLogo = (KOVO_LOGOS as any)[home] || '';
                            const awayLogo = (KOVO_LOGOS as any)[away] || '';

                            let currentDate = '';
                            let dateCandidate = row.parentElement; // Try parent first
                            let steps = 0;
                            
                            // Greedily look for date pattern YYYY.MM.DD in ancestors/previous siblings
                            let currentSearch = row as HTMLElement;
                            while (currentSearch && steps < 50) {
                                const searchTxt = currentSearch.innerText || '';
                                const match = searchTxt.match(/\b\d{4}\.\d{2}\.\d{2}\b/);
                                if (match) {
                                    currentDate = match[0];
                                    break;
                                }
                                if (currentSearch.previousElementSibling) {
                                    currentSearch = currentSearch.previousElementSibling as HTMLElement;
                                } else {
                                    currentSearch = currentSearch.parentElement as HTMLElement;
                                }
                                steps++;
                            }

                            if (!currentDate) return;

                            let venue = '정보없음';
                            // Look for venue text in the row
                            const venueCandidates = Object.keys(VENUE_MAP);
                            for (const cand of venueCandidates) {
                                if (text.includes(cand)) {
                                    venue = cand;
                                    break;
                                }
                            }

                            if (venue === '정보없음') {
                                const venueMatch = text.match(/[가-힣\s]*(체육관|스타디움|경기장)/);
                                if (venueMatch) venue = venueMatch[0].trim();
                            }

                            venue = VENUE_MAP[venue] || venue;

                            results.push({
                                date: currentDate.replace(/\./g, '-'),
                                time,
                                homeTeam: home,
                                awayTeam: away,
                                homeLogo,
                                awayLogo,
                                venue,
                                fullDate: `${currentDate.replace(/\./g, '-')} ${time}`
                            });
                        } catch (e) { }
                    });
                    return results;
                });

                progressBar.start(scrapedItems.length, 0, { status: '변환 중' });

                const performances: Performance[] = scrapedItems.map((item: any) => {
                    const title = `[배구] ${item.homeTeam} vs ${item.awayTeam}`;
                    const safeMatchup = slugify(`${item.homeTeam} vs ${item.awayTeam}`);
                    const id = `kovo_${item.date.replace(/-/g, '')}_${safeMatchup}`;

                    progressBar.increment({ status: `${item.homeTeam} vs ${item.awayTeam}` });

                    return {
                        id,
                        title,
                        image: VOLLEYBALL_POSTER,
                        date: item.fullDate,
                        venue: item.venue,
                        link: KOVO_SCHEDULE_URL,
                        region: classifyRegion(item.venue),
                        genre: 'volleyball',
                        homeTeam: item.homeTeam,
                        awayTeam: item.awayTeam,
                        homeTeamLogo: item.homeLogo,
                    };
                });
                progressBar.stop();

                if (performances.length > 0) {
                    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(performances, null, 2));
                    console.log(`Saved to ${OUTPUT_PATH}`);
                    return; // Success, exit function
                } else {
                    console.log('No items found (0 length). Retrying...');
                    retries++;
                }

            } finally {
                if (browser) await browser.close();
            }
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

const autoScroll = async (page: any) => {
    await page.evaluate(async () => {
        await new Promise<void>((resolve) => {
            let totalHeight = 0;
            const distance = 400;
            const timer = setInterval(() => {
                const scrollHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;
                if (totalHeight >= scrollHeight || totalHeight > 10000) {
                    clearInterval(timer);
                    resolve();
                }
            }, 100);
        });
    });
};

scrapeKovo().then(() => {
    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});

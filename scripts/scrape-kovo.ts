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
const VOLLEYBALL_POSTER = '/culture/images/volleyball_poster.png';

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
                    let timeElements = Array.from(document.querySelectorAll('span.css-hwx9jd'));

                    if (timeElements.length === 0) {
                        timeElements = Array.from(document.querySelectorAll('span')).filter(s => /^\d{2}:\d{2}$/.test((s as HTMLElement).innerText.trim()));
                    }

                    const results: any[] = [];
                    timeElements.forEach(timeEl => {
                        try {
                            const time = (timeEl as HTMLElement).innerText.trim();
                            let row = timeEl.closest('.MuiBox-root') || timeEl.parentElement;
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
                            let dateCandidate = row.previousElementSibling;
                            let steps = 0;
                            while (dateCandidate && steps < 10) {
                                if (/^\d{4}\.\d{2}\.\d{2}$/.test((dateCandidate as HTMLElement).innerText.trim())) {
                                    currentDate = (dateCandidate as HTMLElement).innerText.trim();
                                    break;
                                }
                                dateCandidate = dateCandidate.previousElementSibling;
                                steps++;
                            }

                            if (!currentDate) return;

                            let venue = '정보없음';
                            const venueEl = row.querySelector('.css-1og2kxg');
                            if (venueEl) {
                                venue = (venueEl as HTMLElement).innerText.trim();
                            } else {
                                const venueMatch = text.match(/[가-힣\s]*(체육관|스타디움|경기장)/);
                                if (venueMatch) venue = venueMatch[0].trim();
                            }

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

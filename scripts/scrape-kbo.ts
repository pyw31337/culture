import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';
import path from 'path';
import { withErrorHandling, getBrowserConfig, getCurrentYear } from './utils/scraper-utils';

puppeteer.use(StealthPlugin());

function slugify(text: string): string {
    return text
        .replace(/[^a-zA-Z0-9가-힣]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
}

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
const THUMBNAIL_PATH = '/images/kbo-thumbnail.png'; // Path in public

// Venue Mapping
const VENUE_MAP: Record<string, string> = {
    '잠실': '잠실종합운동장잠실야구장',
    '문학': '인천SSG 랜더스필드',
    '수원': '수원KT위즈파크',
    '고척': '고척스카이돔',
    '광주': '광주기아챔피언스필드',
    '대구': '대구삼성라이온즈파크',
    '대전': '한화생명이글스파크',
    '사직': '부산사직종합운동장사직야구장',
    '창원': '창원NC파크',
    '포항': '포항야구장',
    '울산': '울산문수야구장',
    '청주': '청주야구장',
    '이천': '이천',
    '마산': '마산',
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
    const browserConfig = await getBrowserConfig();
    const browser = await puppeteer.launch(browserConfig);

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 1024 });
        const TARGET_URL = 'https://www.koreabaseball.com/Schedule/Schedule.aspx';
        await page.goto(TARGET_URL, { waitUntil: 'networkidle2', timeout: 60000 });

        const allPerformances: Performance[] = [];
        const seenIds = new Set<string>();

        const TARGET_YEAR = getCurrentYear(); // Use dynamic year (replaces hardcoded 2025)
        const SERIES_LIST = [
            { id: '1', name: 'Exhibition' },
            { id: '0,9,6', name: 'Regular' },
            { id: '3,4,5,7', name: 'Post' }
        ];
        const MONTHS = ['03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];

        async function selectOption(selector: string, value: string) {
            const currentVal = await page.$eval(selector, (el) => (el as HTMLSelectElement).value);
            if (currentVal === value) return;
            console.log(`Selecting ${selector} = ${value}`);
            await page.select(selector, value);
            await new Promise((r) => setTimeout(r, 2000));
        }

        const TEAM_LOGOS: Record<string, string> = {
            "LG": "/images/logos/kbo/lg.svg",
            "한화": "/images/logos/kbo/hanwha.svg",
            "SSG": "/images/logos/kbo/ssg.svg",
            "삼성": "/images/logos/kbo/samsung.svg",
            "NC": "/images/logos/kbo/nc.svg",
            "KT": "/images/logos/kbo/kt.svg",
            "롯데": "/images/logos/kbo/lotte.svg",
            "KIA": "/images/logos/kbo/kia.svg",
            "두산": "/images/logos/kbo/doosan.svg",
            "키움": "/images/logos/kbo/kiwoom.svg"
        };

        console.log(`\nPhase 1: Collecting KBO games for ${TARGET_YEAR}...`);

        for (const month of MONTHS) {
            for (const series of SERIES_LIST) {
                try {
                    await selectOption('#ddlYear', TARGET_YEAR);
                    await selectOption('#ddlMonth', month);
                    await selectOption('#ddlSeries', series.id);

                    const hasData = await page.evaluate(() => {
                        const trs = document.querySelectorAll('#tblScheduleList tbody tr');
                        if (trs.length === 0) return false;
                        const firstTr = trs[0] as HTMLElement;
                        if (firstTr.innerText.includes('데이터가 없습니다')) return false;
                        return true;
                    });

                    if (!hasData) continue;

                    const results = await page.evaluate((targetYear) => {
                        const trs = document.querySelectorAll('#tblScheduleList tbody tr');
                        const games: any[] = [];
                        let currentDate = '';

                        trs.forEach((tr) => {
                            const cells = tr.querySelectorAll('td');
                            if (cells.length < 8) return;

                            let timeIdx = 1;
                            let matchupIdx = 2;
                            let venueIdx = 7;

                            if (cells.length === 9 || cells[0].classList.contains('day')) {
                                const dateRaw = cells[0].textContent?.trim() || '';
                                const match = dateRaw.match(/(\d{2})\.(\d{2})/);
                                if (match) {
                                    currentDate = `${targetYear}-${match[1]}-${match[2]}`;
                                }
                            } else {
                                timeIdx = 0;
                                matchupIdx = 1;
                                venueIdx = 6;
                            }

                            if (!currentDate) return;

                            const time = cells[timeIdx].textContent?.trim() || '';
                            const matchup = cells[matchupIdx].textContent?.trim() || '';
                            const venue = cells[venueIdx].textContent?.trim() || '';

                            if (matchup.includes('vs')) {
                                games.push({
                                    date: currentDate,
                                    time,
                                    matchup,
                                    venue
                                });
                            }
                        });
                        return games;
                    }, TARGET_YEAR);

                    console.log(`  Found ${results.length} games for ${series.name} in ${month}.`);

                    for (const item of results) {
                        const isoDate = item.date;
                        const safeMatchup = slugify(item.matchup);
                        const id = `kbo_${isoDate.replace(/-/g, '')}_${safeMatchup}`;

                        if (seenIds.has(id)) continue;
                        seenIds.add(id);

                        const mappedVenue = mapVenue(item.venue);
                        const parts = item.matchup.split('vs');
                        let homeTeam = '';
                        let awayTeam = '';
                        if (parts.length === 2) {
                            awayTeam = parts[0].trim();
                            homeTeam = parts[1].trim();
                        }

                        allPerformances.push({
                            id,
                            title: item.matchup,
                            image: THUMBNAIL_PATH,
                            date: `${isoDate} ${item.time}`,
                            venue: mappedVenue,
                            link: TARGET_URL,
                            region: classifyRegion(mappedVenue),
                            genre: 'baseball',
                            homeTeam,
                            awayTeam,
                            homeTeamLogo: TEAM_LOGOS[homeTeam] || '',
                            awayTeamLogo: TEAM_LOGOS[awayTeam] || ''
                        });
                    }
                } catch (e: any) {
                    console.error(`Error scraping ${series.name} in ${month}: ${e.message}`);
                }
            }
        }

        console.log(`Total collected: ${allPerformances.length}`);

        let existingItems: any[] = [];
        if (fs.existsSync(OUTPUT_PATH)) {
            try {
                existingItems = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf-8'));
            } catch (e) {}
        }

        const itemMap = new Map<string, any>();
        existingItems.forEach(item => itemMap.set(item.id, item));
        allPerformances.forEach(newItem => {
            if (itemMap.has(newItem.id)) {
                itemMap.set(newItem.id, { ...newItem, ...itemMap.get(newItem.id) });
            } else {
                itemMap.set(newItem.id, newItem);
            }
        });

        const finalItems = Array.from(itemMap.values());
        fs.writeFileSync(OUTPUT_PATH, JSON.stringify(finalItems, null, 2));
        console.log(`Saved ${finalItems.length} items to ${OUTPUT_PATH}`);

    } finally {
        await browser.close();
    }
}

withErrorHandling('kbo', scrapeKBO);

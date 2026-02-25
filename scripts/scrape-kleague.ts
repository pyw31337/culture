import axios from 'axios';
import fs from 'fs';
import path from 'path';

/**
 * K League 2026 Scraper
 * Uses official API to fetch K League 1 & 2 schedules.
 */

const OUTPUT_PATH = path.resolve(process.cwd(), 'src/data/kleague.json');
const API_URL = 'https://www.kleague.com/getScheduleList.do';
const YEAR = '2026';

// Team ID Mapping (Extracted during research)
const TEAM_MAP: Record<string, { id: string, name: string }> = {
    '울산': { id: 'K01', name: '울산 HD' },
    '수원': { id: 'K02', name: '수원 삼성' },
    '포항': { id: 'K03', name: '포항 스틸야드' },
    '제주': { id: 'K04', name: '제주 유나이티드' },
    '전북': { id: 'K05', name: '전북 현대' },
    '부산': { id: 'K06', name: '부산 아이파크' },
    '전남': { id: 'K07', name: '전남 드래곤즈' },
    '성남': { id: 'K08', name: '성남 FC' },
    '서울': { id: 'K09', name: 'FC 서울' },
    '대전': { id: 'K10', name: '대전 하나시티즌' },
    '대구': { id: 'K17', name: '대구 FC' },
    '인천': { id: 'K18', name: '인천 유나이티드' },
    '경남': { id: 'K20', name: '경남 FC' },
    '강원': { id: 'K21', name: '강원 FC' },
    '광주': { id: 'K22', name: '광주 FC' },
    '부천': { id: 'K26', name: '부천 FC 1995' },
    '안양': { id: 'K27', name: 'FC 안양' },
    '수원FC': { id: 'K29', name: '수원 FC' },
    '안산': { id: 'K32', name: '안산 그리너스' },
    '충남아산': { id: 'K34', name: '충남아산 FC' },
    '김천': { id: 'K35', name: '김천 상무' },
    '김포': { id: 'K36', name: '김포 FC' },
    '충북청주': { id: 'K37', name: '충북청주 FC' },
    '천안': { id: 'K38', name: '천안 시티 FC' },
    '화성': { id: 'K39', name: '화성 FC' },
    '파주': { id: 'K40', name: '파주 시민축구단' },
    '김해': { id: 'K41', name: '김해 시청축구단' },
    '용인': { id: 'K42', name: '용인 미르' }
};

function getLogoUrl(teamName: string) {
    for (const [key, val] of Object.entries(TEAM_MAP)) {
        if (teamName.includes(key)) {
            return `https://www.kleague.com/assets/images/emblem/emblem_${val.id}.png`;
        }
    }
    return '';
}

function slugify(text: string): string {
    return text
        .replace(/[^a-zA-Z0-9가-힣]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
}

async function scrapeKLeague() {
    console.log('Starting K League 2026 Scraper...');

    const allMatches: any[] = [];
    const months = ['02', '03', '04', '05', '06', '07', '08', '09', '10', '11'];
    const leagues = ['1', '2']; // K1, K2

    try {
        for (const league of leagues) {
            for (const month of months) {
                console.log(`Fetching League ${league}, Month ${month}...`);
                try {
                    const response = await axios.post(API_URL, {
                        leagueId: league,
                        year: YEAR,
                        month: month,
                        teamId: '',
                        ticketYn: ''
                    }, {
                        headers: {
                            'Content-Type': 'application/json',
                            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                            'Referer': 'https://www.kleague.com/schedule.do'
                        }
                    });

                    const data = response.data;
                    const list = data.data?.scheduleList || [];
                    console.log(`Found ${list.length} matches.`);

                    for (const match of list) {
                        const dateRaw = match.gameDate; // YYYY.MM.DD
                        const timeRaw = match.gameTime; // HH:MM

                        if (!dateRaw || !timeRaw) continue;

                        const dateStr = dateRaw.replace(/\./g, '-');
                        const timeStr = timeRaw;

                        const homeTeam = match.homeTeamName;
                        const awayTeam = match.awayTeamName;
                        const stadium = match.fieldNameFull;

                        const title = `${homeTeam} vs ${awayTeam}`;
                        const id = `kleague_${dateRaw}_${league}_${slugify(title)}`;

                        allMatches.push({
                            id,
                            title,
                            image: '/culture/images/posters/kleague_2026_default.webp',
                            date: `${dateStr} ${timeStr}`,
                            venue: stadium,
                            link: 'https://www.kleague.com/schedule.do',
                            region: classifyRegion(stadium),
                            genre: 'soccer',
                            league: league === '1' ? 'K League 1' : 'K League 2',
                            homeTeam,
                            awayTeam,
                            homeTeamLogo: getLogoUrl(homeTeam),
                            awayTeamLogo: getLogoUrl(awayTeam)
                        });
                    }
                } catch (err) {
                    console.error(`Error fetching League ${league}, Month ${month}:`, err);
                }

                await new Promise(r => setTimeout(r, 1000));
            }
        }

        const uniqueMatchesMap = new Map();
        allMatches.forEach(m => uniqueMatchesMap.set(m.id, m));
        const finalMatches = Array.from(uniqueMatchesMap.values());

        console.log(`Total matches collected: ${finalMatches.length}`);

        let existingData: any[] = [];
        if (fs.existsSync(OUTPUT_PATH)) {
            try {
                existingData = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf-8'));
            } catch (e) { }
        }

        const mergedMap = new Map();
        existingData.forEach(m => mergedMap.set(m.id, m));
        finalMatches.forEach(m => mergedMap.set(m.id, m));

        const mergedList = Array.from(mergedMap.values())
            .sort((a, b) => a.date.localeCompare(b.date));

        fs.writeFileSync(OUTPUT_PATH, JSON.stringify(mergedList, null, 2));
        console.log(`Saved to ${OUTPUT_PATH}`);

    } catch (err) {
        console.error('Fatal error during scraping:', err);
        throw err;
    }
}

function classifyRegion(venue: string): string {
    if (!venue) return 'etc';
    if (venue.includes('서울') || venue.includes('상암')) return 'seoul';
    if (venue.includes('경기') || venue.includes('인천') || venue.includes('수원') || venue.includes('용인') || venue.includes('화성') || venue.includes('안양') || venue.includes('부천') || venue.includes('김포')) return 'gyeonggi';
    if (venue.includes('부산') || venue.includes('울산') || venue.includes('경남') || venue.includes('창원')) return 'busan';
    if (venue.includes('대구') || venue.includes('포항')) return 'daegu';
    if (venue.includes('광주') || venue.includes('전주') || venue.includes('전남') || venue.includes('광양')) return 'gwangju';
    if (venue.includes('대전') || venue.includes('세종') || venue.includes('충남') || venue.includes('충북') || venue.includes('청주')) return 'daejeon';
    if (venue.includes('강원') || venue.includes('춘천') || venue.includes('강릉')) return 'gangwon';
    if (venue.includes('제주')) return 'jeju';
    return 'etc';
}

scrapeKLeague().then(() => {
    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});

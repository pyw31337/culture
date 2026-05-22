import axios from 'axios';
import fs from 'fs';
import path from 'path';

/**
 * K League 2026 Scraper
 * Uses official API to fetch K League 1 & 2 schedules.
 */

const OUTPUT_PATH = path.resolve(process.cwd(), 'src/data/kleague.json');
const POSTER_DIR = path.resolve(process.cwd(), 'public/images/posters/kleague');
const PUBLIC_POSTER_BASE = '/images/posters/kleague';
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

function slugify(text: string): string {
    return text
        .replace(/[^a-zA-Z0-9가-힣]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
}

function getTeamEntry(teamName: string) {
    return Object.entries(TEAM_MAP)
        .sort(([a], [b]) => b.length - a.length)
        .find(([key]) => teamName.includes(key))?.[1];
}

function getLogoUrl(teamName: string) {
    const team = getTeamEntry(teamName);
    return team ? `https://www.kleague.com/assets/images/emblem/emblem_${team.id}.png` : '';
}

function escapeXml(value: string) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function hasHangulFinalConsonant(value: string) {
    const char = value.trim().slice(-1);
    const code = char.charCodeAt(0) - 0xac00;
    return code >= 0 && code <= 11171 && code % 28 !== 0;
}

function pairParticle(value: string) {
    return hasHangulFinalConsonant(value) ? '과' : '와';
}

function buildMatchDescription(match: {
    leagueLabel: string;
    homeTeam: string;
    awayTeam: string;
    date: string;
    venue: string;
}) {
    return [
        `${match.leagueLabel} 공식 일정 기준 경기입니다.`,
        `홈 ${match.homeTeam}${pairParticle(match.homeTeam)} 원정 ${match.awayTeam}의 매치업이며, 킥오프는 ${match.date}로 예정되어 있습니다.`,
        match.venue ? `경기장은 ${match.venue}입니다.` : '',
        '예매 가능 여부와 좌석/가격은 K League 공식 일정 및 각 구단 예매 채널을 기준으로 확인하세요.',
    ].filter(Boolean).join('\n');
}

function ensureMatchPoster(details: {
    id: string;
    leagueLabel: string;
    homeTeam: string;
    awayTeam: string;
    date: string;
    venue: string;
    homeTeamLogo: string;
    awayTeamLogo: string;
}) {
    fs.mkdirSync(POSTER_DIR, { recursive: true });
    const fileName = `${slugify(details.id)}.svg`;
    const absolutePath = path.join(POSTER_DIR, fileName);
    const publicPath = `${PUBLIC_POSTER_BASE}/${fileName}`;
    const homeLogo = details.homeTeamLogo ? `<image href="${escapeXml(details.homeTeamLogo)}" x="130" y="520" width="280" height="280" preserveAspectRatio="xMidYMid meet" />` : '';
    const awayLogo = details.awayTeamLogo ? `<image href="${escapeXml(details.awayTeamLogo)}" x="790" y="520" width="280" height="280" preserveAspectRatio="xMidYMid meet" />` : '';
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="1600" viewBox="0 0 1200 1600" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0b1220"/>
      <stop offset="48%" stop-color="#12365d"/>
      <stop offset="100%" stop-color="#0f766e"/>
    </linearGradient>
    <radialGradient id="light" cx="50%" cy="34%" r="55%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.24"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="20" stdDeviation="24" flood-color="#000000" flood-opacity="0.28"/>
    </filter>
  </defs>
  <rect width="1200" height="1600" fill="url(#bg)"/>
  <rect width="1200" height="1600" fill="url(#light)"/>
  <path d="M80 1170 C260 1080 410 1280 590 1180 C775 1078 930 1205 1120 1110 L1120 1600 L80 1600 Z" fill="#ffffff" opacity="0.08"/>
  <rect x="90" y="96" width="1020" height="1408" rx="46" fill="#ffffff" opacity="0.1" stroke="#ffffff" stroke-opacity="0.24"/>
  <text x="600" y="210" text-anchor="middle" fill="#d7fff7" font-family="Arial, Helvetica, sans-serif" font-size="44" font-weight="800" letter-spacing="3">${escapeXml(details.leagueLabel.toUpperCase())}</text>
  <text x="600" y="308" text-anchor="middle" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="52" font-weight="800">${escapeXml(details.date)}</text>
  <g filter="url(#shadow)">
    <circle cx="270" cy="660" r="180" fill="#ffffff" opacity="0.94"/>
    <circle cx="930" cy="660" r="180" fill="#ffffff" opacity="0.94"/>
    ${homeLogo}
    ${awayLogo}
  </g>
  <text x="600" y="704" text-anchor="middle" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="76" font-weight="900">VS</text>
  <text x="270" y="938" text-anchor="middle" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="54" font-weight="900">${escapeXml(details.homeTeam)}</text>
  <text x="930" y="938" text-anchor="middle" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="54" font-weight="900">${escapeXml(details.awayTeam)}</text>
  <rect x="170" y="1060" width="860" height="150" rx="24" fill="#06111f" opacity="0.52"/>
  <text x="600" y="1132" text-anchor="middle" fill="#e6fffb" font-family="Arial, Helvetica, sans-serif" font-size="42" font-weight="800">${escapeXml(details.venue || 'K League Stadium')}</text>
  <text x="600" y="1192" text-anchor="middle" fill="#bdeee7" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="700">OFFICIAL SCHEDULE MATCH CARD</text>
  <text x="600" y="1410" text-anchor="middle" fill="#ffffff" opacity="0.72" font-family="Arial, Helvetica, sans-serif" font-size="28">K League schedule data</text>
</svg>
`;
    if (!fs.existsSync(absolutePath) || process.env.KLEAGUE_REBUILD_POSTERS === '1') {
        fs.writeFileSync(absolutePath, svg);
    }
    return publicPath;
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
                        const leagueLabel = league === '1' ? 'K League 1' : 'K League 2';
                        const date = `${dateStr} ${timeStr}`;
                        const homeTeamLogo = getLogoUrl(homeTeam);
                        const awayTeamLogo = getLogoUrl(awayTeam);
                        const image = ensureMatchPoster({
                            id,
                            leagueLabel,
                            homeTeam,
                            awayTeam,
                            date,
                            venue: stadium,
                            homeTeamLogo,
                            awayTeamLogo,
                        });
                        const description = buildMatchDescription({
                            leagueLabel,
                            homeTeam,
                            awayTeam,
                            date,
                            venue: stadium,
                        });

                        allMatches.push({
                            id,
                            title,
                            image,
                            backupPoster: '/images/soccer_poster.png',
                            date,
                            venue: stadium,
                            link: 'https://www.kleague.com/schedule.do',
                            region: classifyRegion(stadium),
                            genre: 'soccer',
                            league: leagueLabel,
                            homeTeam,
                            awayTeam,
                            homeTeamLogo,
                            awayTeamLogo,
                            description,
                            feesAndPrograms: description,
                            synopsisImages: [homeTeamLogo, awayTeamLogo].filter(Boolean),
                            sourceUpdatedAt: new Date().toISOString(),
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
            .map((match) => {
                const hasWeakImage = !match.image || /soccer_poster|fallback|placeholder/i.test(match.image);
                if (!hasWeakImage || !match.homeTeam || !match.awayTeam || !match.date) return match;

                const leagueLabel = match.league || 'K League';
                const homeTeamLogo = match.homeTeamLogo || getLogoUrl(match.homeTeam);
                const awayTeamLogo = match.awayTeamLogo || getLogoUrl(match.awayTeam);
                const description = buildMatchDescription({
                    leagueLabel,
                    homeTeam: match.homeTeam,
                    awayTeam: match.awayTeam,
                    date: match.date,
                    venue: match.venue || '',
                });
                return {
                    ...match,
                    image: ensureMatchPoster({
                        id: match.id,
                        leagueLabel,
                        homeTeam: match.homeTeam,
                        awayTeam: match.awayTeam,
                        date: match.date,
                        venue: match.venue || '',
                        homeTeamLogo,
                        awayTeamLogo,
                    }),
                    backupPoster: match.backupPoster || '/images/soccer_poster.png',
                    homeTeamLogo,
                    awayTeamLogo,
                    description: match.description || description,
                    feesAndPrograms: match.feesAndPrograms || description,
                    synopsisImages: Array.isArray(match.synopsisImages) && match.synopsisImages.length > 0
                        ? match.synopsisImages
                        : [homeTeamLogo, awayTeamLogo].filter(Boolean),
                    sourceUpdatedAt: match.sourceUpdatedAt || new Date().toISOString(),
                };
            })
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
    const compactVenue = venue.replace(/\s+/g, '');

    // Do not match the bare word "경기"; every stadium name contains "경기장".
    if (/서울|상암/.test(compactVenue)) return 'seoul';
    if (/인천/.test(compactVenue)) return 'incheon';
    if (/수원|용인|화성|안양|부천|김포|성남/.test(compactVenue)) return 'gyeonggi';
    if (/부산/.test(compactVenue)) return 'busan';
    if (/대구/.test(compactVenue)) return 'daegu';
    if (/광주/.test(compactVenue)) return 'gwangju';
    if (/대전/.test(compactVenue)) return 'daejeon';
    if (/울산/.test(compactVenue)) return 'ulsan';
    if (/세종/.test(compactVenue)) return 'sejong';
    if (/춘천|강릉|강원/.test(compactVenue)) return 'gangwon';
    if (/청주|충북/.test(compactVenue)) return 'chungbuk';
    if (/천안|아산|충남/.test(compactVenue)) return 'chungnam';
    if (/전주|전북/.test(compactVenue)) return 'jeonbuk';
    if (/전남|광양|목포/.test(compactVenue)) return 'jeonnam';
    if (/포항|경북|김천/.test(compactVenue)) return 'gyeongbuk';
    if (/창원|경남|김해/.test(compactVenue)) return 'gyeongnam';
    if (/제주/.test(compactVenue)) return 'jeju';
    return 'etc';
}

scrapeKLeague().then(() => {
    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});

import fs from 'fs';
import path from 'path';

const VENUES_PATH = path.join(process.cwd(), 'src/data/venues.json');

// Map region IDs (from interpark/scraper logic) to expected address keywords
const REGION_EXPECTATIONS: Record<string, string[]> = {
    'seoul': ['서울'],
    'gyeonggi': ['경기', '수원', '성남', '고양', '용인', '부천', '안산', '안양', '남양주', '화성', '평택', '의정부', '시흥', '파주', '광명', '김포', '군포', '광주', '이천', '양주', '오산', '구리', '안성', '포천', '의왕', '하남', '여주', '양평', '동두천', '과천', '가평', '연천'],
    'incheon': ['인천'],
    'busan': ['부산'],
    'daegu': ['대구'],
    'gwangju': ['광주'],
    'daejeon': ['대전'],
    'ulsan': ['울산'],
    'sejong': ['세종'],
    'gangwon': ['강원', '춘천', '원주', '강릉', '동해', '태백', '속초', '삼척', '홍천', '횡성', '영월', '평창', '정선', '철원', '화천', '양구', '인제', '고성', '양양'],
    'chungbuk': ['충북', '충청북도', '청주', '충주', '제천', '보은', '옥천', '영동', '증평', '진천', '괴산', '음성', '단양'],
    'chungnam': ['충남', '충청남도', '천안', '공주', '보령', '아산', '서산', '논산', '계룡', '당진', '금산', '부여', '서천', '청양', '홍성', '예산', '태안'],
    'jeonbuk': ['전북', '전라북도', '전북특별자치도', '전주', '군산', '익산', '정읍', '남원', '김제', '완주', '진안', '무주', '장수', '임실', '순창', '고창', '부안'],
    'jeonnam': ['전남', '전라남도', '목포', '여수', '순천', '나주', '광양', '담양', '곡성', '구례', '고흥', '보성', '화순', '장흥', '강진', '해남', '영암', '무안', '함평', '영광', '장성', '완도', '진도', '신안'],
    'gyeongbuk': ['경북', '경상북도', '포항', '경주', '김천', '안동', '구미', '영주', '영천', '상주', '문경', '경산', '군위', '의성', '청송', '영양', '영덕', '청도', '고령', '성주', '칠곡', '예천', '봉화', '울진', '울릉'],
    'gyeongnam': ['경남', '경상남도', '창원', '진주', '통영', '사천', '김해', '밀양', '거제', '양산', '의령', '함안', '창녕', '고성', '남해', '하동', '산청', '함양', '거창', '합천'],
    'jeju': ['제주', '서귀포']
};

interface PerformanceItem {
    id: string;
    title: string;
    venue: string;
    region?: string;
    source?: string;
}

function loadJSON(filename: string): PerformanceItem[] {
    const fullPath = path.join(process.cwd(), 'src/data', filename);
    if (!fs.existsSync(fullPath)) return [];
    try {
        return JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
    } catch {
        return [];
    }
}

function runAudit() {
    console.log('--- Starting Cross-Regional Anomaly Audit ---\n');

    // Load Venues Master Dictionary
    if (!fs.existsSync(VENUES_PATH)) {
        console.error('venues.json not found!');
        return;
    }
    const venues = JSON.parse(fs.readFileSync(VENUES_PATH, 'utf-8'));

    // Load Data Sources
    const interpark = loadJSON('interpark.json').map(i => ({ ...i, source: 'interpark' }));
    const timeticket = loadJSON('timeticket.json').map(i => ({ ...i, source: 'timeticket' }));
    // Add other regional sources if needed, but Interpark relies heavily on region codes

    const allItems = [...interpark, ...timeticket];

    let anomaliesCount = 0;
    const reportedVenues = new Set<string>();

    for (const item of allItems) {
        if (!item.region || !item.venue) continue;

        // Normalize region key (sometimes comes as uppercase or korean)
        let rKey = item.region.toLowerCase();

        // Convert Korean region names back to codes if necessary
        const koreanToCode: Record<string, string> = {
            '서울': 'seoul', '경기': 'gyeonggi', '인천': 'incheon', '부산': 'busan',
            '대구': 'daegu', '광주': 'gwangju', '대전': 'daejeon', '울산': 'ulsan',
            '세종': 'sejong', '강원': 'gangwon', '충북': 'chungbuk', '충남': 'chungnam',
            '전북': 'jeonbuk', '전남': 'jeonnam', '경북': 'gyeongbuk', '경남': 'gyeongnam',
            '제주': 'jeju'
        };

        if (koreanToCode[item.region]) rKey = koreanToCode[item.region];

        const expectedKeywords = REGION_EXPECTATIONS[rKey];
        if (!expectedKeywords) continue; // Unknown region

        const venueData = venues[item.venue];
        if (!venueData || !venueData.address || venueData.address === '정보 없음') continue;

        // Skip items where address contains ANY the expected keywords
        const addressText = venueData.address;
        const matchesExpected = expectedKeywords.some(kw => addressText.includes(kw));

        if (!matchesExpected) {
            // It's a suspected anomaly! The address doesn't contain the region's keyword.

            // To reduce noise, let's see if the address strongly implies ANOTHER known region
            let matchedOtherRegion = '';
            for (const [otherKey, otherKeywords] of Object.entries(REGION_EXPECTATIONS)) {
                if (otherKey === rKey) continue;
                if (otherKeywords.some(kw => addressText.includes(kw))) {
                    matchedOtherRegion = otherKey;
                    break;
                }
            }

            if (matchedOtherRegion && !reportedVenues.has(item.venue)) {
                console.log(`[ANOMALY MAPPED]`);
                console.log(`- Item Name    : ${item.title} (${item.id})`);
                console.log(`- Stated Region: ${rKey} (Expected: ${expectedKeywords[0]})`);
                console.log(`- Venue Name   : ${item.venue}`);
                console.log(`- DB Address   : ${venueData.address} ---> [Implies: ${matchedOtherRegion}]`);
                console.log('--------------------------------------------------');
                reportedVenues.add(item.venue);
                anomaliesCount++;
            }
        }
    }

    console.log(`\nAudit Complete. Found ${anomaliesCount} unique venue anomalies across cross-regions.`);
}

runAudit();

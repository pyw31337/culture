import fs from 'fs';
import path from 'path';
import axios from 'axios';

const VENUES_FILE = path.join(process.cwd(), 'src/data/venues.json');
const KAKAO_API_KEY = 'e18ee199818819d830c3fe479aa1ca71';

interface VenueData {
    name: string;
    address: string;
    lat?: number;
    lng?: number;
    district?: string;
}

// Helpers for string sanitation
const removeBrackets = (str: string) => str.replace(/\[.*?\]/g, ' ').trim();
const removeParentheses = (str: string) => str.replace(/\(.*?\)/g, ' ').trim();
const replaceHyphens = (str: string) => str.replace(/-/g, ' ').trim();
const stripNoiseWords = (str: string) => {
    const noise = [
        '특설무대', '리사이틀홀', '대공연장', '소공연장', '전시실', '상설전시실', '상설전시관',
        '미술관', '전시관', '특별전시마당', '기획전시실', '특별전시관', '세미나실', '교육실',
        '야외무대', '잔디마당', '로비', '입구', '정문', '동문', '서문', '남문', '북문',
        '휴게실', '안내데스크', '매표소', '주차장', '제1전시실', '제2전시실', '제3전시실',
        '지하1층', '지하2층', '1층', '2층', '3층', '4층', '5층', '본관', '별관', '신관',
        '아트홀', '콘서트홀', '가변석', '전용관', '어문학실', '박물관', '강당', '대강당', '소강당',
        '원형무대', '광장', '홀', '스페이스', '갤러리', '체육관', '실내체육관', '앞', '내', '부근',
        '온라인', '온라인스트리밍', '미정', '추후안내', '상세페이지설명'
    ];
    let cleaned = str;
    for (const w of noise) {
        // Only replace if it's not the ONLY word
        if (cleaned.replace(new RegExp(w, 'g'), '').trim().length > 1) {
             cleaned = cleaned.replace(new RegExp(w, 'g'), ' ');
        }
    }
    return cleaned.replace(/\s+/g, ' ').trim();
};

async function geocodeKakao(query: string): Promise<{lat: number, lng: number, address: string} | null> {
    if (!query || query.length < 2) return null;
    
    try {
        const res = await axios.get('https://dapi.kakao.com/v2/local/search/keyword.json', {
            headers: { 
                Authorization: `KakaoAK ${KAKAO_API_KEY}`
            },
            params: { query: query.trim(), size: 1 }
        });
        
        if (res.data && res.data.documents && res.data.documents.length > 0) {
            const doc = res.data.documents[0];
            return {
                lat: parseFloat(doc.y),
                lng: parseFloat(doc.x),
                address: doc.road_address_name || doc.address_name || query
            };
        }
    } catch (e: any) {
        // Quiet fail for rate limits or bad requests, we will retry gracefully
    }
    return null;
}

async function run() {
    console.log('🚀 Starting Advanced Coordinate Refinement');
    
    const rawData = fs.readFileSync(VENUES_FILE, 'utf8');
    const venues: Record<string, VenueData> = JSON.parse(rawData);
    
    let missingCount = 0;
    const missingKeys: string[] = [];
    
    for (const [key, venue] of Object.entries(venues)) {
        if (!venue.lat || !venue.lng) {
            missingCount++;
            missingKeys.push(key);
        }
    }
    
    console.log(`Found ${missingCount} venues missing coordinates. Beginning resolution...`);
    
    let resolvedCount = 0;
    
    for (let i = 0; i < missingKeys.length; i++) {
        const key = missingKeys[i];
        const rawName = key;
        
        // Strict ignore list
        const ignoreWords = ['상세', '참고', '참조', '홈페이지', 'URL', 'http', 'https', '온라인', '개별통보', '미정', '추후공지', '추후안내', 'No Venue Info', '일본', '도쿄', '오사카', '후쿠오카', '치앙마이', '싱가포르', '괌', '대만', '방콕', '다낭', '발리', '오키나와', '미국', '뉴저지', '애틀랜타', '올랜도', '펜실베니아'];
        if (ignoreWords.some(w => rawName.includes(w))) {
             console.log(`[-] Ignored:  '${rawName}' (Matched Ignore Rule)`);
             continue;
        }

        let result = null;
        let strategyUsed = '';

        // Strategy 1: Attempt the raw exact name (sometimes it just randomly fails the first time in build-venues)
        result = await geocodeKakao(rawName);
        if (result) strategyUsed = 'Raw Name';

        // Strategy 2: Remove brackets [서울]
        if (!result) {
            const clean1 = removeBrackets(rawName);
            if (clean1 !== rawName) {
                result = await geocodeKakao(clean1);
                if (result) strategyUsed = 'Removed Brackets';
            }
        }

        // Strategy 3: Remove parenthesis (상세주소)
        if (!result) {
            const clean2 = removeBrackets(removeParentheses(rawName));
            if (clean2 !== rawName) {
                result = await geocodeKakao(clean2);
                if (result) strategyUsed = 'Removed Parentheses';
            }
        }

        // Strategy 4: Strip noise words (특설무대, 리사이틀홀, 등)
        if (!result) {
            const clean3 = stripNoiseWords(removeBrackets(removeParentheses(rawName)));
            if (clean3 !== rawName && clean3.length >= 2) {
                result = await geocodeKakao(clean3);
                if (result) strategyUsed = 'Stripped Noise Words';
            }
        }

        // Disabled Strategy 5 (First Token Split) because it's too risky for Korean matching (e.g. "도쿄" -> "도쿄카페(한국)")
        
        // Strategy 6: Safe comma split (e.g. "벡스코, 영화의전당")
        if (!result && rawName.includes(',')) {
            const beforeComma = rawName.split(',')[0].trim();
            if (beforeComma.length >= 2) {
                // To be safe, try matching
                result = await geocodeKakao(beforeComma);
                // We only trust it if it's the exact name before comma
                if (result) strategyUsed = 'Safe Split Before Comma';
            }
        }
        
        // Strategy 7: Remove specific regional identifiers that confuse Kakao SDK (e.g. '투어패스', '패키지', '통합권')
        if (!result) {
            const clean4 = rawName.replace(/투어패스|패키지|통합권/g, '').trim();
            if (clean4 !== rawName && clean4.length >= 2) {
                result = await geocodeKakao(clean4);
                if (result) strategyUsed = 'Stripped Package Keywords';
            }
        }

        if (result) {
            venues[key].lat = result.lat;
            venues[key].lng = result.lng;
            venues[key].address = result.address;
            resolvedCount++;
            console.log(`[+] Resolved: '${rawName}' => ${result.lat}, ${result.lng} (Strategy: ${strategyUsed})`);
            
            // Save incrementally every 10 resolved items
            if (resolvedCount % 10 === 0) {
                 fs.writeFileSync(VENUES_FILE, JSON.stringify(venues, null, 2));
                 console.log(`[Autosave] Wrote checkpoint to disk...`);
            }
        } else {
            console.log(`[-] Failed:   '${rawName}'`);
        }

        // Rate limit protection: 100ms between items
        await new Promise(r => setTimeout(r, 100));
    }
    
    // Final save
    fs.writeFileSync(VENUES_FILE, JSON.stringify(venues, null, 2));
    console.log(`\n🎉 Refinement Complete! Resolved ${resolvedCount} out of ${missingCount} missing venues.`);
}

run();

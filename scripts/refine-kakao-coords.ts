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

        // Clean "위치대한민국", "위치 대한민국" prefix from rawName
        let baseName = rawName.replace(/^위치\s*대한민국\s*/, '').replace(/^위치\s*/, '').trim();

        // Strategy 1: Attempt the raw exact name (sometimes it just randomly fails the first time in build-venues)
        result = await geocodeKakao(baseName);
        if (result) strategyUsed = 'Raw Name';

        // Strategy 2: Remove brackets [서울]
        if (!result) {
            const clean1 = removeBrackets(baseName);
            if (clean1 !== rawName) {
                result = await geocodeKakao(clean1);
                if (result) strategyUsed = 'Removed Brackets';
            }
        }

        // Strategy 3: Remove parenthesis (상세주소)
        if (!result) {
            const clean2 = removeBrackets(removeParentheses(baseName));
            if (clean2 !== baseName) {
                result = await geocodeKakao(clean2);
                if (result) strategyUsed = 'Removed Parentheses';
            }
        }

        // Strategy 4: Strip noise words (특설무대, 리사이틀홀, 등)
        if (!result) {
            const clean3 = stripNoiseWords(removeBrackets(removeParentheses(baseName)));
            if (clean3 !== baseName && clean3.length >= 2) {
                result = await geocodeKakao(clean3);
                if (result) strategyUsed = 'Stripped Noise Words';
            }
        }

        // Disabled Strategy 5 (First Token Split) because it's too risky for Korean matching (e.g. "도쿄" -> "도쿄카페(한국)")
        
        // Strategy 6: Safe comma split (e.g. "벡스코, 영화의전당")
        if (!result && baseName.includes(',')) {
            const beforeComma = baseName.split(',')[0].trim();
            if (beforeComma.length >= 2) {
                // To be safe, try matching
                result = await geocodeKakao(beforeComma);
                // We only trust it if it's the exact name before comma
                if (result) strategyUsed = 'Safe Split Before Comma';
            }
        }
        
        // Strategy 7: Remove specific regional identifiers that confuse Kakao SDK (e.g. '투어패스', '패키지', '통합권')
        if (!result) {
            const clean4 = baseName.replace(/투어패스|패키지|통합권/g, '').trim();
            if (clean4 !== baseName && clean4.length >= 2) {
                result = await geocodeKakao(clean4);
                if (result) strategyUsed = 'Stripped Package Keywords';
            }
        }

        // Strategy 8: Safely Right-To-Left Word Trimming (Max 2 words removed)
        // e.g. "금천뮤지컬센터 금천예술극장" -> "금천뮤지컬센터"
        if (!result) {
            const cleanBase = removeBrackets(removeParentheses(baseName));
            let tokens = cleanBase.split(/\s+/).filter(t => t.length > 0);
            const initialCount = tokens.length;
            
            while (tokens.length > 1 && !result && (initialCount - tokens.length) < 2) {
                tokens.pop(); // Remove the right-most word
                const candidate = tokens.join(' ');
                
                // Reject overly generic 1-word fallbacks
                if (tokens.length === 1 && ['대한민국', '서울', '서울특별시', '경기', '경기도', '인천', '인천광역시', '대구', '대구광역시', '부산', '부산광역시', '광주', '대전', '미정', '온라인'].includes(candidate)) {
                     break; 
                }
                
                if (candidate.length >= 2) {
                    result = await geocodeKakao(candidate);
                    if (result) {
                        strategyUsed = 'Right-To-Left Word Trim';
                        break;
                    }
                }
            }
        }

        // Strategy 9: Address Prefix Extraction (동, 로, 길 + max 2 words)
        // e.g. "부산광역시 장전동 금정로 79 3층 몸아트 스튜디오" -> "부산광역시 장전동 금정로 79"
        if (!result) {
            const cleanBase = removeBrackets(removeParentheses(baseName));
            let tokens = cleanBase.split(/\s+/).filter(t => t.length > 0);
            
            // Check if it looks like an address (has 시/도, 구/군, and 동/로/길)
            const hasSido = tokens.some(t => /(시|도)$/.test(t));
            const hasDongRo = tokens.findIndex(t => /(동|로|길)\s*(\d+-?\d*)?$/.test(t));
            
            if (hasDongRo !== -1 && (hasSido || tokens[0].includes('서울') || tokens[0].includes('부산'))) {
                // If address logic matches, keep up to [Dong/Ro] + 1 or 2 tokens (usually the street number / building name)
                const keepCount = Math.min(hasDongRo + 2, tokens.length);
                const addressCandidate = tokens.slice(0, keepCount).join(' ');
                
                if (addressCandidate !== cleanBase) {
                    result = await geocodeKakao(addressCandidate);
                    if (result) {
                         strategyUsed = 'Address Extraction Trim';
                    }
                }
                
                // If that fails, try exactly the Dong/Ro + Number token
                if (!result && keepCount > hasDongRo + 1) {
                    const fallbackCandidate = tokens.slice(0, hasDongRo + 1).join(' ');
                    result = await geocodeKakao(fallbackCandidate);
                    if (result) {
                         strategyUsed = 'Address Exact Extraction Trim';
                    }
                }
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

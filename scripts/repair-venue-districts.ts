
import fs from 'fs';
import path from 'path';

const venueDictPath = path.join(process.cwd(), 'src', 'data', 'venue-dictionary.json');
const venueDict = JSON.parse(fs.readFileSync(venueDictPath, 'utf8'));

const SIGUNGU_SUFFIXES = ['시', '군', '구'];
const SIDO_MAP: Record<string, string> = {
    'seoul': '서울',
    'busan': '부산',
    'daegu': '대구',
    'incheon': '인천',
    'gwangju': '광주',
    'daejeon': '대전',
    'ulsan': '울산',
    'sejong': '세종',
    'gyeonggi': '경기',
    'gangwon': '강원',
    'chungbuk': '충북',
    'chungnam': '충남',
    'jeonbuk': '전북',
    'jeonnam': '전남',
    'gyeongbuk': '경북',
    'gyeongnam': '경남',
    'jeju': '제주'
};

let fixedCount = 0;

for (const [id, venue] of Object.entries(venueDict as any)) {
    if (!venue.district || venue.district === '') {
        const address = venue.address || '';
        const parts = address.split(/\s+/);
        
        let foundDistrict = '';

        // 1. Try to find the first part that ends with 시, 군, 구 (skipping the first part if it's a Sido)
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            
            // Skip the first part if it's obviously a Sido (e.g., "서울특별시", "경기도")
            if (i === 0 && (part.includes('특별') || part.includes('광역') || part.endsWith('도'))) {
                continue;
            }
            
            // Check if it ends with the suffixes
            if (SIGUNGU_SUFFIXES.some(s => part.endsWith(s))) {
                // Special case: if it's the Sido itself (like "부산시"), it might be the only part.
                // But usually we want the next level like "해운대구".
                // If it's the first part and it ends in '시' but it's a metropolitan city, keep looking.
                const isMetropolitanSido = ['서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종'].some(s => part.startsWith(s));
                if (i === 0 && isMetropolitanSido) continue;

                foundDistrict = part;
                break;
            }
        }

        // 2. Special cases for Sejong
        if (!foundDistrict && venue.mapped_region_id === 'sejong') {
            foundDistrict = '세종시';
        }

        // 3. Regex Fallback for cases without spaces or messy formats
        if (!foundDistrict) {
            const match = address.match(/([가-힣]+[구군시])\s/) || address.match(/([가-힣]+[구군시])$/);
            if (match) {
                const candidate = match[1];
                // Avoid capturing Sidos
                const isSido = Object.values(SIDO_MAP).some(s => candidate.includes(s));
                if (!isSido || (!candidate.includes('특별') && !candidate.includes('광역'))) {
                   foundDistrict = candidate;
                }
            }
        }

        if (foundDistrict) {
            venue.district = foundDistrict;
            fixedCount++;
            // console.log(`[FIXED] ${id}: ${address} -> ${foundDistrict}`);
        }
    }
}

console.log(`\nSuccessfully repaired ${fixedCount} districts.`);

fs.writeFileSync(venueDictPath, JSON.stringify(venueDict, null, 2));
console.log(`Updated ${venueDictPath}`);


import * as fs from 'fs';
import * as path from 'path';
import https from 'https';

// --- Configuration ---
const DATA_DIR = path.resolve(process.cwd(), 'src/data');
const VENUE_PATH = path.join(DATA_DIR, 'venues.json');
const PERF_FILES = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json') && f !== 'venues.json');

// --- Helper: Fetch URL ---
function fetchUrl(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

// --- Main Script ---
async function main() {
    console.log('Loading data...');
    const venueData = JSON.parse(fs.readFileSync(VENUE_PATH, 'utf-8'));

    const venuesToDelete = new Set<string>();

    // 1. Foreign & Explicit Deletion Rules
    const DELETE_KEYWORDS = [
        'Ogimachi', 'Omoromachi', 'Goya', 'Toyosu', 'Princeton St',
        'Japan', 'Tokyo', 'Osaka', 'Zepp Haneda', 'Zepp Namba',
        '관람가', '15세 이상', '12세 이상', '전체 관람가'
    ];

    // 2. Address Normalization Rules
    const REGION_MAP: Record<string, string> = {
        '강원도': '강원', '강원특별자치도': '강원',
        '경기도': '경기',
        '경상남도': '경남',
        '경상북도': '경북',
        '광주광역시': '광주',
        '대구광역시': '대구',
        '대전광역시': '대전',
        '부산광역시': '부산',
        '서울특별시': '서울',
        '세종특별자치시': '세종',
        '울산광역시': '울산',
        '인천광역시': '인천',
        '전라남도': '전남',
        '전라북도': '전북', '전북특별자치도': '전북',
        '제주특별자치도': '제주', '제주도': '제주',
        '충청남도': '충남',
        '충청북도': '충북'
    };

    // 3. Merging Groups (Regex or Exact)
    const MERGE_GROUPS: Record<string, string[]> = {
        '경복궁': ['경복궁', '경복궁 광화문', '경복궁 입장권', '경복궁 한복남', '경복궁아트홀', '경복궁역 5번 출구'],
        '벡스코': ['벡스코', '벡스코 오디토리움', '벡스코 제1전시장', '벡스코 컨벤션홀'],
        '성남아트센터': ['성남아트센터', '성남아트센터 오페라하우스', '성남아트센터 콘서트홀', '성남아트센터 앙상블시어터'],
        '부천시민회관': ['부천시민회관', '부천시민회관 대공연장', '부천시민회관 소공연장'],
        '모두투어': ['모두투어'],
        '고양어울림누리': ['고양어울림누리', '고양어울림누리 어울림극장', '고양어울림누리 별모래극장'],
        '나비공방': ['나비공방', '나비공방 상점', '나비상점', '나비상점 공방'],
        '국립중앙박물관': ['국립중앙박물관', ', 국립중앙박물관'],
        '빌리엔젤 당산역점': ['빌리엔젤 당산역점'],
        '연희빌딩': ['연희빌딩'],
    };

    const MANUAL_FIXES: Record<string, string> = {
        '나비공방 상점': '나비공방',
        '나비상점 공방': '나비공방',
        '홈힐러아로마공방': '홈힐러아로마공방',
        '달보컬스튜디오': '달보컬스튜디오',
        '해피에버애프터': '해피에버애프터',
        '키토스': '키토스',
        '뮤즈포터리': '뮤즈포터리'
    };

    console.log('Processing venues...');

    const newVenueData: Record<string, any> = {};
    const venueKeyMap: Record<string, string> = {}; // oldKey -> newKey

    for (const [key, v] of Object.entries(venueData)) {
        let venue = v as any;
        let originalKey = key;

        // --- SSSD Resolution ---
        if (originalKey.includes('sssd.co.kr')) {
            // Already resolved in previous passes hopefully, but if not:
            // Skip fetching in this synchronous pass to avoid timeouts, 
            // assuming previous run handled it using the 'address' field if it was saved.
            // If name is url, try to look at address.
            if (venue.name.includes('http')) {
                if (venue.address && !venue.address.includes('http')) {
                    venue.name = venue.address; // Fallback
                }
            }
        }

        // --- Filter Foreign & Irrelevant ---
        const address = venue.address || '';
        let shouldDel = false;
        for (const kw of DELETE_KEYWORDS) {
            if (originalKey.includes(kw) || venue.name.includes(kw) || address.includes(kw)) {
                shouldDel = true;
                break;
            }
        }
        if (originalKey.includes('15세') || venue.name.includes('15세')) shouldDel = true;

        if (shouldDel) {
            venuesToDelete.add(originalKey);
            continue;
        }

        // --- Name Cleaning Loop ---
        let name = venue.name;
        let prevName = '';

        // Loop until stable to remove stacked junk
        while (name !== prevName) {
            prevName = name;

            // 1. Remove Prefixes/Suffixes
            name = name.replace(/^(\(주\)|㈜)\s*/, '');
            name = name.replace(/^(모카클래스|모카플래스)\s*-\s*/, '');
            name = name.replace(/<\/?mark>/g, '');

            // 2. Brackets
            name = name.replace(/^\[.+?\]\s*/, '').replace(/\s*\[.+?\]$/, '')
                .replace(/^［.+?］\s*/, '').replace(/\s*［.+?］$/, '');

            // 3. Parenthesized Address "(계동)" "(관훈동, 쌈지길)"
            name = name.replace(/^\([^)]+\)\s*/, '');

            // 4. Floor/Unit info occurring at Start
            // "1층", "지하 1층,", "B1", "401호"
            name = name.replace(/^(지하\s*)?(B?\d+층|B\d+)\s*/, '');
            name = name.replace(/^\d+호\s*/, '');
            name = name.replace(/^빌딩\s*/, ''); // If just "빌딩" remains? Unlikely/Unsafe?
            // "연희빌딩 B1" -> "연희빌딩" handled later or via cleaning?

            // 5. Leading Punctuation (CRITICAL FIX for ", 국립중앙박물관")
            name = name.replace(/^[,.\s]+/, '');

            // 6. Meeting phrases
            name = name.replace(/^▶만남의 장소\s*:\s*/, '');
            name = name.replace(/\(자세한 안내는.*\)/, '');

            name = name.trim();
        }

        // 7. Handle Comma Split if it looks like "Address, Name" or "Building, Name"
        // User example: "송정빌딩 401호,달보컬스튜디오" -> With parens/floor removed above, might be "송정빌딩 401호,달보컬스튜디오"
        // If comma exists, check if First Part is address-like or floor-like
        if (name.includes(',')) {
            const parts = name.split(',');
            const first = parts[0].trim();
            // If first part has digits or specific words
            if (/\d+(층|호)|빌딩|지하/.test(first)) {
                if (parts.length > 1) {
                    name = parts.slice(1).join(' ').trim();
                }
            }
        }

        // 8. Address-like Name Extraction (Gangwon-do ...)
        const REGIONS = ['서울', '경기', '인천', '강원', '대전', '세종', '충남', '충북', '광주', '전남', '전북', '대구', '경북', '부산', '울산', '경남', '제주'];
        const REGION_PREFIX_REGEX = new RegExp(`^(${REGIONS.join('|')}|강원도|경기도|경상남도|경상북도|광주광역시|대구광역시|대전광역시|부산광역시|서울특별시|울산광역시|인천광역시|전라남도|전라북도|제주특별자치도|충청남도|충청북도|전북특별자치도)\\s+`);

        if (REGION_PREFIX_REGEX.test(name) && name.length > 15) {
            const addrEndMatch = name.match(/(로|길)\s*\d+([-\s]\d+)?/);
            if (addrEndMatch) {
                const cutoffIndex = addrEndMatch.index! + addrEndMatch[0].length;
                const potentialName = name.substring(cutoffIndex).trim();
                if (potentialName.length > 1 && !/^\d+$/.test(potentialName)) {
                    name = potentialName;
                }
            } else {
                // Fallback: If spaces exist, take last 2 words?
                // "전북 ... 하림"
                const tokens = name.split(' ');
                if (tokens.length > 3) {
                    // Check if last token is pure name
                    name = tokens[tokens.length - 1]; // "하림"
                }
            }
        }

        // 9. Manual Fixes & Misc
        if (name.includes('23, NAIL')) name = '23 NAIL';
        if (name.endsWith(' B1')) name = name.replace(/\s*B1$/, '');
        if (name.includes('빌리엔젤 당산역점')) name = '빌리엔젤 당산역점';

        if (MANUAL_FIXES[name]) name = MANUAL_FIXES[name];
        if (name.includes('나비공방') || name.includes('나비상점')) name = '나비공방';

        name = name.trim();
        venue.name = name;

        // --- Key Renaming / Merging ---
        let newKey = originalKey;

        // 1. Merge Groups
        let merged = false;
        for (const [targetName, sources] of Object.entries(MERGE_GROUPS)) {
            if (sources.some(s => venue.name.includes(s) || originalKey.includes(s))) {
                newKey = targetName;
                venue.name = targetName;
                merged = true;
                break;
            }
        }

        // 2. Rename Key to Clean Name if not merged
        if (!merged) {
            if (venue.name !== originalKey) {
                newKey = venue.name;
            }
        }

        // --- Address Normalization ---
        if (venue.address) {
            for (const [long, short] of Object.entries(REGION_MAP)) {
                if (venue.address.startsWith(long)) {
                    venue.address = venue.address.replace(long, short);
                }
            }
            // Dedup name in address
            if (venue.address.endsWith(venue.name)) {
                // venue.address = venue.address.slice(0, -venue.name.length).trim();
                // Careful not to over-trim
            }
        }

        // Add to new map
        if (!newVenueData[newKey]) {
            newVenueData[newKey] = venue;
        } else {
            // Merge logic: valid coords take precedence
            const existing = newVenueData[newKey];
            if ((!existing.lat || existing.lat === 0) && (venue.lat && venue.lat !== 0)) {
                existing.lat = venue.lat;
                existing.lng = venue.lng;
            }
            if (!existing.address || existing.address.length < 5) existing.address = venue.address;
            newVenueData[newKey] = existing;
        }

        if (originalKey !== newKey) {
            venueKeyMap[originalKey] = newKey;
        }
    }

    // --- Update Performance Files ---
    console.log('Updating performance data...');
    for (const file of PERF_FILES) {
        let fileChanged = false;
        const filePath = path.join(DATA_DIR, file);
        let content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        const isArray = Array.isArray(content);
        const perfs = isArray ? content : Object.values(content);

        const newPerfs: any[] = [];

        perfs.forEach((p: any) => {
            let vKey = p.venue;
            if (venuesToDelete.has(vKey)) return;
            if (venueKeyMap[vKey]) {
                p.venue = venueKeyMap[vKey];
                fileChanged = true;
            }
            newPerfs.push(p);
        });

        if (fileChanged || newPerfs.length !== perfs.length) {
            if (isArray) {
                fs.writeFileSync(filePath, JSON.stringify(newPerfs, null, 2));
            } else {
                const newObj: any = {};
                newPerfs.forEach(p => newObj[p.id] = p);
                fs.writeFileSync(filePath, JSON.stringify(newObj, null, 2));
            }
            console.log(`Updated ${file}`);
        }
    }

    // --- Save Venues ---
    venuesToDelete.forEach(k => delete newVenueData[k]);
    fs.writeFileSync(VENUE_PATH, JSON.stringify(newVenueData, null, 2));
    console.log(`Cleaning Complete. Saved venues.json`);
}

main().catch(console.error);

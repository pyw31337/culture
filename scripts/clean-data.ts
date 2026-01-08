
import fs from 'fs';
import path from 'path';

// Configuration for cleaning
const DATA_DIR = path.join(process.cwd(), 'src/data');
const VENUES_FILE = path.join(DATA_DIR, 'venues.json');

const FILES_TO_PROCESS = [
    'interpark.json',
    'timeticket.json',
    'myrealtrip-kids.json',
    'klook-class.json',
    'umclass.json',
    'mochaclass.json',
    'sssd-class.json'
];

// 1. Replacements (Exact or Partial updates)
const VENUE_ALIASES: Record<string, string> = {
    // Explicit User Mappings
    "오전(09~12시):석굴암(일주문 옆 세계유산 표지석)": "석굴암",
    "오후(13~16시):불국사 정문(세계유산 표지석)": "불국사",
    // Note: The user mentioned complex strings separated by |, typically found in description or name.
    // We will handle generic key matching logic below.
};

// 2. Keyword Consolidations (If name includes key, replace with value)
const BRAND_CONSOLIDATIONS = {
    '곤지암리조트': '곤지암리조트',
    '국립고궁박물관': '국립고궁박물관',
    '전쟁기념관': '전쟁기념관',
    '국립중앙박물관': '국립중앙박물관',
    '국립과천과학관': '국립과천과학관',
    '서대문형무소역사관': '서대문형무소역사관',
    '수원화성박물관': '수원화성박물관',
    '불국사': '불국사',
    '석굴암': '석굴암'
};

// 3. Exclusions (If venue name contains these, remove item)
const EXCLUDE_KEYWORDS = [
    'et theatre',
    'K-POP STAGE',
    'MUSEUM 209',
    'SA Hall', 'SA HALL',
    'SPACE BRICK',
    '안내사항을 확인하시기 바랍니다',
    '해당없음(No information)'
];

// 4. Regional Exclusions (Start of name or address)
const EXCLUDE_REGIONS = ["부산", "대구", "광주", "대전", "울산", "세종", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주"];

// 5. Specific Address Fixes for Venues (Pre-seed venues.json)
const ADDRESS_OVERRIDES: Record<string, string> = {
    "(주)에버랜드": "경기 용인시 처인구 포곡읍 에버랜드로 199",
    "에버랜드": "경기 용인시 처인구 포곡읍 에버랜드로 199"
};

function cleanVenueName(original: string): string {
    if (!original) return '';
    let name = original.trim();

    // Strategy 1: quoted name at end of address string
    // e.g. "경기 ... (수택동) 2층 '쑤록 아트 스튜디오'" -> "쑤록 아트 스튜디오"
    const quoteMatch = name.match(/'([^']+)'$/);
    if (quoteMatch) {
        return quoteMatch[1];
    }

    // Strategy 2: Consolidations
    for (const [key, target] of Object.entries(BRAND_CONSOLIDATIONS)) {
        if (name.includes(key)) {
            // Special check for "Location outside Seoul" validation?
            // The logic runs globally, but filtering happens later.
            return target;
        }
    }

    // Strategy 3: Complex "Meeting Place" handling
    // "▶만남의 장소 : 국립과천과학관..." -> "국립과천과학관"
    if (name.includes('만남의 장소') && name.includes('국립과천과학관')) return '국립과천과학관';
    if (name.includes('만남의 장소') && name.includes('국립중앙박물관')) return '국립중앙박물관';
    if (name.includes('만남의 장소') && name.includes('서대문형무소역사관')) return '서대문형무소역사관';
    if (name.includes('만남의 장소') && name.includes('수원화성박물관')) return '수원화성박물관';

    // Strategy 4: Aliases
    if (VENUE_ALIASES[name]) return VENUE_ALIASES[name];

    return name;
}

function processFiles() {
    let removedCount = 0;
    let modifiedCount = 0;

    // Load Venues
    let venues: any = {};
    if (fs.existsSync(VENUES_FILE)) {
        venues = JSON.parse(fs.readFileSync(VENUES_FILE, 'utf-8'));
    }

    // Apply Address Overrides immediately
    for (const [vName, vAddr] of Object.entries(ADDRESS_OVERRIDES)) {
        if (!venues[vName]) venues[vName] = { name: vName, district: '' };
        venues[vName].address = vAddr;
    }

    FILES_TO_PROCESS.forEach(file => {
        const filePath = path.join(DATA_DIR, file);
        if (!fs.existsSync(filePath)) return;

        let items = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        const initialLen = items.length;

        items = items.filter((item: any) => {
            let vName = item.venue || '';
            const vAddr = (item.address || venues[vName]?.address || '').trim();

            // 1. Exclude based on keywords
            if (EXCLUDE_KEYWORDS.some(k => vName.includes(k))) return false;

            // 2. Exclude based on Address Region (if known)
            if (vAddr) {
                // Check if starts with excluded region
                // Sometimes address is "부산광역시..." or "부산 ..."
                for (const region of EXCLUDE_REGIONS) {
                    if (vAddr.startsWith(region)) return false;
                }
            }

            // 3. Exclude based on Venue Name starting with Region (heuristic)
            for (const region of EXCLUDE_REGIONS) {
                if (vName.startsWith(region)) return false;
            }

            return true;
        });

        // Normalize Names
        items.forEach((item: any) => {
            const oldName = item.venue || '';
            const newName = cleanVenueName(oldName);

            if (oldName !== newName) {
                item.venue = newName;
                modifiedCount++;
            }
        });

        if (items.length !== initialLen) {
            removedCount += (initialLen - items.length);
        }

        fs.writeFileSync(filePath, JSON.stringify(items, null, 2));
    });

    // Save Venues (Aliases applied via override)
    fs.writeFileSync(VENUES_FILE, JSON.stringify(venues, null, 2));

    console.log(`Cleanup Complete.`);
    console.log(`Removed Items: ${removedCount}`);
    console.log(`Modified Venue Names: ${modifiedCount}`);
}

processFiles();

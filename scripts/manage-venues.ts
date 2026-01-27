
import fs from 'fs';
import path from 'path';

/**
 * Venue Management & Validation System
 * 
 * This script serves as the source of truth for venue normalization rules.
 * Use it to:
 * 1. Validate 'venues.json' for missing data or inconsistencies.
 * 2. Apply manual corrections and mergers (preserving 'Gold Standard' data).
 * 3. Clean up junk data from source files.
 */

const DATA_DIR = path.resolve(process.cwd(), 'src/data');
const VENUES_FILE = path.resolve(DATA_DIR, 'venues.json');

// --- GOLD STANDARD RULES ---

/**
 * Venues that should NEVER be overwritten by automated scrapers.
 * Includes manually found coordinates and road name addresses.
 */
export const MANUAL_OVERRIDES: Record<string, any> = {
    '국립 대한민국임시정부 기념관': { address: '서울 서대문구 통일로 279-24', lat: 37.5760175, lng: 126.9543382 },
    '국립대구박물관': { address: '대구광역시 수성구 청호로 321 국립대구박물관', lat: 35.8456135, lng: 128.6379176 },
    '법원전시관': { address: '서울특별시 서초구 서초대로 219 대법원 청사 동관 1층', lat: 37.4922388, lng: 127.0053301 },
    '서울랜드': { address: '경기도 과천시 광명로 181', lat: 37.4372231, lng: 127.0246975 },
    '성암아트홀': { address: '서울특별시 강남구 선릉로111길 6 3F 전층', lat: 37.5110419, lng: 127.0429529 },
    '세종문화예술회관': { address: '세종특별자치시 조치원읍 문예회관길 22', lat: 36.599438, lng: 127.2874384 },
    '포포문': { address: '서울 동대문구 고산자로36길 3 경동시장 신관 3층 청년몰 70123호 포포문', lat: 37.5792013, lng: 127.0388331 },
    '국립대구과학관': { address: '대구광역시 달성군 유가읍 테크노대로6길 20 국립대구과학관', lat: 35.6866333, lng: 128.4653167 },
    '화성행궁': { address: '경기 수원시 팔달구 정조로 825', lat: 37.2819666, lng: 127.013727 }
};

/**
 * Key merger map. Alias -> Target Key.
 */
export const MERGE_MAP: Record<string, string> = {
    '서울숲, 뚝섬역 일대 및 서울 전역': '서울숲',
    '세종문화예술회관 대공연장(세종시)': '세종문화예술회관',
    '신관 3층 포포문(PopoMoon)': '포포문',
    '창덕궁 매표소 앞': '창덕궁',
    '화성행궁 신풍루 매표소 앞': '화성행궁',
    '화성행궁 앞(체험 전 담당 강사님이 개별 연락드립니다.)': '화성행궁',
};

/**
 * Phrases or substrings that indicate a venue should be ignored/deleted.
 */
export const BLACKLIST_PATTERNS = [
    /sssd\.co\.kr/,
    /해당공연 공연장/,
    /해당없음/,
    /상세페이지 참조/,
    /상세주소는 클래스신청시 안내/,
    /뵙겠습니다/
];

// --- CORE LOGIC ---

export function normalizeVenueName(name: string): string {
    if (!name) return '';
    let normalized = name.trim();

    // 1. Apply Regex Blacklist (return empty if blacklisted)
    for (const pattern of BLACKLIST_PATTERNS) {
        if (pattern.test(normalized)) return '';
    }

    // 2. Apply Merger Map
    if (MERGE_MAP[normalized]) {
        normalized = MERGE_MAP[normalized];
    }

    // 3. Specific patterns (e.g., Changgyeonggung variations)
    if (normalized.startsWith('창경궁') && normalized.includes('옥천교')) {
        normalized = '창경궁';
    }

    // 4. Clean up "뵙겠습니다" suffixes if not caught by blacklist
    normalized = normalized.replace(/에서\s*뵙겠습니다\.?$/, '').replace(/뵙겠습니다\.?$/, '').trim();

    return normalized;
}

/**
 * Validates venues.json and source files.
 */
export async function validate() {
    console.log('--- Venue Validation Report ---');
    const venues = JSON.parse(fs.readFileSync(VENUES_FILE, 'utf-8'));
    const issues: string[] = [];

    for (const [key, data] of Object.entries(venues)) {
        const v = data as any;
        if (!v.address || v.address === '정보 없음' || v.address === '서울' || v.address === '경기') {
            issues.push(`[Missing Address] ${key}`);
        }
        if (!v.lat || !v.lng || v.lat === 0) {
            issues.push(`[Missing Coords] ${key}`);
        }
    }

    if (issues.length > 0) {
        console.warn(`Found ${issues.length} potential data issues.`);
        issues.forEach(issue => console.warn(issue));
    } else {
        console.log('All venues have basic data. Great!');
    }
    return issues;
}

/**
 * Synchronizes source JSON files with normalized venue names.
 */
export async function syncSourceFiles() {
    const dataFiles = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json') && f !== 'venues.json' && f !== 'venues.backup.json');

    for (const file of dataFiles) {
        const filePath = path.join(DATA_DIR, file);
        let content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        let modified = false;

        if (Array.isArray(content)) {
            const initialCount = content.length;
            content = content.filter(item => {
                const oldName = item.venue || '';
                const newName = normalizeVenueName(oldName);

                if (oldName && !newName) {
                    modified = true;
                    return false; // Deleted/Blacklisted
                }

                if (oldName !== newName) {
                    item.venue = newName;
                    modified = true;
                }
                return true;
            });

            if (content.length !== initialCount) modified = true;
        }

        if (modified) {
            fs.writeFileSync(filePath, JSON.stringify(content, null, 2));
            console.log(`Synced: ${file}`);
        }
    }
}

/**
 * Enforces MANUAL_OVERRIDES on venues.json.
 */
export function applyGoldStandard() {
    const venues = JSON.parse(fs.readFileSync(VENUES_FILE, 'utf-8'));
    let modified = false;

    for (const [name, goldData] of Object.entries(MANUAL_OVERRIDES)) {
        if (!venues[name]) {
            venues[name] = { name, ...goldData };
            modified = true;
        } else {
            // Check if actual data matches gold data
            for (const [field, value] of Object.entries(goldData)) {
                if (venues[name][field] !== value) {
                    venues[name][field] = value;
                    modified = true;
                }
            }
        }
    }

    if (modified) {
        fs.writeFileSync(VENUES_FILE, JSON.stringify(venues, null, 2));
        console.log('Applied Gold Standard overrides to venues.json');
    }
}

// If run directly
if (require.main === module) {
    (async () => {
        applyGoldStandard();
        await syncSourceFiles();
        await validate();
    })();
}

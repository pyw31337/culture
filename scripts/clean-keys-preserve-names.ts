
import * as fs from 'fs';
import * as path from 'path';
import https from 'https';

// --- Configuration ---
const DATA_DIR = path.resolve(process.cwd(), 'src/data');
const VENUE_PATH = path.join(DATA_DIR, 'venues.json');
const PERF_FILES = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json') && f !== 'venues.json');

// --- Main Script ---
async function main() {
    console.log('Loading updated data...');
    const venueData = JSON.parse(fs.readFileSync(VENUE_PATH, 'utf-8'));

    // --- 1. Global Setup & Regexes ---
    const venuesToDelete = new Set<string>();
    const DELETE_KEYWORDS = [
        'Ogimachi', 'Omoromachi', 'Goya', 'Toyosu', 'Princeton St',
        'Japan', 'Tokyo', 'Osaka', 'Zepp Haneda', 'Zepp Namba',
        '관람가', '15세 이상', '12세 이상', '전체 관람가', '청소년 관람불가'
    ];

    const REGION_MAP: Record<string, string> = {
        '강원도': '강원', '강원특별자치도': '강원', '경기도': '경기', '경상남도': '경남', '경상북도': '경북',
        '광주광역시': '광주', '대구광역시': '대구', '대전광역시': '대전', '부산광역시': '부산',
        '서울특별시': '서울', '세종특별자치시': '세종', '울산광역시': '울산', '인천광역시': '인천',
        '전라남도': '전남', '전라북도': '전북', '전북특별자치도': '전북', '제주특별자치도': '제주', '제주도': '제주',
        '충청남도': '충남', '충청북도': '충북'
    };

    const MERGE_GROUPS: Record<string, string[]> = {
        '경복궁': ['경복궁', '경복궁 광화문', '경복궁 입장권', '경복궁 한복남', '경복궁아트홀', '경복궁역 5번 출구'],
        '벡스코': ['벡스코', '벡스코 오디토리움', '벡스코 제1전시장', '벡스코 컨벤션홀'],
        '성남아트센터': ['성남아트센터', '성남아트센터 오페라하우스', '성남아트센터 콘서트홀', '성남아트센터 앙상블시어터'],
        '부천시민회관': ['부천시민회관', '부천시민회관 대공연장', '부천시민회관 소공연장'],
        '모두투어': ['모두투어'],
        '고양어울림누리': ['고양어울림누리', '고양어울림누리 어울림극장', '고양어울림누리 별모래극장'],
        '고양아람누리': ['고양아람누리', '고양아람누리 아람극장', '고양아람누리 아람음악당', '고양아람누리 새라새극장'],
        '나비공방': ['나비공방', '나비공방 상점', '나비상점', '나비상점 공방'],
        '국립중앙박물관': ['국립중앙박물관', ', 국립중앙박물관'],
        '빌리엔젤 당산역점': ['빌리엔젤 당산역점'],
        '연희빌딩': ['연희빌딩'],
        '안면도 꽃지카트장＆atv': ['안면도 꽃지카트장＆atv', '안면도 꽃지카트장＆atv, 고카트'],
        '클래스콕': ['클래스콕', '스타필드 고양 3층 클래스콕 A룸', '3층 클래스콕'],
        '오두산통일전망대': ['오두산통일전망대', '오두산 통일전망대'],
        '곤지암리조트 살로몬스키스쿨': ['곤지암리조트 살로몬스키스쿨'],
        '광주시문화예술의전당': ['광주시문화예술의전당'],
        '구로아트밸리 예술극장': ['구로아트밸리 예술극장', '구로아트밸리예술극장']
    };

    const MANUAL_FIXES: Record<string, string> = {
        '나비공방 상점': '나비공방', '나비상점 공방': '나비공방',
        '홈힐러아로마공방': '홈힐러아로마공방', '달보컬스튜디오': '달보컬스튜디오',
        '해피에버애프터': '해피에버애프터', '키토스': '키토스', '뮤즈포터리': '뮤즈포터리',
        '리더플렉스 스카이 601호': '리더플렉스 스카이 601호',
        '잎새의향기 아로마공방': '잎새의 향기 아로마공방',
        '파밀리아플라워&까페': '파밀리아플라워&까페',
        '이지드럼': '이지드럼',
        '모두의요리아카데미': '모두의요리아카데미',
        '덕포진교육박물관': '덕포진교육박물관',
        '미호 박물관': '미호 박물관',
        '디자인씽킹뮤지엄': '디자인씽킹뮤지엄',
        '강릉녹색도시 체험센터': '강릉녹색도시 체험센터',
        '강릉아레나': '강릉아레나',
        '오죽헌': '오죽헌',
        '국립과천과학관': '국립과천과학관',
        '서대문형무소역사관': '서대문형무소역사관',
        '수원화성박물관': '수원화성박물관',
        'SEHWA': 'SEHWA',
        '고양어린이박물관': '고양어린이박물관',
        '구로아트밸리 예술극장': '구로아트밸리 예술극장'
    };

    const LOCATION_UPDATES: Record<string, { address: string, lat: number, lng: number }> = {
        '국립과천과학관': { address: '경기 과천시 상하벌로 110', lat: 37.4381, lng: 127.0056 },
        '서대문형무소역사관': { address: '서울 서대문구 통일로 251', lat: 37.5724, lng: 126.9608 },
        '수원화성박물관': { address: '경기 수원시 팔달구 창룡대로 21', lat: 37.2825, lng: 127.0195 }
    };

    const PREFECTURES = ['서울', '경기', '인천', '강원', '대전', '세종', '충남', '충북', '광주', '전남', '전북', '대구', '경북', '부산', '울산', '경남', '제주'];
    const CITIES = ['고양시', '수원시', '성남시', '용인시', '부천시', '안산시', '안양시', '남양주시', '화성시', '평택시', '의정부시', '시흥시', '파주시', '광명시', '김포시', '군포시', '광주시', '이천시', '양주시', '오산시', '구리시', '안성시', '포천시', '의왕시', '하남시', '여주시', '양평군', '동두천시', '과천시', '가평군', '연천군'];
    const REGION_PREFIX_REGEX = new RegExp(`^(${PREFECTURES.join('|')}|${CITIES.join('|')}|강원도|강원특별자치도|경기도|경상남도|경상북도|광주광역시|대구광역시|대전광역시|부산광역시|서울특별시|울산광역시|인천광역시|전라남도|전라북도|제주특별자치도|충청남도|충청북도|전북특별자치도)\\s+`);

    console.log('Processing venues (Phase 1: Standardization)...');

    // Preliminary Pass for Name Standardization
    const newVenueData: Record<string, any> = {};
    const venueKeyMap: Record<string, string> = {};

    for (const [key, v] of Object.entries(venueData)) {
        let venue = v as any;
        let originalKey = key;

        // --- 1. Reverse Address Fix Logic ---
        function fixReverseAddress(str: string): string | null {
            if (str && str.includes('대한민국') && str.includes(',')) {
                const parts = str.split(',').map(s => s.trim()).reverse();
                const validParts = parts.filter(p => !p.match(/^\d{5}$/) && p !== '대한민국');
                const regionIdx = validParts.findIndex(p => PREFECTURES.some(r => p.includes(r.slice(0, 2))));
                if (regionIdx !== -1) {
                    return validParts.slice(regionIdx).join(' ');
                }
            }
            return null;
        }

        const fixedAddr = fixReverseAddress(venue.address);
        if (fixedAddr) {
            venue.address = fixedAddr;
        }

        const fixedKey = fixReverseAddress(originalKey);
        let cleanName = venue.name || originalKey;
        if (fixedKey) {
            cleanName = fixedKey;
            if (!venue.address || venue.address.length < 5 || venue.address.includes('대한민국')) {
                venue.address = fixedKey;
            }
        }

        // --- 2. Filter Deletes ---
        const address = venue.address || '';
        if (DELETE_KEYWORDS.some(k => originalKey.includes(k) || cleanName.includes(k) || address.includes(k))) {
            venuesToDelete.add(originalKey);
            continue;
        }

        // --- 3. Name Cleaning ---
        let prevName = '';
        while (cleanName !== prevName) {
            prevName = cleanName;
            cleanName = cleanName.replace(/^(\(주\)|㈜)\s*/, '').replace(/^(모카클래스|모카플래스)\s*-\s*/, '');
            cleanName = cleanName.replace(/<\/?mark>/g, '');
            cleanName = cleanName.replace(/^\[.+?\]\s*/, '').replace(/\s*\[.+?\]$/, '').replace(/^［.+?］\s*/, '').replace(/\s*［.+?］$/, '');
            cleanName = cleanName.replace(/^\([^)]+\)\s*/, '');
            cleanName = cleanName.replace(/^(지하\s*)?(B?\d+층|B\d+)\s*/, '').replace(/^\d+호\s*/, '').replace(/^빌딩\s*/, '');
            cleanName = cleanName.replace(/^[,.\s]+/, '');

            cleanName = cleanName.replace(/\s*內\s*로비\s*$/, '');
            cleanName = cleanName.replace(/\s*입구\s*앞\s*$/, '');
            cleanName = cleanName.replace(/\s*로비\s*$/, '');
            cleanName = cleanName.replace(/\s*오죽헌\s*$/, '');
            cleanName = cleanName.replace(/\s*\([^)]*(도보|출구|거리)[^)]*\)$/, '');
            cleanName = cleanName.replace(/\s*(지하\s*)?(B?\d+층|B\d+)\s*$/, '');
            cleanName = cleanName.replace(/^▶만남의 장소\s*:\s*/, '').replace(/\(자세한 안내는.*\)/, '');

            if (cleanName.endsWith('대한민국')) {
                const fixed = fixReverseAddress(cleanName);
                if (fixed) cleanName = fixed;
            }
            cleanName = cleanName.trim();
        }

        if (originalKey.includes('리더플렉스 스카이 601호')) cleanName = '리더플렉스 스카이 601호';
        if (cleanName.includes('길찾기 우편번호') && cleanName.includes('부천로3번길 48')) cleanName = '경기 부천시 원미구 부천로3번길 48';
        if (cleanName.includes('23, NAIL')) cleanName = '23 NAIL';
        if (cleanName.endsWith(' B1')) cleanName = cleanName.replace(/\s*B1$/, '');
        if (cleanName.includes('빌리엔젤 당산역점')) cleanName = '빌리엔젤 당산역점';
        if (cleanName.includes('잎새의') && cleanName.includes('향기')) cleanName = '잎새의 향기 아로마공방';
        if (cleanName.includes('파밀리아플라워')) cleanName = '파밀리아플라워&까페';
        if (MANUAL_FIXES[cleanName]) cleanName = MANUAL_FIXES[cleanName];
        if (cleanName.includes('나비공방') || cleanName.includes('나비상점')) cleanName = '나비공방';

        // --- 4. Address Extraction from Name ---
        if (REGION_PREFIX_REGEX.test(cleanName) && cleanName.length > 15) {
            const addrEndMatch = cleanName.match(/(로|길|대로)\s+(\d+)(?:[-\s]\d+)?/);
            if (addrEndMatch) {
                const cutoffIndex = addrEndMatch.index! + addrEndMatch[0].length;
                let pot = cleanName.substring(cutoffIndex).trim();
                let pPrev = '';
                while (pot !== pPrev) {
                    pPrev = pot;
                    pot = pot.replace(/^\([^)]+\)\s*/, '').replace(/^(지하\s*)?(B?\d+층|B\d+)\s*/, '').replace(/^\d+호\s*/, '').replace(/^[,.\s]+/, '')
                        .replace(/\s*(지하\s*)?(B?\d+층|B\d+)\s*$/, '').trim();
                }
                const isMeaningful = pot.length > 1 && !/^\d+$/.test(pot) && !/^[-\d]+$/.test(pot);
                if (isMeaningful) cleanName = pot;
            }
        }

        const MEANINGLESS = /^(\d+층|B?\d+호|지하\s*\d+층|층|호|지하)$/;
        const SINGLE_CHAR_ALPHANUM = /^[A-Z]동$/;
        const MOUNTAIN_ADDR = /^산\s*\d+$/;
        const ROAD_FRAG = /^(번길|대로|로)\s*\d+([-\s]\d+)?/;
        const PARENS_FLOOR = /^\([^)]+\)\s*(\d+층|B?\d+호).*$/;

        if (cleanName.length < 2 || MEANINGLESS.test(cleanName) || SINGLE_CHAR_ALPHANUM.test(cleanName) ||
            MOUNTAIN_ADDR.test(cleanName) || ROAD_FRAG.test(cleanName) || cleanName.startsWith('번길') || PARENS_FLOOR.test(cleanName)) {
            if (venue.address && venue.address.length > 5 && !venue.address.includes('정보 없음')) {
                cleanName = venue.address;
            } else {
                cleanName = venue.name;
            }
        }

        cleanName = cleanName.trim().replace(/^[-\s]+/, '').replace(/[-\s]+$/, '');
        if (REGION_PREFIX_REGEX.test(cleanName)) {
            for (const [long, short] of Object.entries(REGION_MAP)) {
                if (cleanName.startsWith(long)) {
                    cleanName = cleanName.replace(long, short);
                    break;
                }
            }
        }
        if (cleanName === '') cleanName = originalKey;

        // --- 5. Merge Grouping ---
        let newKey = originalKey;
        let merged = false;

        for (const [targetName, sources] of Object.entries(MERGE_GROUPS)) {
            if (sources.some(s => cleanName.includes(s) || originalKey.includes(s) || (venue.name && venue.name.includes(s)))) {
                newKey = targetName;
                merged = true;
                break;
            }
            const looseSources = sources.map(s => s.replace(/\s+/g, ''));
            const looseClean = cleanName.replace(/\s+/g, '');
            if (looseSources.some(s => looseClean.includes(s))) {
                newKey = targetName;
                merged = true;
                break;
            }
        }

        if (!merged) {
            if (cleanName && cleanName.length > 0) newKey = cleanName;
        }

        const update = LOCATION_UPDATES[newKey];
        if (update) {
            venue.address = update.address;
            venue.lat = update.lat;
            venue.lng = update.lng;
        }
        if (venue.address) {
            const fixed = fixReverseAddress(venue.address);
            if (fixed) venue.address = fixed;

            for (const [long, short] of Object.entries(REGION_MAP)) {
                if (venue.address.startsWith(long)) venue.address = venue.address.replace(long, short);
            }
        }

        // --- 6. Store with Priority ---
        if (!newVenueData[newKey]) {
            newVenueData[newKey] = venue;
        } else {
            const existing = newVenueData[newKey];
            if ((!existing.lat || existing.lat === 0) && (venue.lat && venue.lat !== 0)) {
                existing.lat = venue.lat;
                existing.lng = venue.lng;
            }
            if (!existing.address || existing.address.length < 5) existing.address = venue.address;

            if (existing.address && existing.address.includes('대한민국') && venue.address && !venue.address.includes('대한민국')) {
                existing.address = venue.address;
            }
            newVenueData[newKey] = existing;
        }
        if (originalKey !== newKey) venueKeyMap[originalKey] = newKey;
    }

    // --- 7. Phase 2: Address-Based Merging ---
    console.log('Processing venues (Phase 2: Address Clustering)...');

    // Create an Address Normalizer for clustering
    const normalizeAddrForCluster = (addr: string) => {
        return addr.replace(/\s+/g, '').replace(/[0-9\-]+$/g, ''); // Remove trailing numbers for broader match? No, detailed address defines unique venue.
        // Actually, identical address means IDENTICAL.
        // But spacing issues: "A B" vs "AB".
        // remove whitespace.
        return addr.replace(/\s+/g, '');
    };

    const addressToKeys: Record<string, string[]> = {};
    for (const [key, venue] of Object.entries(newVenueData)) {
        if (!venue.address || venue.address.length < 5) continue;
        const normalizedAddr = normalizeAddrForCluster(venue.address);
        if (!addressToKeys[normalizedAddr]) addressToKeys[normalizedAddr] = [];
        addressToKeys[normalizedAddr].push(key);
    }

    for (const [addr, keys] of Object.entries(addressToKeys)) {
        if (keys.length < 2) continue;

        // Sorting strategy: 
        // 1. Prefer shorter names (parents)
        // 2. Prefer names without parentheses
        // 3. Prefer names without "Hall", "Theater", "극장" suffix if multiple
        keys.sort((a, b) => {
            const lenDiff = a.length - b.length;
            if (Math.abs(lenDiff) > 0) return lenDiff;
            return a.localeCompare(b);
        });

        const shortest = keys[0]; // Candidate for Parent

        // Aggressive Merge: If they share the same address, they ARE the same facility complex.
        // We should merge them if they share a common name prefix/substring.

        // Test: Do they share a common bigram/trigram?
        // Or simpler: Does the shortest string appear in the others?

        const allMatch = keys.every(k => {
            const ks = k.replace(/\s+/g, '');
            const ss = shortest.replace(/\s+/g, '');
            return ks.includes(ss);
        });

        if (allMatch && shortest.length > 1) {
            console.log(`Merging Cluster by Address [${addr.slice(0, 10)}...]: ${keys.join(', ')} -> ${shortest}`);
            keys.forEach(k => {
                if (k !== shortest) {
                    venueKeyMap[k] = shortest;
                }
            });
        } else {
            // If NOT all match (e.g. "Seoul Art Center" vs "Hangaram Museum" at same address),
            // We might NOT want to merge them blindly unless user asked to.
            // User asked: "verify duplicates by address... merge them".
            // If they are distinct entities (Museum vs Hall) at same address, merging might be lossy.
            // BUT user example: "Goyang Aram Nuri" vs "Aram Theater" -> Merge.
            // These definitely share "Aram Nuri" prefix.

            // What if "Goyang Aram Nuri" (shortest) is NOT the prefix? 
            // Ex: "Aram Theater", "Aram Music Hall". Shortest is "Aram Theater".
            // They don't contain each other.
            // We need a Common Prefix Finder.

            // Skipping complex common prefix for now, sticking to containment.
            // If the list contains a "Parent" (like "Goyang Aram Nuri"), shortest logic works.
            // If the list is just siblings ("Hall A", "Hall B"), shortest logic fails (Hall A != Hall B).
            // In that case, we should possibly NOT merge, or look for manually defined entry.
        }
    }

    for (const [origin, target] of Object.entries(venueKeyMap)) {
        let final = target;
        let hops = 0;
        while (venueKeyMap[final] && venueKeyMap[final] !== final && hops < 5) {
            final = venueKeyMap[final];
            hops++;
        }
        venueKeyMap[origin] = final;
        if (!newVenueData[final] && newVenueData[target]) {
            newVenueData[final] = newVenueData[target];
        }
    }

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
            } else if (!newVenueData[vKey] && newVenueData[vKey.replace(/\s+/g, '')]) {
                p.venue = vKey.replace(/\s+/g, '');
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

    venuesToDelete.forEach(k => delete newVenueData[k]);
    const finalVenues: Record<string, any> = {};
    for (const [k, v] of Object.entries(newVenueData)) {
        if (venueKeyMap[k] && venueKeyMap[k] !== k) continue;
        finalVenues[k] = v;
    }

    fs.writeFileSync(VENUE_PATH, JSON.stringify(finalVenues, null, 2));
    console.log(`Cleaning Complete. Saved venues.json`);
}

main().catch(console.error);


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
        '구로아트밸리 예술극장': ['구로아트밸리 예술극장', '구로아트밸리예술극장'],
        '천마아트센터': ['영남대 천마아트센터', '영남대학교 천마아트센터', '영남대 천마아트센터 그랜드홀', '영남대학교 천마아트센터 그랜드홀'],
        '드림닥터 인천점': ['드림닥터 인천점', '의사직업체험 드림닥터 인천점', '인천 의사직업체험 드림닥터', '의사직업체험 드림닥터'],
        '인천어린이과학관': ['인천어린이과학관', '인천어린이과학관 공연장'],
        '광화문 광장 세종대왕 동상': ['광화문 광장 세종대왕 동상', '광화문 광장 세종대왕 동상 앞'],
        '국립경주박물관': ['국립경주박물관', '국립경주박물관 내 물품보관함 앞'],
        '남산골한옥마을': ['남산골한옥마을', '남산골 한옥마을 內 천우각 앞', '서울남산국악당'],
        '곤지암리조트': ['곤지암리조트', '곤지암리조트 살로몬스키스쿨', '곤지암리조트렌탈샵 닥터스노우', '곤지암리조트 렌탈샵 보스'],
        '덕수궁': ['덕수궁', '덕수궁 내', '덕수궁 대한문', '덕수궁 대한문 매표소 앞', '덕수궁 돌담길', '덕수궁 정문', '덕수궁 정문 앞', '덕수궁 정문 앞(대한문)'],
        '대한민국역사박물관': ['대한민국역사박물관', '대한민국역사박물관 1층 안내데스크 앞'],
        '코나투스': ['코나투스', "''코나투스''", '<코나투스>']
    };

    const MANUAL_FIXES: Record<string, string> = {
        '남양성모성지 대성당': '남양성모성지',
        '논현빌딩(디마코빌딩) 1층 왼편 꽃집, 마리에 플라워 스튜디오': '마리에 플라워 스튜디오',
        '곤지암리조트 살로몬스키스쿨': '곤지암리조트',
        '강원 화천군 화천읍 일원': '강원 화천군 화천읍',
        '홈힐러아로마공방': '홈힐러아로마공방', '달보컬스튜디오': '달보컬스튜디오',
        '해피에버애프터': '해피에버애프터', '키토스': '키토스', '뮤즈포터리': '뮤즈포터리',
        '리더플렉스 스카이 601호': '리더플렉스 스카이 601호',
        '잎새의향기 아로마공방': '잎새의 향기 아로마공방',
        '파밀리아플라워&까페': '파밀리아플라워&까페',
        '이지드럼': '이지드럼',
        '모두의요리아카데미': '모두의요리아카데미',
        '덕포진교육박물관': '덕포진교육박물관',
        '미호 박물관': '미호박물관',
        '디자인씽킹뮤지엄': '디자인씽킹뮤지엄',
        '강릉녹색도시 체험센터': '강릉녹색도시 체험센터',
        '강릉아레나': '강릉아레나',
        '오죽헌': '오죽헌',
        '국립과천과학관': '국립과천과학관',
        '서대문형무소역사관': '서대문형무소역사관',
        '수원화성박물관': '수원화성박물관',
        'SEHWA': 'SEHWA',
        '고양어린이박물관': '고양어린이박물관',
        '구로아트밸리 예술극장': '구로아트밸리 예술극장',
        '부산 KBS홀': 'KBS부산홀',
        'KBS 부산홀': 'KBS부산홀',
        '대전 우송예술회관': '우송예술회관',
        '우송대학교 우송예술회관': '우송예술회관',
        '오설록 오설록': '오설록 티뮤지엄',
        '층 드림닥터 인천점': '드림닥터 인천점',
        '서울역(본옥)': '문화역서울284',
        '101동': '에그쉘',
        '2동 202': '모카클래스 (부평구)',
        // New fixes from user request
        '(방화동': '서울 강서구 금낭화로 40 3층',
        '(봉천동': '서울 관악구',
        '(수유동': '서울 강북구',
        '(잠원동': '서울 서초구',
        "''코나투스''": '코나투스',
        '<코나투스>': '코나투스',
        ') 위워크 을지로점': '__REMOVE__',
        '1F': '서울 강남구 논현로 661 1F',
        '2F': '서울 강남구 논현로 661 2F',
        '2충 휘향찬란': '휘향찬란',
        '광화문 플래티넘빌딩(스타벅스 정부서울청사 R점)인근, 정확한 장소는 솜씨당 채팅으로 안내드렸습니다': '광화문 플래티넘빌딩',
        '국립 서해안 기후대기센터 국립서해안기류대기센터': '국립서해안기후대기센터',
        '국립무형유산원 국립무형유산원 꿈나래터 디지털체험관': '국립무형유산원',
        '대한문 입장 후 좌측 고객정보센터 앞(덕수궁 입장권 개별 구매)': '대한문',
        // User request 2026-01-27
        '_랑쌤드럼 (뚜레쥬르주안북부점 건물)': '랑쌤드럼',
        '곤지암리조트 살로몬스키스쿨': '__REMOVE__',
        '근린생활시설': '__REMOVE__'
    };

    const LOCATION_UPDATES: Record<string, { address: string, lat: number, lng: number }> = {
        '강원 화천군 화천읍': { address: '강원 화천군 화천읍', lat: 38.1062, lng: 127.7082 },
        '경기 고양시 일산동구 율천로8번길 8-6': { address: '경기 고양시 일산동구 율천로8번길 8-6', lat: 37.6653, lng: 126.7843 },
        '곤지암리조트': { address: '경기도 광주시 도척면 도척윗로 278', lat: 37.3372, lng: 127.2954 },
        '광화문 광장 세종대왕 동상': { address: '서울 종로구 세종대로 175', lat: 37.5725, lng: 126.9756 },
        '국립민속박물관': { address: '서울특별시 종로구 삼청로 37', lat: 37.5816, lng: 126.9790 },
        '국립세계문자박물관': { address: '인천 연수구 센트럴로 217', lat: 37.3947, lng: 126.6377 },
        '국립경주박물관': { address: '경북 경주시 일정로 186', lat: 35.8289, lng: 129.2280 },
        '남산골한옥마을': { address: '서울 중구 퇴계로34길 28', lat: 37.5593, lng: 126.9945 },
        '남양성모성지': { address: '경기도 화성시 남양읍 남양성지로 112', lat: 37.2055, lng: 126.8167 },
        '마리에 플라워 스튜디오': { address: '서울 강남구 언주로134길 31', lat: 37.5197, lng: 127.0345 },
        '니리므의상실': { address: '충남 공주시 백미고을길 5-7', lat: 36.4578, lng: 127.1219 },
        '대학로 마로니에 공원': { address: '서울 종로구 대학로8길 1', lat: 37.5804, lng: 127.0028 },
        '서울숲 가족마당': { address: '서울 성동구 뚝섬로 273', lat: 37.5443, lng: 127.0374 },
        '수원화성박물관': { address: '경기 수원시 팔달구 창룡대로 21', lat: 37.2825, lng: 127.0195 },
        // New locations from user request
        '코나투스': { address: '서울특별시 중구 을지로38길 40 4층', lat: 37.5665, lng: 126.9925 },
        '휘향찬란': { address: '서울 종로구 인사동길 44', lat: 37.5736, lng: 126.9853 },
        '광화문 플래티넘빌딩': { address: '서울 종로구 새문안로5가길 28', lat: 37.5730, lng: 126.9794 },
        '대한문': { address: '서울특별시 중구 세종대로 99', lat: 37.5658, lng: 126.9752 },
        '대한민국역사박물관': { address: '서울특별시 종로구 세종대로 198', lat: 37.5753, lng: 126.9779 },
        '덕수궁': { address: '서울 중구 세종대로 99', lat: 37.5658, lng: 126.9752 },
        '국립서해안기후대기센터': { address: '충남 태안군 안면읍 승언리', lat: 36.5389, lng: 126.3306 },
        '국립무형유산원': { address: '전북 전주시 완산구 서학로 95', lat: 35.8133, lng: 127.1258 },
        // User request 2026-01-27
        '랑쌤드럼': { address: '경기 고양시 일산동구 율천로8번길 8-6 (마두동)', lat: 37.6653, lng: 126.7843 },
        '달빛꽃': { address: '서울 서초구 방배로23길 14 지하1층', lat: 37.4878, lng: 126.9894 },
        '더시에나프리보 까보스코': { address: '제주특별자치도 서귀포시 용흥로66번길 158-7 더 시에나 프리모 까보스코 본관 1층', lat: 33.2540, lng: 126.4115 },
        '덕스(DUEX) 부산': { address: '부산 부산진구 중앙대로666번길 50 더샵센트럴스타 B1', lat: 35.1590, lng: 129.0600 },
        '동궁원+바니베어뮤지엄': { address: '경북 경주시 보문로 74-14', lat: 35.8444, lng: 129.2753 },
        '레이저레나엑스 제주점': { address: '제주특별자치도 서귀포시 소보리당로164번길 62 중문랜드 1층', lat: 33.2540, lng: 126.4120 }
    };

    const PREFECTURES = ['서울', '경기', '인천', '강원', '대전', '세종', '충남', '충북', '광주', '전남', '전북', '대구', '경북', '부산', '울산', '경남', '제주'];
    const CITIES = ['고양시', '수원시', '성남시', '용인시', '부천시', '안산시', '안양시', '남양주시', '화성시', '평택시', '의정부시', '시흥시', '파주시', '광명시', '김포시', '군포시', '광주시', '이천시', '양주시', '오산시', '구리시', '안성시', '포천시', '의왕시', '하남시', '여주시', '양평군', '동두천시', '과천시', '가평군', '연천군'];
    const REGION_PREFIX_REGEX = new RegExp(`^(${PREFECTURES.join('|')}|${CITIES.join('|')}|서울시|부산시|대구시|인천시|광주시|대전시|울산시|세종시|강원도|강원특별자치도|경기도|경상남도|경상북도|광주광역시|대구광역시|대전광역시|부산광역시|서울특별시|울산광역시|인천광역시|전라남도|전라북도|제주특별자치도|충청남도|충청북도|전북특별자치도)\\s+`);

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
        // Check for __REMOVE__ marker in MANUAL_FIXES
        if (MANUAL_FIXES[originalKey] === '__REMOVE__' || MANUAL_FIXES[cleanName] === '__REMOVE__') {
            venuesToDelete.add(originalKey);
            console.log(`Deleting venue (manual remove): ${originalKey}`);
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

            // Floor Info Removal (Specific User Request)
            // '소양강 물문화관 B1층~' -> '소양강 물문화관'
            cleanName = cleanName.replace(/\s*(?:지하)?(?:B?\d+층)(?:[~-].*)?$/, '');
            cleanName = cleanName.replace(/\s*(?:B?\d+호).*$/, ''); // Remove '101호' etc if trailing

            cleanName = cleanName.replace(/^▶만남의 장소\s*:\s*/, '').replace(/\(자세한 안내는.*\)/, '');

            if (cleanName.endsWith('대한민국')) {
                const fixed = fixReverseAddress(cleanName);
                if (fixed) cleanName = fixed;
            }
            cleanName = cleanName.trim();
        }

        // Repetition Check: 'A A' -> 'A'
        // '태백고생대자연사박물관 태백고생대자연사박물관'
        const nameParts = cleanName.split(/\s+/);
        if (nameParts.length === 2 && nameParts[0] === nameParts[1]) {
            cleanName = nameParts[0];
        }

        if (originalKey.includes('리더플렉스 스카이 601호')) cleanName = '리더플렉스 스카이 601호';
        if (cleanName.endsWith(' 일원')) cleanName = cleanName.replace(' 일원', '');
        if (cleanName === '1동' || originalKey.includes('3930-39 1동')) cleanName = '경기도 안성시 공도읍 서동대로 3930-39 1동 3층 103호';
        if (cleanName.includes('길찾기 우편번호') && cleanName.includes('부천로3번길 48')) cleanName = '경기 부천시 원미구 부천로3번길 48';
        if (cleanName.includes('23, NAIL')) cleanName = '23 NAIL';
        if (cleanName.endsWith(' B1')) cleanName = cleanName.replace(/\s*B1$/, '');
        if (cleanName.includes('빌리엔젤 당산역점')) cleanName = '빌리엔젤 당산역점';
        if (cleanName.includes('잎새의') && cleanName.includes('향기')) cleanName = '잎새의 향기 아로마공방';
        if (cleanName.includes('파밀리아플라워')) cleanName = '파밀리아플라워&까페';
        if (MANUAL_FIXES[cleanName]) cleanName = MANUAL_FIXES[cleanName];
        if (cleanName.includes('나비공방') || cleanName.includes('나비상점')) cleanName = '나비공방';
        if (cleanName.includes('서울역(본옥)')) cleanName = '문화역서울284';
        if (cleanName.includes('층 드림닥터 인천점')) cleanName = '드림닥터 인천점';
        if (cleanName.includes('태디베어뮤지엄')) cleanName = '테디베어뮤지엄 제주';
        if (cleanName === '오설록') cleanName = '오설록 티뮤지엄';

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

        const MEANINGLESS = /^(\d+층|B?\d+호|지하\s*\d+층|층|호|지하|층\s*\d+호|\d+동)$/; // Added '층 101호' and '101동' pattern
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

        // Manual Revert for '1동' (Must happen AFTER address extraction)
        if (cleanName === '1동' || cleanName.includes('1동 3층') || originalKey.includes('3930-39 1동')) {
            cleanName = '경기도 안성시 공도읍 서동대로 3930-39 1동 3층 103호';
            // Also fix venue.name if it is meaningless
            if (venue.name === '1동' || venue.name.includes('1동 3층')) venue.name = cleanName;
        }

        // --- 5. Merge Grouping ---
        let newKey = originalKey;
        let merged = false;

        // Update MERGE GROUPS dynamically if possible or trust Manual Fixes
        // Specific Requests:
        if (cleanName.includes('김대중컨벤션센터')) {
            newKey = '김대중컨벤션센터'; merged = true;
        } else if (cleanName.includes('링크아트센터드림')) {
            newKey = '링크아트센터드림'; merged = true;
        } else if (cleanName.includes('공주문예회관') && (cleanName.includes('대공연장') || cleanName.includes('소공연장'))) {
            newKey = '공주문예회관'; merged = true;
        } else if (cleanName.includes('군포문화예술회관') && (cleanName.includes('수리홀') || cleanName.includes('철쭉홀'))) {
            newKey = '군포문화예술회관'; merged = true;
        } else if (cleanName.includes('대구문화예술회관') && (cleanName.includes('비슬홀') || cleanName.includes('팔공홀') || cleanName.includes('대극장'))) {
            newKey = '대구문화예술회관'; merged = true;
        } else if (cleanName.includes('대구콘서트하우스') && (cleanName.includes('그랜드홀') || cleanName.includes('챔버홀'))) {
            newKey = '대구콘서트하우스'; merged = true;
        } else if (cleanName.includes('김해 롯데워터파크')) {
            newKey = '김해 롯데워터파크'; merged = true;
        } else if (cleanName.includes('다이나믹 메이즈') || cleanName.includes('다이나믹메이즈')) {
            newKey = '다이나믹 메이즈 인사동점'; merged = true;
        } else if (cleanName.includes('국립민속박물관')) {
            newKey = '국립민속박물관'; merged = true;
        } else if (cleanName.includes('국립춘천박물관')) {
            newKey = '국립춘천박물관'; merged = true;
        } else if (cleanName.includes('대릉원')) {
            newKey = '대릉원'; merged = true;
        } else if (cleanName.includes('서대문형무소')) {
            newKey = '서대문형무소역사관'; merged = true;
        } else if (cleanName.includes('백제고분로 지하 368')) {
            newKey = '서울 송파구 백제고분로 지하 368 (석촌동, 석촌역)'; merged = true;
        } else if (cleanName.includes('세라잼') || cleanName.includes('세라젬') || cleanName.includes('세라젬 웰파크')) {
            newKey = '세라젬 웰파크 위례점'; merged = true;
        } else if (cleanName.includes('세종문화회관')) {
            newKey = '세종문화회관'; merged = true;
        } else if (cleanName.includes('신한카드 SOL페이 스퀘어')) {
            newKey = '신한카드 SOL페이 스퀘어'; merged = true;
        } else if (cleanName.includes('엘림아트센터')) {
            newKey = '엘림아트센터'; merged = true;
        } else if (cleanName.includes('예술의전당') || cleanName.includes('예술의 전당')) {
            newKey = '예술의전당'; merged = true;
        } else if (cleanName.includes('용인문화예술원') || cleanName.includes('용인시문화예술원')) {
            newKey = '용인문화예술원'; merged = true;
        } else if (cleanName.includes('스카이라인루지 통영') || cleanName.includes('통영 스카이라인루지')) {
            newKey = '스카이라인루지 통영'; merged = true;
        } else if (cleanName.includes('부산 엑스더스카이') || cleanName.includes('부산 랜드마크')) {
            newKey = '부산 엑스더스카이'; merged = true;
        } else if (cleanName.includes('테디베어뮤지엄 제주') || cleanName.includes('태디베어뮤지엄')) {
            newKey = '테디베어뮤지엄 제주'; merged = true;
        } else if (cleanName.includes('우송예술회관')) {
            newKey = '우송예술회관'; merged = true;
        } else if (cleanName.includes('오설록 티뮤지엄') || cleanName.includes('오설록 오설록')) {
            newKey = '오설록 티뮤지엄'; merged = true;
        } else if (cleanName.includes('KBS부산홀') || cleanName.includes('부산 KBS홀')) {
            newKey = 'KBS부산홀'; merged = true;
        }

        if (!merged) {
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
        }

        if (!merged) {
            if (cleanName && cleanName.length > 0) newKey = cleanName;
        }

        // Manual Location Updates (User Requests)
        if (newKey === '국립춘천박물관') {
            venue.address = '강원 춘천시 우석로 70';
            venue.lat = 37.8656;
            venue.lng = 127.7471;
        } else if (newKey === '국립항공박물관') {
            venue.address = '서울 강서구 하늘길 177';
            venue.lat = 37.5557;
            venue.lng = 126.7977;
        } else if (newKey === '김대중컨벤션센터') {
            venue.address = '광주 서구 상무누리로 30';
            venue.lat = 35.1464;
            venue.lng = 126.8394;
        } else if (newKey === '대릉원') {
            venue.address = '경북 경주시 황남동 31-1';
            venue.lat = 35.8392;
            venue.lng = 129.2185;
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
            // First time seeing this key
            venue.name = newKey;
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
            // Always update name to the cleanest version (newKey)
            existing.name = newKey;
            newVenueData[newKey] = existing;
        }
        if (originalKey !== newKey) venueKeyMap[originalKey] = newKey;
    }

    // Helper: Levenshtein Distance
    function levenshtein(a: string, b: string): number {
        const matrix = [];
        for (let i = 0; i <= b.length; i++) matrix[i] = [i];
        for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                if (b.charAt(i - 1) === a.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }
        return matrix[b.length][a.length];
    }

    // --- 7. Phase 2: Address-Based Merging ---
    console.log('Processing venues (Phase 2: Address Clustering)...');

    // Create an Address Normalizer for clustering
    // Strict normalization: Only remove spaces. Keep numbers.
    const normalizeAddrForCluster = (addr: string) => {
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

        // EXCEPTION: Don't merge "Mocha Class" type generic venues if they have different suffixes but same address?
        // Actually Mocha Class usually has DIFFERENT addresses. If same address, merge is fine.

        const allMatch = keys.every(k => {
            const ks = k.replace(/\s+/g, '');
            const ss = shortest.replace(/\s+/g, '');
            return ks.includes(ss);
        });

        // Relaxed Merge for specific cases (like Art Centers) where shortest might not be strict substring of sibling
        // e.g. "Gongju Art Center Main Hall" vs "Gongju Art Center Small Hall" -> "Gongju Art Center"
        // But if Shortest is "Gongju Art Center", it IS a substring.
        // What if Shortest is just "Art Center"?

        // User said: "Addresses are perfectly identical... merge to one".
        // So I should TRUST the address cluster more for clearly related items.

        if (allMatch && shortest.length > 1) {
            console.log(`Merging Cluster by Address [${addr.slice(0, 10)}...]: ${keys.join(', ')} -> ${shortest}`);
            keys.forEach(k => {
                if (k !== shortest) {
                    venueKeyMap[k] = shortest;
                }
            });
        }
    }

    // Apply Address Merges
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

    // --- 8. Phase 3: Coordinate-Based Clustering (New!) ---
    console.log('Processing venues (Phase 3: Coordinate Clustering)...');

    const coordToKeys: Record<string, string[]> = {};

    // Helper to format coords (round to 4 decimal places ~11m precision)
    const getCoordKey = (lat: number, lng: number) => {
        if (!lat || !lng) return null;
        return `${lat.toFixed(4)},${lng.toFixed(4)}`;
    };

    for (const [key, venue] of Object.entries(newVenueData)) {
        // Skip correctly processed ones
        if (venueKeyMap[key] && venueKeyMap[key] !== key) continue;

        const cKey = getCoordKey(venue.lat, venue.lng);
        if (cKey) {
            if (!coordToKeys[cKey]) coordToKeys[cKey] = [];
            coordToKeys[cKey].push(key);
        }
    }

    for (const [cKey, keys] of Object.entries(coordToKeys)) {
        if (keys.length < 2) continue;
        // Sort by length to find potential parent
        keys.sort((a, b) => a.length - b.length || a.localeCompare(b));
        const shortest = keys[0];

        // Merge logic: If they share strict substring OR specific known patterns
        // e.g. "Osan Art Center" vs "Osan Art Center Grand Hall" -> Merge
        // "Osan Art Center" vs "Osan Art Center Small Hall" -> Merge

        // Check if Shortest is contained in ALL others (ignoring spaces)
        const allMatch = keys.every(k => {
            const ks = k.replace(/\s+/g, '');
            const ss = shortest.replace(/\s+/g, '');
            return ks.includes(ss);
        });

        // Also check manual override for Osan specifically if automatic fails
        // Actually if shortest is "오산문화예술회관", and others are "오산문화예술회관 대공연장", it works.
        // But what if shortest is "대공연장"? (Unlikely due to cleanup, but possible)

        if (allMatch && shortest.length > 1) {
            console.log(`Merging Cluster by Coordinates [${cKey}]: ${keys.join(', ')} -> ${shortest}`);

            // Address Selection Strategy: Prefer Road Name (contains '로' or '길' usually)
            // Retrieve all addresses in this cluster
            const addresses = keys.map(k => newVenueData[k]?.address).filter(Boolean);
            const roadAddr = addresses.find(a => /[로길]/.test(a) && !/^\d/.test(a)); // Has 'Ro' or 'Gil', not just number

            if (roadAddr && newVenueData[shortest]) {
                // Use Road Address for the parent
                newVenueData[shortest].address = roadAddr;
            }

            keys.forEach(k => {
                if (k !== shortest) {
                    venueKeyMap[k] = shortest;
                }
            });
        } else {
            // Try to find a Common Prefix
            // e.g. "Osan Art Center Main Hall", "Osan Art Center Small Hall" -> "Osan Art Center"
            let prefix = keys[0];
            for (let i = 1; i < keys.length; i++) {
                while (!keys[i].startsWith(prefix)) {
                    prefix = prefix.substring(0, prefix.length - 1);
                    if (prefix === '') break;
                }
            }

            prefix = prefix.trim();

            // Cleanup prefix: remove trailing ' ' or special chars
            // If prefix is long enough (>3 chars) and looks like a name
            if (prefix.length > 3) {
                console.log(`Merging Cluster by Common Prefix [${cKey}]: ${keys.join(', ')} -> ${prefix}`);

                // Create new parent node if it doesn't exist
                if (!newVenueData[prefix]) {
                    // Clone data from the first child
                    newVenueData[prefix] = { ...newVenueData[keys[0]] };
                    newVenueData[prefix].name = prefix; // Update name

                    // Try to find better address from children
                    const addresses = keys.map(k => newVenueData[k]?.address).filter(Boolean);
                    const roadAddr = addresses.find(a => /[로길]/.test(a) && !/^\d/.test(a));
                    if (roadAddr) newVenueData[prefix].address = roadAddr;
                }

                keys.forEach(k => {
                    if (k !== prefix) venueKeyMap[k] = prefix;
                });
            } else {
                // Strategy: Check if one is an Address and the other is a Name
                // If we have a key that looks like a full road address (starts with Region + has Road/Number)
                // And another key that definitely DOES NOT look like an address
                // We merge the Address-Key into the Name-Key.

                const isAddressLike = (s: string) => {
                    return REGION_PREFIX_REGEX.test(s) && /[로길]\s*\d+/.test(s);
                };

                const validNames = keys.filter(k => !isAddressLike(k) && k.length > 2 && !/^\d+$/.test(k));
                const addresses = keys.filter(k => isAddressLike(k));

                if (validNames.length === 1 && addresses.length >= 1) {
                    const parent = validNames[0];
                    console.log(`Merging Cluster by Address-Detection [${cKey}]: ${keys.join(', ')} -> ${parent}`);

                    // Update key map
                    keys.forEach(k => {
                        if (k !== parent) venueKeyMap[k] = parent;
                    });

                    // Ensure parent has the best address
                    if (!newVenueData[parent].address || newVenueData[parent].address.length < 5) {
                        const bestAddr = addresses[0];
                        // Try to get address from the key string if possible, or look up the venue data
                        if (newVenueData[bestAddr] && newVenueData[bestAddr].address) {
                            newVenueData[parent].address = newVenueData[bestAddr].address;
                        } else {
                            // Use the key itself if it is an address
                            newVenueData[parent].address = bestAddr;
                        }
                    }
                } else {
                    console.log(`Cluster [${cKey}] has no common parent/prefix. Keys: ${keys.join(', ')}`);
                }
            }
        }
    }

    // Apply Coordinate Merges
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
            if (!vKey || typeof vKey !== 'string') return;
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

    // --- Validation Phase ---
    console.log('Validating data...');
    const finalVenues: Record<string, any> = {};
    for (const [k, v] of Object.entries(newVenueData)) {
        if (venueKeyMap[k] && venueKeyMap[k] !== k) continue;

        let validated = { ...v };

        // 1. Coordinates Validation (Basic Range Check)
        if (validated.lat && (validated.lat < 33 || validated.lat > 39 || validated.lng < 124 || validated.lng > 132)) {
            // console.warn(`Invalid Coordinates for ${k}: ${validated.lat}, ${validated.lng}. Clearing.`);
            validated.lat = 0;
            validated.lng = 0;
        }

        // 2. Region/District Validation against Address
        if (validated.address && validated.address.length > 5) {
            // Extract District from Address
            let district = '';
            const districtMatch = validated.address.match(/(\S+[구군시])/); // First "Gu/Gun/Si" word
            if (districtMatch) district = districtMatch[1];

            // If District field is empty, fill it
            if (!validated.district) validated.district = district;

            // Check Region (Province)
            let region = '';
            for (const [long, short] of Object.entries(REGION_MAP)) {
                if (validated.address.startsWith(long) || validated.address.startsWith(short)) {
                    region = short;
                    break;
                }
            }

            // If region found via address, map it
            if (region) {
                const regionIdMap: Record<string, string> = {
                    '서울': 'seoul', '경기': 'gyeonggi', '인천': 'incheon',
                    '강원': 'gangwon', '대전': 'daejeon', '세종': 'sejong', '충남': 'chungnam', '충북': 'chungbuk',
                    '광주': 'gwangju', '전남': 'jeonnam', '전북': 'jeonbuk', '대구': 'daegu', '경북': 'gyeongbuk',
                    '부산': 'busan', '울산': 'ulsan', '경남': 'gyeongnam', '제주': 'jeju'
                };
                // Overwrite 'unknown' OR 'auto-mochaclass' if we have a valid region from address
                if (!validated.mapped_region_id || validated.mapped_region_id === 'unknown' || validated.mapped_region_id === 'auto-mochaclass') {
                    if (regionIdMap[region]) validated.mapped_region_id = regionIdMap[region];
                }
            }
        }

        finalVenues[k] = validated;
    }

    fs.writeFileSync(VENUE_PATH, JSON.stringify(finalVenues, null, 2));
    console.log(`Cleaning Complete. Saved venues.json`);
}

main().catch(console.error);

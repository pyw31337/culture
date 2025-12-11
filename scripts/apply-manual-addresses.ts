
import fs from 'fs';
import path from 'path';

const KAKAO_API_KEY = 'e18ee199818819d830c3fe479aa1ca71';
const VENUES_PATH = path.join(process.cwd(), 'src/data/venues.json');
const venues = JSON.parse(fs.readFileSync(VENUES_PATH, 'utf-8'));

const manualData: Record<string, string> = {
    "평택 남부문화예술회관 대공연장": "경기 평택시 중앙로 277",
    "아트센터인천 다목적홀": "인천 연수구 아트센터대로 222",
    "부천아트센터 콘서트홀": "경기 부천시 원미구 소향로 165 부천아트센터",
    "현대백화점 판교점 10층 토파즈홀": "경기 성남시 분당구 판교역로146번길 20 현대백화점 판교점",
    "고양시립 아람미술관": "경기 고양시 일산동구 중앙로 1286 고양시립 아람미술관",
    "리빙파워센터 4F": "경기 용인시 기흥구 신고매로 59",
    "동탄 어둠속의대화": "경기 화성시 동탄역로 160 롯데백화점 동탄점 7층",
    "매직플로우 원더파크": "경기 고양시 덕양구 고양대로 1955 1층",
    "헤이리 팝트릭아트 93뮤지엄": "경기 파주시 탄현면 헤이리마을길 59-58",
    "매직플로우 원더빌리지": "경기도 고양시 덕양구 고양대로 1955 3층 매직플로우",
    "성남큐브미술관": "경기 성남시 분당구 성남대로 808 성남큐브미술관",
    // Group 12: Yongin Children's Art Forest
    "용인어린이상상의숲 예술놀이터": "경기 용인시 처인구 동백죽전대로 61 용인어린이상상의숲",
    "용인어린이상상의숲 미술놀이터": "경기 용인시 처인구 동백죽전대로 61 용인어린이상상의숲",
    "용인어린이상상의숲 요리조리스튜디오": "경기 용인시 처인구 동백죽전대로 61 용인어린이상상의숲",
    "용인시실내체육관": "경기 용인시 처인구 경안천로 76",
    "트리플스트리트 D동 B1": "인천 연수구 송도과학로16번길 33-1",
    "쎈토이박물관": "경기 여주시 명품1로 42-9 여주프리미엄빌리지 쎈토이박물관",
    "고양 아람누리 제4전시실": "경기 고양시 일산동구 중앙로 1286",
    "용인문화예술원 전시실": "경기 용인시 처인구 중부대로 1199 용인문화연 2층",
    "현대백화점 중동점 9층 문화홀": "경기 부천시 원미구 길주로 180",
    "헤이리 파주공룡박물관": "경기 파주시 탄현면 헤이리마을길 93-83",
    "안성맞춤랜드 내 천문과학관": "경기 안성시 보개면 남사당로 198",
    "가평 쁘띠프랑스": "경기 가평군 청평면 호반로 1063",
    "오산 오마이쥬 키즈파크": "경기 오산시 경기대로632번길 89 오마이쥬",
    "세라젬웰파크 위례점": "경기 하남시 위례대로 350 2층",
    "하피랜드 찜질스파": "경기 화성시 팔탄면 시청로 888 하피랜드",
    // Group 25: Gonjiam
    "곤지암리조트 렌탈샵 보스": "경기 광주시 도척면 도척윗로 278",
    "곤지암리조트렌탈샵 닥터스노우": "경기 광주시 도척면 도척윗로 278",
    "［곤지암］ 청춘스키": "경기 광주시 도척면 도척윗로 278",
    "모닝스키 렌탈샵": "경기 광주시 도척면 도척윗로 278", // Assuming nearby/related
    "주렁주렁 동탄라크몽점": "경기 화성시 동탄대로5길 21 라크몽 B동 3층",
    "영일딸기농장": "경기 김포시 고촌읍 전호리 453-2",
    "오키드 키즈카페": "경기 김포시 대곶면 대명항1로 52 가동 2층",
    "［다산］ 도심속 멀티힐링 스팟 스파디움24": "경기 남양주시 다산순환로 20 다산현대프리미어캠퍼스 C동 B1층",
    "쥬리라움 동탄점": "경기 화성시 동탄기흥로257번가길 31",
    "지산캠프 렌탈샵": "경기 이천시 마장면 지산로 257-7",
    "극동조이키즈파크": "경기 안산시 단원구 초지동로 7 극동스포랜드 1층 극동조이키즈파크",
    "자이언트제트 시아테마파크점": "경기 안산시 단원구 광덕1로 276 6층 자이언트제트",
    "양주 어드벤처 시티": "경기 양주시 어하고개로 5",
    "여주 루덴시아": "경기 여주시 산북면 금품1로 177 여주 루덴시아",
    "［인천］부평 엔터파크 게임장": "인천 부평구 부평문화로80번길 16 스타빠루뚜빌딩 2층",
    "쥬벅스 앤 쥬니멀": "인천 남동구 서창남순환로216번길 20 승연프라자 2층",
    "히어로플레이파크 일산점": "경기도 고양시 일산동구 중산동 1561-1 해태쇼핑타운 8층",
    "쥬라리움 청라": "인천 서구 청라커낼로288번길 26 현대썬앤빌 더테라스 지하 1층",
    "플레이월드 미사점": "경기 하남시 미사강변동로 73 12층",
    "서원인레인지 (서원밸리CC 골프연습장)": "경기 파주시 광탄면 서원길 333 서원밸리컨트리클럽 연습장",
    "판교레이크골프클럽": "경기 용인시 수지구 호수로 69",
    "아센사우나 ＆ 찜질방": "경기 화성시 효행로 1051 메인프라자",
    "화성 치즈학교": "경기 화성시 우정읍 기아자동차로 189-2 화성치즈학교",
    // Group 45: Soyo
    "소요 별＆숲 테마파크 상상공작소": "경기 동두천시 평화로2922번길 76",
    "소요 별＆숲 테마파크": "경기 동두천시 평화로2922번길 76",
    "안성맞춤 남사당공연장": "경기 안성시 보개면 남사당로 198",
    "안성팜랜드": "경기 안성시 공도읍 대신두길 28",
    "김포 쥬라기파크": "경기 김포시 대곶면 대명항1로 52 가동 3층",
    "수원 라이프스포츠 워터파크": "경기 수원시 장안구 대평로90번길 19"
};

async function geocode(address: string, name: string) {
    const url = `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(address)}`;
    try {
        const res = await fetch(url, { headers: { 'Authorization': `KakaoAK ${KAKAO_API_KEY}` } });
        const data = await res.json();
        if (data.documents && data.documents.length > 0) {
            return data.documents[0];
        } else {
            console.log(`Fallback keyword search for: ${name} ${address}`);
            // Fallback to keyword search if address parser fails
            const kUrl = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(address)}`;
            const kRes = await fetch(kUrl, { headers: { 'Authorization': `KakaoAK ${KAKAO_API_KEY}` } });
            const kData = await kRes.json();
            return kData.documents && kData.documents.length > 0 ? kData.documents[0] : null;
        }
    } catch (e) {
        console.error(`Error geocoding ${address}`, e);
        return null;
    }
}

async function run() {
    let count = 0;
    for (const [name, address] of Object.entries(manualData)) {
        if (!venues[name]) {
            console.log(`Skipping unknown venue key: ${name}`);
            continue;
        }

        const result = await geocode(address, name);
        if (result) {
            venues[name].address = address; // Use user provided exact string
            venues[name].district = address.split(' ').find(p => p.endsWith('구') || p.endsWith('시') || p.endsWith('군')) || "";
            venues[name].lat = parseFloat(result.y);
            venues[name].lng = parseFloat(result.x);
            console.log(`[UPDATED] ${name} -> ${address}`);
            count++;
        } else {
            console.log(`[FAIL] Could not geocode: ${address} (${name})`);
            // Set address anyway even if geocode fails? No, map needs coords. 
            // Better to force strict geocoding.
        }
        await new Promise(r => setTimeout(r, 100)); // Rate limit
    }

    fs.writeFileSync(VENUES_PATH, JSON.stringify(venues, null, 2));
    console.log(`Done. Updated ${count} venues.`);
}

run();

const fs = require('fs');
const path = require('path');
const https = require('https');

const VENUE_FILE = path.join(process.cwd(), 'src/data/venues.json');
const rawInput = `
대학로 스타시티 7층 후암씨어터 : 서울 종로구 대학로11길 23 대학로스타시티빌딩
한국방송회관 2층 코바코홀 : 서울 양천구 목동동로 233 한국방송회관 2층 코바코홀
광진청소년센터 대극장 : 서울 광진구 구천면로 2
강서아트리움 아리홀 : 서울 강서구 가로공원로 195 강서아트리움
후암스테이지 1관 : 서울 종로구 대학로11길 23 대학로스타시스빌딩 지하2층
엠스테이지 2관 : 서울 종로구 인사동길 34-1 지하2층 엠스테이지
LG아트센터 서울 LG SIGNATURE 홀 : 서울 강서구 마곡중앙로 136 LG아트센터 서울
서울숲 씨어터 2관 : 서울 성동구 서울숲2길 32-14
NOL 서경스퀘어 스콘 1관 : 서울 종로구 동숭길 148
링크아트센터 벅스홀 : 서울 종로구 대학로14길 29 링크아트센터
동덕여자대학교 공연예술센터 코튼홀 : 서울 종로구 동숭길 126 동덕여대 공연예술 연구소
링크아트센터드림 드림2관 : 서울 종로구 동숭길 123 링크아트센터드림
Converse Stage Arena “여명” : 서울특별시 동작구 현충로 213(동작동)
허리우드극장 4층 낭만극장 : 서울 종로구 삼일대로 428 허리우드극장
링크아트센터드림 드림1관 : 서울 종로구 동숭길 123 링크아트센터드림
와일드 와일드 전용관 (명보아트홀) : 서울 중구 마른내로 47 명보극장
명보아트홀 B1F 다온홀 : 서울 중구 마른내로 47 명보극장
명보아트홀 지하3층 점프 전용극장 : 서울 중구 마른내로 47 명보극장
잠실종합운동장 내 빅탑 : 서울 송파구 올림픽로 25 서울종합운동장
라이브홀 문래재즈IN : 서울 영등포구 도림로 475 지하공연장
엠피엠지 2층 LOUNGE M. : 서울 마포구 서강로 78
KT＆G 상상마당 홍대 라이브홀 : 서울 마포구 어울마당로 65 상상마당 빌딩 지하 2층
그랜드 인터컨티넨탈 서울 파르나스 5층 그랜드볼룸 : 서울 강남구 테헤란로 521 그랜드 인터컨티넨탈 서울 파르나스
캔버스N홀 : 서울 강남구 언주로172길 25 지하 1층
명화 라이브홀 5층 라운지 : 서울 영등포구 버드나루로 30
라움아트센터 마제스틱 볼룸 : 서울 강남구 언주로 564 라움아트센터
공감센터 공감홀 : 서울 중구 퇴계로88길 38
라움아트센터 4F 체임버홀 : 서울 강남구 언주로 564 라움아트센터
KT&G 상상마당 홍대 라이브홀 : 서울 마포구 어울마당로 65 상상마당 빌딩 지하 2층
신세계 스튜디오 1관 : 서울 성북구 동소문로20길 37-13 2,3층
NC문화재단 Stage Black : 서울 종로구 이화장길 100
대학로 한예극장 1관 : 서울 종로구 이화장길 66 동진빌딩 1층
나루아트센터 스페이스76(전시실) : 서울 광진구 능동로 76 나루아트센터
신도림 오페라하우스 지하소극장 : 서울 구로구 새말로 107-32
대학로 스타릿홀 : 서울 종로구 대학로8가길 111 지하층
NOL 서경스퀘어 스콘 2관 : 서울 종로구 동숭길 148
LG아트센터 서울 U+ 스테이지 : 서울 강서구 마곡중앙로 136 LG아트센터 서울
명보아트홀 3층 라온홀 : 서울 중구 마른내로 47 명보극장
DS ART HALL 창선당 : 서울시 종로구 청계천로 279 
NOL 씨어터 대학로 우리투자증권홀(구. 중극장) : 서울특별시 종로구 동숭길 100
스테이션 사람 사람홀 : 서울 은평구 증산로17가길 15-7
링크아트센터드림 드림4관 : 서울 종로구 동숭길 123 링크아트센터드림
무하아트센터 2관 : 서울 종로구 이화장길 72
대학로 봄날아트홀 2관 : 서울 종로구 동숭길 39 지하 1층, 2층 봄날아트홀
봄날아트홀 1관 : 서울 종로구 동숭길 39 지하 1층, 2층 봄날아트홀
세종대 컨벤션홀 : 서울 광진구 능동로 209
크레디아클래식클럽 STUDIO : 서울 종로구 자하문로9길 8 B1
예술의전당 IBK기업은행챔버홀 : 서울 서초구 남부순환로 2406 예술의전당
JCC아트센터 콘서트홀 : 서울 종로구 창경궁로35길 29
충무아트센터예그린스페이스 : 서울 중구 퇴계로 387
JCC 아트센터 콘서트홀 : 서울 종로구 창경궁로35길 29
명동대성당 내 파밀리아 채플 : 서울 중구 명동길 74
서울교육대학교 음악관 콘서트홀 : 서울 서초구 서초중앙로 96
롤링홀 Rollinghall : 서울 마포구 어울마당로 35
전통공연창작마루 광무대 : 서울 종로구 종로 272 신관 N동 8, 9층
김희수아트센터 SPACE1 : 서울 동대문구 홍릉로 118 김희수아트센터
강남씨어터극장 : 서울 강남구 역삼로7길 16 역삼1동복합문화센터 3층 강남씨어터
서울남산국악당 크라운해태홀 : 서울 중구 퇴계로34길 28 서울남산국악당
이화여자대학교 ECC 삼성홀 : 서울 서대문구 이화여대길 52 이화여자대학교 이화캠퍼스복합단지ECC 지하4층
DDP 뮤지엄 전시 2관 : 서울 중구 을지로 281 동대문디자인플라자뮤지엄
대원뮤지엄 팝콘D스퀘어 : 서울 용산구 한강대로23길 55 아이파크몰 테마파크 6층 1-1호
동대문디자인플라자(DDP) 전시 1관 : 서울 중구 을지로 281 동대문디자인플라자뮤지엄
전쟁기념관 특별전시실 : 서울 용산구 이태원로 29
롯데몰 김포공항점 1F 전시홀 : 서울 강서구 하늘길 77
한국민화학교 : 서울 강남구 삼성로96길 6 1210호
JCC크리에이티브센터 스튜디오 : 서울 종로구 창경궁로35길 45
［경복궁］ 해와달 한복 : 서울 종로구 사직로 127-14 다자연빌딩 3층 해와달한복
궁궐사랑 : 서울특별시 서초구 명달로 97-9
방탈출카페 탈출브라더스 : 서울 영등포구 영중로4길 25-1 4층
［성북］ 빚다 도예공방 도자기만들기 / 물레체험 / : 서울 성북구 도봉로3길 9-3
［연남］ K탑건 사격양궁장 : 서울 마포구 양화로21길 29 지층
그아저씨 도예공방 원데이 클래스 : 서울 성동구 무학봉15길 27
주식회사 리얼샷 익선점 : 서울 종로구 수표로28길 17-5 1층
안성맞춤아트홀 대공연장 : 경기 안성시 발화대길 21 안성맞춤아트홀
한국항공대학교 투데이아트홀 : 경기 고양시 덕양구 항공대학로 76
평택 북부문화예술회관 대공연장 : 경기 평택시 경기대로 1366 북부문화예술회관
용인어린이상상의숲 공연놀이터 : 경기 용인시 처인구 동백죽전대로 61 용인어린이상상의숲
한국만화박물관 1층 만화영화상영관 : 경기 부천시 원미구 길주로 1
광주시문화예술의전당 남한산성홀 (구.남한산성아트홀 : 경기 광주시 회안대로 891 광주시문화재단 광주시문화예술의전당
비상교육 대강당 : 경기 과천시 과천대로2길 54 그라운드브이
광주시문화예술의전당 맹사성홀 : 경기 광주시 회안대로 891 광주시문화재단 광주시문화예술의전당
킨텍스 제2전시장 10B홀 : 경기 고양시 일산서구 킨텍스로 217-59 , 1층
수원컨벤션센터 1~2홀 : 경기 수원시 영통구 광교중앙로 140
송도컨벤시아 4홀 : 인천 연수구 센트럴로 123 송도컨벤시아
통진두레문화센터 두레홀 : 경기 김포시 통진읍 김포대로 2347-8
아늑호텔 인천점 2층 : 인천 남동구 예술로204번길 15 아늑 호텔 인천점
인스파이어 오로라바 일대 : 인천광역시 중구 공항문화로 127 인스파이어 오로라 2F 오로라 바
평택북부문화예술회관 소공연장 : 경기 평택시 경기대로 1366 북부문화예술회관
이천아트홀 전관 : 경기 이천시 부악로 40 이천시청
매직앤조이 : 경기 수원시 영통구 광교중앙로 124 갤러리아백화점 10층
미리내 마술극단 송도점 : 인천 연수구 송도과학로16번길 33-4 D동 3층
부천아트센터 소공연장 : 경기 부천시 원미구 소향로 165 부천아트센터
피아올라홀 : 경기도 오산시 역광장로83번길 3(오산동) 2층 피아올라스튜디오
광주시문화예술의전당 남한산성홀 : 경기 광주시 회안대로 891 광주시문화재단 광주시문화예술의전당
키즈 아트 갤러리 by MAM : 경기도 가평군 설악면 미사리로 189 3층
`;

const DISTRICT_COORDS = {
    '강남구': { lat: 37.5172, lng: 127.0473 },
    '강동구': { lat: 37.5301, lng: 127.1238 },
    '강북구': { lat: 37.6396, lng: 127.0257 },
    '강서구': { lat: 37.5509, lng: 126.8497 },
    '관악구': { lat: 37.4784, lng: 126.9516 },
    '광진구': { lat: 37.5385, lng: 127.0824 },
    '구로구': { lat: 37.4954, lng: 126.8874 },
    '금천구': { lat: 37.4565, lng: 126.8954 },
    '노원구': { lat: 37.6542, lng: 127.0568 },
    '도봉구': { lat: 37.6688, lng: 127.0471 },
    '동대문구': { lat: 37.5744, lng: 127.0400 },
    '동작구': { lat: 37.5124, lng: 126.9393 },
    '마포구': { lat: 37.5665, lng: 126.9018 },
    '서대문구': { lat: 37.5791, lng: 126.9368 },
    '서초구': { lat: 37.4837, lng: 127.0324 },
    '성동구': { lat: 37.5633, lng: 127.0371 },
    '성북구': { lat: 37.5891, lng: 127.0182 },
    '송파구': { lat: 37.5145, lng: 127.1066 },
    '양천구': { lat: 37.5169, lng: 126.8660 },
    '영등포구': { lat: 37.5264, lng: 126.8962 },
    '용산구': { lat: 37.5323, lng: 126.9906 },
    '은평구': { lat: 37.6027, lng: 126.9291 },
    '종로구': { lat: 37.5730, lng: 126.9794 },
    '중구': { lat: 37.5637, lng: 126.9975 },
    '중랑구': { lat: 37.6066, lng: 127.0924 },
    '수원시': { lat: 37.2636, lng: 127.0286 },
    '성남시': { lat: 37.4386, lng: 127.1378 },
    '고양시': { lat: 37.6584, lng: 126.8320 },
    '용인시': { lat: 37.2410, lng: 127.1775 },
    '부천시': { lat: 37.5034, lng: 126.7660 },
    '안산시': { lat: 37.368, lng: 126.836 },
    '인천': { lat: 37.4563, lng: 126.7052 },
    '연수구': { lat: 37.4102, lng: 126.6782 },
    '남동구': { lat: 37.4473, lng: 126.7314 },
    '부평구': { lat: 37.5074, lng: 126.7217 }
};

function geocode(address) {
    return new Promise((resolve) => {
        const query = encodeURIComponent(address.split('(')[0].trim());
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`;

        const req = https.get(url, {
            headers: { 'User-Agent': 'InterparkAggregatorUpdate/1.0 (me@example.com)' }
        }, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    if (parsed && parsed.length > 0) {
                        resolve({
                            lat: parseFloat(parsed[0].lat),
                            lng: parseFloat(parsed[0].lon)
                        });
                    } else {
                        resolve(null);
                    }
                } catch (e) {
                    resolve(null);
                }
            });
        });

        req.on('error', () => resolve(null));
        req.end();
    });
}

async function main() {
    let venues;
    try {
        venues = JSON.parse(fs.readFileSync(VENUE_FILE, 'utf8'));
    } catch (e) {
        console.error('Failed to read venues.json');
        return;
    }

    const lines = rawInput.trim().split('\n');
    let updatedCount = 0;

    for (const line of lines) {
        if (!line.includes(':')) continue;
        const [name, address] = line.split(':').map(s => s.trim());

        if (!name || !address) continue;

        if (!venues[name]) {
            console.log(`Venue not found in existing DB, creating: ${name}`);
            venues[name] = { name: name, address: address };
        } else {
            console.log(`Updating address for: ${name}`);
            venues[name].address = address;
        }

        // Extract district
        let district = '';
        const guMatch = address.match(/(\S+구)/);
        if (guMatch) district = guMatch[1];
        if (!district) {
            const siMatch = address.match(/(\S+시)/);
            if (siMatch && ['수원시', '성남시', '고양시', '용인시', '부천시', '안산시'].includes(siMatch[1])) {
                district = siMatch[1];
            }
        }
        venues[name].district = district;

        // Geocode - SKIPPED for speed, relying on District Fallback
        // const coords = await geocode(address);
        const coords = null;
        if (coords) {
            venues[name].lat = coords.lat;
            venues[name].lng = coords.lng;
            console.log(`  -> Geocoded: ${coords.lat}, ${coords.lng}`);
        } else {
            // console.log(`  -> Geocoding failed for: ${address}`);
            // Fallback
            if (district && DISTRICT_COORDS[district]) {
                venues[name].lat = DISTRICT_COORDS[district].lat;
                venues[name].lng = DISTRICT_COORDS[district].lng;
                console.log(`  -> Used District Fallback: ${district}`);
            }
        }

        updatedCount++;
        // Rate limit removed
        // await new Promise(r => setTimeout(r, 1000));
    }

    fs.writeFileSync(VENUE_FILE, JSON.stringify(venues, null, 2));
    console.log(`Updates saved. Processed ${updatedCount} venues.`);
}

main();

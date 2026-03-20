
import { VenueNormalizer } from '../src/lib/venue-normalizer';

const testCases = [
    // Existing in Dictionary
    "(주)소노호텔앤리조트 천안",
    "예술의전당 콘서트홀",
    "세종문화회관 대극장",

    // New / Unknown (Should rely on rules)
    "(주)새로운공연장",
    "서울 강남구 어떤빌딩 3층 새로운아트홀 대공연장",
    "경기 가평군 어디어디 123 쁘띠프랑스",
    "부산 해운대구 무슨무슨길 1 부산어린이극장 소극장",
    "스타필드 코엑스몰 라이브플라자",
];

async function validate() {
    console.log('--- Venue Normalization Validation ---\n');

    for (const name of testCases) {
        const result = VenueNormalizer.normalize(name);
        console.log(`Input: "${name}"`);
        console.log(`Source: ${result.source}`);
        console.log(`Refined Name: "${result.refined_name}"`);
        console.log(`Address: "${result.address}"`);
        console.log('-----------------------------------');
    }
}

validate();

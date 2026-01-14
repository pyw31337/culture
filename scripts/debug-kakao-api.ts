
import axios from 'axios';

const KAKAO_API_KEY = '0236cfffa7cfef34abacd91a6d7c73c0';

async function test() {
    try {
        const query = '디큐브 링크아트센터';
        console.log(`Searching for: ${query}`);
        const res = await axios.get('https://dapi.kakao.com/v2/local/search/keyword.json', {
            headers: { Authorization: `KakaoAK ${KAKAO_API_KEY}` },
            params: { query, size: 1 }
        });
        console.log('Status:', res.status);
        console.log('Data:', JSON.stringify(res.data, null, 2));
    } catch (e: any) {
        console.error('Error:', e.message);
        if (e.response) {
            console.error('Response:', e.response.status, e.response.data);
        }
    }
}

test();

import axios from 'axios';
const KAKAO_API_KEY = '0236cfffa7cfef34abacd91a6d7c73c0';

async function testKakao(query: string) {
    try {
        console.log(`\n[Testing] "${query}"`);
        const res = await axios.get('https://dapi.kakao.com/v2/local/search/keyword.json', {
            headers: { 
                Authorization: `KakaoAK ${KAKAO_API_KEY}`,
                Origin: 'http://localhost:3000'
            },
            params: { query, size: 5 }
        });
        console.log('Results Count:', res.data.meta.total_count);
        if (res.data.documents.length > 0) {
            for (const doc of res.data.documents.slice(0, 3)) {
                 console.log(` - Found: [${doc.category_group_name}] ${doc.place_name} -> ${doc.address_name || doc.road_address_name}`);
            }
        } else {
            console.log(' - No documents array populated.');
        }
    } catch (e: any) {
        console.error('API Error:', e.response?.data || e.message);
    }
}

async function run() {
    await testKakao('예술의전당 리사이틀홀');
    await testKakao('예술의전당');
    await testKakao('광화문광장 특설무대');
    await testKakao('광화문광장');
    await testKakao('올림픽공원 88잔디마당');
}
run();

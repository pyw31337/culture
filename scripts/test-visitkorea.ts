
import axios from 'axios';

async function testVisitKoreaApi() {
    const baseApiUrl = 'https://korean.visitkorea.or.kr';
    const endpoint = `${baseApiUrl}/api/v2/hot-place/tmap/list`;
    
    const params = {
        innerType: 'popular',
        regionCode: 0,
        page: 1,
        ageGroup: 0,
        latitude: 37.5665,
        longitude: 126.9780,
        offset: 20
    };

    console.log(`Testing API: ${endpoint}`);
    
    try {
        const response = await axios.get(endpoint, {
            params,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://korean.visitkorea.or.kr/main/area_tmap.do?regionCode=0',
                'Accept': 'application/json, text/plain, */*'
            }
        });

        console.log('Status:', response.status);
        if (response.data.data && response.data.data.items) {
            console.log(`✅ Success! Found ${response.data.data.items.length} items.`);
            const first = response.data.data.items[0];
            console.log('Sample Item:', {
                title: first.title,
                cotId: first.cotId
            });
        } else {
            console.log('❌ Unexpected response structure:', response.data);
        }
    } catch (error: any) {
        console.error('❌ API Error:', error.message);
    }
}

testVisitKoreaApi();

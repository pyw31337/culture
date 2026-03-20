
import axios from 'axios';

async function testVisitKoreaPlaceApi() {
    const baseApiUrl = 'https://korean.visitkorea.or.kr';
    const endpoint = `${baseApiUrl}/api/v2/hot-place/place/list`;
    
    const params = {
        page: 1,
        offset: 15,
        device: 'PC',
        hotPlaceType: 'Place',
        regionCode: '',
        order: 'POPULAR',
        type: 'place'
    };

    console.log(`Testing VisitKorea Place API: ${endpoint}`);
    
    try {
        const response = await axios.get(endpoint, {
            params,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://korean.visitkorea.or.kr/main/area_list.do?type=Place',
            }
        });

        console.log('VK Status:', response.status);
        if (response.data.data && response.data.data.items) {
            console.log(`✅ VK Success! Found ${response.data.data.items.length} items.`);
            console.log('Sample VK Item:', response.data.data.items[0].title);
        } else {
            console.log('❌ VK Unexpected response:', response.data);
        }
    } catch (error: any) {
        console.error('❌ VK API Error:', error.message);
    }
}

async function testGGTourApi() {
    const endpoint = 'https://www.ggtour.or.kr/api/v1/travel-info/tourism-info';
    
    const params = {
        page: 1,
        sortBy: 'RECENTLY',
        sgg: 0,
        dbCategory2: 0,
        keyword: ''
    };

    console.log(`Testing GGTour API: ${endpoint}`);
    
    try {
        const response = await axios.get(endpoint, {
            params,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://www.ggtour.or.kr/travel-info/tourism-info',
                'Accept': 'application/json, text/plain, */*'
            }
        });

        console.log('GGTour Status:', response.status);
        if (response.data.data && response.data.data.items) {
            console.log(`✅ GGTour Success! Found ${response.data.data.items.length} items. Total: ${response.data.data.total}`);
            console.log('Sample GGTour Item:', JSON.stringify(response.data.data.items[0], null, 2));
        } else {
            console.log('❌ GGTour Unexpected response:', response.data);
        }
    } catch (error: any) {
        console.error('❌ GGTour API Error:', error.message);
    }
}

async function main() {
    await testVisitKoreaPlaceApi();
    console.log('---');
    await testGGTourApi();
}

main();

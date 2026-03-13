
import axios from 'axios';

async function testGGTourDetailApi(id: string) {
    const endpoint = `https://www.ggtour.or.kr/api/v1/travel-info/tourism-info/${id}`;
    
    console.log(`Testing GGTour Detail API: ${endpoint}`);
    
    try {
        const response = await axios.get(endpoint, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://www.ggtour.or.kr/travel-info/tourism-info',
                'Accept': 'application/json, text/plain, */*'
            }
        });

        console.log('Status:', response.status);
        if (response.data.data) {
            console.log('✅ Success! Data found.');
            console.log('Detail Data:', JSON.stringify(response.data.data, null, 2));
        } else {
            console.log('❌ Unexpected response:', response.data);
        }
    } catch (error: any) {
        console.error('❌ API Error:', error.message);
    }
}

const testId = process.argv[2] || '121';
testGGTourDetailApi(testId);

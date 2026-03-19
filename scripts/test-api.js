
const fs = require('fs');
const axios = require('axios');

// Manual env parsing
let KAKAO_API_KEY = '';
try {
    const envLocal = fs.readFileSync('.env.local', 'utf-8');
    envLocal.split('\n').filter(line => line.includes('=')).forEach(line => {
        const [key, ...valueParts] = line.split('=');
        if (key.trim() === 'KAKAO_REST_API_KEY') KAKAO_API_KEY = valueParts.join('=').trim();
    });
} catch (e) { }

async function test() {
    console.log('Key:', KAKAO_API_KEY ? 'Present' : 'Missing');
    const query = '서울특별시 서초구 서초동 1678-4';
    try {
        const res = await axios.get('https://dapi.kakao.com/v2/local/search/address.json', {
            headers: { Authorization: `KakaoAK ${KAKAO_API_KEY}` },
            params: { query, size: 1 }
        });
        console.log('Response Status:', res.status);
        console.log('Result Count:', res.data.meta.total_count);
    } catch (e) {
        console.error('Error:', e.message);
        if (e.response) console.error('Response:', e.response.data);
    }
}

test();

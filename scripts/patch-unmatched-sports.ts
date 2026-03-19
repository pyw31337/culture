import fs from 'fs';
import path from 'path';
import axios from 'axios';

const KAKAO_API_KEY = process.env.KAKAO_REST_API_KEY || '';
const VENUES_PATH = path.join(process.cwd(), 'src/data/venues.json');

const venues = JSON.parse(fs.readFileSync(VENUES_PATH, 'utf-8'));

async function searchExact(query: string) {
    try {
        const res = await axios.get('https://dapi.kakao.com/v2/local/search/keyword.json', {
            headers: { Authorization: `KakaoAK ${KAKAO_API_KEY}` },
            params: { query, size: 1 }
        });
        if (res.data.documents && res.data.documents.length > 0) {
            return res.data.documents[0];
        }
        return null;
    } catch (e) { return null; }
}

async function patch() {
    // 1. 한화생명이글스파크
    let doc = await searchExact('한화생명 이글스파크');
    if (doc) {
        venues['한화생명이글스파크'] = {
            ...venues['한화생명이글스파크'],
            official_name: doc.place_name,
            address: doc.road_address_name || doc.address_name,
            district: '중구', // 대전 중구
            lat: parseFloat(doc.y),
            lng: parseFloat(doc.x)
        };
        console.log(`✅ Patched 한화생명이글스파크 -> ${doc.place_name}`);
    }

    // 2. 경민대학교 기념관(체육관)
    doc = await searchExact('경민대학교 기념관');
    if (doc) {
        venues['경민대학교 기념관(체육관)'] = {
            ...venues['경민대학교 기념관(체육관)'],
            official_name: doc.place_name,
            address: doc.road_address_name || doc.address_name,
            district: '의정부시',
            lat: parseFloat(doc.y),
            lng: parseFloat(doc.x)
        };
        console.log(`✅ Patched 경민대학교 기념관(체육관) -> ${doc.place_name}`);
    }

    // 3. 티켓링크 라이브 아레나(핸드볼경기장)
    doc = await searchExact('SK올림픽핸드볼경기장');
    if (doc) {
        venues['티켓링크 라이브 아레나(핸드볼경기장)'] = {
            ...venues['티켓링크 라이브 아레나(핸드볼경기장)'],
            official_name: doc.place_name,
            address: doc.road_address_name || doc.address_name,
            district: '송파구',
            lat: parseFloat(doc.y),
            lng: parseFloat(doc.x)
        };
        console.log(`✅ Patched 티켓링크 라이브 아레나(핸드볼경기장) -> ${doc.place_name}`);
    }

    fs.writeFileSync(VENUES_PATH, JSON.stringify(venues, null, 2));
    console.log('Done!');
}

patch();

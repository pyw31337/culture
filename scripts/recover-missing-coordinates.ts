
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import pLimit from 'p-limit';

const KAKAO_API_KEY = process.env.KAKAO_REST_API_KEY || '';
const DATA_DIR = path.join(process.cwd(), 'src/data');
const VENUES_PATH = path.join(DATA_DIR, 'venues.json');
const REPORT_PATH = path.join(process.cwd(), 'missing_venues_report.json');

const EXCLUDE_KEYWORDS = ['투어', '온라인', '플랫폼', '예매', '상시'];

async function searchKakao(query: string) {
    try {
        // Try Keyword Search first
        let res = await axios.get('https://dapi.kakao.com/v2/local/search/keyword.json', {
            headers: {
                Authorization: `KakaoAK ${KAKAO_API_KEY}`
            },
            params: { query, size: 1 }
        });

        if (res.data.documents && res.data.documents.length > 0) {
            const doc = res.data.documents[0];
            return {
                address: doc.road_address_name || doc.address_name,
                lat: parseFloat(doc.y),
                lng: parseFloat(doc.x),
                source: 'keyword'
            };
        }

        // Try Address Search as fallback
        res = await axios.get('https://dapi.kakao.com/v2/local/search/address.json', {
            headers: {
                Authorization: `KakaoAK ${KAKAO_API_KEY}`
            },
            params: { query, size: 1 }
        });

        if (res.data.documents && res.data.documents.length > 0) {
            const doc = res.data.documents[0];
            return {
                address: doc.road_address?.address_name || doc.address?.address_name,
                lat: parseFloat(doc.y),
                lng: parseFloat(doc.x),
                source: 'address'
            };
        }

        return null;
    } catch (e: any) {
        // console.error(`\nError for ${query}:`, e.message);
        return null;
    }
}

async function recover() {
    console.log('🚀 좌표 복구 엔진 가동 (REST API Mode)...');

    if (!fs.existsSync(REPORT_PATH)) {
        console.error('❌ 리포트 파일이 없습니다. audit 스크립트를 먼저 실행하세요.');
        return;
    }

    const missingData = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf-8'));
    const venues = JSON.parse(fs.readFileSync(VENUES_PATH, 'utf-8'));

    const limit = pLimit(5); // Process 5 at a time for more stability
    let successCount = 0;
    let skipCount = 0;
    let failCount = 0;
    let totalProcessed = 0;

    console.log(`총 ${missingData.length}건 작업 시작...`);

    const saveVenues = () => {
        fs.writeFileSync(VENUES_PATH, JSON.stringify(venues, null, 2));
        console.log(`\n💾 중간 저장 완료 (${successCount}건 복구됨)`);
    };

    const tasks = missingData.map((item: any) => limit(async () => {
        const name = item.venue;

        // Skip non-physical venues
        if (EXCLUDE_KEYWORDS.some(k => name.includes(k))) {
            skipCount++;
            return;
        }

        // Already recovered in this run or previous?
        if (venues[name] && venues[name].lat && venues[name].lng) {
            return;
        }

        // Search with a small delay to avoid rate limit
        await new Promise(resolve => setTimeout(resolve, 100));
        const result = await searchKakao(name);

        totalProcessed++;

        if (result) {
            venues[name] = {
                address: result.address,
                lat: result.lat,
                lng: result.lng
            };
            successCount++;
            process.stdout.write('✅');
        } else {
            failCount++;
            process.stdout.write('❌');
        }

        // Periodic save every 50 items
        if (totalProcessed % 50 === 0) {
            saveVenues();
        }
    }));

    await Promise.all(tasks);

    console.log('\n\n✨ 복구 완료!');
    console.log(`- 성공: ${successCount}건`);
    console.log(`- 실패: ${failCount}건`);
    console.log(`- 스킵: ${skipCount}건 (비물리적 장소)`);

    // Final Save updated venues.json
    saveVenues();
    console.log(`📄 venues.json 최종 업데이트 완료.`);
}

recover();

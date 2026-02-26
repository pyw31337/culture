
import fs from 'fs';
import path from 'path';

const VENUES_PATH = path.join(process.cwd(), 'src/data/venues.json');

function fix() {
    console.log('🔧 venues.json 데이터 구조 정규화 시작...');

    if (!fs.existsSync(VENUES_PATH)) {
        console.error('❌ venues.json을 찾을 수 없습니다.');
        return;
    }

    const venues = JSON.parse(fs.readFileSync(VENUES_PATH, 'utf-8'));
    let fixCount = 0;

    for (const key in venues) {
        if (!venues[key].name) {
            venues[key].name = key;
            fixCount++;
        }
    }

    fs.writeFileSync(VENUES_PATH, JSON.stringify(venues, null, 2));
    console.log(`✨ 정규화 완료! ${fixCount}개의 필드를 보강했습니다.`);
}

fix();

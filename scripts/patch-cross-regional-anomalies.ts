import fs from 'fs';
import path from 'path';

const INTERPARK_PATH = path.join(process.cwd(), 'src/data/interpark.json');
const TIMETICKET_PATH = path.join(process.cwd(), 'src/data/timeticket.json');
const DICT_PATH = path.join(process.cwd(), 'src/data/venue-dictionary.json');

// Define the exact corrections based on the audit report
const CORRECTIONS = [
    { title: '2026 가족 뮤지컬 〈어린이캣 리틀캣〉 - 세종', venue: '충남 BOK아트센터', correctRegion: 'sejong' },
    { title: '어쩌다 보니', venue: '샤봉디씨어터', correctRegion: 'gyeonggi' },
    { title: '어린이 마술쇼(송도)', venue: '미리내 마술극단 송도점', correctRegion: 'incheon' },
    { title: '와일드벅스 곤충탐험대', venue: '와일드벅스 곤충탐험대', correctRegion: 'incheon' },
    { title: '파라다이스시티 원더박스', venue: '파라다이스시티 원더박스', correctRegion: 'incheon' },
    { title: '의사직업체험 드림닥터(인천)', venue: '드림닥터 인천점', correctRegion: 'incheon' },
    { title: '슬라라 인스파이어점', venue: '슬라라 인스파이어점', correctRegion: 'incheon' },
    { title: '청라 국제 롤러스케이트장', venue: '국제롤러스케이트장', correctRegion: 'incheon' },
    { title: '인천 롤러스타 롤러스케이트장', venue: '롤러스타 롤러스케이트장', correctRegion: 'incheon' },
    { title: '크로마 인도어 풀파티 MISTIQUE (인천)', venue: '클럽크로마', correctRegion: 'incheon' },
    { title: '글라이더스 왕산(인천)', venue: '글라이더스 왕산', correctRegion: 'incheon' },
    { title: '스탠드업 코미디(송도)', venue: '송도 메가박스', correctRegion: 'incheon' }
];

function patchFile(filepath: string) {
    if (!fs.existsSync(filepath)) return;
    const items = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
    let modified = false;

    for (const item of items) {
        if (!item.title || !item.venue) continue;

        const correction = CORRECTIONS.find(c => item.title.includes(c.title) || item.venue === c.venue);
        if (correction && item.region !== correction.correctRegion) {
            console.log(`[PATCHING] ${item.title} : ${item.region} -> ${correction.correctRegion}`);
            item.region = correction.correctRegion;
            modified = true;
        }
    }

    if (modified) {
        fs.writeFileSync(filepath, JSON.stringify(items, null, 2));
        console.log(`Saved patches to ${path.basename(filepath)}`);
    }
}

function patchDictionary() {
    if (!fs.existsSync(DICT_PATH)) return;
    const dict = JSON.parse(fs.readFileSync(DICT_PATH, 'utf-8'));
    let modified = false;

    for (const correction of CORRECTIONS) {
        if (dict[correction.venue] && dict[correction.venue].mapped_region_id !== correction.correctRegion) {
            console.log(`[DICT PATCH] ${correction.venue} : ${dict[correction.venue].mapped_region_id} -> ${correction.correctRegion}`);
            dict[correction.venue].mapped_region_id = correction.correctRegion;
            modified = true;
        }
    }

    if (modified) {
        fs.writeFileSync(DICT_PATH, JSON.stringify(dict, null, 2));
        console.log(`Saved patches to ${path.basename(DICT_PATH)}`);
    }
}

console.log('--- Applying Cross-Regional Corrections ---');
patchFile(INTERPARK_PATH);
patchFile(TIMETICKET_PATH);
patchDictionary();
console.log('--- Done ---');

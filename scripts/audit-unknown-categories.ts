
import fs from 'fs';
import path from 'path';

// Helper to safe load
function loadJson(filename: string) {
    try {
        const p = path.join(process.cwd(), 'src/data', filename);
        const data = fs.readFileSync(p, 'utf-8');
        const parsed = JSON.parse(data);
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        return [];
    }
}

const files = fs.readdirSync(path.join(process.cwd(), 'src/data')).filter(f => f.endsWith('.json'));

let unknownItems: any[] = [];
const REGION_MAP: Record<string, string> = {
    '서울': 'seoul', '경기': 'gyeonggi', '인천': 'incheon',
    '부산': 'busan', '대구': 'daegu', '광주': 'gwangju',
    '대전': 'etc', '울산': 'etc', '세종': 'etc',
    '강원': 'etc', '충북': 'etc', '충남': 'etc',
    '전북': 'etc', '전남': 'etc', '경북': 'etc',
    '경남': 'etc', '제주': 'etc'
};

files.forEach(file => {
    // Skip large raw files or irrelevant ones if needed, but safer to check all
    if (file === 'venues.json' || file === 'bad-venues.json') return;

    const items = loadJson(file);
    items.forEach((p: any) => {
        let region = p.region;

        // Simulate Interpark logic if it's raw
        if (file === 'interpark.json') {
            region = REGION_MAP[p.region] || (p.region ? 'etc' : 'unknown');
        }

        // Check ONLY if genre is unknown or etc
        const isUnknownGenre = !p.genre || p.genre === 'unknown' || p.genre === 'etc';

        if (isUnknownGenre) {
            unknownItems.push({
                file,
                id: p.id,
                title: p.title || p.name || 'No Title',
                venue: p.venue || p.place || 'No Venue',
                genre: p.genre
            });
        }
    });
});

console.log(`Found ${unknownItems.length} items with Unknown/Etc GENRE.\n`);

const groupedByFile: Record<string, any[]> = {};
unknownItems.forEach(item => {
    if (!groupedByFile[item.file]) groupedByFile[item.file] = [];
    groupedByFile[item.file].push(item);
});

Object.keys(groupedByFile).forEach(file => {
    console.log(`\n=== File: ${file} ===`);
    groupedByFile[file].forEach((item, idx) => {
        console.log(`${idx + 1}. [${item.genre || 'NoGenre'}] ${item.title} (Venue: ${item.venue})`);
    });
});

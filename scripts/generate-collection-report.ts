import fs from 'fs';
import path from 'path';

// Define Sources
const SOURCES = [
    { name: 'Interpark', file: 'interpark.json', type: 'concert' },
    { name: 'KOVO (Volleyball)', file: 'kovo.json', type: 'sports' },
    { name: 'KBL (Basketball)', file: 'kbl.json', type: 'sports' },
    { name: 'KBO (Baseball)', file: 'kbo.json', type: 'sports' },
    { name: 'Handball', file: 'handball.json', type: 'sports' },
    { name: 'Yes24', file: 'yes24.json', type: 'concert' },
    { name: 'TimeTicket', file: 'timeticket.json', type: 'exhibition' },
    { name: 'Festivals', file: 'festivals.json', type: 'festival' },
    { name: 'Travel', file: 'travel.json', type: 'travel' },
    { name: 'Movies', file: 'movies.json', type: 'movie' },
    { name: 'OTT', file: 'ott.json', type: 'ott' },
    { name: 'Seoul Culture', file: 'seoul-culture.json', type: 'culture' },
    { name: 'UmClass', file: 'umclass.json', type: 'class' },
    { name: 'SSSD Class', file: 'sssd-class.json', type: 'class' },
    { name: 'MochaClass', file: 'mochaclass.json', type: 'class' },
    { name: 'MyRealTrip Kids', file: 'myrealtrip-kids.json', type: 'kids' },
    { name: 'Mommom', file: 'mommom.json', type: 'kids' },
    { name: 'Mommom Food', file: 'mommom-food.json', type: 'kids' },
    { name: 'Mommom Product', file: 'mommom-products.json', type: 'kids' },
    { name: 'Museum', file: 'museum.json', type: 'museum' },
];

function isPerformanceActive(dateStr: string, today: Date): boolean {
    if (!dateStr) return false;
    try {
        let targetDate: Date | null = null;
        if (dateStr.includes('~')) {
            const parts = dateStr.split('~');
            const endStr = parts[1].trim();
            const [y, m, d] = endStr.split('.').map(Number);
            targetDate = new Date(y, m - 1, d);
            targetDate.setHours(23, 59, 59, 999);
        } else if (dateStr.includes('-') && dateStr.includes(':')) {
            const [datePart] = dateStr.split(' ');
            const [y, m, d] = datePart.split('-').map(Number);
            targetDate = new Date(y, m - 1, d);
            targetDate.setHours(23, 59, 59, 999);
        } else if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            const [y, m, d] = dateStr.split('-').map(Number);
            targetDate = new Date(y, m - 1, d);
            targetDate.setHours(23, 59, 59, 999);
        } else {
            targetDate = new Date(dateStr);
            if (targetDate && !isNaN(targetDate.getTime())) {
                targetDate.setHours(23, 59, 59, 999);
            }
        }

        if (!targetDate || isNaN(targetDate.getTime())) return true;
        return targetDate.getTime() >= today.getTime();
    } catch (e) {
        return true;
    }
}

function getFilterStats(data: any[], type: string) {
    const now = new Date();
    const BLOCKLIST = ['블루마린 스쿠버 다이브', '광주 조선대학교 해오름관'];

    // Mimic the filter logic from performance-data.ts
    const filtered = data.filter(p => {
        // Always show specific genres
        const genre = p.genre || type; // Fallback to source type if genre missing
        if (['movie', 'ott', 'museum', 'leisure', 'hotdeal'].includes(genre)) return true;

        if (!isPerformanceActive(p.date, now)) return false;

        if (p.venue === '예매하기') return false;
        if (/^\d{1,2}\.\d{1,2}/.test(p.venue)) return false;

        if (BLOCKLIST.some(b => (p.venue || '').includes(b))) return false;

        return true;
    });

    return filtered.length;
}

async function generateReport() {
    const dataDir = path.join(process.cwd(), 'src/data');
    console.log('| 데이터 출처 | 수집된 갯수 | 노출 갯수 | 마지막 업데이트 (파일 수정 시간) |');
    console.log('|---|---|---|---|');

    let totalCollected = 0;
    let totalExposed = 0;

    for (const source of SOURCES) {
        const filePath = path.join(dataDir, source.file);

        if (!fs.existsSync(filePath)) {
            console.log(`| ${source.name} | 파일 없음 | - | - |`);
            continue;
        }

        const stats = fs.statSync(filePath);
        const lastModified = stats.mtime.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });

        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const data = JSON.parse(content);
            const collectedCount = Array.isArray(data) ? data.length : 0;
            const exposedCount = getFilterStats(Array.isArray(data) ? data : [], source.type);

            console.log(`| ${source.name} | ${collectedCount.toLocaleString()} | ${exposedCount.toLocaleString()} | ${lastModified} |`);

            totalCollected += collectedCount;
            totalExposed += exposedCount;
        } catch (e) {
            console.log(`| ${source.name} | 에러 | - | ${lastModified} |`);
        }
    }

    console.log(`| **합계** | **${totalCollected.toLocaleString()}** | **${totalExposed.toLocaleString()}** | - |`);
}

generateReport();

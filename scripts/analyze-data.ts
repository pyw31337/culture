
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'src/data');

interface Performance {
    id: string;
    title: string;
    date: string;
    venue: string;
    region: string;
    genre: string;
    [key: string]: any;
}

const SOURCES = [
    { file: 'interpark.json', name: 'Interpark (Ticket)' },
    { file: 'yes24.json', name: 'Yes24 (Ticket)' },
    { file: 'timeticket.json', name: 'TimeTicket' },
    { file: 'festivals.json', name: 'Festivals' },
    { file: 'kovo.json', name: 'Volleyball (KOVO)' },
    { file: 'kbl.json', name: 'Basketball (KBL)' },
    { file: 'kbo.json', name: 'Baseball (KBO)' },
    { file: 'handball.json', name: 'Handball' },
    { file: 'soccer.json', name: 'Soccer' },
    { file: 'ott.json', name: 'OTT (Kinolights/Naver)' },
    { file: 'movies.json', name: 'Movies' },
    { file: 'travel.json', name: 'Travel' },
    { file: 'myrealtrip-kids.json', name: 'MyRealTrip (Kids)' },
    { file: 'sssd-class.json', name: 'SSSD Class' },
    { file: 'umclass.json', name: 'UmClass' },
    { file: 'mochaclass.json', name: 'MochaClass' },
    { file: 'seoul-culture.json', name: 'Seoul Culture' },
    { file: 'mommom.json', name: 'Mommom (Kids)' },
    { file: 'museum.json', name: 'Museum' },
    { file: 'musical.json', name: 'Musical' },
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

        if (!targetDate || isNaN(targetDate.getTime())) return true; // Default to true if parse fails to be safe (or false? Safe to true to not hide potential data)
        return targetDate.getTime() >= today.getTime();
    } catch (e) {
        return true;
    }
}

function processSource(source: { file: string, name: string }) {
    const filePath = path.join(DATA_DIR, source.file);

    if (!fs.existsSync(filePath)) {
        return {
            name: source.name,
            total: 0,
            exposed: 0,
            lastLog: 'File not found'
        };
    }

    const stats = fs.statSync(filePath);
    const lastLog = stats.mtime.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });

    let data: Performance[] = [];
    try {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        if (fileContent.trim()) {
            data = JSON.parse(fileContent);
        }
    } catch (e) {
        // console.error(`Error parsing ${source.file}:`, e);
    }

    const total = Array.isArray(data) ? data.length : 0;

    // Filter Logic
    const now = new Date();
    const validRegions = ['seoul', 'gyeonggi', 'incheon', 'busan', 'daegu', 'gwangju', 'etc'];
    const BLOCKLIST = ['블루마린 스쿠버 다이브', '광주 조선대학교 해오름관'];

    const exposed = Array.isArray(data) ? data.filter(p => {
        if (!p) return false;

        // Always show specific genres
        const alwaysShow = ['movie', 'travel', 'kids', 'class', 'ott', 'museum', 'leisure', 'hotdeal'];
        if (alwaysShow.includes(p.genre)) return true;

        if (!isPerformanceActive(p.date, now)) return false;

        // Valid region check logic copied roughly
        if (!p.region) return false; // Basic safety

        // Sports Strict
        if (['volleyball', 'basketball', 'baseball', 'handball'].includes(p.genre)) {
            if (!validRegions.includes(p.region)) return false;
        }

        if (!validRegions.includes(p.region)) return false;

        if (p.venue === '예매하기') return false;
        if (/^\d{1,2}\.\d{1,2}/.test(p.venue)) return false;

        if (BLOCKLIST.some(b => p.venue && p.venue.includes(b))) return false;

        return true;
    }).length : 0;

    return {
        name: source.name,
        total,
        exposed,
        lastLog: lastLog // Modification time
    };
}

async function main() {
    console.log("| 수집처 | 수집된 데이터 (건) | 노출 데이터 (건) | 마지막 로그 (수정일) | 비고 |");
    console.log("|---|---|---|---|---|");

    for (const source of SOURCES) {
        const result = processSource(source);
        // Special check for 'lastEnriched' in interpark if possible, but file mtime is good enough generic
        // If total == 0, note it
        const note = result.total === 0 ? '데이터 없음' : '';
        console.log(`| ${result.name} | ${result.total.toLocaleString()} | ${result.exposed.toLocaleString()} | ${result.lastLog} | ${note} |`);
    }
}

main();

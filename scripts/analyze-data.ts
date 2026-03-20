
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
    { file: 'interpark.json', name: '인터파크 (공연/전시)' },
    { file: 'yes24.json', name: '예스24' },
    { file: 'timeticket.json', name: '타임티켓' },
    { file: 'festivals.json', name: '축제 (VisitKorea)' },
    { file: 'movies.json', name: '영화' },
    { file: 'kovo.json', name: '배구 (KOVO)' },
    { file: 'kbl.json', name: '농구 (KBL)' },
    { file: 'kbo.json', name: '야구 (KBO)' },
    { file: 'handball.json', name: '핸드볼' },
    { file: 'kleague.json', name: '축구 (K리그)' },
    { file: 'myrealtrip-kids.json', name: '마이리얼트립 (키즈)' },
    { file: 'sssd-class.json', name: '솜씨당' },
    { file: 'umclass.json', name: '엄클래스' },
    { file: 'mochaclass.json', name: '모카클래스' },
    { file: 'seoul-culture.json', name: '서울문화포털' },
    { file: 'mommom.json', name: '맘맘 (장소)' },
    { file: 'mommom-products.json', name: '맘맘 (상품)' },
    { file: 'museum.json', name: '박물관' },
];

const VENUE_PATH = path.join(DATA_DIR, 'venues.json');
const venueData = JSON.parse(fs.readFileSync(VENUE_PATH, 'utf-8'));
const venues = venueData as Record<string, { address: string; lat?: number; lng?: number }>;

function isPerformanceActive(dateStr: string, today: Date): boolean {
    if (!dateStr) return false;

    try {
        let targetDate: Date | null = null;
        if (dateStr.includes('~')) {
            const parts = dateStr.split('~');
            const endStr = parts[parts.length - 1].trim();
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

    let data: any[] = [];
    try {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        if (fileContent.trim()) {
            data = JSON.parse(fileContent);
        }
    } catch (e) { }

    const total = Array.isArray(data) ? data.length : 0;

    const now = new Date();
    const BLOCKLIST = ['블루마린 스쿠버 다이브', '광주 조선대학교 해오름관'];

    const exposed = Array.isArray(data) ? data.filter(p => {
        if (!p) return false;
        if (p.genre === 'popup' || p.genre === 'travel') return false;
        if (p.genre === 'movie') return true;
        if (!isPerformanceActive(p.date, now)) return false;
        if (p.venue === '예매하기') return false;
        if (/^\d{1,2}\.\d{1,2}/.test(p.venue)) return false;

        // Venue validation
        const v = venues[p.venue];
        if (!v || !v.address || v.address === '정보 없음' || !v.lat || !v.lng) {
            return false;
        }

        if (BLOCKLIST.some(b => p.venue && p.venue.includes(b))) return false;
        return true;
    }).length : 0;

    return {
        name: source.name,
        total,
        exposed,
        lastLog: lastLog
    };
}

async function main() {
    console.log("| 수집처 | 수집 (건) | 노출 (건) | 마지막 로그 (KST) |");
    console.log("|---|---|---|---|");

    const results = SOURCES.map(s => processSource(s));

    results.forEach(r => {
        console.log(`| ${r.name} | ${r.total.toLocaleString()} | ${r.exposed.toLocaleString()} | ${r.lastLog} |`);
    });

    const totalRaw = results.reduce((acc, r) => acc + r.total, 0);
    const totalExposed = results.reduce((acc, r) => acc + r.exposed, 0);
    console.log(`| **합계** | **${totalRaw.toLocaleString()}** | **${totalExposed.toLocaleString()}** | - |`);
}

main();


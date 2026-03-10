import fs from 'fs';
import path from 'path';

const ROOT = '/Users/pyw31337/Developer/CultureFlow-New';
const MOCHA_FILE = path.join(ROOT, 'src/data/mochaclass.json');
const PERF_FILE = path.join(ROOT, 'public/data/performances.json');

const regionMap: Record<string, string> = {
    '서울': 'seoul', '강남': 'seoul', '홍대': 'seoul', '건대': 'seoul', '신촌': 'seoul', '잠실': 'seoul',
    '경기': 'gyeonggi', '인천': 'gyeonggi', '부천': 'gyeonggi', '수원': 'gyeonggi', '성남': 'gyeonggi',
    '부산': 'busan', '서면': 'busan', '해운대': 'busan',
    '제주': 'jeju',
    '광주': 'gwangju',
    '대구': 'daegu',
    '대전': 'daejeon',
    '울산': 'ulsan'
};

function repairData() {
    console.log('Repairing MochaClass data...');
    
    if (!fs.existsSync(MOCHA_FILE)) {
        console.error('File not found:', MOCHA_FILE);
        return;
    }

    const data = JSON.parse(fs.readFileSync(MOCHA_FILE, 'utf8'));
    let fixedCount = 0;

    const repaired = data.map((item: any) => {
        // Find tags like [Jeju/Seogwipo] or [Jeju]
        const tagMatch = item.title.match(/\[([^\]]+)\]/);
        
        if (tagMatch && (item.venue === '모카클래스' || item.venue.includes('모카클래스 ('))) {
            const tag = tagMatch[1];
            
            // Use the tag as the new venue
            item.venue = tag;
            
            // Update region if possible
            for (const [key, reg] of Object.entries(regionMap)) {
                if (tag.includes(key) || item.title.includes(key)) {
                    item.region = reg;
                    // If address is generic, update it to be slightly more specific for geocoding
                    if (item.address === '서울특별시' || item.address === '서울') {
                        if (reg === 'jeju') item.address = '제주';
                        else if (reg === 'busan') item.address = '부산';
                        else if (reg === 'gyeonggi') item.address = '경기도';
                    }
                    break;
                }
            }
            fixedCount++;
        }
        return item;
    });

    fs.writeFileSync(MOCHA_FILE, JSON.stringify(repaired, null, 2));
    console.log(`Repaired ${fixedCount} items in ${MOCHA_FILE}`);

    // Sync with public/data/performances.json if it exists
    if (fs.existsSync(PERF_FILE)) {
        const perfData = JSON.parse(fs.readFileSync(PERF_FILE, 'utf8'));
        const updatedPerf = perfData.map((p: any) => {
            if (p.genre === 'class' && (p.venue === '모카클래스' || p.venue.includes('모카클래스 ('))) {
                const match = repaired.find((r: any) => r.id === p.id);
                if (match) return match;
            }
            return p;
        });
        fs.writeFileSync(PERF_FILE, JSON.stringify(updatedPerf, null, 2));
        console.log(`Synced updates to ${PERF_FILE}`);
    }
}

repairData();

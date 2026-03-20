import fs from 'fs';
import path from 'path';

const MOCHACLASS_FILE = path.resolve(process.cwd(), 'src/data/mochaclass.json');

function cleanMochaclass() {
    if (!fs.existsSync(MOCHACLASS_FILE)) return;
    const data = JSON.parse(fs.readFileSync(MOCHACLASS_FILE, 'utf-8'));
    let fixed = 0;

    data.forEach((p: any) => {
        if (!p.venue) return;

        let v = p.venue;
        let original = v;

        if (v.includes('위치대한민국')) {
            v = v.replace('위치대한민국', '').trim();
        }
        if (v.includes('공간 소개')) {
            v = v.split('공간 소개')[0].trim();
        }
        if (v.includes('상세페이지 참조')) {
            v = '모카클래스'; // Fallback
        }
        if (v.includes('지금 바로 클래스를')) {
            v = '모카클래스';
        }

        if (v !== original) {
            p.venue = v;
            p.address = v === '모카클래스' ? '' : v;
            fixed++;
        }

        // Also strip commas from the end if they exist
        if (p.venue.endsWith(',')) p.venue = p.venue.slice(0, -1);
    });

    if (fixed > 0) {
        fs.writeFileSync(MOCHACLASS_FILE, JSON.stringify(data, null, 2));
        console.log(`Cleaned up ${fixed} dirty Mochaclass venues.`);
    }
}

cleanMochaclass();

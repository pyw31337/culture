import fs from 'fs';
import path from 'path';

const OTT_PATH = path.resolve(process.cwd(), 'src/data/ott.json');

const MAP: Record<string, string> = {
    'coupang': '쿠팡플레이',
    'netflix': '넷플릭스',
    'disney': '디즈니플러스',
    'tving': '티빙',
    'wavve': '웨이브'
};

function run() {
    console.log('Replacing English OTT names with Korean ones in ott.json...');
    const data = JSON.parse(fs.readFileSync(OTT_PATH, 'utf-8'));

    let replaceCount = 0;
    for (const item of data) {
        if (MAP[item.platform]) {
            item.platform = MAP[item.platform];
            replaceCount++;
        }
    }

    fs.writeFileSync(OTT_PATH, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`Successfully replaced ${replaceCount} platform names.`);
}

run();

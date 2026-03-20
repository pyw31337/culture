
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'src/data');
const VENUES_PATH = path.join(DATA_DIR, 'venues.json');

const SOURCE_FILES = [
    'interpark.json',
    'museum.json',
    'mochaclass.json',
    'umclass.json',
    'kbo.json',
    'travel.json',
    'festivals.json',
    'seoul-culture.json'
];

async function audit() {
    console.log('📊 공연장 좌표 매핑 감사 시작...');

    if (!fs.existsSync(VENUES_PATH)) {
        console.error('❌ venues.json 파일을 찾을 수 없습니다.');
        return;
    }

    const venues = JSON.parse(fs.readFileSync(VENUES_PATH, 'utf-8'));
    const missingVenues = new Map<string, { sources: string[], count: number }>();

    for (const file of SOURCE_FILES) {
        const filePath = path.join(DATA_DIR, file);
        if (!fs.existsSync(filePath)) continue;

        try {
            const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            data.forEach((item: any) => {
                const venueName = item.venue || item.place;
                if (!venueName) return;

                const v = venues[venueName];
                const isMissing = !v || !v.lat || !v.lng || v.address === '정보 없음';

                if (isMissing) {
                    if (!missingVenues.has(venueName)) {
                        missingVenues.set(venueName, { sources: [file], count: 1 });
                    } else {
                        const info = missingVenues.get(venueName)!;
                        if (!info.sources.includes(file)) info.sources.push(file);
                        info.count++;
                    }
                }
            });
        } catch (e) {
            console.error(`❌ ${file} 처리 중 에러:`, e);
        }
    }

    console.log(`\n🔎 분석 결과: 총 ${missingVenues.size}개의 장소가 좌표 정보가 없거나 부족합니다.`);

    const sortedMissing = Array.from(missingVenues.entries())
        .sort((a, b) => b[1].count - a[1].count);

    // Save report
    const reportPath = path.join(process.cwd(), 'missing_venues_report.json');
    const reportData = sortedMissing.map(([name, info]) => ({
        venue: name,
        ...info
    }));
    fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));

    console.log(`📄 상세 리포트가 저장되었습니다: ${reportPath}`);

    // Summary of top missing venues
    console.log('\n🔝 주요 누락 장소 (Top 10):');
    sortedMissing.slice(0, 10).forEach(([name, info]) => {
        console.log(`- ${name} (${info.count}건) [소스: ${info.sources.join(', ')}]`);
    });
}

audit();

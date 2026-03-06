
import fs from 'fs';
import path from 'path';
import { QUALITY_THRESHOLDS, POISON_PATTERNS, isVenueSuspicious, isRegionMismatch } from './utils/quality-rules.js';

const DATA_DIR = path.join(process.cwd(), 'src/data');
const PUBLIC_DIR = path.join(process.cwd(), 'public');
const VENUES_PATH = path.join(DATA_DIR, 'venues.json');

const TARGETS = [
    'movies.json',
    'museum.json',
    'interpark.json',
    'mochaclass.json',
    'umclass.json',
    'travel.json'
];

async function audit() {
    console.log('🧐 [데이터 품질 감사 시스템] 정밀 진단을 시작합니다...');

    if (!fs.existsSync(VENUES_PATH)) {
        console.error('❌ venues.json이 없습니다.');
        return;
    }

    const venues = JSON.parse(fs.readFileSync(VENUES_PATH, 'utf-8'));
    const venueCounts: Record<string, number> = {};
    const issues: any[] = [];

    // 1. 전역 카운트 수집 (장소 밀집도 조사)
    for (const file of TARGETS) {
        const filePath = path.join(DATA_DIR, file);
        if (!fs.existsSync(filePath)) continue;

        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        data.forEach((item: any) => {
            const vName = item.venue || item.place;
            if (vName) {
                venueCounts[vName] = (venueCounts[vName] || 0) + 1;
            }
        });
    }

    // 2. 세부 항목 감사
    for (const file of TARGETS) {
        const filePath = path.join(DATA_DIR, file);
        if (!fs.existsSync(filePath)) continue;

        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

        data.forEach((item: any, idx: number) => {
            const itemID = item.id || `${file}_${idx}`;

            // [규칙 1] 이미지 품질 (용량 체크)
            const imgPath = item.image || item.poster || item.imageSrc;
            if (imgPath && imgPath.startsWith('/images/')) {
                const absPath = path.join(PUBLIC_DIR, imgPath);
                if (fs.existsSync(absPath)) {
                    const stats = fs.statSync(absPath);
                    if (stats.size < QUALITY_THRESHOLDS.MIN_POSTER_SIZE) {
                        issues.push({
                            type: 'LOW_QUALITY_IMAGE',
                            id: itemID,
                            title: item.title,
                            value: `${(stats.size / 1024).toFixed(1)}KB`,
                            file
                        });
                    }
                }
            }

            // [규칙 2] 장소 밀집도 (본사 주소 의심)
            const vName = item.venue || item.place;
            if (vName && isVenueSuspicious(venueCounts[vName], vName)) {
                issues.push({
                    type: 'SUSPICIOUS_VENUE_DENSITY',
                    id: itemID,
                    title: item.title,
                    venue: vName,
                    count: venueCounts[vName],
                    file
                });
            }

            // [규칙 3] 텍스트 오염 (D-day 등)
            if (item.title && POISON_PATTERNS.TITLE_D_DAY.test(item.title)) {
                issues.push({
                    type: 'POISONED_TITLE',
                    id: itemID,
                    title: item.title,
                    file
                });
            }

            if (item.subGenre && POISON_PATTERNS.GENRE_COUNTRY.test(item.subGenre)) {
                issues.push({
                    type: 'POISONED_GENRE',
                    id: itemID,
                    title: item.title,
                    genre: item.subGenre,
                    file
                });
            }

            // [규칙 4] 구역 불일치 (Region vs Address)
            if (vName && venues[vName]) {
                const v = venues[vName];
                const addr = v.address || '';
                const region = item.region || '';

                if (isRegionMismatch(region, addr, item.title)) {
                    issues.push({
                        type: 'REGION_ADDRESS_MISMATCH',
                        id: itemID,
                        title: item.title,
                        region,
                        address: addr,
                        file
                    });
                }
            }
        });
    }

    // 결과 출력
    console.log(`\n📊 감사 결과: 총 ${issues.length}건의 잠재적 품질 이슈 발견`);

    const summary: Record<string, number> = {};
    issues.forEach(iss => {
        summary[iss.type] = (summary[iss.type] || 0) + 1;
    });

    console.table(summary);

    if (issues.length > 0) {
        const reportPath = path.join(process.cwd(), 'QUALITY_REPORT.json');
        fs.writeFileSync(reportPath, JSON.stringify(issues, null, 2));
        console.log(`\n📄 상세 리포트가 생성되었습니다: ${reportPath}`);
    }
}

audit();

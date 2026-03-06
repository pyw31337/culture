
import fs from 'fs';
import path from 'path';
import { cleanTitle, cleanGenre, POISON_PATTERNS } from './utils/quality-rules.js';
import { processImage } from './utils/image-processor.js';

const DATA_DIR = path.join(process.cwd(), 'src/data');
const PUBLIC_DIR = path.join(process.cwd(), 'public');

const TARGETS = [
    'movies.json',
    'museum.json',
    'interpark.json',
    'mochaclass.json',
    'umclass.json',
    'travel.json'
];

async function repair() {
    console.log('🛠️ [데이터 품질 수선 시스템] 복구를 시작합니다...');

    const reportPath = path.join(process.cwd(), 'QUALITY_REPORT.json');
    if (!fs.existsSync(reportPath)) {
        console.error('❌ 품질 리포트(QUALITY_REPORT.json)가 없습니다. 감사를 먼저 실행하세요.');
        return;
    }

    const issues = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
    const issuesByFile: Record<string, any[]> = {};

    issues.forEach((iss: any) => {
        if (!issuesByFile[iss.file]) issuesByFile[iss.file] = [];
        issuesByFile[iss.file].push(iss);
    });

    for (const file in issuesByFile) {
        const filePath = path.join(DATA_DIR, file);
        if (!fs.existsSync(filePath)) continue;

        let data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        const fileIssues = issuesByFile[file];
        let changed = false;

        console.log(`\n📄 ${file} 수선 중... (${fileIssues.length}개 이슈)`);

        for (const iss of fileIssues) {
            const item = data.find((d: any) => (d.id || '') === iss.id);
            if (!item) continue;

            switch (iss.type) {
                case 'POISONED_TITLE':
                    const originalTitle = item.title;
                    item.title = cleanTitle(item.title);
                    console.log(`   ✅ 제목 정제: ${originalTitle} -> ${item.title}`);
                    changed = true;
                    break;

                case 'POISONED_GENRE':
                    const originalGenre = item.subGenre;
                    item.subGenre = cleanGenre(item.subGenre);
                    console.log(`   ✅ 장르 정제: ${originalGenre} -> ${item.subGenre}`);
                    changed = true;
                    break;

                case 'LOW_QUALITY_IMAGE':
                    console.log(`   🔄 저화질 이미지 복구 시도: ${item.title}`);
                    // Force re-download by clearing image and calling processImage
                    const posterUrl = item.posterUrl || item.backupPoster || item.imageSrc;
                    if (posterUrl) {
                        const safeTitle = item.title.replace(/[^a-zA-Z0-9가-힣]/g, '');
                        const stableFilename = `movie_${safeTitle}`;
                        // Delete old file first
                        const oldPath = path.join(PUBLIC_DIR, item.image);
                        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);

                        const newPath = await processImage(posterUrl, stableFilename, 'posters/movies');
                        if (newPath) {
                            item.image = newPath;
                            console.log(`      ✨ 복구 성공: ${newPath}`);
                            changed = true;
                        }
                    }
                    break;

                case 'SUSPICIOUS_VENUE_DENSITY':
                    // We don't auto-fix this as it requires manual address verification
                    // but we can mark it for the UI if needed.
                    break;
            }
        }

        if (changed) {
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
            console.log(` ✅ ${file} 저장 완료.`);
        }
    }

    console.log('\n✨ 수선 작업이 완료되었습니다.');
}

repair();

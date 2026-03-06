
import fs from 'fs';
import path from 'path';

// Targets that MUST have data
const CRITICAL_TARGETS = [
    { file: 'movies.json', name: '영화' },
    { file: 'museum.json', name: '미술관/박물관' },
    { file: 'interpark.json', name: '인터파크 공연' },
    { file: 'mochaclass.json', name: '모카클래스' },
    { file: 'umclass.json', name: '솜씨당/음클래스' },
    { file: 'kbo.json', name: '프로야구' },
    { file: 'travel.json', name: '여행/체험' }
];

const DATA_DIR = path.join(process.cwd(), 'src/data');
const VENUES_PATH = path.join(DATA_DIR, 'venues.json');

async function validate() {
    const dataDir = DATA_DIR;
    const errors: string[] = [];
    const warnings: string[] = [];

    const venues = JSON.parse(fs.readFileSync(VENUES_PATH, 'utf-8'));

    console.log('🔍 [데이터 정합성 엔진] 정밀 검사를 시작합니다...');

    // 1. 에러 마커 파일 확인 (.error)
    const files = fs.readdirSync(dataDir);
    const errorFiles = files.filter(f => f.endsWith('.error'));

    if (errorFiles.length > 0) {
        errorFiles.forEach(f => {
            const content = fs.readFileSync(path.join(dataDir, f), 'utf-8');
            errors.push(`❌ [스크래퍼 에러] ${f}: ${content}`);
        });
    }

    // 2. 개별 파일 정밀 검토
    for (const target of CRITICAL_TARGETS) {
        const filePath = path.join(dataDir, target.file);

        if (!fs.existsSync(filePath)) {
            errors.push(`❌ [${target.name}] 파일을 찾을 수 없음: ${target.file}`);
            continue;
        }

        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const data = JSON.parse(content);

            if (!Array.isArray(data)) {
                errors.push(`❌ [${target.name}] 형식이 올바르지 않음 (배열이 아님): ${target.file}`);
                continue;
            }

            if (data.length === 0) {
                errors.push(`❌ [${target.name}] 데이터가 0건입니다: ${target.file}`);
                continue;
            }

            let missingGeoCount = 0;
            let invalidImageCount = 0;
            let invalidDateCount = 0;

            data.forEach((item: any, index: number) => {
                const venueName = item.venue || item.place;
                // 좌표 검사 (문화/공연 카테고리는 위치가 필수)
                if (target.name !== '영화' && venueName) {
                    // 해외 여행(overseas)은 좌표 검출에서 제외
                    if (target.file === 'travel.json' && item.region === 'overseas') {
                        return;
                    }

                    const v = venues[venueName];
                    if (!v || !v.lat || !v.lng || v.address === '정보 없음') {
                        missingGeoCount++;
                    }
                }

                // 이미지 URL 검사
                const img = item.image || item.poster || item.imageSrc;
                if (!img || (!img.startsWith('http') && !img.startsWith('/'))) {
                    invalidImageCount++;
                }

                // 날짜 포맷 검사 (간단한 체크)
                if (item.date && item.date !== '상시' && !item.date.includes('.') && !item.date.includes('-')) {
                    invalidDateCount++;
                }
            });

            const stats = `(${data.length}건 검사 완료)`;
            if (missingGeoCount > 0) {
                const msg = `⚠️ [${target.name}] 좌표 누락: ${missingGeoCount}건 ${stats}`;
                // Allow some missing for Class/Travel if it's below a threshold (Best effort)
                if (target.file.includes('class') && missingGeoCount > 300) {
                    errors.push(`❌ [${target.name}] 심각한 좌표 누락 (임계값 300건 초과): ${missingGeoCount}건`);
                } else {
                    warnings.push(msg);
                }
            }

            if (invalidImageCount > 0) {
                errors.push(`❌ [${target.name}] 이미지 경로 오류: ${invalidImageCount}건 ${stats}`);
            }

            if (invalidDateCount > 0) {
                warnings.push(`⚠️ [${target.name}] 날짜 포맷 의심: ${invalidDateCount}건 ${stats}`);
            }

            if (missingGeoCount === 0 && invalidImageCount === 0) {
                console.log(`✅ [${target.name}] 통과 ${stats}`);
            }
        } catch (e: any) {
            errors.push(`❌ [${target.name}] 파일 읽기 또는 파싱 에러: ${e.message}`);
        }
    }

    // 3. 결과 보고
    console.log('\n----------------------------------------');
    if (warnings.length > 0) {
        console.log('💡 주의 사항 (Warnings):');
        warnings.forEach(w => console.log(w));
    }

    if (errors.length > 0) {
        console.error('\n🚨 데이터 정합성 검사 실패 (Critical Errors):');
        errors.forEach(e => console.error(e));
        console.error('\nStopping deployment due to critical data quality issues.');
        process.exit(1);
    } else {
        console.log('\n✨ [검사 완료] 모든 주요 데이터 소스가 정합성 기준을 충족합니다.');
    }
}

validate();

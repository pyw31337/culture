import fs from 'fs';
import path from 'path';
import { analyzeContentQuality, type ContentQualityItem } from './utils/content-quality';

type ContentItem = ContentQualityItem & {
    id?: string;
    title?: string;
};

function loadPerformances(): ContentItem[] {
    const targetPath = path.join(process.cwd(), 'public', 'data', 'performances.json');
    if (!fs.existsSync(targetPath)) {
        throw new Error('public/data/performances.json 파일이 없습니다.');
    }

    const parsed = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
    if (!Array.isArray(parsed)) {
        throw new Error('performances.json 형식이 올바르지 않습니다.');
    }

    return parsed;
}

function hasLocalAsset(assetPath?: string): boolean {
    if (!assetPath || !assetPath.startsWith('/')) return false;
    const normalized = assetPath.replace(/^\/+/, '');
    return fs.existsSync(path.join(process.cwd(), 'public', normalized));
}

function main() {
    const items = loadPerformances();
    const qualitySummary = analyzeContentQuality(items, {
        hasLocalAsset,
    });

    const errors: string[] = [];

    if (items.filter((item) => item.genre === 'movie').length === 0) {
        errors.push('영화 데이터가 비어 있습니다.');
    }

    if (qualitySummary.movieMissingLinkCount > 0) {
        errors.push(`영화 링크 누락 ${qualitySummary.movieMissingLinkCount}건`);
    }

    if (qualitySummary.movieMissingDescriptionCount > 0) {
        errors.push(`영화 설명/시놉시스 누락 ${qualitySummary.movieMissingDescriptionCount}건`);
    }

    if (qualitySummary.movieBrokenImageCount > 0) {
        errors.push(`복구 경로 없는 영화 이미지 누락 ${qualitySummary.movieBrokenImageCount}건`);
    }

    console.log(`[quality] total items: ${items.length}`);
    console.warn(`[quality][warn] 장르별 링크 누락: ${JSON.stringify(qualitySummary.warningsByGenre.missingLinks)}`);
    console.warn(`[quality][warn] 장르별 텍스트 누락: ${JSON.stringify(qualitySummary.warningsByGenre.missingDescriptions)}`);
    console.warn(`[quality][warn] 장르별 이미지 누락: ${JSON.stringify(qualitySummary.warningsByGenre.missingImages)}`);

    if (errors.length > 0) {
        errors.forEach((error) => console.error(`[quality][error] ${error}`));
        process.exit(1);
    }

    console.log(`[quality] 콘텐츠 핵심 품질 검증 통과 (${qualitySummary.status})`);
}

main();

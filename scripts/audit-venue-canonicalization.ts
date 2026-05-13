import fs from 'fs';
import path from 'path';
import type { Performance } from '../src/types';
import { buildVenueCanonicalizationReport, type VenueRecordMap } from './utils/venue-canonicalization';

const PERFORMANCES_PATH = path.join(process.cwd(), 'public', 'data', 'performances.json');
const VENUES_PATH = path.join(process.cwd(), 'public', 'data', 'venues.json');

function readJson<T>(filePath: string): T {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function writeOptionalReport(report: unknown) {
    if (process.env.WRITE_AUDIT_REPORTS !== '1') return;

    const reportsDir = path.join(process.cwd(), 'reports');
    fs.mkdirSync(reportsDir, { recursive: true });
    fs.writeFileSync(path.join(reportsDir, 'venue-canonicalization-report.json'), JSON.stringify(report, null, 2));
}

function main() {
    const performances = readJson<Performance[]>(PERFORMANCES_PATH);
    const venues = readJson<VenueRecordMap>(VENUES_PATH);
    const report = buildVenueCanonicalizationReport(performances, venues);

    console.log(`🔎 공연장 표준화 감사: ${report.usedVenueCount.toLocaleString()}개 공연장 · ${report.usedPerformanceCount.toLocaleString()}건 콘텐츠`);
    console.log(`- 고신뢰 통합 후보: ${report.summary.highConfidenceMergeCandidateCount}개`);
    console.log(`- parent/child 후보: ${report.parentChildCandidates.length}개`);
    console.log(`- 좌표 재확인 그룹: ${report.coordinateRiskGroups.length}개`);
    console.log(`- 좌표 누락/오류 공연장: ${report.invalidCoordinateVenues.length}개`);
    console.log(`- 주소 누락 공연장: ${report.missingAddressVenues.length}개`);
    console.log(`- 공식 장소 검색 모드: ${report.externalLookup.mode}`);

    if (report.exactAddressAliasCandidates.length > 0) {
        console.warn('ℹ️ 고신뢰 통합 후보 상위:');
        report.exactAddressAliasCandidates.slice(0, 8).forEach((candidate) => {
            const names = candidate.venues.slice(0, 4).map((venue) => venue.name).join(' / ');
            console.warn(`- ${candidate.groupKey}: ${names} (${candidate.usageCount}건)`);
        });
    }

    if (report.coordinateRiskGroups.length > 0) {
        console.warn('⚠️ 좌표 fallback 의심 그룹 상위:');
        report.coordinateRiskGroups.slice(0, 8).forEach((candidate) => {
            const names = candidate.venues.slice(0, 4).map((venue) => venue.name).join(' / ');
            console.warn(`- ${candidate.groupKey}: ${names} (${candidate.usageCount}건)`);
        });
    }

    writeOptionalReport(report);
    console.log(`✅ 공연장 표준화 감사 완료 (${report.status})`);
}

main();

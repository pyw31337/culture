import fs from 'fs';
import path from 'path';
import type { Performance } from '../src/types';
import { buildVenueMaster } from './utils/venue-master';
import type { VenueRecordMap } from './utils/venue-canonicalization';

const PERFORMANCES_PATH = path.join(process.cwd(), 'public', 'data', 'performances.json');
const VENUES_PATH = path.join(process.cwd(), 'public', 'data', 'venues.json');
const CANONICALIZATION_REPORT_PATH = path.join(process.cwd(), 'public', 'data', 'venue-canonicalization-report.json');

function readJson<T>(filePath: string): T {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function readCoordinateRiskKeys() {
    if (!fs.existsSync(CANONICALIZATION_REPORT_PATH)) return new Set<string>();

    const report = readJson<{ coordinateRiskGroups?: Array<{ groupKey?: string }> }>(CANONICALIZATION_REPORT_PATH);
    return new Set((report.coordinateRiskGroups || []).map((group) => group.groupKey).filter((key): key is string => Boolean(key)));
}

function main() {
    const performances = readJson<Performance[]>(PERFORMANCES_PATH);
    const venues = readJson<VenueRecordMap>(VENUES_PATH);
    const result = buildVenueMaster(performances, venues, readCoordinateRiskKeys());
    const dataDir = path.join(process.cwd(), 'public', 'data');

    fs.writeFileSync(path.join(dataDir, 'venue-master.json'), JSON.stringify(result.entries));
    fs.writeFileSync(path.join(dataDir, 'venue-master-report.json'), JSON.stringify(result.report));

    console.log(`🏛️ 공연장 마스터 생성: ${result.entries.length.toLocaleString()}개 canonical venue`);
    console.log(`- 고신뢰: ${result.report.highConfidenceCount.toLocaleString()}개`);
    console.log(`- 중간 신뢰: ${result.report.mediumConfidenceCount.toLocaleString()}개`);
    console.log(`- 낮은 신뢰: ${result.report.lowConfidenceCount.toLocaleString()}개`);
    console.log(`- 공식 장소 검색 필요: ${result.report.needsOfficialLookupCount.toLocaleString()}개`);
    console.log(`- 좌표 fallback 재확인: ${result.report.coordinateFallbackRiskCount.toLocaleString()}개`);
    console.log(`✅ 공연장 마스터 리포트 완료 (${result.report.status})`);
}

main();

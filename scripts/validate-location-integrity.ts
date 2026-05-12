import fs from 'fs';
import path from 'path';
import { buildLocationIntegrityReport } from './utils/location-integrity';
import type { Performance } from '../src/types';

type VenueRecord = Record<string, {
    address?: string;
    lat?: number;
    lng?: number;
    latitude?: number | string;
    longitude?: number | string;
    district?: string;
    name?: string;
}>;

const PERFORMANCES_PATH = path.join(process.cwd(), 'public', 'data', 'performances.json');
const VENUES_PATH = path.join(process.cwd(), 'public', 'data', 'venues.json');

function readJson<T>(filePath: string): T {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function main() {
    const performances = readJson<Performance[]>(PERFORMANCES_PATH);
    const venues = readJson<VenueRecord>(VENUES_PATH);
    const report = buildLocationIntegrityReport(performances, venues);

    console.log(`🔎 위치 정합성 검사: ${report.performanceCount}건 점검`);
    console.log(`- raw venue/address 충돌: ${report.rawMismatchCount}건`);
    console.log(`- 고신뢰 충돌: ${report.highConfidenceMismatchCount}건`);
    console.log(`- 해석 후 잔존 충돌: ${report.resolvedMismatchCount}건`);
    console.log(`- 원본 venue 이름 충돌 참고: ${report.rawAmbiguousVenueNameCount}건`);
    console.log(`- canonical venue 충돌: ${report.ambiguousVenueCount}건`);

    if (report.rawAmbiguousVenueNameCount > 0) {
        console.warn('ℹ️ 원본 venue 이름 충돌 상위 샘플:');
        report.topRawAmbiguousVenueNames.slice(0, 10).forEach((entry) => {
            const labels = entry.locations.map((location) => `${location.displayLabel} (${location.count}건)`).join(', ');
            console.warn(`- ${entry.venue}: ${labels}`);
        });
    }

    if (report.ambiguousVenueCount > 0) {
        console.error('❌ canonical venue 기준으로도 여러 위치가 남아 있습니다.');
        report.topAmbiguousVenues.slice(0, 10).forEach((entry) => {
            const labels = entry.locations.map((location) => `${location.displayLabel} (${location.count}건)`).join(', ');
            console.error(`- ${entry.venue}: ${labels}`);
        });
        process.exit(1);
    }

    if (report.resolvedMismatchCount > 0) {
        console.error('❌ 실제 표시 기준으로도 해결되지 않은 위치 충돌이 남아 있습니다.');
        report.unresolvedSamples.forEach((row) => {
            console.error(`- ${row.title} | performance=${row.performanceAddress} | resolved=${row.resolvedAddress}`);
        });
        process.exit(1);
    }

    console.log('✅ 실제 표시 기준 위치 정합성 통과');
}

main();

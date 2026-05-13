import fs from 'fs';
import path from 'path';
import type { Performance } from '../src/types';
import { buildSourceFunnelReport } from './utils/source-funnel';

const PERFORMANCES_PATH = path.join(process.cwd(), 'public', 'data', 'performances.json');

function readJson<T>(filePath: string): T {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function writeOptionalReport(report: unknown) {
    if (process.env.WRITE_AUDIT_REPORTS !== '1') return;

    const reportsDir = path.join(process.cwd(), 'reports');
    fs.mkdirSync(reportsDir, { recursive: true });
    fs.writeFileSync(path.join(reportsDir, 'source-funnel-report.json'), JSON.stringify(report, null, 2));
}

function formatRate(value: number) {
    return `${Math.round(value * 1000) / 10}%`;
}

function main() {
    const performances = readJson<Performance[]>(PERFORMANCES_PATH);
    const report = buildSourceFunnelReport(performances);

    console.log(`🔎 소스 퍼널 감사: raw ${report.rawItemCount.toLocaleString()}건 → 운영 ${report.finalItemCount.toLocaleString()}건`);
    console.log(`- 등록 수집처: ${report.registeredSourceCount}개 · 운영 반영 수집처: ${report.activeSourceCount}개`);
    console.log(`- 미등록 데이터 파일: ${report.summary.unregisteredDataFileCount}개`);
    console.log(`- 워크플로우/레지스트리 불일치: ${report.summary.workflowOnlyScraperCount}개`);
    console.log(`- 높은 손실률 소스: ${report.highLossSources.length}개`);

    if (report.missingRegisteredFiles.length > 0) {
        console.warn('⚠️ 등록되어 있지만 파일이 없는 소스:');
        report.missingRegisteredFiles.forEach((file) => console.warn(`- ${file}`));
    }

    if (report.unregisteredDataFiles.length > 0) {
        console.warn('ℹ️ 레지스트리에 없는 데이터 파일:');
        report.unregisteredDataFiles.slice(0, 12).forEach((entry) => {
            console.warn(`- ${entry.file}: ${entry.itemCount.toLocaleString()}건 (${entry.note})`);
        });
    }

    if (report.highLossSources.length > 0) {
        console.warn('ℹ️ raw 대비 운영 반영률이 낮은 소스:');
        report.highLossSources.slice(0, 10).forEach((row) => {
            console.warn(`- ${row.label}: ${row.rawItemCount.toLocaleString()}건 → ${row.finalItemCount.toLocaleString()}건 (${formatRate(row.conversionRate)})`);
        });
    }

    writeOptionalReport(report);
    console.log(`✅ 소스 퍼널 감사 완료 (${report.status})`);
}

main();

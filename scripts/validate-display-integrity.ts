import { buildDisplayIntegrityReport, readPublicDisplayIntegrityInputs } from './utils/display-integrity';

function main() {
    const { performances, venues } = readPublicDisplayIntegrityInputs();
    const report = buildDisplayIntegrityReport(performances, venues);

    console.log(`🔎 표시 정합성 검사: ${report.itemCount}건 점검`);
    console.log(`- 차단 이슈: ${report.blockingIssueCount}건`);
    console.log(`- 위치 충돌: ${report.locationMismatchCount}건`);
    console.log(`- 제목 지역/주소 충돌: ${report.bracketLocationMismatchCount}건`);
    console.log(`- 무료 가격 의심: ${report.suspiciousFreePriceCount}건`);
    console.log(`- 가격 미상 참고: ${report.unknownPriceCount}건`);
    console.log(`- 날짜 해석 참고: ${report.invalidDateCount}건`);
    console.log(`- 시간 중복 참고: ${report.duplicateTimeCount}건`);
    console.log(`- 비시즌 참고: ${report.outOfSeasonCount}건`);

    if (report.blockingIssueCount > 0) {
        Object.entries(report.samples).forEach(([key, rows]) => {
            if (!['locationMismatch', 'bracketLocationMismatch', 'suspiciousFreePrice'].includes(key)) return;
            rows.slice(0, 8).forEach((row) => {
                console.error(`[display-integrity][${key}] ${row.title} | ${row.value || ''} | ${row.reason}`);
            });
        });
        process.exit(1);
    }

    console.log(`✅ 표시 정합성 통과 (${report.status})`);
}

main();

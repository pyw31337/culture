import fs from 'fs';
import path from 'path';
import type { Performance } from '../src/types';
import { buildSourceQualityOpportunitySummary } from './utils/source-quality-opportunities';

const PUBLIC_PERFORMANCES_PATH = path.join(process.cwd(), 'public', 'data', 'performances.json');
const PUBLIC_BUILD_INFO_PATH = path.join(process.cwd(), 'public', 'data', 'build-info.json');
const PUBLIC_REPORT_PATH = path.join(process.cwd(), 'public', 'data', 'source-quality-opportunities.json');

function readPerformances() {
    if (!fs.existsSync(PUBLIC_PERFORMANCES_PATH)) {
        throw new Error(`Cannot find ${PUBLIC_PERFORMANCES_PATH}. Run npm run generate-data first.`);
    }

    const parsed = JSON.parse(fs.readFileSync(PUBLIC_PERFORMANCES_PATH, 'utf8')) as unknown;
    if (!Array.isArray(parsed)) {
        throw new Error('public/data/performances.json is not an array.');
    }

    return parsed as Performance[];
}

function formatPercent(rate: number) {
    return `${Math.round(rate * 100)}%`;
}

const performances = readPerformances();
const summary = buildSourceQualityOpportunitySummary(performances);
const shouldWrite = process.argv.includes('--write');

if (shouldWrite) {
    fs.writeFileSync(PUBLIC_REPORT_PATH, JSON.stringify(summary, null, 2));

    if (fs.existsSync(PUBLIC_BUILD_INFO_PATH)) {
        const buildInfo = JSON.parse(fs.readFileSync(PUBLIC_BUILD_INFO_PATH, 'utf8')) as Record<string, unknown>;
        buildInfo.sourceQualityOpportunitySummary = summary;
        fs.writeFileSync(PUBLIC_BUILD_INFO_PATH, JSON.stringify(buildInfo));
    }

    console.log(`Wrote ${PUBLIC_REPORT_PATH}`);
    console.log(`Updated ${PUBLIC_BUILD_INFO_PATH}`);
}

console.log(JSON.stringify(summary, null, 2));
console.log('\nSource quality opportunities');
console.table(summary.topSourceOpportunities.map((row) => ({
    source: row.label,
    items: row.itemCount,
    score: row.opportunityScore,
    priority: row.priority,
    image: formatPercent(row.imageCoverageRate),
    coordinates: formatPercent(row.coordinateCoverageRate),
    description: formatPercent(row.descriptionCoverageRate),
    detailImages: formatPercent(row.detailImageCoverageRate),
    price: formatPercent(row.priceCoverageRate),
    action: row.recommendedAction.slice(0, 72),
})));

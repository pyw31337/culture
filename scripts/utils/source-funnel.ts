import fs from 'fs';
import path from 'path';
import type { Performance } from '../../src/types';
import { SOURCE_REGISTRY } from '../../src/lib/source-registry';

type JsonObject = Record<string, unknown>;

export type SourceFieldCompleteness = {
    venue: number;
    address: number;
    coordinates: number;
    price: number;
    image: number;
    link: number;
    date: number;
};

export type SourceFunnelRow = {
    key: string;
    label: string;
    file: string;
    rawItemCount: number;
    finalItemCount: number;
    conversionRate: number;
    estimatedFilteredOrMergedCount: number;
    rawCompleteness: SourceFieldCompleteness;
    finalCompleteness: SourceFieldCompleteness;
};

export type SourceFunnelReport = {
    checkedAt: string;
    status: 'pass' | 'warn';
    rawItemCount: number;
    finalItemCount: number;
    registeredSourceCount: number;
    activeSourceCount: number;
    missingRegisteredFiles: string[];
    unregisteredDataFiles: Array<{ file: string; itemCount: number; note: string }>;
    workflowScrapers: string[];
    workflowOnlyScrapers: string[];
    registeredWithoutWorkflow: string[];
    highLossSources: SourceFunnelRow[];
    noFinalOutputSources: SourceFunnelRow[];
    rows: SourceFunnelRow[];
    summary: SourceFunnelSummary;
};

export type SourceFunnelSummary = {
    checkedAt: string;
    status: 'pass' | 'warn';
    rawItemCount: number;
    finalItemCount: number;
    registeredSourceCount: number;
    activeSourceCount: number;
    missingRegisteredFileCount: number;
    unregisteredDataFileCount: number;
    workflowOnlyScraperCount: number;
    registeredWithoutWorkflowCount: number;
    highLossSourceCount: number;
    noFinalOutputSourceCount: number;
    topUnregisteredDataFiles: Array<{ file: string; itemCount: number; note: string }>;
    topHighLossSources: Array<Pick<SourceFunnelRow, 'key' | 'label' | 'rawItemCount' | 'finalItemCount' | 'conversionRate'>>;
};

const SOURCE_DATA_DIR = path.join(process.cwd(), 'src', 'data');
const WORKFLOW_PATH = path.join(process.cwd(), '.github', 'workflows', 'daily-update.yml');

const SUPPORT_DATA_FILES = new Set([
    'bad-venues.json',
    'cinemas.json',
    'data_status.md',
    'korean_address_hierarchy.json',
    'mommom-debug.json',
    'ott.json',
    'performances.json',
    'venue-dictionary.json',
    'venues.backup.json',
    'venues.json',
]);

const WORKFLOW_SOURCE_ALIASES: Record<string, string> = {
    cinemas: 'cinemas',
    festival: 'festival',
    handball: 'handball',
    interpark: 'interpark',
    kbl: 'basketball',
    kbo: 'baseball',
    kleague: 'football',
    kopis: 'kopis',
    kovo: 'volleyball',
    mochaclass: 'mochaclass',
    mommom: 'mommom',
    'mommom-activities': 'mommom-activity',
    'mommom-exhibitions': 'mommom-exhibitions',
    'mommom-products': 'mommom-product',
    movies: 'movie',
    museum: 'museum',
    myrealtrip: 'myrealtrip-kids',
    'seoul-culture': 'seoul',
    sssd: 'sssd-class',
    timeticket: 'timeticket',
    umclass: 'umclass',
    'yes24-exclusive': 'yes24-exclusive',
};

const INFRA_WORKFLOW_SCRAPERS = new Set(['build-venues', 'cinemas', 'mommom-exhibitions']);

function readJsonIfExists(filePath: string): unknown {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
}

function toArray(value: unknown): JsonObject[] {
    if (Array.isArray(value)) return value.filter((item): item is JsonObject => Boolean(item && typeof item === 'object' && !Array.isArray(item)));

    if (value && typeof value === 'object') {
        const firstArray = Object.values(value).find(Array.isArray);
        if (Array.isArray(firstArray)) return toArray(firstArray);
    }

    return [];
}

function compactText(value: unknown) {
    return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function hasText(...values: unknown[]) {
    return values.some((value) => compactText(value) !== '' && compactText(value) !== '정보 없음' && compactText(value) !== '정보없음');
}

function parseCoordinate(value: unknown) {
    if (typeof value === 'number' && Number.isFinite(value) && value !== 0) return value;
    if (typeof value === 'string') {
        const parsed = Number.parseFloat(value);
        if (Number.isFinite(parsed) && parsed !== 0) return parsed;
    }
    return null;
}

function hasCoordinates(item: JsonObject | Performance) {
    const lat = parseCoordinate((item as JsonObject).lat ?? (item as JsonObject).latitude);
    const lng = parseCoordinate((item as JsonObject).lng ?? (item as JsonObject).longitude);
    return lat !== null && lng !== null;
}

function buildCompleteness(items: Array<JsonObject | Performance>): SourceFieldCompleteness {
    return items.reduce<SourceFieldCompleteness>((acc, item) => {
        if (hasText((item as JsonObject).venue, (item as JsonObject).place, (item as JsonObject).name)) acc.venue += 1;
        if (hasText((item as JsonObject).address, (item as JsonObject).addr, (item as JsonObject).locationAddress)) acc.address += 1;
        if (hasCoordinates(item)) acc.coordinates += 1;
        if (hasText((item as JsonObject).price, (item as JsonObject).cost, (item as JsonObject).fee, (item as JsonObject).priceDetail)) acc.price += 1;
        if (hasText((item as JsonObject).image, (item as JsonObject).poster, (item as JsonObject).posterUrl, (item as JsonObject).thumbnail)) acc.image += 1;
        if (hasText((item as JsonObject).link, (item as JsonObject).url, (item as JsonObject).website)) acc.link += 1;
        if (hasText((item as JsonObject).date, (item as JsonObject).dateRaw, (item as JsonObject).startDate, (item as JsonObject).endDate)) acc.date += 1;
        return acc;
    }, {
        venue: 0,
        address: 0,
        coordinates: 0,
        price: 0,
        image: 0,
        link: 0,
        date: 0,
    });
}

function getJsonDataFiles() {
    if (!fs.existsSync(SOURCE_DATA_DIR)) return [];
    return fs.readdirSync(SOURCE_DATA_DIR)
        .filter((file) => file.endsWith('.json'))
        .sort((left, right) => left.localeCompare(right));
}

function readWorkflowScrapers() {
    if (!fs.existsSync(WORKFLOW_PATH)) return [];
    const content = fs.readFileSync(WORKFLOW_PATH, 'utf8');
    return Array.from(content.matchAll(/run_scraper\s+"([^"]+)"/g))
        .map((match) => match[1])
        .filter(Boolean);
}

export function buildSourceFunnelReport(finalPerformances: Performance[], checkedAt = new Date().toISOString()): SourceFunnelReport {
    const finalBySource = finalPerformances.reduce<Record<string, Performance[]>>((acc, performance) => {
        const source = performance.source || 'unknown';
        acc[source] = acc[source] || [];
        acc[source].push(performance);
        return acc;
    }, {});

    const rows = SOURCE_REGISTRY.map<SourceFunnelRow>((entry) => {
        const rawPath = path.join(SOURCE_DATA_DIR, entry.file);
        const rawItems = toArray(readJsonIfExists(rawPath));
        const finalItems = finalBySource[entry.key] || [];
        const conversionRate = rawItems.length > 0 ? finalItems.length / rawItems.length : (finalItems.length > 0 ? 1 : 0);

        return {
            key: entry.key,
            label: entry.label,
            file: entry.file,
            rawItemCount: rawItems.length,
            finalItemCount: finalItems.length,
            conversionRate,
            estimatedFilteredOrMergedCount: Math.max(0, rawItems.length - finalItems.length),
            rawCompleteness: buildCompleteness(rawItems),
            finalCompleteness: buildCompleteness(finalItems),
        };
    });

    const registeredFiles = new Set(SOURCE_REGISTRY.map((entry) => entry.file));
    const dataFiles = getJsonDataFiles();
    const missingRegisteredFiles = SOURCE_REGISTRY
        .filter((entry) => !fs.existsSync(path.join(SOURCE_DATA_DIR, entry.file)))
        .map((entry) => entry.file);
    const unregisteredDataFiles = dataFiles
        .filter((file) => !registeredFiles.has(file))
        .map((file) => {
            const itemCount = toArray(readJsonIfExists(path.join(SOURCE_DATA_DIR, file))).length;
            const note = SUPPORT_DATA_FILES.has(file)
                ? 'support-or-legacy'
                : itemCount > 0
                    ? 'unwired-source-candidate'
                    : 'empty-or-reserved';
            return { file, itemCount, note };
        })
        .filter((entry) => entry.itemCount > 0 || entry.note === 'unwired-source-candidate');

    const workflowScrapers = readWorkflowScrapers();
    const registryKeys = new Set(SOURCE_REGISTRY.map((entry) => entry.key));
    const workflowSourceKeys = new Set(
        workflowScrapers
            .map((scraper) => WORKFLOW_SOURCE_ALIASES[scraper] || scraper)
            .filter((scraper) => !INFRA_WORKFLOW_SCRAPERS.has(scraper))
    );
    const workflowOnlyScrapers = workflowScrapers.filter((scraper) => {
        if (INFRA_WORKFLOW_SCRAPERS.has(scraper)) return false;
        const sourceKey = WORKFLOW_SOURCE_ALIASES[scraper] || scraper;
        return !registryKeys.has(sourceKey);
    });
    const registeredWithoutWorkflow = SOURCE_REGISTRY
        .filter((entry) => !workflowSourceKeys.has(entry.key))
        .map((entry) => entry.key);
    const highLossSources = rows
        .filter((row) => row.rawItemCount >= 20 && row.finalItemCount > 0 && row.conversionRate < 0.35)
        .sort((left, right) => left.conversionRate - right.conversionRate || right.rawItemCount - left.rawItemCount);
    const noFinalOutputSources = rows
        .filter((row) => {
            const registryEntry = SOURCE_REGISTRY.find((entry) => entry.key === row.key);
            return row.rawItemCount > 0 && row.finalItemCount === 0 && registryEntry?.seasonal !== true;
        })
        .sort((left, right) => right.rawItemCount - left.rawItemCount);
    const activeSourceCount = rows.filter((row) => row.finalItemCount > 0).length;
    const status: SourceFunnelReport['status'] = (
        missingRegisteredFiles.length > 0 ||
        unregisteredDataFiles.some((entry) => entry.note === 'unwired-source-candidate') ||
        workflowOnlyScrapers.length > 0 ||
        highLossSources.length > 0 ||
        noFinalOutputSources.length > 0
    ) ? 'warn' : 'pass';
    const rawItemCount = rows.reduce((sum, row) => sum + row.rawItemCount, 0);
    const finalItemCount = finalPerformances.length;

    return {
        checkedAt,
        status,
        rawItemCount,
        finalItemCount,
        registeredSourceCount: SOURCE_REGISTRY.length,
        activeSourceCount,
        missingRegisteredFiles,
        unregisteredDataFiles,
        workflowScrapers,
        workflowOnlyScrapers,
        registeredWithoutWorkflow,
        highLossSources,
        noFinalOutputSources,
        rows,
        summary: {
            checkedAt,
            status,
            rawItemCount,
            finalItemCount,
            registeredSourceCount: SOURCE_REGISTRY.length,
            activeSourceCount,
            missingRegisteredFileCount: missingRegisteredFiles.length,
            unregisteredDataFileCount: unregisteredDataFiles.filter((entry) => entry.note === 'unwired-source-candidate').length,
            workflowOnlyScraperCount: workflowOnlyScrapers.length,
            registeredWithoutWorkflowCount: registeredWithoutWorkflow.length,
            highLossSourceCount: highLossSources.length,
            noFinalOutputSourceCount: noFinalOutputSources.length,
            topUnregisteredDataFiles: unregisteredDataFiles.slice(0, 8),
            topHighLossSources: highLossSources.slice(0, 8).map((row) => ({
                key: row.key,
                label: row.label,
                rawItemCount: row.rawItemCount,
                finalItemCount: row.finalItemCount,
                conversionRate: row.conversionRate,
            })),
        },
    };
}

/**
 * Keeps every performance id in the published data small enough to be used as a single
 * filesystem path component by the static export of /p/[id].
 *
 * The generator caps ids when it writes the payloads, but data that was produced by an
 * older build (or committed by the local data pipeline) can still carry long Korean slugs
 * that make `next build` fail with ENAMETOOLONG. This script normalizes the committed data
 * in place, so `build:site` and the deploy workflow always build from safe ids.
 *
 * It is idempotent: ids that already fit are left untouched, and a run with nothing to do
 * writes nothing.
 */
import fs from 'fs';
import path from 'path';
import {
    MAX_PERFORMANCE_ID_BYTES,
    isSafePerformanceId,
    normalizePerformanceId,
    utf8ByteLength,
} from '../src/lib/performance-id';

const DATA_DIR = path.join(process.cwd(), 'public', 'data');
const PERFORMANCES_FILE = 'performances.json';

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type PerformanceLike = { id?: string } & Record<string, unknown>;

function listJsonFiles(dir: string): string[] {
    if (!fs.existsSync(dir)) return [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) files.push(...listJsonFiles(full));
        else if (entry.isFile() && entry.name.endsWith('.json')) files.push(full);
    }
    return files;
}

/** Replace every string value that is exactly an old id, anywhere in the file. */
function rewriteIds(node: Json, idMap: Map<string, string>, counter: { count: number }): Json {
    if (typeof node === 'string') {
        const next = idMap.get(node);
        if (next) {
            counter.count += 1;
            return next;
        }
        return node;
    }
    if (Array.isArray(node)) {
        return node.map((item) => rewriteIds(item, idMap, counter));
    }
    if (node && typeof node === 'object') {
        const result: { [key: string]: Json } = {};
        for (const [key, value] of Object.entries(node)) {
            result[key] = rewriteIds(value, idMap, counter);
        }
        return result;
    }
    return node;
}

function buildIdMap(performances: PerformanceLike[]) {
    const taken = new Set<string>();
    for (const performance of performances) {
        if (isSafePerformanceId(performance.id)) taken.add(performance.id as string);
    }

    const idMap = new Map<string, string>();
    for (const performance of performances) {
        const id = performance.id;
        if (!id || isSafePerformanceId(id)) continue;
        const next = normalizePerformanceId(id, taken);
        taken.add(next);
        idMap.set(id, next);
        performance.id = next;
    }

    return idMap;
}

function main() {
    const performancesPath = path.join(DATA_DIR, PERFORMANCES_FILE);
    if (!fs.existsSync(performancesPath)) {
        console.log(`No ${PERFORMANCES_FILE} to normalize`);
        return;
    }

    const performances = JSON.parse(fs.readFileSync(performancesPath, 'utf8')) as PerformanceLike[];
    const idMap = buildIdMap(performances);

    if (idMap.size === 0) {
        console.log(`✅ 모든 performance id가 ${MAX_PERFORMANCE_ID_BYTES}바이트 이하입니다 (변경 없음)`);
        return;
    }

    console.log(
        `🔧 ${idMap.size}개의 긴 performance id를 ${MAX_PERFORMANCE_ID_BYTES}바이트 이하로 정규화합니다`,
    );
    const sample = Array.from(idMap.entries())[0];
    if (sample) {
        console.log(`- 예: ${utf8ByteLength(sample[0])}B "${sample[0]}" -> ${utf8ByteLength(sample[1])}B "${sample[1]}"`);
    }

    fs.writeFileSync(performancesPath, JSON.stringify(performances));
    console.log(`- ${PERFORMANCES_FILE} 갱신`);

    let filesChanged = 0;
    let referencesChanged = 0;
    for (const file of listJsonFiles(DATA_DIR)) {
        if (file === performancesPath) continue;

        let parsed: Json;
        try {
            parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as Json;
        } catch (error) {
            console.warn(`- 건너뜀(파싱 실패): ${path.relative(DATA_DIR, file)}`);
            continue;
        }

        const counter = { count: 0 };
        const next = rewriteIds(parsed, idMap, counter);
        if (counter.count === 0) continue;

        fs.writeFileSync(file, JSON.stringify(next));
        filesChanged += 1;
        referencesChanged += counter.count;
    }

    console.log(`- 참조 갱신: ${filesChanged}개 파일 / ${referencesChanged}건`);
}

main();

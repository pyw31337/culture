/**
 * Reads performance intro images (소개 이미지) on the Mac mini and stores the details they
 * contain, so generate-data can fill fields the sources left empty.
 *
 *   1. Apple Vision OCR (scripts/ai/vision-ocr.swift, compiled on first use) reads each image,
 *      cutting very tall KOPIS detail images into pieces first.
 *   2. A local Ollama model picks out cast / running time / age / seat prices and writes a
 *      2–3 sentence summary from that text only.
 *   3. Every value is checked against the OCR text; anything not found there is dropped.
 *   4. Results go to src/data/ai-detail-extractions.json (src/lib/ai-detail-fill.ts applies them).
 *
 * Candidates come from the last build (public/data/performances.json): ticketed performances
 * with intro images and at least one empty field or a template description.
 *
 *   AI_EXTRACT_MAX_ITEMS     default 30     performances per run
 *   AI_EXTRACT_MAX_SECONDS   default 1200   time budget per run (progress is saved per item)
 *   AI_EXTRACT_MAX_IMAGES    default 4      images per performance
 *   VISION_OCR_BIN           prebuilt OCR binary (default .cache/ai/vision-ocr, built with swiftc)
 *   OLLAMA_HOST / OLLAMA_MODEL / AI_MIN_FREE_PERCENT  see scripts/ai/ollama.ts (memory and CPU limits)
 *
 * Skips without changes when it is not on macOS, swiftc or Ollama is missing, so the scheduler
 * can treat it as optional. GitHub Actions never runs it.
 */
import { execFile, execFileSync } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { promisify } from 'util';
import { isTemplateDescription, type AiDetailEntry, type AiDetailFields } from '../../src/lib/ai-detail-fill';
import { OLLAMA_MODEL, breather, memoryAllowsWork, ollamaJson, ollamaReady, ollamaUnload } from './ollama';

const execFileAsync = promisify(execFile);

const ROOT = process.cwd();
const PUBLIC_PERFORMANCES = path.join(ROOT, 'public', 'data', 'performances.json');
const OUTPUT_PATH = path.join(ROOT, 'src', 'data', 'ai-detail-extractions.json');
const SWIFT_SOURCE = path.join(ROOT, 'scripts', 'ai', 'vision-ocr.swift');
const OCR_BIN = process.env.VISION_OCR_BIN || path.join(ROOT, '.cache', 'ai', 'vision-ocr');
const MAX_ITEMS = Number(process.env.AI_EXTRACT_MAX_ITEMS || 30);
const MAX_SECONDS = Number(process.env.AI_EXTRACT_MAX_SECONDS || 1200);
const MAX_IMAGES = Number(process.env.AI_EXTRACT_MAX_IMAGES || 4);
const MAX_TILES_PER_IMAGE = 8;
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
// Keeps the prompt inside the 4096-token context set in ollama.ts.
const MAX_OCR_CHARS = 3000;
const RETRY_EMPTY_DAYS = 30;
const DROP_GONE_DAYS = 60;
const TAG = 'ai-intro';

const PERFORMANCE_SOURCES = new Set(['kopis', 'interpark', 'timeticket', 'seoul', 'culture-portal', 'yes24', 'yes24-exclusive']);
// Stage shows only: museum/activity listings carry product photos, not intro text.
const PERFORMANCE_GENRES = new Set(['musical', 'play', 'concert', 'classic_tradition', 'classic', 'opera', 'dance']);
// Square poster thumbnails (timeticket "700x700") have no intro text to read.
const THUMBNAIL_URL = /file_attach_thumb|-\d{2,4}x\d{2,4}\.(jpe?g|png|webp)$/i;

type Item = Record<string, unknown> & { id: string; title: string; source?: string };

interface OutputFile {
    note: string;
    updatedAt: string;
    items: Record<string, AiDetailEntry>;
}

interface Extraction {
    runningTime?: string;
    ageRating?: string;
    cast?: string[];
    priceList?: { label?: string; price?: string }[];
    summary?: string;
}

const SYSTEM_PROMPT = `너는 한국 공연 소개 이미지에서 읽어 낸 글자(OCR)를 정리하는 도우미다.
주어진 글에 실제로 적힌 내용만 옮긴다. 글에 없으면 빈 값("" 또는 [])으로 둔다. 추측하거나 지어내지 않는다.
- runningTime: 관람시간/공연시간/러닝타임 (예: "100분", "약 2시간 (인터미션 15분 포함)")
- ageRating: 관람연령 (예: "만 7세 이상", "전체관람가", "24개월 이상")
- cast: 출연자 이름만 (배우·연주자·가수·지휘자). 역할명, 단체 설명, 제작진(연출·작곡 등)은 넣지 않는다.
- priceList: 좌석 등급별 가격 (예: {"label":"R석","price":"100,000원"}). 할인 가격은 넣지 않는다.
- summary: 이 공연을 처음 보는 사람에게 소개하는 2~3문장 한국어 요약. 글에 있는 내용(줄거리, 프로그램, 특징)만 쓰고 날짜·가격은 넣지 않는다.
JSON으로만 답한다.`;

const EXTRACTION_SCHEMA = {
    type: 'object',
    properties: {
        runningTime: { type: 'string' },
        ageRating: { type: 'string' },
        cast: { type: 'array', items: { type: 'string' } },
        priceList: {
            type: 'array',
            items: {
                type: 'object',
                properties: { label: { type: 'string' }, price: { type: 'string' } },
                required: ['label', 'price'],
            },
        },
        summary: { type: 'string' },
    },
    required: ['runningTime', 'ageRating', 'cast', 'priceList', 'summary'],
};

function compact(value: unknown) {
    return String(value ?? '').normalize('NFC').replace(/\s+/g, '').toLowerCase();
}

function numbersIn(value: string) {
    return value.match(/\d[\d,]*/g) || [];
}

function hasText(value: unknown) {
    return typeof value === 'string' && value.trim() !== '' && !/^(정보없음|미정|-)$/.test(value.trim());
}

function missingFields(item: Item) {
    const missing: string[] = [];
    if (!hasText(item.runningTime)) missing.push('runningTime');
    if (!hasText(item.ageRating) && !hasText(item.age)) missing.push('ageRating');
    if (!(Array.isArray(item.cast) && item.cast.length > 0)) missing.push('cast');
    if (!(Array.isArray(item.priceList) && item.priceList.length > 0)) missing.push('priceList');
    if (isTemplateDescription(item.description)) missing.push('summary');
    return missing;
}

function introImages(item: Item) {
    const images = Array.isArray(item.synopsisImages) ? item.synopsisImages : [];
    return images
        .filter((url): url is string => typeof url === 'string' && /^https?:\/\//i.test(url) && !THUMBNAIL_URL.test(url))
        .slice(0, MAX_IMAGES);
}

function imagesKey(urls: string[]) {
    return crypto.createHash('sha1').update(urls.join('\n')).digest('hex').slice(0, 12);
}

function startDate(item: Item) {
    const match = String(item.date || '').match(/\d{4}[.-]\d{2}[.-]\d{2}/);
    return match ? match[0].replace(/[.-]/g, '') : '99999999';
}

// --- Checks against the OCR text: a value is kept only if the image really says it. ---

function checkRunningTime(value: unknown, ocr: string) {
    const text = String(value || '').trim();
    if (!text || text.length > 40 || !/\d+\s*(분|시간)/.test(text)) return undefined;
    return numbersIn(text).every((n) => ocr.includes(n)) ? text : undefined;
}

function checkAgeRating(value: unknown, ocr: string) {
    const text = String(value || '').trim();
    if (!text || text.length > 30) return undefined;
    if (/전체\s*관람|전\s*연령/.test(text)) return /전체관람|전연령/.test(ocr) ? text : undefined;
    if (!/\d+\s*(세|개월)|미취학|초등|중학생|고등학생|성인/.test(text)) return undefined;
    const core = text.match(/\d+\s*(세|개월)/);
    if (core) return ocr.includes(compact(core[0])) ? text : undefined;
    return ocr.includes(compact(text.replace(/이상|관람가?|가능/g, ''))) ? text : undefined;
}

const NOT_A_NAME = /^(출연|출연진|연출|작곡|작가|극본|안무|음악감독|지휘|피아노|바이올린|첼로|관객|배우|주최|주관|제작|기획|후원|협찬|미정)$/;

function checkCast(values: unknown, ocr: string) {
    if (!Array.isArray(values)) return undefined;
    const names: string[] = [];
    for (const raw of values) {
        const name = String(raw || '').trim();
        if (name.length < 2 || name.length > 20 || /[\d@#/:()[\]<>]/.test(name) || NOT_A_NAME.test(name)) continue;
        if (!ocr.includes(compact(name))) continue;
        if (!names.includes(name)) names.push(name);
        if (names.length >= 12) break;
    }
    return names.length > 0 ? names : undefined;
}

function checkPriceList(values: unknown, ocr: string) {
    if (!Array.isArray(values)) return undefined;
    const rows: { label: string; price: string }[] = [];
    for (const raw of values) {
        const label = String((raw as { label?: unknown })?.label || '').trim();
        const price = String((raw as { price?: unknown })?.price || '').replace(/\s/g, '');
        if (!label || label.length > 20) continue;
        if (!/^(\d{1,3}(,\d{3})+|\d{3,})원$|^무료$/.test(price)) continue;
        const amount = price.replace(/원$/, '');
        const amountFound = amount === '무료' ? ocr.includes('무료') : ocr.includes(amount) || ocr.includes(amount.replace(/,/g, ''));
        if (!amountFound || !ocr.includes(compact(label))) continue;
        rows.push({ label, price });
        if (rows.length >= 8) break;
    }
    return rows.length > 0 ? rows : undefined;
}

function checkSummary(value: unknown, ocr: string, item: Item) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (text.length < 40 || text.length > 320 || !/[가-힣]/.test(text)) return undefined;
    // Numbers the model made up (years, prices, counts) are the usual sign of invention.
    const context = ocr + compact(item.title) + compact(item.venue) + compact(item.date);
    return numbersIn(text).every((n) => context.includes(n.replace(/,/g, '')) || context.includes(n)) ? text : undefined;
}

// --- OCR ---

function ensureOcrBinary(): boolean {
    if (process.env.VISION_OCR_BIN) return fs.existsSync(OCR_BIN);
    if (process.platform !== 'darwin') {
        console.log(`[${TAG}] Apple Vision needs macOS; skipped (optional step)`);
        return false;
    }
    const stale = !fs.existsSync(OCR_BIN) || fs.statSync(OCR_BIN).mtimeMs < fs.statSync(SWIFT_SOURCE).mtimeMs;
    if (!stale) return true;
    try {
        fs.mkdirSync(path.dirname(OCR_BIN), { recursive: true });
        execFileSync('swiftc', ['-O', SWIFT_SOURCE, '-o', OCR_BIN], { stdio: 'inherit' });
        return true;
    } catch {
        console.log(`[${TAG}] could not build vision-ocr (install Xcode command line tools: xcode-select --install); skipped`);
        return false;
    }
}

async function download(url: string, dir: string, index: number) {
    const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh) CultureFlow intro-image reader' },
        signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const length = Number(response.headers.get('content-length') || 0);
    if (length > MAX_IMAGE_BYTES) throw new Error('image too large');
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > MAX_IMAGE_BYTES) throw new Error('image too large');
    const type = response.headers.get('content-type') || '';
    const ext = /png/.test(type) ? 'png' : /webp/.test(type) ? 'webp' : /gif/.test(type) ? 'gif' : 'jpg';
    const file = path.join(dir, `${index}.${ext}`);
    fs.writeFileSync(file, buffer);
    return file;
}

async function readImages(urls: string[]) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cultureflow-ocr-'));
    const lines: string[] = [];
    try {
        for (const [index, url] of urls.entries()) {
            try {
                const file = await download(url, dir, index);
                const { stdout } = await execFileAsync('nice', ['-n', '15', OCR_BIN, file, String(MAX_TILES_PER_IMAGE)], { timeout: 120_000, maxBuffer: 8 * 1024 * 1024 });
                const rows = (JSON.parse(stdout) as { rows?: unknown[] }).rows || [];
                rows.forEach((row) => {
                    const text = String(row || '').trim();
                    if (text && lines[lines.length - 1] !== text) lines.push(text);
                });
            } catch (error) {
                console.warn(`[${TAG}]   image skipped (${error instanceof Error ? error.message : String(error)}): ${url}`);
            }
        }
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
    return lines.join('\n');
}

// --- main ---

function loadOutput(): OutputFile {
    try {
        const parsed = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf8')) as OutputFile;
        return { ...parsed, items: parsed.items || {} };
    } catch {
        return { note: '', updatedAt: '', items: {} };
    }
}

function saveOutput(file: OutputFile) {
    const items = Object.fromEntries(Object.entries(file.items).sort(([a], [b]) => a.localeCompare(b)));
    fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify({
        note: '맥미니 로컬 AI(Apple Vision OCR + Ollama)가 공연 소개 이미지에서 읽은 값. 이미지 글자에서 확인된 값만 저장하며, generate-data는 원본에 없는 칸만 채웁니다.',
        updatedAt: new Date().toISOString(),
        items,
    }, null, 2)}\n`);
}

function describeContext(item: Item, missing: string[]) {
    return [
        `제목: ${item.title}`,
        `공연장: ${item.venue || ''}`,
        `기간: ${item.date || ''}`,
        `채워야 할 항목: ${missing.join(', ')}`,
    ].join('\n');
}

async function main() {
    if (!fs.existsSync(PUBLIC_PERFORMANCES)) {
        console.log(`[${TAG}] public/data/performances.json not found; nothing to read`);
        return;
    }
    if (!ensureOcrBinary()) return;
    if (!(await ollamaReady(TAG))) return;

    const file = loadOutput();
    const performances = JSON.parse(fs.readFileSync(PUBLIC_PERFORMANCES, 'utf8')) as Item[];
    const liveIds = new Set(performances.map((item) => item.id));
    const now = Date.now();

    const candidates = performances
        .filter((item) => PERFORMANCE_SOURCES.has(String(item.source || '')) && PERFORMANCE_GENRES.has(String(item.genre || '')))
        .map((item) => ({ item, urls: introImages(item), missing: missingFields(item) }))
        .filter(({ urls, missing }) => urls.length > 0 && missing.length > 0)
        .filter(({ item, urls }) => {
            const previous = file.items[item.id];
            if (!previous || previous.imagesKey !== imagesKey(urls)) return true;
            const empty = Object.keys(previous.fields || {}).length === 0;
            return empty && now - Date.parse(previous.checkedAt) > RETRY_EMPTY_DAYS * 86_400_000;
        })
        // KOPIS intro images are text-heavy detail pages; read them first.
        .sort((a, b) => Number(b.item.source === 'kopis') - Number(a.item.source === 'kopis')
            || b.missing.length - a.missing.length
            || startDate(a.item).localeCompare(startDate(b.item)))
        .slice(0, MAX_ITEMS);
    console.log(`[${TAG}] performances to read: ${candidates.length} (model ${OLLAMA_MODEL})`);

    const deadline = now + MAX_SECONDS * 1000;
    const counts = { read: 0, withFields: 0 };
    for (const { item, urls, missing } of candidates) {
        if (Date.now() > deadline) {
            console.log(`[${TAG}] time budget used; the rest waits for the next run`);
            break;
        }
        if (!memoryAllowsWork(TAG)) break;
        console.log(`[${TAG}] reading ${item.title} (${urls.length} image${urls.length > 1 ? 's' : ''})`);
        const entry: AiDetailEntry = { imagesKey: imagesKey(urls), checkedAt: new Date().toISOString(), model: OLLAMA_MODEL, fields: {} };
        try {
            const text = await readImages(urls);
            entry.ocrChars = text.length;
            if (text.replace(/\s/g, '').length >= 30) {
                const raw = await ollamaJson<Extraction>(
                    SYSTEM_PROMPT,
                    `${describeContext(item, missing)}\n\n[소개 이미지 글자]\n${text.slice(0, MAX_OCR_CHARS)}`,
                    EXTRACTION_SCHEMA,
                    180_000,
                );
                const ocr = compact(text);
                const fields: AiDetailFields = {
                    runningTime: checkRunningTime(raw.runningTime, ocr),
                    ageRating: checkAgeRating(raw.ageRating, ocr),
                    cast: checkCast(raw.cast, ocr),
                    priceList: checkPriceList(raw.priceList, ocr),
                    summary: checkSummary(raw.summary, ocr, item),
                };
                entry.fields = Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined)) as AiDetailFields;
            }
        } catch (error) {
            // Ollama or the network failed: leave no entry so the next run tries again.
            console.warn(`[${TAG}] ${item.title}: ${error instanceof Error ? error.message : String(error)}`);
            await breather();
            continue;
        }
        file.items[item.id] = entry;
        counts.read += 1;
        if (Object.keys(entry.fields).length > 0) counts.withFields += 1;
        console.log(`[${TAG}] ${item.title}: ${Object.keys(entry.fields).join(', ') || 'nothing usable'} (${entry.ocrChars ?? 0} chars)`);
        saveOutput(file);
        await breather();
    }
    await ollamaUnload();

    for (const [id, entry] of Object.entries(file.items)) {
        if (!liveIds.has(id) && now - Date.parse(entry.checkedAt) > DROP_GONE_DAYS * 86_400_000) delete file.items[id];
    }
    if (counts.read > 0) saveOutput(file);
    console.log(`[${TAG}] read ${counts.read}, with usable fields ${counts.withFields}`);
}

main().catch((error) => {
    // Never fail the data run over this optional step.
    console.warn(`[${TAG}] skipped: ${error instanceof Error ? error.message : String(error)}`);
});

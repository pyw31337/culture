/**
 * Local AI judge for "maybe the same show" pairs (Mac mini only, free, offline).
 *
 * src/lib/cross-source-dedupe.ts merges certain duplicates by itself (booking-link ids,
 * same title + venue + dates). Pairs that only look similar ("이별을 위한 세레나데 Ⅱ.
 * 자화상…" vs "이별을 위한 세레나데Ⅱ - 수원") are left apart and listed as the gray zone.
 * This script asks a local Ollama model about each new gray pair and stores the verdict in
 * src/data/ai-dedupe-judgments.json. The next generate-data run merges pairs judged
 * `same` with confidence ≥ 0.8. GitHub Actions never runs the model; it only reads the file.
 *
 *   OLLAMA_HOST / OLLAMA_MODEL / AI_MIN_FREE_PERCENT  see scripts/ai/ollama.ts (memory and CPU limits)
 *   AI_JUDGE_MAX_PAIRS    default 80   pairs per run
 *   AI_JUDGE_MAX_SECONDS  default 900  time budget per run
 *
 * Exits 0 without changes when Ollama is not running, so the scheduler treats it as optional.
 */
import fs from 'fs';
import path from 'path';
import { dedupeCrossSourcePerformances, type DedupeJudgment, type DedupePair } from '../../src/lib/cross-source-dedupe';
import { OLLAMA_MODEL as MODEL, breather, memoryAllowsWork, ollamaJson, ollamaReady, ollamaUnload } from './ollama';

const ROOT = process.cwd();
const PUBLIC_PERFORMANCES = path.join(ROOT, 'public', 'data', 'performances.json');
const JUDGMENTS_PATH = path.join(ROOT, 'src', 'data', 'ai-dedupe-judgments.json');
const MAX_PAIRS = Number(process.env.AI_JUDGE_MAX_PAIRS || 80);
const MAX_SECONDS = Number(process.env.AI_JUDGE_MAX_SECONDS || 900);
const KEEP_DAYS = 120;

interface JudgmentsFile {
    note: string;
    updatedAt: string;
    judgments: Record<string, DedupeJudgment>;
}

const SYSTEM_PROMPT = `너는 한국 공연·전시 일정 데이터를 정리하는 검수자다.
서로 다른 사이트에서 가져온 두 항목이 "같은 공연/전시의 같은 회차 묶음"인지 판단한다.
- 같은 작품이라도 도시(투어 지역)·공연장·기간·월(예: 10월/11월 공연)이 다르면 다른 항목이다.
- 시리즈 이름은 같아도 출연자·프로그램(곡목, 부제)이 다르면 다른 항목이다.
- 판매처가 붙인 홍보 문구, 장르 접두어("뮤지컬", "2026"), 지역 꼬리표("- 부산", "[대학로]")는 차이로 보지 않는다.
- 확신이 없으면 same=false로 답한다.
JSON으로만 답한다: {"same": boolean, "confidence": 0~1 숫자, "reason": "한 문장"}`;

function describe(item: Record<string, unknown>) {
    const cast = Array.isArray(item.cast) ? item.cast.slice(0, 6).join(', ') : '';
    return [
        `출처: ${item.source}`,
        `제목: ${item.title}`,
        `장르: ${item.genre}`,
        `공연장: ${item.venue}`,
        item.address ? `주소: ${item.address}` : '',
        `기간: ${item.date}`,
        cast ? `출연: ${cast}` : '',
        item.runningTime ? `관람시간: ${item.runningTime}` : '',
        item.price ? `가격: ${item.price}` : '',
    ].filter(Boolean).join('\n');
}

async function judge(pair: DedupePair): Promise<DedupeJudgment | null> {
    const parsed = await ollamaJson<Partial<DedupeJudgment>>(
        SYSTEM_PROMPT,
        `[항목 A]\n${describe(pair.a)}\n\n[항목 B]\n${describe(pair.b)}`,
        {
            type: 'object',
            properties: {
                same: { type: 'boolean' },
                confidence: { type: 'number' },
                reason: { type: 'string' },
            },
            required: ['same', 'confidence', 'reason'],
        },
    );
    if (typeof parsed.same !== 'boolean' || typeof parsed.confidence !== 'number') return null;
    return {
        same: parsed.same,
        confidence: Math.max(0, Math.min(1, parsed.confidence)),
        reason: String(parsed.reason || '').slice(0, 200),
        model: MODEL,
        judgedAt: new Date().toISOString(),
    };
}

function loadJudgments(): JudgmentsFile {
    try {
        const parsed = JSON.parse(fs.readFileSync(JUDGMENTS_PATH, 'utf8')) as JudgmentsFile;
        return { ...parsed, judgments: parsed.judgments || {} };
    } catch {
        return { note: '', updatedAt: '', judgments: {} };
    }
}

async function main() {
    if (!fs.existsSync(PUBLIC_PERFORMANCES)) {
        console.log('[ai-dedupe] public/data/performances.json not found; nothing to judge');
        return;
    }
    if (!(await ollamaReady('ai-dedupe'))) return;

    const file = loadJudgments();
    const performances = JSON.parse(fs.readFileSync(PUBLIC_PERFORMANCES, 'utf8'));
    const { grayZone } = dedupeCrossSourcePerformances(performances, file);
    const pending = grayZone
        .filter((pair) => !file.judgments[pair.key])
        .sort((x, y) => y.titleScore - x.titleScore)
        .slice(0, MAX_PAIRS);
    console.log(`[ai-dedupe] gray-zone pairs: ${grayZone.length}, new to judge: ${pending.length} (model ${MODEL})`);

    const deadline = Date.now() + MAX_SECONDS * 1000;
    let judged = 0;
    let same = 0;
    for (const pair of pending) {
        if (Date.now() > deadline) {
            console.log('[ai-dedupe] time budget used; the rest waits for the next run');
            break;
        }
        if (!memoryAllowsWork('ai-dedupe')) break;
        try {
            const verdict = await judge(pair);
            if (!verdict) continue;
            file.judgments[pair.key] = verdict;
            judged += 1;
            if (verdict.same) same += 1;
            console.log(`[ai-dedupe] ${verdict.same ? 'SAME' : 'diff'} ${verdict.confidence.toFixed(2)} ${pair.a.title} ↔ ${pair.b.title} — ${verdict.reason}`);
        } catch (error) {
            console.warn(`[ai-dedupe] failed: ${pair.key}: ${error instanceof Error ? error.message : String(error)}`);
        }
        await breather();
    }
    await ollamaUnload();

    const cutoff = Date.now() - KEEP_DAYS * 86_400_000;
    for (const [key, verdict] of Object.entries(file.judgments)) {
        if (verdict.judgedAt && Date.parse(verdict.judgedAt) < cutoff) delete file.judgments[key];
    }

    if (judged === 0) return;
    const sorted = Object.fromEntries(Object.entries(file.judgments).sort(([a], [b]) => a.localeCompare(b)));
    fs.writeFileSync(JUDGMENTS_PATH, `${JSON.stringify({
        note: '로컬 AI(Ollama) 중복 판정 캐시. key = 두 공연 id 정렬 후 "|"로 연결. same && confidence ≥ 0.8 이면 generate-data가 합칩니다.',
        updatedAt: new Date().toISOString(),
        judgments: sorted,
    }, null, 2)}\n`);
    console.log(`[ai-dedupe] judged ${judged} (same ${same}); saved ${path.relative(ROOT, JUDGMENTS_PATH)}`);
}

main().catch((error) => {
    // Never fail the data run over this optional step.
    console.warn(`[ai-dedupe] skipped: ${error instanceof Error ? error.message : String(error)}`);
});

/**
 * Minimal client for a local Ollama server, shared by the scripts/ai/* jobs.
 *
 * The Mac mini must stay usable while these run (an unbounded 7B run once froze it), so:
 *   - the model is picked by installed memory unless OLLAMA_MODEL is set,
 *   - every call caps the context window, output length and CPU threads,
 *   - jobs check macOS memory pressure before each unit of work and stop once it leaves "normal",
 *   - the model is unloaded from memory when a job ends.
 *
 *   OLLAMA_HOST          default http://127.0.0.1:11434
 *   OLLAMA_MODEL         default qwen2.5:7b with ≥ 16GB memory, qwen2.5:3b below that
 *   AI_MIN_FREE_PERCENT  default 12   also stop when macOS reports less free memory than this
 *                        (8GB Macs idle around 20–30% because macOS keeps the rest as cache,
 *                        so the pressure level is the main signal, not this number)
 */
import { execFileSync } from 'child_process';
import os from 'os';

const GB = 1024 ** 3;

export const OLLAMA_HOST = (process.env.OLLAMA_HOST || 'http://127.0.0.1:11434').replace(/\/+$/, '');
export const OLLAMA_MODEL = process.env.OLLAMA_MODEL || (os.totalmem() >= 15 * GB ? 'qwen2.5:7b' : 'qwen2.5:3b');

const MIN_TOTAL_MEMORY = 7.5 * GB;
const MIN_FREE_PERCENT = Number(process.env.AI_MIN_FREE_PERCENT || 12);
// Small context = small KV cache. Prompts are trimmed to fit (see MAX_OCR_CHARS in extract-intro-images).
const NUM_CTX = 4096;
const NUM_PREDICT = 600;
const NUM_THREAD = Math.max(2, Math.floor(os.cpus().length / 2));

function sysctlNumber(name: string): number | null {
    if (process.platform !== 'darwin') return null;
    try {
        const value = Number(execFileSync('sysctl', ['-n', name], { encoding: 'utf8' }).trim());
        return Number.isFinite(value) ? value : null;
    } catch {
        return null;
    }
}

/** Percent of memory macOS considers available; null when unknown. */
const freeMemoryPercent = () => sysctlNumber('kern.memorystatus_level');
/** macOS memory pressure: 1 normal, 2 warning, 4 critical (Activity Monitor's green/yellow/red); null when unknown. */
const memoryPressureLevel = () => sysctlNumber('kern.memorystatus_vm_pressure_level');
const PRESSURE_LABEL: Record<number, string> = { 1: 'normal', 2: 'warning', 4: 'critical' };

/** One line for the log: what the job sees before it starts. */
export function describeMemory() {
    const pressure = memoryPressureLevel();
    const free = freeMemoryPercent();
    return `memory ${(os.totalmem() / GB).toFixed(0)}GB, free ${free ?? '?'}%, pressure ${pressure === null ? '?' : PRESSURE_LABEL[pressure] || pressure}, model ${OLLAMA_MODEL}`;
}

/** False (with a log line) when starting or continuing model work could push the Mac into swap. */
export function memoryAllowsWork(tag: string): boolean {
    if (os.totalmem() < MIN_TOTAL_MEMORY) {
        console.log(`[${tag}] only ${(os.totalmem() / GB).toFixed(1)}GB memory; local AI skipped to keep the Mac responsive`);
        return false;
    }
    const pressure = memoryPressureLevel();
    if (pressure !== null && pressure > 1) {
        console.log(`[${tag}] macOS memory pressure is ${PRESSURE_LABEL[pressure] || pressure}; stopping for now (the next run continues)`);
        return false;
    }
    const free = freeMemoryPercent();
    if (free !== null && free < MIN_FREE_PERCENT) {
        console.log(`[${tag}] free memory ${free}% < ${MIN_FREE_PERCENT}%; stopping for now (the next run continues)`);
        return false;
    }
    return true;
}

/** True when the server answers and the chosen model is pulled; logs why not otherwise. */
export async function ollamaReady(tag: string): Promise<boolean> {
    console.log(`[${tag}] ${describeMemory()}`);
    if (!memoryAllowsWork(tag)) return false;
    try {
        const response = await fetch(`${OLLAMA_HOST}/api/tags`, { signal: AbortSignal.timeout(3000) });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const body = await response.json() as { models?: { name: string }[] };
        const names = (body.models || []).map((m) => m.name);
        if (!names.some((name) => name === OLLAMA_MODEL || name.split(':')[0] === OLLAMA_MODEL)) {
            console.log(`[${tag}] model ${OLLAMA_MODEL} is not pulled (have: ${names.join(', ') || 'none'}). Run: ollama pull ${OLLAMA_MODEL}`);
            return false;
        }
        return true;
    } catch {
        console.log(`[${tag}] Ollama not reachable at ${OLLAMA_HOST}; skipped (optional step)`);
        return false;
    }
}

/** One chat turn constrained to a JSON schema; returns the parsed object. */
export async function ollamaJson<T>(system: string, user: string, schema: object, timeoutMs = 120_000): Promise<T> {
    const response = await fetch(`${OLLAMA_HOST}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(timeoutMs),
        body: JSON.stringify({
            model: OLLAMA_MODEL,
            stream: false,
            keep_alive: '2m',
            options: { temperature: 0, num_ctx: NUM_CTX, num_predict: NUM_PREDICT, num_thread: NUM_THREAD },
            format: schema,
            messages: [
                { role: 'system', content: system },
                { role: 'user', content: user },
            ],
        }),
    });
    if (!response.ok) throw new Error(`ollama ${response.status}`);
    const body = await response.json() as { message?: { content?: string } };
    return JSON.parse(body.message?.content || '{}') as T;
}

/** Frees the model's memory right away instead of waiting for keep_alive. */
export async function ollamaUnload() {
    try {
        await fetch(`${OLLAMA_HOST}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(10_000),
            body: JSON.stringify({ model: OLLAMA_MODEL, keep_alive: 0 }),
        });
    } catch {
        // keep_alive unloads it shortly anyway
    }
}

/** Short pause between items so the machine gets idle time. */
export function breather(ms = 1500) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

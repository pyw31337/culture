/**
 * Minimal client for a local Ollama server, shared by the scripts/ai/* jobs.
 *   OLLAMA_HOST   default http://127.0.0.1:11434
 *   OLLAMA_MODEL  default qwen2.5:7b   (exaone3.5:7.8b and gemma3:12b also read Korean well)
 */
export const OLLAMA_HOST = (process.env.OLLAMA_HOST || 'http://127.0.0.1:11434').replace(/\/+$/, '');
export const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:7b';

/** True when the server answers and the configured model is pulled; logs why not otherwise. */
export async function ollamaReady(tag: string): Promise<boolean> {
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
            options: { temperature: 0 },
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

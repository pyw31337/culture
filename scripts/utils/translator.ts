import translate from '@iamtraction/google-translate';
import fs from 'fs';
import path from 'path';

const CACHE_FILE = path.join(process.cwd(), 'src/data/translation-cache.json');

interface TranslationCache {
    [text: string]: {
        [locale: string]: string;
    };
}

let cache: TranslationCache = {};
let hasChanges = false;

// Load cache
if (fs.existsSync(CACHE_FILE)) {
    try {
        cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    } catch (e) {
        console.error('[Translator] Failed to load cache:', e);
    }
}

const DELIMITER = '\n###\n';

export async function translateBatch(texts: string[], to: string): Promise<string[]> {
    if (texts.length === 0) return [];
    if (to === 'ko') return texts;

    const target = to === 'zh' ? 'zh-cn' : to;
    const results: string[] = new Array(texts.length).fill('');
    const toTranslateIndices: number[] = [];
    const stringsToTranslate: string[] = [];

    // Check cache first
    texts.forEach((text, i) => {
        const clean = text.trim();
        if (!clean) {
            results[i] = '';
        } else if (cache[clean] && cache[clean][to]) {
            results[i] = cache[clean][to];
        } else {
            toTranslateIndices.push(i);
            stringsToTranslate.push(clean);
        }
    });

    if (stringsToTranslate.length === 0) return results;

    // Split into smaller sub-batches to avoid payload limits (e.g., 25 strings at a time)
    const SUB_BATCH_SIZE = 25;
    for (let i = 0; i < stringsToTranslate.length; i += SUB_BATCH_SIZE) {
        const currentBatch = stringsToTranslate.slice(i, i + SUB_BATCH_SIZE);
        const joined = currentBatch.join(DELIMITER);
        
        let attempts = 0;
        const maxAttempts = 3;
        while (attempts < maxAttempts) {
            try {
                const res = await translate(joined, { from: 'ko', to: target });
                const translatedJoined = res.text;
                const translatedStrings = translatedJoined.split(DELIMITER).map(s => s.trim());

                if (translatedStrings.length === currentBatch.length) {
                    currentBatch.forEach((original, idx) => {
                        const translated = translatedStrings[idx];
                        const originalIdx = toTranslateIndices[i + idx];
                        results[originalIdx] = translated;
                        
                        // Update cache
                        if (!cache[original]) cache[original] = {};
                        cache[original][to] = translated;
                    });
                    hasChanges = true;
                    break;
                } else {
                    throw new Error(`Batch translation count mismatch: sent ${currentBatch.length}, got ${translatedStrings.length}`);
                }
            } catch (e: any) {
                attempts++;
                const wait = Math.pow(2, attempts) * 1000;
                console.warn(`[Translator] Batch Error (Attempt ${attempts}/${maxAttempts}): ${e.message}. waiting ${wait}ms...`);
                await new Promise(r => setTimeout(r, wait));
                if (attempts === maxAttempts) {
                    // Final fallback: translate individually
                    for (let idx = 0; idx < currentBatch.length; idx++) {
                        const original = currentBatch[idx];
                        const originalIdx = toTranslateIndices[i + idx];
                        results[originalIdx] = await translateText(original, to);
                    }
                }
            }
        }
    }

    return results;
}

export async function translateText(text: string, to: string): Promise<string> {
    if (!text || text.trim() === '') return '';
    const cleanText = text.trim();
    
    // Normalize target locale (mapping next-intl zh to zh-cn for google translate)
    const target = to === 'zh' ? 'zh-cn' : to;
    if (target === 'ko') return cleanText;

    // Check cache
    if (cache[cleanText] && cache[cleanText][to]) {
        return cache[cleanText][to];
    }

    // Rate limiting & Retry logic
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
        try {
            const res = await translate(cleanText, { from: 'ko', to: target });
            const translatedText = res.text;

            if (!cache[cleanText]) cache[cleanText] = {};
            cache[cleanText][to] = translatedText;
            hasChanges = true;
            
            return translatedText;
        } catch (e: any) {
            attempts++;
            if (e.status === 429) {
                const wait = Math.pow(2, attempts) * 1000;
                console.warn(`[Translator] Rate limited. Waiting ${wait}ms...`);
                await new Promise(r => setTimeout(r, wait));
            } else {
                console.error(`[Translator] Error translating "${cleanText.substring(0, 20)}..." to ${to}:`, e.message);
                break;
            }
        }
    }

    return cleanText; // Fallback
}

export function saveCache() {
    if (!hasChanges) return;
    try {
        const dir = path.dirname(CACHE_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
        console.log(`[Translator] Cache saved with ${Object.keys(cache).length} entries.`);
        hasChanges = false;
    } catch (e) {
        console.error('[Translator] Failed to save cache:', e);
    }
}

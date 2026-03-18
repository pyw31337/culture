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

    // Increased batch size for performance
    const SUB_BATCH_SIZE = 20; 
    for (let i = 0; i < stringsToTranslate.length; i += SUB_BATCH_SIZE) {
        const currentBatch = stringsToTranslate.slice(i, i + SUB_BATCH_SIZE);
        const joined = currentBatch.join(DELIMITER);
        
        let attempts = 0;
        const maxAttempts = 3;
        let success = false;

        while (attempts < maxAttempts && !success) {
            try {
                const res = await translate(joined, { from: 'ko', to: target });
                const translatedJoined = res.text;
                // Use regex split to be more robust against minor formatting changes by the API
                const translatedStrings = translatedJoined.split(DELIMITER).map(s => s.trim());

                if (translatedStrings.length === currentBatch.length) {
                    currentBatch.forEach((original, idx) => {
                        const translated = translatedStrings[idx];
                        const originalIdx = toTranslateIndices[i + idx];
                        results[originalIdx] = translated;
                        
                        if (!cache[original]) cache[original] = {};
                        cache[original][to] = translated;
                    });
                    hasChanges = true;
                    // Save cache periodically instead of every sub-batch
                    success = true;
                    // Reduced wait, will increase on 429
                    await new Promise(r => setTimeout(r, 1000)); 
                } else {
                    throw new Error(`Batch mismatch: expected ${currentBatch.length}, got ${translatedStrings.length}`);
                }
            } catch (e: any) {
                attempts++;
                const isRateLimit = e.message.includes('429') || e.message.includes('<HTML') || e.message.includes('<!DOCTYPE');
                const wait = isRateLimit ? 120000 : Math.pow(5, attempts) * 1000;
                console.warn(`[Translator] ${to} Batch Error (${attempts}/${maxAttempts}): ${e.message.substring(0, 100)}... waiting ${Math.round(wait/1000)}s...`);
                await new Promise(r => setTimeout(r, wait));
            }
        }

        if (!success) {
            console.warn(`[Translator] ${to} Batch failed. Moving to individual translation for this chunk.`);
            for (let idx = 0; idx < currentBatch.length; idx++) {
                const original = currentBatch[idx];
                const originalIdx = toTranslateIndices[i + idx];
                results[originalIdx] = await translateText(original, to);
                // Keep individual wait slightly higher to be safe
                await new Promise(r => setTimeout(r, 2000)); 
            }
        }
        
        // Save cache after each significant sub-batch
        saveCache();
    }

    return results;
}

export async function translateText(text: string, to: string): Promise<string> {
    if (!text || text.trim() === '') return '';
    const cleanText = text.trim();
    
    const target = to === 'zh' ? 'zh-cn' : to;
    if (target === 'ko') return cleanText;

    if (cache[cleanText] && cache[cleanText][to]) {
        return cache[cleanText][to];
    }

    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
        try {
            const res = await translate(cleanText, { from: 'ko', to: target });
            const translatedText = res.text;

            if (!cache[cleanText]) cache[cleanText] = {};
            cache[cleanText][to] = translatedText;
            hasChanges = true;
            saveCache();
            
            return translatedText;
        } catch (e: any) {
            attempts++;
            const isHtml = e.message.includes('<HTML') || e.message.includes('<!DOCTYPE');
            const wait = isHtml ? 120000 : Math.pow(3, attempts) * 1000; // 2 minute wait if 429/HTML
            console.warn(`[Translator] Retry (${attempts}/${maxAttempts}) for "${cleanText.substring(0, 20)}...": ${e.message.substring(0, 50)}... waiting ${wait}ms...`);
            await new Promise(r => setTimeout(r, wait));
            if (attempts === maxAttempts) break;
        }
    }

    return cleanText; // Fallback
}

export function getFromCache(text: string, to: string): string | null {
    const clean = text.trim();
    if (cache[clean] && cache[clean][to]) {
        return cache[clean][to];
    }
    return null;
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

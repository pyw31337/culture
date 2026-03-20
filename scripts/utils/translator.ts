import translate from '@iamtraction/google-translate';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { progressLogger } from './progress-logger';

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

// --- API Configurations ---
const DEEPL_KEY = process.env.DEEPL_API_KEY;
const PAPAGO_ID = process.env.PAPAGO_CLIENT_ID;
const PAPAGO_SECRET = process.env.PAPAGO_CLIENT_SECRET;

/**
 * DeepL Translation
 */
async function translateWithDeepL(text: string, to: string): Promise<string | null> {
    if (!DEEPL_KEY) return null;
    try {
        const target = to.toUpperCase() === 'EN' ? 'EN-US' : to.toUpperCase();
        const res = await axios.post('https://api-free.deepl.com/v2/translate', 
            `auth_key=${DEEPL_KEY}&text=${encodeURIComponent(text)}&target_lang=${target}&source_lang=KO`,
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );
        return res.data.translations[0].text;
    } catch (e: any) {
        console.warn(`[Translator] DeepL Error: ${e.message}`);
        return null;
    }
}

/**
 * Naver Papago Translation
 */
async function translateWithPapago(text: string, to: string): Promise<string | null> {
    if (!PAPAGO_ID || !PAPAGO_SECRET) return null;
    try {
        const target = to === 'zh' ? 'zh-CN' : to;
        const res = await axios.post('https://openapi.naver.com/v1/papago/n2mt', 
            `source=ko&target=${target}&text=${encodeURIComponent(text)}`,
            { 
                headers: { 
                    'X-Naver-Client-Id': PAPAGO_ID,
                    'X-Naver-Client-Secret': PAPAGO_SECRET,
                    'Content-Type': 'application/x-www-form-urlencoded'
                } 
            }
        );
        return res.data.message.result.translatedText;
    } catch (e: any) {
        console.warn(`[Translator] Papago Error: ${e.message}`);
        return null;
    }
}

export async function translateBatch(texts: string[], to: string): Promise<string[]> {
    if (texts.length === 0) return [];
    if (to === 'ko') return texts;

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

    const barId = `translate-${to}`;
    progressLogger.createBar(barId, stringsToTranslate.length, `Translating to ${to.toUpperCase()}...`);

    // Process sub-batches in chunks
    const SUB_BATCH_SIZE = 50; 
    for (let i = 0; i < stringsToTranslate.length; i += SUB_BATCH_SIZE) {
        const currentBatch = stringsToTranslate.slice(i, i + SUB_BATCH_SIZE);
        
        // Parallelize translations within the sub-batch for speed
        const promises = currentBatch.map(async (original, idxInSub) => {
            const batchIdx = i + idxInSub;
            const originalIdx = toTranslateIndices[batchIdx];
            const translated = await translateText(original, to);
            results[originalIdx] = translated;
            progressLogger.increment(barId, 1, `Translating to ${to.toUpperCase()}: ${original.slice(0, 20)}...`);
        });
        
        await Promise.all(promises);
    }

    // Save cache once after the whole batch is processed
    saveCache();

    return results;
}

export async function translateText(text: string, to: string): Promise<string> {
    if (!text || text.trim() === '') return '';
    const cleanText = text.trim();
    
    if (to === 'ko') return cleanText;

    if (cache[cleanText] && cache[cleanText][to]) {
        return cache[cleanText][to];
    }

    if (process.env.SKIP_TRANSLATION === 'true') {
        return cleanText;
    }
    // 1. Try DeepL
    let translated = await translateWithDeepL(cleanText, to);
    
    // 2. Try Papago if DeepL fails or not configured
    if (!translated) {
        translated = await translateWithPapago(cleanText, to);
    }

    // 3. Fallback to Google (Scraper)
    if (!translated) {
        const target = to === 'zh' ? 'zh-cn' : to;
        let attempts = 0;
        while (attempts < 2) {
            try {
                const res = await translate(cleanText, { from: 'ko', to: target });
                translated = res.text;
                break;
            } catch (e: any) {
                attempts++;
                const isHtml = e.message.includes('<HTML') || e.message.includes('<!DOCTYPE');
                if (isHtml) await new Promise(r => setTimeout(r, 5000)); // Short wait for individual retry
            }
        }
    }

    if (translated) {
        if (!cache[cleanText]) cache[cleanText] = {};
        cache[cleanText][to] = translated;
        hasChanges = true;
        // Periodic save is handled by batch processor
        return translated;
    }

    return cleanText; // Final Fallback
}

export function getFromCache(text: string, to: string): string | null {
    const clean = text.trim();
    if (cache[clean] && cache[clean][to]) {
        return cache[clean][to];
    }
    return null;
}

/**
 * Manually inject a translation into the cache (used for CSV imports)
 */
export function injectToCache(original: string, translated: string, locale: string) {
    const cleanOriginal = original.trim();
    const cleanTranslated = translated.trim();
    if (!cleanOriginal || !cleanTranslated || cleanOriginal === cleanTranslated) return;

    if (!cache[cleanOriginal]) cache[cleanOriginal] = {};
    cache[cleanOriginal][locale] = cleanTranslated;
    hasChanges = true;
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

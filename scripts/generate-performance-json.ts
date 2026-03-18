import fs from 'fs';
import path from 'path';
import { getAllPerformances } from '../src/lib/performance-data';
import { sortPerformances } from '../src/lib/performance-filter';
import { translateText, saveCache, translateBatch, getFromCache } from './utils/translator';
import { normalizeAddressWithMeta, isExpired, cleanAddress, REGION_MAP } from './utils/data-cleaner';

// Batch processor for translations
async function batchTranslate(items: any[], locale: string) {
    // We allow Korean translation if there's English content that needs to be "Korean-ified"
    console.log(`[Translate] Starting translation to ${locale} for ${items.length} items...`);
    
    const fields = ['title', 'venue', 'address', 'synopsis', 'feesAndPrograms', 'operatingHours', 'priceDetail', 'petFriendly'];
    const translatedItems = [...items];
    const CHUNK_SIZE = 100; // Larger chunks for better overhead management
    
    for (let i = 0; i < translatedItems.length; i += CHUNK_SIZE) {
        const chunk = translatedItems.slice(i, i + CHUNK_SIZE);
        
        // Collect all strings that need translation in this chunk
        const stringsToTranslate: { itemIdx: number, field: string, text: string }[] = [];
        chunk.forEach((item, idx) => {
            fields.forEach(field => {
                const text = item[field];
                if (text && typeof text === 'string' && text.trim().length > 0) {
                    // Smart Cache Lookup for Address
                    if (field === 'address' && item.originalAddress && item.prefixAdded) {
                        const originalTranslation = getFromCache(item.originalAddress, locale);
                        const prefixTranslation = REGION_MAP[item.prefixAdded]?.[locale];
                        
                        if (originalTranslation && prefixTranslation) {
                            item[field] = prefixTranslation + (originalTranslation.startsWith(' ') ? '' : ' ') + originalTranslation;
                            return; 
                        }
                    }

                    // Standard Cache check
                    const cached = getFromCache(text, locale);
                    if (cached) {
                        item[field] = cached;
                    } else {
                        // For Korean locale, only translate if it looks like English/Foreign text
                        if (locale === 'ko') {
                            const isMostlyEnglish = /^[A-Za-z0-9\s.,!?'"&\(\)\[\]\-]{4,}$/.test(text);
                            if (isMostlyEnglish) {
                                stringsToTranslate.push({ itemIdx: i + idx, field, text });
                            }
                        } else {
                            stringsToTranslate.push({ itemIdx: i + idx, field, text });
                        }
                    }
                }
            });
        });

        if (stringsToTranslate.length > 0) {
            console.log(`[Translate] ${locale}: Translating batch of ${stringsToTranslate.length} strings (Progress: ${i}/${translatedItems.length})...`);
            const textsOnly = stringsToTranslate.map(s => s.text);
            try {
                const translatedTexts = await translateBatch(textsOnly, locale);
                translatedTexts.forEach((translated, idx) => {
                    if (idx < stringsToTranslate.length) {
                        const { itemIdx, field } = stringsToTranslate[idx];
                        translatedItems[itemIdx][field] = translated;
                    }
                });
            } catch (e) {
                console.error(`[Translate] CHUNK Batch failed for ${locale}, items will remain in original language.`);
            }
        }
        
        if (i % 200 === 0 && i > 0) {
            saveCache();
        }
    }
    
    console.log(`[Translate] Finished ${locale} translation totally.`);
    saveCache();
    return translatedItems;
}

async function generate() {
    console.log('Generating static performance data...');
    if (process.env.SKIP_TRANSLATION === 'true') {
        console.warn('[Build] SKIP_TRANSLATION is set. Localized files will contain original Korean text for untranslated fields.');
    }
    try {
        const performances = await getAllPerformances('ko', true);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // [Data Quality Override]
        performances.forEach((p: any) => {
            // Fix Category for National Dance Company 2026 Festival
            if (p.title.includes('국립무용단 [2026 축제]')) {
                p.genre = '무용';
            }

            // Normalize Address and keep track of changes for smart translation
            const { normalized, prefixAdded } = normalizeAddressWithMeta(p);
            p.originalAddress = cleanAddress(p.address);
            p.address = normalized;
            p.prefixAdded = prefixAdded;
        });

        // Overseas Filtering Logic (User Request)
        const KR_LAT_MIN = 33.0;
        const KR_LAT_MAX = 43.0;
        const KR_LNG_MIN = 124.0;
        const KR_LNG_MAX = 132.0;

        const isOverseas = (p: any) => {
            if (p.title.includes('일본 스페이스 일일캠프') || p.title.includes('JAXA츠크바우주센터')) return true;
            const overseasKeywords = ['일본', '미국', '중국', '유럽', 'France', 'USA', 'Japan', 'China', '츠쿠바역'];
            if (overseasKeywords.some(kw => p.address?.includes(kw) || p.venue?.includes(kw))) return true;
            if (p.lat && p.lng) {
                if (p.lat < KR_LAT_MIN || p.lat > KR_LAT_MAX || p.lng < KR_LNG_MIN || p.lng > KR_LNG_MAX) return true;
            }
            return false;
        };

        let movieCount = 0;
        let ottCount = 0;
        let dateCount = 0;

        const activePerformances = performances.filter((p: any) => {
            if (p.genre === 'ott') {
                ottCount++;
                return false;
            }
            if (isOverseas(p)) return false;
            
            // Apply Expiration AND Status-based filtering (User Request)
            if (isExpired(p, today)) {
                dateCount++;
                return false;
            }

            return true;
        });

        // Sort by default (Date Ascending)
        const sorted = sortPerformances(activePerformances, 'all');

        // [New: Data Pruning for payload optimization]
        const pruned = sorted.map((p: any) => {
            const { posterUrl, ...rest } = p;
            if (Array.isArray(rest.cast) && rest.cast.length === 0) delete rest.cast;
            if (Array.isArray(rest.platforms) && rest.platforms.length === 0) delete rest.platforms;
            rest.source = p.source; 
            return rest;
        });

        const locales = ['ko', 'en', 'zh', 'ja'];
        const dataDir = path.join(process.cwd(), 'public', 'data');
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

        for (const locale of locales) {
            console.log(`[Build] Generating data for locale: ${locale}`);
            
            // Deep copy pruned data for translation
            const sourceData = JSON.parse(JSON.stringify(pruned));
            let localizedData = sourceData;
            
            if (process.env.SKIP_TRANSLATION !== 'true') {
                localizedData = await batchTranslate(sourceData, locale);
            }
            
            const outputPath = path.join(dataDir, locale === 'ko' ? 'performances.json' : `performances-${locale}.json`);
            fs.writeFileSync(outputPath, JSON.stringify(localizedData));
            console.log(`Successfully generated ${localizedData.length} items to ${outputPath}`);
            
            saveCache(); // Save cache after each locale
        }

        // [New: Sync critical data files to public/data]
        const srcDataDir = path.join(process.cwd(), 'src', 'data');
        const filesToSync = ['cinemas.json', 'movies.json', 'ott.json', 'venues.json'];

        filesToSync.forEach(filename => {
            const srcPath = path.join(srcDataDir, filename);
            const destPath = path.join(dataDir, filename);

            if (fs.existsSync(srcPath)) {
                if (filename === 'venues.json') {
                    const venues = JSON.parse(fs.readFileSync(srcPath, 'utf8'));
                    const usedVenueNames = new Set(pruned.map(p => p.venue));
                    const prunedVenues: Record<string, any> = {};

                    Object.entries(venues).forEach(([key, v]: [string, any]) => {
                        if (usedVenueNames.has(key)) {
                            const { name, ...rest } = v;
                            if (name && name !== key) {
                                rest.name = name;
                            }
                            prunedVenues[key] = rest;
                        }
                    });

                    fs.writeFileSync(destPath, JSON.stringify(prunedVenues));
                    console.log(`Optimized venues.json to ${destPath}`);
                } else {
                    fs.copyFileSync(srcPath, destPath);
                    console.log(`Synced ${filename} to ${destPath}`);
                }
            }
        });

    } catch (error: any) {
        console.error('Error generating performance data:', error);
        process.exit(1);
    }
}

generate();

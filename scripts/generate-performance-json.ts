import fs from 'fs';
import path from 'path';
import { getAllPerformances } from '../src/lib/performance-data';
import { sortPerformances } from '../src/lib/performance-filter';
import { translateText, saveCache, translateBatch } from './utils/translator';

// Batch processor for translations
async function batchTranslate(items: any[], locale: string) {
    if (locale === 'ko') return items;
    
    console.log(`[Translate] Starting translation to ${locale} for ${items.length} items...`);
    
    const fields = ['title', 'venue', 'address', 'synopsis', 'feesAndPrograms', 'operatingHours', 'priceDetail'];
    const translatedItems = [...items];
    const CHUNK_SIZE = 50; // Larger chunk size for items
    
    for (let i = 0; i < translatedItems.length; i += CHUNK_SIZE) {
        const chunk = translatedItems.slice(i, i + CHUNK_SIZE);
        
        // Collect all strings that need translation in this chunk
        const stringsToTranslate: { itemIdx: number, field: string, text: string }[] = [];
        chunk.forEach((item, idx) => {
            fields.forEach(field => {
                if (item[field] && typeof item[field] === 'string' && item[field].trim().length > 0) {
                    stringsToTranslate.push({ itemIdx: i + idx, field, text: item[field] });
                }
            });
        });

        if (stringsToTranslate.length > 0) {
            const textsOnly = stringsToTranslate.map(s => s.text);
            const translatedTexts = await translateBatch(textsOnly, locale);
            
            translatedTexts.forEach((translated, idx) => {
                const { itemIdx, field } = stringsToTranslate[idx];
                translatedItems[itemIdx][field] = translated;
            });
        }
        
        if (i % 200 === 0 && i > 0) {
            console.log(`[Translate] ${locale}: Processed ${i}/${translatedItems.length} items...`);
            saveCache();
        }
    }
    
    console.log(`[Translate] Finished ${locale} translation.`);
    saveCache();
    return translatedItems;
}

async function generate() {
    console.log('Generating static performance data...');
    try {
        const performances = await getAllPerformances('ko', true);

        // [Data Quality Override]
        // Manual fixes for specific items requested by user
        performances.forEach((p: any) => {
            // 1. Hardcode specific festival posters
            if (p.title.includes('양평빙송어축제')) {
                p.posterUrl = '/images/posters/festivals/yangpyeong_ice_trout.png';
            } else if (p.title.includes('온천천 빛 축제')) {
                p.posterUrl = '/images/posters/festivals/oncheoncheon_light.png';
            } else if (p.title.includes('포천백운계곡 동장군축제')) {
                p.posterUrl = '/images/posters/festivals/pocheon_dongjanggun.jpg';
            }

            // 2. Fix Category for National Dance Company 2026 Festival
            if (p.title.includes('국립무용단 [2026 축제]')) {
                p.genre = '무용';
            }
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

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let movieCount = 0;
        let ottCount = 0;
        let dateCount = 0;

        const activePerformances = performances.filter((p: any) => {
            if (p.genre === 'ott') {
                ottCount++;
                return false;
            }
            if (isOverseas(p)) return false;
            if (!p.date || p.date.trim() === '') return true; 

            try {
                let endDate: Date | null = null;
                const d = p.date.replace(/\./g, '-'); 

                if (d.includes('~')) {
                    const parts = d.split('~');
                    if (parts.length >= 2) {
                        let endStr = parts[1].trim();
                        endStr = endStr.split('[')[0].split('(')[0].trim();
                        if (endStr.match(/^\d{2}-\d{2}-\d{2}$/)) {
                            endStr = '20' + endStr;
                        }
                        if (endStr.match(/^\d{8}$/)) {
                            const y = parseInt(endStr.substring(0, 4));
                            const m = parseInt(endStr.substring(4, 6));
                            const dParts = parseInt(endStr.substring(6, 8));
                            endDate = new Date(y, m - 1, dParts);
                        } else {
                            endDate = new Date(endStr);
                        }
                    }
                } else if (d.trim() !== '') {
                    let endStr = d.trim();
                    endStr = endStr.split('[')[0].split('(')[0].trim();
                    if (endStr.match(/^\d{2}-\d{2}-\d{2}$/)) {
                        endStr = '20' + endStr;
                    }
                    if (endStr.match(/^\d{8}$/)) {
                        const y = parseInt(endStr.substring(0, 4));
                        const m = parseInt(endStr.substring(4, 6));
                        const dParts = parseInt(endStr.substring(6, 8));
                        endDate = new Date(y, m - 1, dParts);
                    } else {
                        endDate = new Date(endStr);
                    }
                }

                if (!endDate || isNaN(endDate.getTime())) return true;
                endDate.setHours(23, 59, 59, 999);
                if (p.genre === 'movie') return true;
                const isActive = endDate >= today;
                if (!isActive) dateCount++;
                return isActive;
            } catch (e: any) {
                return true;
            }
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
            const localizedData = await batchTranslate(sourceData, locale);
            
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

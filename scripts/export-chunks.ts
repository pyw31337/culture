import fs from 'fs';
import path from 'path';
import { stringify } from 'csv-stringify/sync';
import { getAllPerformances } from '../src/lib/performance-data';

const CACHE_FILE = path.join(process.cwd(), 'src/data/translation-cache.json');
const EXPORT_DIR = path.join(process.cwd(), 'scripts/exports/chunks');

const CHUNK_SIZE = 1000; // Manageable size for Google Sheets

async function exportInChunks() {
    console.log('Starting chunked export for Google Sheets...');
    
    if (!fs.existsSync(EXPORT_DIR)) {
        fs.mkdirSync(EXPORT_DIR, { recursive: true });
    }

    const cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    const performances = await getAllPerformances('ko', true);
    const fields = ['title', 'venue', 'address', 'description', 'price', 'target', 'contact'];

    const locales = ['en', 'ja', 'zh'];
    const untranslated: Record<string, Set<string>> = {
        en: new Set(),
        ja: new Set(),
        zh: new Set()
    };

    performances.forEach((p: any) => {
        fields.forEach((field: string) => {
            const text = p[field];
            if (text && typeof text === 'string' && text.trim().length > 0) {
                const clean = text.trim();
                locales.forEach(locale => {
                    if (!cache[clean] || !cache[clean][locale]) {
                        untranslated[locale].add(clean);
                    }
                });
            }
        });
    });

    for (const locale of locales) {
        const list = Array.from(untranslated[locale]);
        const total = list.length;
        console.log(`[${locale}] Total untranslated: ${total}`);

        for (let i = 0; i < total; i += CHUNK_SIZE) {
            const chunk = list.slice(i, i + CHUNK_SIZE);
            const chunkNum = Math.floor(i / CHUNK_SIZE) + 1;
            const fileName = `untranslated-${locale}-part${chunkNum}.csv`;
            const filePath = path.join(EXPORT_DIR, fileName);

            const csvData = chunk.map((text, idx) => {
                const rowNum = idx + 2;
                const formula = `=GOOGLETRANSLATE(A${rowNum}, "ko", "${locale === 'zh' ? 'zh-cn' : locale}")`;
                return [text, formula];
            });

            const output = stringify(csvData, {
                header: true,
                columns: ['Original', 'TranslationFormula']
            });

            fs.writeFileSync(filePath, output);
        }
        console.log(`[${locale}] Generated ${Math.ceil(total / CHUNK_SIZE)} chunks.`);
    }

    console.log(`\nDone! Chunks are located in: ${EXPORT_DIR}`);
}

exportInChunks().catch(console.error);

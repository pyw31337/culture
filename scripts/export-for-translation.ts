import fs from 'fs';
import path from 'path';
import { getAllPerformances } from '../src/lib/performance-data';
import { getFromCache } from './utils/translator';

async function exportUntranslated() {
    console.log('Analyzing performances for untranslated strings...');
    const performances = await getAllPerformances('ko', true);
    const locales = ['en', 'ja', 'zh'];
    const fields = ['title', 'venue', 'address', 'synopsis', 'feesAndPrograms', 'operatingHours', 'priceDetail', 'petFriendly'];
    
    // Use a Set to store unique strings that need translation per locale
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
                    if (!getFromCache(clean, locale)) {
                        untranslated[locale].add(clean);
                    }
                });
            }
        });
    });

    const outDir = path.join(process.cwd(), 'scripts', 'exports');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    locales.forEach(locale => {
        const list = Array.from(untranslated[locale]);
        if (list.length === 0) {
            console.log(`[${locale}] All strings are already translated!`);
            return;
        }

        // Create CSV for Google Sheets
        // Column A: Original (Korean)
        // Column B: Formula =GOOGLETRANSLATE(A2, "ko", "target")
        const targetLocale = locale === 'zh' ? 'zh-CN' : locale;
        let csvContent = `Original,TranslationFormula\n`;
        list.forEach((text, idx) => {
            // Escape double quotes for CSV
            const escaped = text.replace(/"/g, '""');
            csvContent += `"${escaped}","=GOOGLETRANSLATE(A${idx + 2}, ""ko"", ""${targetLocale}"")"\n`;
        });

        const outputPath = path.join(outDir, `untranslated-${locale}.csv`);
        fs.writeFileSync(outputPath, csvContent);
        console.log(`[${locale}] Exported ${list.length} untranslated strings to ${outputPath}`);
    });

    console.log('\n--- Instructions for Google Sheets Workaround ---');
    console.log('1. Open Google Sheets.');
    console.log('2. Import the generated .csv files (File > Import).');
    console.log('3. Google Sheets will automatically translate the strings via the formula.');
    console.log('4. Once translated, copy the "TranslationFormula" column and use "Paste Special > Values only" to freeze them.');
    console.log('5. Download as CSV and I can help you import them back into the cache!');
}

exportUntranslated().catch(console.error);

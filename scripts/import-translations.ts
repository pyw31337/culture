import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { injectToCache, saveCache } from './utils/translator';

async function importTranslations() {
    const importDir = path.join(process.cwd(), 'scripts', 'imports');
    if (!fs.existsSync(importDir)) {
        console.log('\n--- Import Guide ---');
        console.log('1. Create a directory: scripts/imports/');
        console.log('2. Place your translated strings (as CSV) there.');
        console.log('3. Ensure filename contains the language code, e.g., "untranslated-en.csv".');
        console.log('4. Run this script again.');
        return;
    }

    const files = fs.readdirSync(importDir).filter(f => f.endsWith('.csv'));
    const locales = ['en', 'ja', 'zh'];

    for (const file of files) {
        const localeMatch = locales.find(l => file.includes(`-${l}`));
        if (!localeMatch) {
            console.warn(`[Skip] Could not determine locale for file: ${file}`);
            continue;
        }

        console.log(`[Import] Processing ${file} for locale: ${localeMatch}...`);
        const filePath = path.join(importDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        
        try {
            const records = parse(content, {
                columns: true,
                skip_empty_lines: true,
                relax_column_count: true
            });

            let importCount = 0;
            for (const record of records as any[]) {
                // Support various common column names from Google Sheets exports
                const original = record.Original || record.original || (Object.values(record)[0] as string);
                const translated = record.TranslationFormula || record.Translation || record.translation || (Object.values(record)[1] as string);
                
                if (original && translated && original !== translated) {
                    injectToCache(original, translated, localeMatch);
                    importCount++;
                }
            }
            console.log(`[Success] Imported ${importCount} new translations for ${localeMatch}`);
        } catch (e: any) {
            console.error(`[Error] Failed to parse ${file}: ${e.message}`);
        }
    }

    saveCache();
    console.log('\nImport complete. You can now run the generation script to apply these changes.');
}

importTranslations().catch(console.error);

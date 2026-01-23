
import fs from 'fs';
import path from 'path';


// 1. Check Data Files
const dataDir = path.resolve(process.cwd(), 'src/data');
const dataFiles = fs.readdirSync(dataDir).filter(f => f.endsWith('.json'));

console.log('--- Checking Data Files ---');
let dataClean = true;

dataFiles.forEach(file => {
    const filePath = path.join(dataDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const json = JSON.parse(content);

    const items = Array.isArray(json) ? json : Object.values(json);

    items.forEach((item: any) => {
        // Check Cast
        if (item.cast) {
            if (Array.isArray(item.cast)) {
                item.cast.forEach((c: any) => {
                    const str = typeof c === 'string' ? c : JSON.stringify(c);
                    if (str.includes('justwatch.com')) {
                        console.error(`[FAIL] JustWatch link found in ${file} (Cast):`, str);
                        dataClean = false;
                    }
                });
            }
        }
        // Check Director
        if (item.director) {
            const str = typeof item.director === 'string' ? item.director : JSON.stringify(item.director);
            if (str.includes('justwatch.com')) {
                console.error(`[FAIL] JustWatch link found in ${file} (Director):`, str);
                dataClean = false;
            }
        }
    });
});

if (dataClean) console.log('[PASS] No JustWatch links in Data Cast/Director.');

// 2. Check Source Code
console.log('\n--- Checking Source Code ---');
const srcDir = path.resolve(process.cwd(), 'src');
// Simple recursive walk or glob
// We'll use glob if available, or just reuse the logic from the user's grep
// but let's write a simple recursive scanner for TSX files

function scanDir(dir: string) {
    const files = fs.readdirSync(dir);
    files.forEach(f => {
        const fullPath = path.join(dir, f);
        if (fs.statSync(fullPath).isDirectory()) {
            scanDir(fullPath);
        } else if (f.endsWith('.tsx') || f.endsWith('.ts')) {
            const content = fs.readFileSync(fullPath, 'utf-8');
            if (content.includes('justwatch.com')) {
                // Ignore comments? No, be strict.
                // Exception: constants.ts if we allowed it, but we don't want it for cast.
                console.error(`[FAIL] JustWatch string found in ${fullPath}`);
            }
        }
    });
}

try {
    scanDir(srcDir);
    console.log('[PASS] Code scan complete.');
} catch (e) {
    console.error('Error scanning code:', e);
}

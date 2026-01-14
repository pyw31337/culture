
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'src/data');
const PUBLIC_DIR = path.join(process.cwd(), 'public');
const FILES = ['kovo.json', 'kbl.json', 'handball.json', 'kbo.json'];

function resolvePublicPath(webPath: string): string {
    // Remove /culture prefix if present
    const cleanPath = webPath.replace(/^\/culture/, '');
    return path.join(PUBLIC_DIR, cleanPath.startsWith('/') ? cleanPath.slice(1) : cleanPath);
}

function findBestLogo(currentWebPath: string): string | null {
    const fullPath = resolvePublicPath(currentWebPath);
    const dir = path.dirname(fullPath);
    const ext = path.extname(fullPath);
    const basename = path.basename(fullPath, ext); // e.g., "doosan" from "doosan.png"

    // 1. Check if the current file exists
    if (fs.existsSync(fullPath)) {
        // If it's already SVG, it's the best.
        if (ext === '.svg') return currentWebPath;

        // If it's not SVG, check if SVG exists (Upgrade)
        const svgPath = path.join(dir, `${basename}.svg`);
        if (fs.existsSync(svgPath)) {
            // Found SVG upgrade!
            // Reconstruct web path: replace extension
            return currentWebPath.replace(ext, '.svg');
        }

        // Return original if valid and no upgrade
        return currentWebPath;
    }

    // 2. File does not exist. Look for alternatives.
    const extensions = ['.svg', '.png', '.jpg', '.jpeg'];

    // Try exact basename with different extensions
    for (const testExt of extensions) {
        if (fs.existsSync(path.join(dir, `${basename}${testExt}`))) {
            return currentWebPath.replace(ext, testExt);
        }
    }

    // 3. Try variations (remove _f, etc) if not found
    const cleanBasename = basename.replace('_f', '');
    if (cleanBasename !== basename) {
        for (const testExt of extensions) {
            if (fs.existsSync(path.join(dir, `${cleanBasename}${testExt}`))) {
                // We found a file with a cleaner name (e.g. found 'kt.svg' when looking for 'kt_f.png')
                // We need to reconstruct the path completely
                // Get relative dir from public
                const relDir = path.relative(PUBLIC_DIR, dir);
                return `/culture/${relDir}/${cleanBasename}${testExt}`;
            }
        }
    }


    // 4. Special Case: Sangmu in KBO -> check KBL

    // 5. KBL External URL Mapping
    if (currentWebPath.includes('kbl.or.kr')) {
        // Map external filenames to local filenames
        const kblMap: Record<string, string> = {
            'ic-kt': 'kt',
            'ic-sk': 'sk',
            'ic-lg': 'lg',
            'ic-kcc': 'kcc',
            'ic-db': 'db',
            'ic-kgc': 'kgc', // Anyang Jungkwanjang Red Boosters (formerly KGC)
            'ic-ss': 'samsung', // Samsung Thunders
            'ic-hd': 'mobis', // Hyundai Mobis Phoebus
            'ic-pega': 'kogas', // Kogas Pegasus
            'ic-sky': 'sono', // Sono Skygunners
            'ic-sono': 'sono',
            'ic-goyang': 'sono',
            'ic-sangmu': 'sangmu'
        };

        const extName = path.basename(currentWebPath, path.extname(currentWebPath)); // ic-kt
        const mappedName = kblMap[extName];

        if (mappedName) {
            const localPathRel = `/culture/images/logos/kbl/${mappedName}.svg`;
            const fullLocalPath = resolvePublicPath(localPathRel);
            if (fs.existsSync(fullLocalPath)) {
                return localPathRel;
            }
        }
    }

    return null; // Copy could not be found
}

function auditAndFix() {
    FILES.forEach(file => {
        const filePath = path.join(DATA_DIR, file);
        if (!fs.existsSync(filePath)) {
            console.log(`Skipping ${file} - not found`);
            return;
        }

        console.log(`Auditing ${file}...`);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        let changes = 0;
        let errors = 0;

        data.forEach((item: any, index: number) => {
            ['homeTeamLogo', 'awayTeamLogo'].forEach(key => {
                const currentPath = item[key];
                if (!currentPath) return;

                const bestPath = findBestLogo(currentPath);

                if (bestPath) {
                    if (bestPath !== currentPath) {
                        console.log(`[FIX] ${item.homeTeam} vs ${item.awayTeam} (${key}): ${currentPath} -> ${bestPath}`);
                        item[key] = bestPath;
                        changes++;
                    }
                } else {
                    console.error(`[ERR] ${file} #${index}: File not found for ${key}: ${currentPath}`);
                    errors++;
                }
            });
        });

        if (changes > 0) {
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
            console.log(`Saved ${file} with ${changes} fixes.`);
        } else {
            console.log(`No changes needed for ${file}.`);
        }
        if (errors > 0) {
            console.log(`Found ${errors} missing files in ${file}.`);
        } else {
            console.log(`All files verified in ${file}.`);
        }
        console.log('---');
    });
}

auditAndFix();


import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'src/data');
const FILES = ['kovo.json', 'kbl.json', 'handball.json', 'kbo.json'];

function fixPaths() {
    FILES.forEach(file => {
        const filePath = path.join(DATA_DIR, file);
        if (!fs.existsSync(filePath)) return;

        console.log(`Processing ${file}...`);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        let changed = false;

        data.forEach((item: any) => {
            // Fix Key Missing in some files (id, etc) - Generic Path Fix
            ['homeTeamLogo', 'awayTeamLogo'].forEach(key => {
                if (item[key]) {
                    // 1. Prepend /culture if missing and starts with /images
                    if (item[key].startsWith('/images/')) {
                        item[key] = `/culture${item[key]}`;
                        changed = true;
                    }

                    // 2. KBO Specific: Upgrade to SVG if available
                    if (file === 'kbo.json' && item[key].endsWith('.png')) {
                        const svgPath = item[key].replace('.png', '.svg').replace('_f.svg', '.svg'); // Handle _f suffix removal if needed, or check existence
                        // Check if SVG exists in public dir
                        // Path in JSON: /culture/images/logos/kbo/kt_f.png -> Public: images/logos/kbo/kt.svg (Need to map carefully)

                        // Simplistic mapping for KBO based on known files
                        // Current values are like: /culture/images/logos/kbo/kt_f.png
                        // Target SVGs are like: /culture/images/logos/kbo/kt.svg

                        const basename = path.basename(item[key], '.png').replace('_f', ''); // kt_f -> kt
                        const possibleSvgRelative = `images/logos/kbo/${basename}.svg`;
                        const possibleSvgAbsolute = path.join(process.cwd(), 'public', possibleSvgRelative);

                        if (fs.existsSync(possibleSvgAbsolute)) {
                            item[key] = `/culture/${possibleSvgRelative}`;
                            changed = true;
                        }
                    }
                }
            });
        });

        if (changed) {
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2)); // 2-space indent
            console.log(`Updated ${file}`);
        } else {
            console.log(`No changes for ${file}`);
        }
    });
}

fixPaths();

import fs from 'fs';
import path from 'path';

/**
 * Extracts numeric value from a price string (e.g. "40,000원" -> 40000)
 */
function getNumericPrice(priceStr: any): number | null {
    if (!priceStr || typeof priceStr !== 'string') return null;
    const numeric = priceStr.replace(/[^0-9]/g, '');
    return numeric ? parseInt(numeric, 10) : null;
}

const dataDir = path.resolve(process.cwd(), 'src/data');
const files = ['interpark.json', 'timeticket.json', 'melon.json', 'yes24.json', 'ticketlink.json'];

let totalFixed = 0;

files.forEach(filename => {
    const filePath = path.join(dataDir, filename);
    if (!fs.existsSync(filePath)) return;

    console.log(`Auditing ${filename}...`);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    let fixedInFile = 0;

    const audited = data.map((item: any) => {
        const nPrice = getNumericPrice(item.price);
        const nOriginal = getNumericPrice(item.originalPrice);

        if (nPrice !== null && nOriginal !== null && nPrice >= nOriginal && item.discount) {
            console.log(`  [FIX] ${item.title}: Price ${item.price} >= Original ${item.originalPrice}. Removing discount ${item.discount}`);
            const { discount, ...rest } = item;
            fixedInFile++;
            return rest;
        }
        return item;
    });

    if (fixedInFile > 0) {
        fs.writeFileSync(filePath, JSON.stringify(audited, null, 4));
        console.log(`  Fixed ${fixedInFile} items in ${filename}.`);
        totalFixed += fixedInFile;
    } else {
        console.log(`  No issues found in ${filename}.`);
    }
});

console.log(`\nAudit Complete. Total items fixed: ${totalFixed}`);

import fs from 'fs';
import path from 'path';

const filePath = path.resolve(process.cwd(), 'debug_dom_clicked.html');
const content = fs.readFileSync(filePath, 'utf-8');

function printContext(keyword: string) {
    const idx = content.indexOf(keyword);
    if (idx === -1) {
        console.log(`Keyword "${keyword}" NOT FOUND.`);
        return;
    }
    console.log(`--- Context for "${keyword}" (index: ${idx}) ---`);
    const start = Math.max(0, idx - 500);
    const end = Math.min(content.length, idx + 1500);
    console.log(content.slice(start, end));
    console.log('--------------------------------');
}

// Search for possible cast-related keywords and class names
printContext('등장인물');
printContext('김혜윤'); // Lead actress name
printContext('김태리'); // Common actress name
printContext('정해인'); // Common actor name
printContext('name'); // common class
printContext('card'); // common class
printContext('cast'); // common class
printContext('person'); // common class
printContext('cm_info_box'); // naver-specific class

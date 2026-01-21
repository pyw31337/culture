import fs from 'fs';
import path from 'path';

const filePath = path.resolve(process.cwd(), 'debug_dom.html');
const content = fs.readFileSync(filePath, 'utf-8');

function printContext(keyword: string) {
    const idx = content.indexOf(keyword);
    if (idx === -1) {
        console.log(`Keyword "${keyword}" NOT FOUND.`);
        return;
    }
    console.log(`--- Context for "${keyword}" ---`);
    const start = Math.max(0, idx - 1000);
    const end = Math.min(content.length, idx + 1000);
    console.log(content.slice(start, end));
    console.log('--------------------------------');
}

printContext('등장인물');
printContext('role="tab"');
printContext('card_item');
printContext('sec_scroll_cast_member');

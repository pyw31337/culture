const fs = require('fs');
const path = require('path');

const outputPath = path.resolve(process.cwd(), 'src/data/interpark.json');
const raw = fs.readFileSync(outputPath, 'utf-8');
const data = JSON.parse(raw);

let eventCount = 0;
let freeCount = 0;

const eventKeywords = ['로터리', '이벤트', '응모', '초청', '초대', '당첨'];
const freeKeywords = ['무료', '0원', '정오의 음악회'];

data.forEach(p => {
    if (!p.price || !/[0-9]/.test(p.price)) {
        const text = (p.title + ' ' + (p.description || '')).toLowerCase();

        let isEvent = false;
        let isFree = false;

        for (const kw of eventKeywords) {
            if (text.includes(kw.toLowerCase())) {
                isEvent = true;
                break;
            }
        }

        for (const kw of freeKeywords) {
            if (text.includes(kw.toLowerCase())) {
                isFree = true;
                break;
            }
        }

        if (isEvent && isFree) {
            p.price = '무료/이벤트';
            eventCount++;
            freeCount++;
        } else if (isEvent) {
            p.price = '이벤트';
            eventCount++;
        } else if (isFree) {
            p.price = '무료';
            freeCount++;
        } else {
            // Default to 무료/이벤트 if undetermined
            p.price = '무료/이벤트';
            freeCount++;
            eventCount++;
        }
    }
});

fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
console.log(`Labeled ${eventCount} events and ${freeCount} free tickets.`);

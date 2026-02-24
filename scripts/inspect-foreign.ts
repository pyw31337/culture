
import fs from 'fs';
import path from 'path';

const PERF_FILE = path.join(process.cwd(), 'public/data/performances.json');

function inspect() {
    const data = JSON.parse(fs.readFileSync(PERF_FILE, 'utf-8'));
    const foreignKeywords = ['싱가포르', '오키나와'];

    const found = data.filter((p: any) => {
        return foreignKeywords.some(k => JSON.stringify(p).includes(k));
    });

    console.log(`Found ${found.length} foreign items.`);
    found.forEach((p: any) => console.log(JSON.stringify(p, null, 2)));
}

inspect();

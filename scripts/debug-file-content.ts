
import fs from 'fs';
import path from 'path';

const kovoPath = path.join(process.cwd(), 'src/data/kovo.json');
const kblPath = path.join(process.cwd(), 'src/data/kbl.json');

try {
    const kovo = JSON.parse(fs.readFileSync(kovoPath, 'utf-8'));
    console.log('KOVO Items:', kovo.length);
    if (kovo.length > 0) console.log('KOVO Sample:', kovo[0]);
} catch (e) {
    console.error('Error reading KOVO:', e);
}

try {
    const kbl = JSON.parse(fs.readFileSync(kblPath, 'utf-8'));
    console.log('KBL Items:', kbl.length);
} catch (e) {
    console.error('Erorr reading KBL:', e);
}

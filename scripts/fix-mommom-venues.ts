import * as fs from 'fs';
import * as path from 'path';

const FILES = [
    'src/data/mommom.json',
];

FILES.forEach(file => {
    const fullPath = path.resolve(process.cwd(), file);
    if (fs.existsSync(fullPath)) {
        const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
        let fixed = 0;
        data.forEach((item: any) => {
            if (item.venue !== item.title || /^\d+$/.test(item.venue)) {
                item.venue = item.title;
                fixed++;
            }
        });
        fs.writeFileSync(fullPath, JSON.stringify(data, null, 2));
        console.log(`Fixed ${fixed} venues in ${file}`);
    } else {
        console.error(`${file} not found!`);
    }
});

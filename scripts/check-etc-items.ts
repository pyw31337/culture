
import fs from 'fs';
import path from 'path';

const dataDir = path.join(process.cwd(), 'src/data');

const files = [
    'interpark.json',
    'kovo.json',
    'kbl.json',
    'kbo.json',
    'handball.json',
    'hockey.json',
    'travel.json',
    'festivals.json',
    'yes24.json',
    'timeticket.json',
    'movies.json',
    'myrealtrip-kids.json',
    'sssd-class.json',
    'ott.json',
    'umclass.json',
    'mochaclass.json',
    'seoul-culture.json'
];

async function checkEtc() {
    let etcItems: any[] = [];

    for (const file of files) {
        const filePath = path.join(dataDir, file);
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf-8');
            try {
                const data = JSON.parse(content);
                const items = Array.isArray(data) ? data : [];

                const fileEtc = items.filter((item: any) => item.region === 'etc');

                if (fileEtc.length > 0) {
                    console.log(`\n📄 ${file}: ${fileEtc.length} items`);
                    fileEtc.forEach((item: any) => {
                        console.log(` - [${item.genre || 'unknown'}] ${item.title} (@ ${item.venue})`);
                        etcItems.push(item);
                    });
                }
            } catch (e) {
                console.error(`Error parsing ${file}:`, e);
            }
        }
    }

    if (etcItems.length === 0) {
        console.log('\n✅ No items found with region "etc".');
    } else {
        console.log(`\nFound total ${etcItems.length} "etc" items.`);
    }
}

checkEtc();

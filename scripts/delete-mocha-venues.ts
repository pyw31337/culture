import * as fs from 'fs';
import * as path from 'path';

const VENUE_PATH = path.resolve(process.cwd(), 'src/data/venues.json');

function deleteMochaVenues() {
    if (!fs.existsSync(VENUE_PATH)) return;

    const data = JSON.parse(fs.readFileSync(VENUE_PATH, 'utf-8'));
    let deleted = 0;

    for (const key of Object.keys(data)) {
        if (key.includes('모카클래스') || key.includes('MochaClass')) {
            delete data[key];
            deleted++;
        }
    }

    fs.writeFileSync(VENUE_PATH, JSON.stringify(data, null, 2));
    console.log(`Deleted ${deleted} Mocha Class venues from venues.json`);
}

deleteMochaVenues();

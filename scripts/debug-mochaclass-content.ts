import * as fs from 'fs';
import * as path from 'path';

const MOCHACLASS_PATH = path.resolve(process.cwd(), 'src/data/mochaclass.json');

const data = JSON.parse(fs.readFileSync(MOCHACLASS_PATH, 'utf-8'));
console.log('Total items:', data.length);
console.log('First 3 items:', JSON.stringify(data.slice(0, 3), null, 2));

const mocha = data.filter((i: any) => i.venue.includes('모카클래스'));
console.log('Items with venue including "모카클래스":', mocha.length);
if (mocha.length > 0) {
    console.log('Sample venue:', mocha[0].venue);
    console.log('Sample address:', mocha[0].address);
}


import fs from 'fs';
import path from 'path';

const file = path.resolve(process.cwd(), 'src/data/ott.json');
const data = JSON.parse(fs.readFileSync(file, 'utf-8'));

console.log(`Total Items: ${data.length}`);

const missingAge = data.filter((i: any) => !i.ageRating);
console.log(`Items missing ageRating: ${missingAge.length}`);
if (missingAge.length > 0) {
    console.log('Sample missing:', missingAge.slice(0, 3).map((i: any) => i.title));
}

const face = data.find((i: any) => i.title === '얼굴');
console.log('\nChecking "얼굴":');
console.log(face ? face : 'Not found');

const maze = data.find((i: any) => i.title.includes('스코치 트라이얼'));
console.log('\nChecking "메이즈 러너: 스코치 트라이얼":');
console.log(maze ? maze : 'Not found');

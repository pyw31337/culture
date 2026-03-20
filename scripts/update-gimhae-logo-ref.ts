import fs from 'fs';
import path from 'path';

const KLEAGUE_PATH = path.resolve(process.cwd(), 'src/data/kleague.json');

function run() {
    let content = fs.readFileSync(KLEAGUE_PATH, 'utf-8');
    content = content.replace(/\/culture\/images\/logos\/kleague\/김해\.webp/g, '/culture/images/logos/kleague/김해.svg');
    fs.writeFileSync(KLEAGUE_PATH, content, 'utf-8');
    console.log('Successfully updated 김해 FC logo references to .svg in kleague.json');
}

run();

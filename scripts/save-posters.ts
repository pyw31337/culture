import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const POSTER_DIR = path.join(process.cwd(), 'public', 'images', 'posters', 'movies');
const moviesFile = path.join(process.cwd(), 'src', 'data', 'movies.json');

async function convert(input: string, output: string) {
    await sharp(input).resize(400, null, { withoutEnlargement: true }).webp({ quality: 80 }).toFile(path.join(POSTER_DIR, output));
    console.log('Saved:', output);
}

async function main() {
    await convert('/tmp/poster_tokyo.jpg', 'movie_류이치사카모토도쿄멜로디.webp');
    await convert('/tmp/poster_hind.jpg', 'movie_힌드의목소리.webp');

    const movies = JSON.parse(fs.readFileSync(moviesFile, 'utf-8'));
    let fixed = 0;
    for (const m of movies) {
        if (m.title === '류이치 사카모토: 도쿄 멜로디') {
            m.image = '/images/posters/movies/movie_류이치사카모토도쿄멜로디.webp';
            fixed++;
        }
        if (m.title === '힌드의 목소리') {
            m.image = '/images/posters/movies/movie_힌드의목소리.webp';
            fixed++;
        }
    }
    fs.writeFileSync(moviesFile, JSON.stringify(movies, null, 2), 'utf-8');
    console.log('Fixed', fixed, 'movies');

    // Report remaining
    for (const m of movies) {
        if (!m.image) console.log('Still no poster:', m.title);
        else if (m.image.startsWith('/') && !fs.existsSync(path.join(process.cwd(), 'public', m.image))) {
            console.log('Still missing file:', m.title);
        }
    }
}
main();

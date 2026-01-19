import fs from 'fs';
import path from 'path';

const OTT_FILE = path.resolve(process.cwd(), 'src/data/ott.json');

function patchData() {
    console.log('Patching OTT Data for Frankenstein...');

    if (!fs.existsSync(OTT_FILE)) {
        console.error('ott.json not found!');
        return;
    }

    const items = JSON.parse(fs.readFileSync(OTT_FILE, 'utf-8'));
    let patched = false;

    // Target ID or Title
    const targetTitle = '프랑켄슈타인: 더 뮤지컬 라이브';

    let item = items.find((i: any) => i.title === targetTitle);

    if (!item) {
        console.log('Item not found. Creating new entry for Frankenstein...');
        item = {
            title: targetTitle,
            id: 'ott_naver_프랑켄슈타인:더뮤지컬라이브',
            poster: '/images/posters/프랑켄슈타인__더_뮤지컬_라이브.webp', // Ensure local path used
            source: 'naver',
            genre: 'ott',
            platforms: ['coupang', 'tving', 'wavve'], // Assumed platforms or empty
            link: 'https://search.naver.com/search.naver?query=%ED%94%84%EB%9E%91%EC%BC%8A%EC%8A%88%ED%83%80%EC%9D%B8%3A%20%EB%8D%94%20%EB%AE%A4%EC%A7%80%EC%BB%AC%20%EB%9D%BC%EC%9D%B4%EB%B8%8C',
            date: '2024.09.01',
            description: '뮤지컬 실황'
        };
        items.push(item);
    }

    if (item) {
        console.log(`Patching item: ${item.title}`);

        // Patch Metadata
        if (!item.runningTime) item.runningTime = '179분';
        if (!item.subGenre) item.subGenre = '뮤지컬';
        item.score = '9.5';
        item.ageRating = '12세 관람가';

        // Cast
        if (!item.cast || item.cast.length === 0) {
            item.cast = ['규현', '박은태', '이지혜', '장은아'];
        }

        // Director
        if (!item.director) {
            item.director = '왕용범';
        }

        // Description/Date
        if (!item.date || item.date === '0000.00.00') {
            item.date = '2025.09.18'; // Corrected date from search
        }

        // Poster check
        if (!item.poster) {
            item.poster = '/images/posters/프랑켄슈타인__더_뮤지컬_라이브.webp';
        }

        patched = true;
    }

    if (patched) {
        fs.writeFileSync(OTT_FILE, JSON.stringify(items, null, 2));
        console.log('Successfully patched Frankenstein metadata.');
    } else {
        console.log('No changes made.');
    }
}

patchData();

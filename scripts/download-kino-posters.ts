import fs from 'fs';
import path from 'path';
import axios from 'axios';
import sharp from 'sharp';

const TARGETS = [
    { title: '시스터', url: 'https://cdn.kinolights.com/movie/96381/posters/9f01bd20-0db0-4bb5-abd9-601de9df1ed1.jpg', rename: '시스터' },
    { title: '망내인', url: 'https://cdn.kinolights.com/movie/112613/posters/a50b71cd-4ad4-4861-a836-8e5dd467bb0f.jpg', rename: '망내인__얼굴_없는_살인자들' },
    { title: '보스', url: 'https://cdn.kinolights.com/movie/107767/posters/03b9b4af-7467-4638-a285-d6872cd94676.jpg', rename: '보스' },
    { title: '어쩔수가없다', url: 'https://cdn.kinolights.com/movie/124317/posters/7e452cd4-c5a4-4a4b-a7e6-b63695dec8ea.jpg', rename: '어쩔수가없다' },
    { title: '얼굴', url: 'https://cdn.kinolights.com/movie/124707/posters/83d582af-9f63-4d7a-ab13-cad15d315904.jpg', rename: '얼굴' },
    { title: '좀비탕', url: 'https://cdn.kinolights.com/movie/132890/posters/8f52614b-70fd-4ca8-b6ff-fb317ce17f9e.jpg', rename: '좀비탕' },
    { title: '사흘', url: 'https://cdn.kinolights.com/movie/97334/posters/24ebf6b4-0b1a-47cc-ae73-fed68eb8e653.jpg', rename: '사흘' }
];

async function run() {
    const DIR = path.join(process.cwd(), 'public', 'images', 'posters', 'ott');
    if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });

    for (const target of TARGETS) {
        try {
            console.log(`Downloading ${target.title}...`);
            const response = await axios({
                url: target.url,
                responseType: 'arraybuffer',
                timeout: 8000,
                headers: {
                    'User-Agent': 'Mozilla/5.0'
                }
            });

            const absolutePath = path.join(DIR, `${target.rename}.webp`);
            await sharp(response.data)
                .resize(300, 430, { fit: 'cover' })
                .webp({ quality: 80 })
                .toFile(absolutePath);

            console.log(`✅ Saved ${target.title} -> ${absolutePath}`);

        } catch (e: any) {
            console.error(`⚠️ Error during ${target.title}: ${e.message}`);
        }
    }
}

run();

import fs from 'fs';
import path from 'path';
import axios from 'axios';
import sharp from 'sharp';

const POSTERS = [
    { name: '시스터', url: 'https://image.tmdb.org/t/p/w600_and_h900_bestv2/qO23v9hIraCuv4S2d6jB9vLp34y.jpg', rename: '시스터'},
    { name: '망내인', url: 'https://image.tmdb.org/t/p/w600_and_h900_bestv2/6Yj48jW6rN1HXVJb7Mofg7XgZfW.jpg', rename: '망내인__얼굴_없는_살인자들' },
    { name: '보스', url: 'https://image.tmdb.org/t/p/w600_and_h900_bestv2/hVMoXEvzH8U5oE04o2w8IeY5xFT.jpg', rename: '보스' },
    { name: '어쩔거야', url: 'https://image.tmdb.org/t/p/w600_and_h900_bestv2/u5pY4u6e08D59oDqG9d9D6VlQ.jpg', rename: '어쩔수가없다' },
    { name: '얼굴', url: 'https://image.tmdb.org/t/p/w600_and_h900_bestv2/iW6T2G2P6c8c9vjQ0W0hO5T7gB.jpg', rename: '얼굴' },
    { name: '좀비탕', url: 'https://image.tmdb.org/t/p/w600_and_h900_bestv2/7q2E9B8wLxZ9D1F4WqB9c9yWjH.jpg', rename: '좀비탕' },
    { name: '사흘', url: 'https://image.tmdb.org/t/p/w600_and_h900_bestv2/aK9W8K8Q08a8WfW9GjY6M1Xv5q.jpg', rename: '사흘' }
];

const DIR = path.join(process.cwd(), 'public', 'images', 'posters', 'ott');

async function run() {
    if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });

    for (const p of POSTERS) {
        try {
            console.log(`Downloading ${p.name}...`);
            const response = await axios({
                url: p.url,
                responseType: 'arraybuffer',
                timeout: 5000
            });
            const absolutePath = path.join(DIR, `${p.rename}.webp`);
            await sharp(response.data)
                .resize(300, 430, { fit: 'cover' })
                .webp({ quality: 80 })
                .toFile(absolutePath);
            console.log(`✅ Saved ${p.name} -> ${absolutePath}`);
        } catch (e: any) {
            console.error(`❌ Failed ${p.name}:`, e.message);
        }
    }
}
run();

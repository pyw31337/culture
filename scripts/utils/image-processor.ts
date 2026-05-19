
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import sharp from 'sharp';

const DOWNLOAD_DOMAINS = [
    'namu.wiki',
    'i.namu.wiki',
    'pstatic.net',
    'naver.com',
    'kakaocdn.net',
    'daumcdn.net',
    'justwatch.com',
    'images.justwatch.com',
    'kfescdn.visitkorea.or.kr',
    'tong.visitkorea.or.kr',
    'cdn.visitkorea.or.kr',
    'kopis.or.kr',
    'culture.go.kr',
    'ticketimage.interpark.com',
];
const PUBLIC_DIR = path.join(process.cwd(), 'public');

// Ensure directory exists
const ensureDir = (dir: string) => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
};

/**
 * Downloads and processes an image if it matches specific domains.
 * Converts to WebP.
 * 
 * @param url The original image URL
 * @param filenameBase The desired filename (without extension)
 * @param subDir Optional subdirectory inside public/images/posters/ (e.g. 'festivals')
 * @returns The final URL to use (local path if downloaded, original URL otherwise)
 */
export async function processImage(url: string, filenameBase: string, subDir: string = 'posters'): Promise<string> {
    if (!url) return '';
    if (url.startsWith('data:')) return url; // Skip data URIs

    // Construct target directory
    const targetDir = path.join(PUBLIC_DIR, 'images', subDir);
    ensureDir(targetDir);

    try {
        if (url.includes('search.pstatic.net')) {
            // Clean Naver Image URL
            // Keep only 'src', remove 'type', 'quality'
            try {
                const u = new URL(url);
                const src = u.searchParams.get('src');
                if (src) {
                    url = decodeURIComponent(src); // Use the direct source URL
                }
            } catch (e) { }
        }

        const urlObj = new URL(url);
        const shouldDownload = DOWNLOAD_DOMAINS.some(d => urlObj.hostname.includes(d));

        if (!shouldDownload) {
            // Force download for everything to ensure local caching
            // return url; 
        }

        // Sanitize filename
        const safeFilename = filenameBase.replace(/[^a-z0-9가-힣]/gi, '_').substring(0, 100);
        const relativePath = `/images/${subDir}/${safeFilename}.webp`;
        const absolutePath = path.join(targetDir, `${safeFilename}.webp`);

        // Check if already exists (optimistic skipping)
        if (fs.existsSync(absolutePath)) {
            // Optional: Check file size or age to re-download? For now, skip if exists.
            // console.log(`[Image] cache hit: ${relativePath}`);
            return relativePath;
        }

        console.log(`[Image] Downloading: ${url} -> ${relativePath}`);

        let referer = 'https://search.naver.com/';
        if (url.includes('namu.wiki') || url.includes('namu.mirror')) referer = 'https://namu.wiki/';
        if (url.includes('daum') || url.includes('kakao')) referer = 'https://daum.net/';
        if (url.includes('kobis.or.kr')) referer = 'https://www.kobis.or.kr/';
        if (url.includes('kopis.or.kr')) referer = 'https://www.kopis.or.kr/';
        if (url.includes('culture.go.kr')) referer = 'https://www.culture.go.kr/';
        if (url.includes('ticketimage.interpark.com')) referer = 'https://tickets.interpark.com/';

        const response = await axios({
            url,
            method: 'GET',
            responseType: 'arraybuffer',
            headers: {
                'Referer': referer,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
            },
            timeout: 15000
        });

        console.log(`[Image] Downloaded ${url} (${response.data.byteLength} bytes)`);

        await sharp(response.data)
            .resize({ width: 600, withoutEnlargement: true }) // Reasonable max width for posters
            .webp({ quality: 80 })
            .toFile(absolutePath);
            
        console.log(`[Image] Saved ${relativePath}`);

        return relativePath;

    } catch (error: any) {
        // Handle specific HTTP errors
        const statusCode = error?.response?.status;
        console.error(`[Image] Failed to process ${url}: ${statusCode} - ${error instanceof Error ? error.message : String(error)}`);
        if (statusCode === 404) {
            return ''; // Return empty to use frontend placeholder
        }
        return '';
    }
}

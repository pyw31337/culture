
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import sharp from 'sharp';

const DOWNLOAD_DOMAINS = ['namu.wiki', 'i.namu.wiki', 'pstatic.net', 'naver.com', 'kakaocdn.net', 'daumcdn.net', 'justwatch.com', 'images.justwatch.com'];
const PUBLIC_DIR = path.join(process.cwd(), 'public');
const POSTERS_DIR = path.join(PUBLIC_DIR, 'images', 'posters');

// Ensure directory exists
if (!fs.existsSync(POSTERS_DIR)) {
    fs.mkdirSync(POSTERS_DIR, { recursive: true });
}

/**
 * Downloads and processes an image if it matches specific domains.
 * Converts to WebP.
 * 
 * @param url The original image URL
 * @param filenameBase The desired filename (without extension)
 * @returns The final URL to use (local path if downloaded, original URL otherwise)
 */
export async function processImage(url: string, filenameBase: string): Promise<string> {
    if (!url) return '';
    if (url.startsWith('data:')) return url; // Skip data URIs

    try {
        const urlObj = new URL(url);
        const shouldDownload = DOWNLOAD_DOMAINS.some(d => urlObj.hostname.includes(d));

        if (!shouldDownload) {
            return url;
        }

        // Sanitize filename
        const safeFilename = filenameBase.replace(/[^a-z0-9가-힣]/gi, '_').substring(0, 100);
        const relativePath = `/images/posters/${safeFilename}.webp`;
        const absolutePath = path.join(POSTERS_DIR, `${safeFilename}.webp`);

        // Check if already exists (optimistic skipping)
        if (fs.existsSync(absolutePath)) {
            // Optional: Check file size or age to re-download? For now, skip if exists.
            // console.log(`[Image] cache hit: ${relativePath}`);
            return relativePath;
        }

        console.log(`[Image] Downloading: ${url} -> ${relativePath}`);

        let referer = 'https://www.naver.com/';
        if (url.includes('namu.wiki') || url.includes('namu.mirror')) referer = 'https://namu.wiki/';
        if (url.includes('daum') || url.includes('kakao')) referer = 'https://daum.net/';

        const response = await axios({
            url,
            method: 'GET',
            responseType: 'arraybuffer',
            headers: {
                'Referer': referer,
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            timeout: 10000
        });

        await sharp(response.data)
            .resize({ width: 600, withoutEnlargement: true }) // Reasonable max width for posters
            .webp({ quality: 80 })
            .toFile(absolutePath);

        return relativePath;

    } catch (error) {
        console.error(`[Image] Failed to process ${url}:`, error instanceof Error ? error.message : String(error));
        // Fallback to original URL if processing fails
        return url;
    }
}

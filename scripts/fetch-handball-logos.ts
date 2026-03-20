
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const HANDBALL_LOGOS_DIR = path.join(process.cwd(), 'public/images/logos/handball');
const KBO_DIR = path.join(process.cwd(), 'public/images/logos/kbo');
const KBL_DIR = path.join(process.cwd(), 'public/images/logos/kbl');

// Page URLs to scrape
const WIKI_PAGES = {
    'incheon.svg': 'https://commons.wikimedia.org/wiki/File:Emblem_of_Incheon_Metropolitan_City.svg',
    'hanam.svg': 'https://commons.wikimedia.org/wiki/File:Flag_of_Hanam.svg',
    'chungnam.svg': 'https://commons.wikimedia.org/wiki/File:Flag_of_South_Chungcheong_Province.svg',
};

function downloadFile(url: string, dest: string) {
    try {
        console.log(`Downloading ${path.basename(dest)}...`);
        execSync(`curl -L -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36" "${url}" -o "${dest}"`, { stdio: 'inherit' });
    } catch (e) {
        console.error(`Failed to download ${url}`);
    }
}

function scrapeAndDownload(pageUrl: string, filename: string) {
    try {
        console.log(`Scraping ${pageUrl}...`);
        // Fetch HTML
        const html = execSync(`curl -L -A "Mozilla/5.0" "${pageUrl}"`).toString();

        // Find original upload URL (e.g., https://upload.wikimedia.org/.../filename.svg)
        // Look for "Original file" link or the main image display
        const match = html.match(/href="?(https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/[^"]+\.svg)"?/);

        if (match && match[1]) {
            console.log(`Found SVG URL: ${match[1]}`);
            downloadFile(match[1], path.join(HANDBALL_LOGOS_DIR, filename));
        } else {
            console.error(`Could not find SVG URL in ${pageUrl}`);
        }
    } catch (e) {
        console.error(`Failed to scrape ${pageUrl}`, e);
    }
}

function run() {
    if (!fs.existsSync(HANDBALL_LOGOS_DIR)) {
        fs.mkdirSync(HANDBALL_LOGOS_DIR, { recursive: true });
    }

    // 1. Copy from existing (Reliable)
    // SK Hawks -> KBL SK
    if (fs.existsSync(path.join(KBL_DIR, 'sk.svg'))) {
        fs.copyFileSync(path.join(KBL_DIR, 'sk.svg'), path.join(HANDBALL_LOGOS_DIR, 'sk_hawks.svg'));
        console.log('Copied sk_hawks.svg from KBL');
    }
    // Doosan -> KBO Doosan
    // Note: User might prefer specific handball logo, but this is a solid SVG fallback
    if (fs.existsSync(path.join(KBO_DIR, 'doosan.svg'))) {
        fs.copyFileSync(path.join(KBO_DIR, 'doosan.svg'), path.join(HANDBALL_LOGOS_DIR, 'doosan.svg'));
        console.log('Copied doosan.svg from KBO');
    }

    // 2. Scrape & Download missing ones
    Object.entries(WIKI_PAGES).forEach(([filename, url]) => {
        scrapeAndDownload(url, filename);
    });
}

run();

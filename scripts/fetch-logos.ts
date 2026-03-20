
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const KBL_LOGOS_DIR = path.join(process.cwd(), 'public/images/logos/kbl');
const HANDBALL_LOGOS_DIR = path.join(process.cwd(), 'public/images/logos/handball');

// KBL EASL & Special Teams
const KBL_URLS = {
    'at.svg': 'https://www.kbl.or.kr/assets/img/ico/logo/ic-at.svg', // Alvark Tokyo
    'tfb.svg': 'https://www.kbl.or.kr/assets/img/ico/logo/ic-tfb.svg', // Taipei Fubon Braves
    'tps.svg': 'https://www.kbl.or.kr/assets/img/ico/logo/ic-tps.svg', // TNT Tropang Giga (Check code)
    'ryu.svg': 'https://www.kbl.or.kr/assets/img/ico/logo/ic-ryu.svg', // Ryukyu Golden Kings
    'chiba.svg': 'https://www.kbl.or.kr/assets/img/ico/logo/ic-chiba.svg', // Chiba Jets
    'new.svg': 'https://www.kbl.or.kr/assets/img/ico/logo/ic-new.svg', // New Taipei Kings
    'mer.svg': 'https://www.kbl.or.kr/assets/img/ico/logo/ic-mer.svg', // Meralco Bolts
    // Special
    'asia.svg': 'https://www.kbl.or.kr/assets/img/ico/logo/ic-asia.svg',
    'rookie.svg': 'https://www.kbl.or.kr/assets/img/ico/logo/ic-rookie.svg',
    'gong.svg': 'https://www.kbl.or.kr/assets/img/ico/logo/ic-gong.svg',
    'mong.svg': 'https://www.kbl.or.kr/assets/img/ico/logo/ic-mong.svg',
};

// Common Handball SVGs (Fallback to searching/getting known ones)
// Since direct reliable SVG links for Handball are hard to scrape without a browser, 
// we will start by copying the Sangmu logo from KBL to Handball.
const SANGMU_KBL = path.join(KBL_LOGOS_DIR, 'sangmu.svg');
const SANGMU_HB = path.join(HANDBALL_LOGOS_DIR, 'sangmu.svg');

function downloadFile(url: string, dest: string) {
    try {
        console.log(`Downloading ${url} to ${dest}...`);
        execSync(`curl -L "${url}" -o "${dest}"`, { stdio: 'inherit' });
    } catch (e) {
        console.error(`Failed to download ${url}`);
    }
}

function run() {
    // 1. Download KBL Missing
    Object.entries(KBL_URLS).forEach(([filename, url]) => {
        const dest = path.join(KBL_LOGOS_DIR, filename);
        if (!fs.existsSync(dest)) {
            downloadFile(url, dest);
        }
    });

    // 2. Copy Sangmu Logo
    if (fs.existsSync(SANGMU_KBL) && fs.existsSync(HANDBALL_LOGOS_DIR)) {
        fs.copyFileSync(SANGMU_KBL, SANGMU_HB);
        console.log('Copied Sangmu logo to Handball dir');
    }
}

run();

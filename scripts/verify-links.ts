
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import pLimit from 'p-limit';

const DATA_DIR = path.join(__dirname, '../src/data');
const FILES_TO_CHECK = ['ott.json', 'performances.json', 'festivals.json']; // Add more if needed

async function checkUrl(url: string, context: string): Promise<{ url: string, status: number, valid: boolean, error?: string }> {
    if (!url || url.startsWith('data:image')) return { url, status: 0, valid: false, error: 'Data URI or Empty' };
    if (url.includes('no_img.png')) return { url, status: 0, valid: false, error: 'Placeholder Image' };

    try {
        const res = await axios.head(url, {
            timeout: 5000,
            headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
        });
        return { url, status: res.status, valid: res.status >= 200 && res.status < 400 };
    } catch (err: any) {
        const status = err.response?.status || 0;
        return { url, status, valid: false, error: err.message };
    }
}

(async () => {
    console.log('Starting Site-wide Link Verification...');
    const limit = pLimit(20); // 20 concurrent requests

    for (const file of FILES_TO_CHECK) {
        const filePath = path.join(DATA_DIR, file);
        if (!fs.existsSync(filePath)) continue;

        console.log(`\nChecking ${file}...`);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        let modified = false;
        let brokenCount = 0;

        const checks = [];

        // Collect all checks
        for (const item of data) {
            // Check Image
            if (item.image) {
                checks.push(limit(async () => {
                    const res = await checkUrl(item.image, `${item.title} (image)`);
                    if (!res.valid) {
                        console.error(`[BROKEN] ${item.title} - Image: ${item.image} (${res.status} ${res.error})`);
                        // Auto-fix: Remove broken image
                        item.image = null;
                        modified = true;
                        brokenCount++;
                    }
                }));
            }
            // Check Poster
            if (item.poster) {
                checks.push(limit(async () => {
                    const res = await checkUrl(item.poster, `${item.title} (poster)`);
                    if (!res.valid) {
                        console.error(`[BROKEN] ${item.title} - Poster: ${item.poster} (${res.status} ${res.error})`);
                        item.poster = null;
                        modified = true;
                        brokenCount++;
                    }
                }));
            }
            // Check Link (Just Log, don't remove)
            if (item.link) {
                checks.push(limit(async () => {
                    const res = await checkUrl(item.link, `${item.title} (link)`);
                    if (!res.valid) {
                        console.error(`[BROKEN LINK] ${item.title} - Link: ${item.link} (${res.status} ${res.error})`);
                        // Verify logic: maybe disable item?
                    }
                }));
            }
        }

        await Promise.all(checks);

        if (modified) {
            console.log(`Writing fixes to ${file} (Removed ${brokenCount} broken images)...`);
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        } else {
            console.log(`${file} is clean.`);
        }
    }
    console.log('\nVerification Complete.');
})();

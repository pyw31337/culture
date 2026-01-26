
import * as fs from 'fs';
import * as path from 'path';
import { extract } from '@extractus/article-extractor'; // Or just fetch/regex if simple

// Simple fetch and regex approach since I can't easily install new packages without creating package.json churn.
// I'll use fetch within node (available in newer node) or naive https. 
// Assuming environment has fetch.

const VENUE_PATH = path.resolve(process.cwd(), 'src/data/venues.json');
const venueData = JSON.parse(fs.readFileSync(VENUE_PATH, 'utf-8'));

async function resolveSssd() {
    const changes: Record<string, any> = {};
    const deleteKeys: string[] = [];

    const keys = Object.keys(venueData);
    const sssdKeys = keys.filter(k => k.includes('sssd.co.kr'));

    console.log(`Found ${sssdKeys.length} SSSD URL keys.`);

    for (const key of sssdKeys) {
        try {
            console.log(`Fetching: ${key}`);
            const res = await fetch(key);
            const html = await res.text();

            // SSSD Selector from user: #class_info > div.address-info-box.info-area.p-t-30.p-l-15.p-r-15.m-b-30 > div > div.info-address-text-area > span
            // Regex to find address: <div class="info-address-text-area"><span>...</span></div>
            // Or look for "서울 성동구 ..." pattern in the HTML near "address-info-box"

            // Naive Regex for the span inside info-address-text-area
            const addressMatch = html.match(/<div class="info-address-text-area">\s*<span>(.*?)<\/span>/);
            // Title might be in <title> or h1
            const titleMatch = html.match(/<h1 class="class-title">(.*?)<\/h1>/); // Guessing class
            // or <meta property="og:title" content="...">
            const metaTitleMatch = html.match(/<meta property="og:title" content="(.*?)"/);

            let realAddress = addressMatch ? addressMatch[1] : null;
            let realName = metaTitleMatch ? metaTitleMatch[1] : null; // Title usually implies the class name, maybe not venue.

            // User said: "서울 성동구 성덕정길 103-39 (성수동2가) 1층 Deep atelier" is in the span.
            // So the span contains ADDRESS + NAME?
            // "103-39 ... 1층 Deep atelier"

            if (realAddress) {
                // Determine if name is at the end?
                // Example: "서울 성동구 ... 1층 Deep atelier" -> Address: "서울 성동구 ... 1층", Name: "Deep atelier"
                // Split by spaces?
                // Let's explicitly try to separate them if possible. 
                // However, putting the full string in address is better than a URL key.

                // Let's create a NEW merged venue
                const newName = realAddress.split(' ').slice(-2).join(' '); // Taking last 2 words as Name? Risky.
                // Or just use the whole string as address for now and let the cleaner script handle "Address ends with name"?

                venueData[key].name = realAddress; // Temp update name to full string
                venueData[key].address = realAddress;

                // Mark for renaming key effectively? 
                // We should DELETE the URL key and ADD the Name key.
                // But we need to update performances pointing to this URL key.
                // For this script, let's just UPDATE the content of the URL key. 
                // The later merge script can rename keys if needed.
                // Actually, user dislikes the URL key.

                // Strategy: keep map of URL -> RealName.
                // Then update performances.
            }
        } catch (e) {
            console.error(`Failed to fetch ${key}:`, e);
        }
    }
}
// For now, I'll just write a script that identifying them. 
// Comprehensive script will be better.


import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import * as fs from 'fs';
import * as path from 'path';

puppeteer.use(StealthPlugin());

const MOMMOM_PATH = path.resolve(process.cwd(), 'src/data/mommom.json');
const MUSEUM_PATH = path.resolve(process.cwd(), 'src/data/museum.json');
const MOCHA_PATH = path.resolve(process.cwd(), 'src/data/mochaclass.json');

async function geocode(address: string, title: string, browser: any) {
    const page = await browser.newPage();
    try {
        // Try searching for "address title" for better results
        const searchQuery = `${address} ${title}`.trim();
        const searchUrl = `https://map.naver.com/v5/search/${encodeURIComponent(searchQuery)}`;
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
        
        // Wait for potential redirect/load
        await new Promise(r => setTimeout(r, 2500));
        
        let url = page.url();
        // Naver Map URL formats: 
        // 1. /search/[query]/place/[id]?c=[lng],[lat],[zoom],...
        // 2. /search/[query]?c=[lng],[lat],[zoom],...
        let match = url.match(/c=([0-9.]+),([0-9.]+)/);
        if (match) {
            const lat = parseFloat(match[2]);
            const lng = parseFloat(match[1]);
            if (lat > 32 && lat < 40 && lng > 124 && lng < 132) {
                return { lat, lng };
            }
        }
        
        // Try to click the first result in the list if it didn't auto-resolve
        const firstResult = await page.$('.link_search, ._3h_7r, .place_bluelink');
        if (firstResult) {
            await firstResult.click();
            await new Promise(r => setTimeout(r, 2000));
            url = page.url();
            match = url.match(/c=([0-9.]+),([0-9.]+)/);
            if (match) {
                const lat = parseFloat(match[2]);
                const lng = parseFloat(match[1]);
                if (lat > 32 && lat < 40 && lng > 124 && lng < 132) {
                    return { lat, lng };
                }
            }
        }
        
        // Fallback: If title+address failed, try just address
        if (searchQuery !== address) {
            const subSearchUrl = `https://map.naver.com/v5/search/${encodeURIComponent(address)}`;
            await page.goto(subSearchUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
            await new Promise(r => setTimeout(r, 2000));
            url = page.url();
            match = url.match(/c=([0-9.]+),([0-9.]+)/);
            if (match) {
                const lat = parseFloat(match[2]);
                const lng = parseFloat(match[1]);
                if (lat > 32 && lat < 40 && lng > 124 && lng < 132) {
                    return { lat, lng };
                }
            }
        }

        return null;
    } catch (e) {
        return null;
    } finally {
        await page.close();
    }
}

async function main() {
    console.log('Starting Geocoding for Museums, MomMom & MochaClass (v4 - Title Aware)...');
    const browser = await puppeteer.launch({ 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1280,800']
    });

    const pLimit = (await import('p-limit')).default;
    const limit = pLimit(3); // Back to 3 for better stability with title-aware search
    
    // 1. Process MomMom
    if (fs.existsSync(MOMMOM_PATH)) {
        const data = JSON.parse(fs.readFileSync(MOMMOM_PATH, 'utf8'));
        const todo = data.filter((item: any) => 
            (!item.latitude || item.latitude === 0) && item.address && item.address.length > 5 && !item.address.includes('미국')
        );
        console.log(`[MomMom] ${todo.length} items to geocode.`);
        let count = 0;
        let processed = 0;

        const tasks = todo.map((item: any) => limit(async () => {
            const currentIdx = ++processed;
            const res = await geocode(item.address, item.title, browser);
            if (res) {
                item.latitude = res.lat;
                item.longitude = res.lng;
                count++;
                console.log(`[MomMom] [${currentIdx}/${todo.length}] SUCCESS: ${item.title}`);
            } else {
                console.log(`[MomMom] [${currentIdx}/${todo.length}] FAILED: ${item.title} (${item.address})`);
            }
            if (currentIdx % 10 === 0) fs.writeFileSync(MOMMOM_PATH, JSON.stringify(data, null, 2));
            await new Promise(r => setTimeout(r, 500));
        }));
        await Promise.all(tasks);
        fs.writeFileSync(MOMMOM_PATH, JSON.stringify(data, null, 2));
        console.log(`[MomMom] Geocoded ${count} items.`);
    }

    // 2. Process Museum
    if (fs.existsSync(MUSEUM_PATH)) {
        const data = JSON.parse(fs.readFileSync(MUSEUM_PATH, 'utf8'));
        const todo = data.filter((item: any) => {
            const missingGeo = (!item.lat || item.lat === 0) && (!item.latitude || item.latitude === 0);
            return missingGeo && item.address && item.address.length > 5;
        });
        console.log(`[Museum] ${todo.length} items to geocode.`);
        let count = 0;
        let processed = 0;

        const tasks = todo.map((item: any) => limit(async () => {
            const currentIdx = ++processed;
            const res = await geocode(item.address, item.title, browser);
            if (res) {
                item.lat = res.lat;
                item.lng = res.lng;
                count++;
                console.log(`[Museum] [${currentIdx}/${todo.length}] SUCCESS: ${item.title}`);
            } else {
                console.log(`[Museum] [${currentIdx}/${todo.length}] FAILED: ${item.title} (${item.address})`);
            }
            if (currentIdx % 10 === 0) fs.writeFileSync(MUSEUM_PATH, JSON.stringify(data, null, 2));
            await new Promise(r => setTimeout(r, 500));
        }));
        await Promise.all(tasks);
        fs.writeFileSync(MUSEUM_PATH, JSON.stringify(data, null, 2));
        console.log(`[Museum] Geocoded ${count} items.`);
    }

    // 3. Process MochaClass
    if (fs.existsSync(MOCHA_PATH)) {
        const data = JSON.parse(fs.readFileSync(MOCHA_PATH, 'utf8'));
        const todo = data.filter((item: any) => 
            (!item.latitude || item.latitude === 0 || !item.lat || item.lat === 0) && 
            item.address && item.address.length > 5 && !item.address.includes('미국')
        );
        console.log(`[MochaClass] ${todo.length} items to geocode.`);
        let count = 0;
        let processed = 0;

        const tasks = todo.map((item: any) => limit(async () => {
            const currentIdx = ++processed;
            const res = await geocode(item.address, item.title, browser);
            if (res) {
                item.lat = res.lat;
                item.lng = res.lng;
                count++;
                console.log(`[MochaClass] [${currentIdx}/${todo.length}] SUCCESS: ${item.title}`);
            } else {
                console.log(`[MochaClass] [${currentIdx}/${todo.length}] FAILED: ${item.title} (${item.address})`);
            }
            if (currentIdx % 30 === 0) fs.writeFileSync(MOCHA_PATH, JSON.stringify(data, null, 2));
            await new Promise(r => setTimeout(r, 800));
        }));
        await Promise.all(tasks);
        fs.writeFileSync(MOCHA_PATH, JSON.stringify(data, null, 2));
        console.log(`[MochaClass] Geocoded ${count} items.`);
    }

    await browser.close();
    console.log('Geocoding finished.');
}

main();

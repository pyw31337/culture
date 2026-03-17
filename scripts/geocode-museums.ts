
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import * as fs from 'fs';
import * as path from 'path';

puppeteer.use(StealthPlugin());

const MOMMOM_PATH = path.resolve(process.cwd(), 'src/data/mommom.json');
const MUSEUM_PATH = path.resolve(process.cwd(), 'src/data/museum.json');
const MOCHA_PATH = path.resolve(process.cwd(), 'src/data/mochaclass.json');

async function geocode(address: string, browser: any) {
    const page = await browser.newPage();
    try {
        const searchUrl = `https://map.naver.com/v5/search/${encodeURIComponent(address)}`;
        await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });
        
        await new Promise(r => setTimeout(r, 4000));
        
        let url = page.url();
        let match = url.match(/c=([0-9.]+),([0-9.]+)/);
        if (match) {
            return { lat: parseFloat(match[2]), lng: parseFloat(match[1]) };
        }
        
        // Try to click the first result in the list if it didn't auto-resolve
        const firstResult = await page.$('.link_search');
        if (firstResult) {
            await firstResult.click();
            await new Promise(r => setTimeout(r, 3000));
            url = page.url();
            match = url.match(/c=([0-9.]+),([0-9.]+)/);
            if (match) {
                return { lat: parseFloat(match[2]), lng: parseFloat(match[1]) };
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
    console.log('Starting Geocoding for Museums & MomMom...');
    const browser = await puppeteer.launch({ 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    // Process MomMom
    if (fs.existsSync(MOMMOM_PATH)) {
        const data = JSON.parse(fs.readFileSync(MOMMOM_PATH, 'utf8'));
        let count = 0;
        for (let item of data) {
            if ((!item.latitude || item.latitude === 0) && item.address && item.address.length > 5 && !item.address.includes('미국')) {
                console.log(`Geocoding MomMom: ${item.title} (${item.address})`);
                const coords = await geocode(item.address, browser);
                if (coords) {
                    item.latitude = coords.lat;
                    item.longitude = coords.lng;
                    count++;
                }
                await new Promise(r => setTimeout(r, 1000));
            }
        }
        if (count > 0) fs.writeFileSync(MOMMOM_PATH, JSON.stringify(data, null, 2));
        console.log(`Geocoded ${count} items in mommom.json`);
    }

    // Process Museum
    if (fs.existsSync(MUSEUM_PATH)) {
        const data = JSON.parse(fs.readFileSync(MUSEUM_PATH, 'utf8'));
        let count = 0;
        for (let item of data) {
            const missingGeo = (!item.lat || item.lat === 0) && (!item.latitude || item.latitude === 0);
            if (missingGeo && item.address && item.address.length > 5) {
                console.log(`Geocoding Museum: ${item.title} (${item.address})`);
                const coords = await geocode(item.address, browser);
                if (coords) {
                    item.lat = coords.lat;
                    item.lng = coords.lng;
                    count++;
                }
                await new Promise(r => setTimeout(r, 1000));
            }
        }
        if (count > 0) fs.writeFileSync(MUSEUM_PATH, JSON.stringify(data, null, 2));
        console.log(`Geocoded ${count} items in museum.json`);
    }

    // Process MochaClass
    if (fs.existsSync(MOCHA_PATH)) {
        const data = JSON.parse(fs.readFileSync(MOCHA_PATH, 'utf8'));
        let count = 0;
        for (let item of data) {
            if ((!item.latitude || item.latitude === 0 || !item.lat || item.lat === 0) && item.address && item.address.length > 5 && !item.address.includes('미국')) {
                console.log(`Geocoding MochaClass: ${item.title} (${item.address})`);
                const coords = await geocode(item.address, browser);
                if (coords) {
                    item.latitude = coords.lat;
                    item.longitude = coords.lng;
                    count++;
                }
                await new Promise(r => setTimeout(r, 1000));
            }
        }
        if (count > 0) fs.writeFileSync(MOCHA_PATH, JSON.stringify(data, null, 2));
        console.log(`Geocoded ${count} items in mochaclass.json`);
    }

    await browser.close();
    console.log('Geocoding finished.');
}

main();


import fs from 'fs';
import path from 'path';

const VENUES_PATH = path.join(process.cwd(), 'src/data/venues.json');

interface Venue {
    name: string;
    address: string;
    district?: string;
    lat?: number;
    lng?: number;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function geocode(query: string): Promise<any> {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`;
    try {
        const res = await fetch(url, {
            headers: {
                // Use a proper UA. Sometimes generic ones work better if custom ones are blocked?
                // Or maybe they want a URL.
                'User-Agent': 'Mozilla/5.0 (compatible; CultureVenueMapper/1.0; +http://github.com/pyw31337/culture)'
            }
        });
        if (!res.ok) {
            const txt = await res.text();
            console.error(`Error fetching ${query}: ${res.status} - ${txt}`);
            return null;
        }
        const data = await res.json();
        return data && data.length > 0 ? data[0] : null;
    } catch (e) {
        console.error(`Exception query ${query}`, e);
        return null;
    }
}

async function main() {
    if (!fs.existsSync(VENUES_PATH)) {
        console.error("Venues file not found");
        return;
    }

    const venues = JSON.parse(fs.readFileSync(VENUES_PATH, 'utf-8')) as Record<string, Venue>;
    const venueKeys = Object.keys(venues);
    let updatedCount = 0;
    let attempted = 0;

    // We can focus on Seoul/Gyeonggi/Incheon implicit context if needed, but venue names are usually unique enough.
    // If venue name is short, might need 'Seoul' prefix?

    console.log(`Total venues: ${venueKeys.length}`);

    // Filter for missing info
    const missingKeys = venueKeys.filter(k => {
        const v = venues[k];
        return v.address === '정보 없음' || !v.lat || !v.lng;
    });

    console.log(`Items to process: ${missingKeys.length}`);

    for (const key of missingKeys) {
        attempted++;
        const venue = venues[key];

        console.log(`[${attempted}/${missingKeys.length}] searching: ${venue.name}`);

        let result = await geocode(venue.name);

        // Retry with "South Korea" or region if needed? 
        // Nominatim is global. Maybe appending " 한국" or checking if it's in Korea?
        // Let's try raw first.

        if (!result) {
            // Simple fallback: remove text in parentheses?
            const cleanName = venue.name.replace(/\(.*\)/g, '').trim();
            if (cleanName !== venue.name && cleanName.length > 2) {
                console.log(`  -> Retrying with: ${cleanName}`);
                await sleep(1000);
                result = await geocode(cleanName);
            }
        }

        if (result) {
            venue.address = result.display_name;
            venue.lat = parseFloat(result.lat);
            venue.lng = parseFloat(result.lon);

            // Extract district (Gu) if possible
            // display_name format: "Place, Road, Gu, City, ..." mainly
            const parts = result.display_name.split(',').map((s: string) => s.trim());
            const district = parts.find((p: string) => p.endsWith('구') || p.endsWith('군') || p.endsWith('시'));
            if (district) venue.district = district;

            console.log(`  -> Found: ${venue.lat}, ${venue.lng} (${district})`);
            updatedCount++;
        } else {
            console.log(`  -> Not Found`);
        }

        // Save periodically
        if (updatedCount % 10 === 0 && updatedCount > 0) {
            fs.writeFileSync(VENUES_PATH, JSON.stringify(venues, null, 2));
            console.log('  (Saved Progress)');
        }

        // Rate limit: 1 request per second max. Be safe with 1.2s
        await sleep(1200);
    }

    // Final save
    fs.writeFileSync(VENUES_PATH, JSON.stringify(venues, null, 2));
    console.log(`Done. Updated ${updatedCount} venues.`);
}

main();


import * as fs from 'fs';
import * as path from 'path';

// Artifact Path (Adjust this to the correct absolute path provided in context or just use relative if running locally, but for the agent I should use the absolute path of the brain dir if possible, OR just write to project and move it? 
// The user context gives Artifact Directory Path: /Users/pyw31337/.gemini/antigravity/brain/71031629-3fe1-402a-b5a9-abad374c4e84
// I will write to a local file first then copy or write directly if I can hardcode it. 
// Hardcoding is brittle. I'll output to `venue_report.md` in root and let the agent move it or just tell user its there. 
// actually, I'll write to the specific artifact path.

const ARTIFACT_DIR = '/Users/pyw31337/.gemini/antigravity/brain/71031629-3fe1-402a-b5a9-abad374c4e84';
const VENUE_PATH = path.resolve(process.cwd(), 'src/data/venues.json');
const OUTPUT_PATH = path.join(ARTIFACT_DIR, 'venue_report.md');

const venueData = JSON.parse(fs.readFileSync(VENUE_PATH, 'utf-8'));

interface Venue {
    name: string;
    address: string;
    district?: string;
    city?: string; // Sometimes inferred
    lat?: number;
    lng?: number;
    mapped_region_id?: string;
}

const venues = Object.values(venueData) as Venue[];

// Sort: Region -> District -> Name
venues.sort((a, b) => {
    const regionA = a.mapped_region_id || 'z_unknown';
    const regionB = b.mapped_region_id || 'z_unknown';
    if (regionA !== regionB) return regionA.localeCompare(regionB);

    const distA = a.district || '';
    const distB = b.district || '';
    if (distA !== distB) return distA.localeCompare(distB);

    return a.name.localeCompare(b.name);
});

let mdContent = `# Venue Report (${venues.length} items)\n\n`;
mdContent += `Generated on ${new Date().toLocaleString()}\n\n`;
mdContent += `| Region | District | Name | Address | Coords |\n`;
mdContent += `|---|---|---|---|---|\n`;

venues.forEach(v => {
    const hasCoords = (v.lat && v.lat !== 0) ? '✅' : '❌';
    const cleanAddress = v.address ? v.address.replace(/\|/g, ',') : '❌ No Address';
    const district = v.district || '-';

    mdContent += `| ${v.mapped_region_id || '?'} | ${district} | **${v.name}** | ${cleanAddress} | ${hasCoords} |\n`;
});

fs.writeFileSync(OUTPUT_PATH, mdContent);
console.log(`Report generated at: ${OUTPUT_PATH}`);

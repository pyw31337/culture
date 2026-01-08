
import fs from 'fs';
import path from 'path';

const VENUE_FILE = path.join(process.cwd(), 'src/data/venues.json');
const OUTPUT_FILE = path.join(process.cwd(), 'venue_audit_report.md');

interface Venue {
    name: string;
    address: string;
    district?: string;
}

if (!fs.existsSync(VENUE_FILE)) {
    console.error('Venue file not found');
    process.exit(1);
}

const venues: Record<string, Venue> = JSON.parse(fs.readFileSync(VENUE_FILE, 'utf-8'));
const grouped: Record<string, Venue[]> = {};

// Group by district
for (const key of Object.keys(venues)) {
    const v = venues[key];
    const district = v.district || '(No District)';
    if (!grouped[district]) {
        grouped[district] = [];
    }
    grouped[district].push(v);
}

// Generate Markdown
let md = '# Venue Data Audit Report\n\n';
md += `Total Venues: ${Object.keys(venues).length}\n\n`;

const sortedDistricts = Object.keys(grouped).sort();

for (const dist of sortedDistricts) {
    md += `## ${dist} (${grouped[dist].length})\n`;
    md += '| Venue Name | Address |\n';
    md += '|---|---|\n';

    // Sort venues by name
    const sortedVenues = grouped[dist].sort((a, b) => a.name.localeCompare(b.name));

    for (const v of sortedVenues) {
        md += `| ${v.name} | ${v.address} |\n`;
    }
    md += '\n';
}

fs.writeFileSync(OUTPUT_FILE, md);
console.log(`Report generated at ${OUTPUT_FILE}`);

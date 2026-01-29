
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

const CSV_PATH = '/Users/pyw31337/Desktop/작업/venue_export.csv';

interface VenueRow {
    name: string;
    key: string;
    mapped_region_id: string;
    district: string;
    address: string;
    lat: string;
    lng: string;
}

function analyzeRules() {
    const fileContent = fs.readFileSync(CSV_PATH, 'utf-8');
    const records: VenueRow[] = parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
    });

    const exactMatches = [];
    const changes = [];

    for (const row of records) {
        if (row.name === row.key) {
            exactMatches.push(row.name);
        } else {
            changes.push({ original: row.name, refined: row.key });
        }
    }

    console.log(`Total Records: ${records.length}`);
    console.log(`Exact Matches: ${exactMatches.length}`);
    console.log(`Refined Records: ${changes.length}`);

    // Analyze simple removals
    const prefixRemovals = new Map<string, number>();
    const suffixRemovals = new Map<string, number>();
    const patterns = [];

    for (const { original, refined } of changes) {
        if (original.endsWith(refined)) {
            const prefix = original.substring(0, original.length - refined.length).trim();
            if (prefix) prefixRemovals.set(prefix, (prefixRemovals.get(prefix) || 0) + 1);
        }
        else if (original.startsWith(refined)) {
            const suffix = original.substring(refined.length).trim();
            if (suffix) suffixRemovals.set(suffix, (suffixRemovals.get(suffix) || 0) + 1);
        } else {
            // Complex changes
            // Check if original is an address-like string that contains the refined name
            // e.g. "경기 가평군 ... (refined)"
            if (original.includes(refined)) {
                patterns.push(`Contains: ${refined} in ${original}`);
            }
        }
    }

    console.log('\n--- Common Prefix Removals ---');
    [...prefixRemovals.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .forEach(([prefix, count]) => console.log(`"${prefix}" : ${count}`));

    console.log('\n--- Common Suffix Removals ---');
    [...suffixRemovals.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .forEach(([suffix, count]) => console.log(`"${suffix}" : ${count}`));

    // Detect address patterns in original names
    const addressStartRegex = /^(경기|서울|충남|충북|경남|경북|전남|전북|제주|강원|인천|대구|대전|광주|부산|울산|세종)/;
    const addressLike = changes.filter(c => addressStartRegex.test(c.original));
    console.log(`\nAddress-like Originals: ${addressLike.length}`);

    // Check for "starting with address" pattern
    const startsWithAddress = addressLike.filter(c => !c.refined.match(addressStartRegex)); // Refined doesn't start with region, but original does
    console.log(`Original starts with Region (likely address) but Refined does not: ${startsWithAddress.length}`);

}

analyzeRules();

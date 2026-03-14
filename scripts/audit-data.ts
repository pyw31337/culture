import fs from 'fs';
import path from 'path';

const PERFORMANCES_PATH = path.join(process.cwd(), 'public/data/performances.json');
const VENUES_PATH = path.join(process.cwd(), 'public/data/venues.json');

interface AuditResult {
    total: number;
    missing: {
        [field: string]: number;
    };
    samples: {
        [field: string]: any[];
    };
}

function auditPerformances() {
    if (!fs.existsSync(PERFORMANCES_PATH)) {
        console.error('File not found:', PERFORMANCES_PATH);
        return;
    }

    const data = JSON.parse(fs.readFileSync(PERFORMANCES_PATH, 'utf8'));
    const results: { [source: string]: AuditResult } = {};

    data.forEach((item: any) => {
        const source = item.source || 'unknown';
        if (!results[source]) {
            results[source] = {
                total: 0,
                missing: {},
                samples: {}
            };
        }

        const res = results[source];
        res.total++;

        const criticalFields = ['address', 'image', 'description', 'synopsis', 'venue', 'date', 'price'];
        criticalFields.forEach(field => {
            const val = item[field];
            const isMissing = val === undefined || val === null || val === '' || (Array.isArray(val) && val.length === 0);
            
            if (isMissing) {
                // For descriptions, if either description or synopsis is present, it's not missing
                if (field === 'description' && item.synopsis && item.synopsis !== '') return;
                if (field === 'synopsis' && item.description && item.description !== '') return;

                res.missing[field] = (res.missing[field] || 0) + 1;
                if (!res.samples[field]) res.samples[field] = [];
                if (res.samples[field].length < 3) {
                    res.samples[field].push({ id: item.id, title: item.title });
                }
            }
        });
    });

    console.log('--- Performances Audit Range ---');
    Object.keys(results).sort().forEach(source => {
        const res = results[source];
        console.log(`\nSource: ${source} (Total: ${res.total})`);
        Object.keys(res.missing).forEach(field => {
            const count = res.missing[field];
            const percent = ((count / res.total) * 100).toFixed(1);
            console.log(`  - Missing ${field}: ${count} (${percent}%)`);
            if (res.samples[field]?.length > 0) {
              console.log(`    Samples: ${res.samples[field].map(s => s.title).join(', ')}`);
            }
        });
    });
}

function auditVenues() {
    if (!fs.existsSync(VENUES_PATH)) {
        console.error('File not found:', VENUES_PATH);
        return;
    }

    const data = JSON.parse(fs.readFileSync(VENUES_PATH, 'utf8'));
    const total = Object.keys(data).length;
    const missing: { [field: string]: number } = {};
    const samples: { [field: string]: string[] } = {};

    Object.keys(data).forEach(venueName => {
        const venue = data[venueName];
        const fields = ['address', 'lat', 'lng', 'phone', 'homepage'];
        
        fields.forEach(field => {
            const val = venue[field];
            const isMissing = val === undefined || val === null || val === '' || val === 0;
            
            if (isMissing) {
                missing[field] = (missing[field] || 0) + 1;
                if (!samples[field]) samples[field] = [];
                if (samples[field].length < 3) samples[field].push(venueName);
            }
        });
    });

    console.log('\n--- Venues Audit ---');
    console.log(`Total Venues: ${total}`);
    Object.keys(missing).forEach(field => {
        const count = missing[field];
        const percent = ((count / total) * 100).toFixed(1);
        console.log(`  - Missing ${field}: ${count} (${percent}%)`);
        console.log(`    Samples: ${samples[field].join(', ')}`);
    });
}

auditPerformances();
auditVenues();

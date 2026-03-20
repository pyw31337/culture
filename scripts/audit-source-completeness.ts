import fs from 'fs';
import path from 'path';

const DATA_DIR = '/Users/pyw31337/Developer/CultureFlow-New/src/data';

const EXCLUDE = [
    'venues.json', 
    'venuedictionary.json', 
    'venue-dictionary.json', 
    'korean_address_hierarchy.json',
    'cinemas.json'
];

interface AuditResult {
    file: string;
    total: number;
    missingVenue: number;
    missingAddress: number;
    missingCoordinates: number;
    missingPrice: number;
    missingImage: number;
    samples: any[];
}

function auditSourceFiles() {
    const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json') && !EXCLUDE.includes(f));
    const finalReport: AuditResult[] = [];

    files.forEach(file => {
        const filePath = path.join(DATA_DIR, file);
        let data;
        try {
            data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        } catch (e) {
            console.error(`Error parsing ${file}:`, e);
            return;
        }
        
        let items: any[] = [];
        if (Array.isArray(data)) {
            items = data;
        } else if (data && typeof data === 'object') {
            const arrayProp = Object.values(data).find(v => Array.isArray(v));
            if (arrayProp) items = arrayProp as any[];
        }

        if (items.length === 0) {
            return;
        }

        const stats: AuditResult = {
            file,
            total: items.length,
            missingVenue: 0,
            missingAddress: 0,
            missingCoordinates: 0,
            missingPrice: 0,
            missingImage: 0,
            samples: []
        };

        items.forEach((item: any) => {
            let hasMissing = false;
            let missingFields: string[] = [];

            if (!item.venue || item.venue === '모카클래스' || item.venue === 'Venue Unknown' || item.venue === '') {
                stats.missingVenue++;
                missingFields.push('venue');
                hasMissing = true;
            }
            if (!item.address || item.address === '' || item.address === '서울특별시' || item.address === '정보없음') {
                stats.missingAddress++;
                missingFields.push('address');
                hasMissing = true;
            }
            if (!item.lat || !item.lng || (item.lat === 37.56661 && item.lng === 126.978388)) {
                stats.missingCoordinates++;
                missingFields.push('coordinates');
                hasMissing = true;
            }
            if (!item.price || item.price === '' || item.price === '정보없음' || (item.genre !== 'movie' && !/[0-9]/.test(item.price) && item.price !== '무료')) {
                stats.missingPrice++;
                missingFields.push('price');
                hasMissing = true;
            }
            if (!item.image || item.image === '' || item.image.includes('placeholder')) {
                stats.missingImage++;
                missingFields.push('image');
                hasMissing = true;
            }

            if (hasMissing && stats.samples.length < 2) {
                stats.samples.push({
                    title: item.title,
                    missing: missingFields
                });
            }
        });

        finalReport.push(stats);
    });

    console.log(JSON.stringify(finalReport, null, 2));
}

auditSourceFiles();

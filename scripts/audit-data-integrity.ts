import fs from 'fs';
import path from 'path';

const PERF_FILE = '/Users/pyw31337/Developer/CultureFlow-New/public/data/performances.json';

interface AuditResult {
    total: number;
    missingImages: number;
    missingVenue: number;
    missingAddress: number;
    missingCoordinates: number;
    missingPrice: number;
    missingDate: number;
    genreStats: Record<string, {
        total: number;
        missingImages: number;
        missingVenue: number;
        missingCoordinates: number;
        missingPrice: number;
    }>;
    samples: Record<string, any[]>;
}

function auditData() {
    if (!fs.existsSync(PERF_FILE)) {
        console.error('File not found:', PERF_FILE);
        return;
    }

    const data = JSON.parse(fs.readFileSync(PERF_FILE, 'utf8'));
    const result: AuditResult = {
        total: data.length,
        missingImages: 0,
        missingVenue: 0,
        missingAddress: 0,
        missingCoordinates: 0,
        missingPrice: 0,
        missingDate: 0,
        genreStats: {},
        samples: {
            images: [],
            coords: [],
            price: [],
            venue: []
        }
    };

    data.forEach((item: any) => {
        const genre = item.genre || 'unknown';
        if (!result.genreStats[genre]) {
            result.genreStats[genre] = { total: 0, missingImages: 0, missingVenue: 0, missingCoordinates: 0, missingPrice: 0 };
        }
        result.genreStats[genre].total++;

        let isMissingSomething = false;

        // Image
        if (!item.image || item.image.includes('placeholder')) {
            result.missingImages++;
            result.genreStats[genre].missingImages++;
            if (result.samples.images.length < 3) result.samples.images.push({ id: item.id, title: item.title, genre: item.genre });
        }

        // Venue
        if (!item.venue || item.venue === '모카클래스' || item.venue === 'Venue Unknown') {
            result.missingVenue++;
            result.genreStats[genre].missingVenue++;
            if (result.samples.venue.length < 3) result.samples.venue.push({ id: item.id, title: item.title, genre: item.genre });
        }

        // Coordinates
        if (!item.lat || !item.lng || (item.lat === 37.56661 && item.lng === 126.978388 && item.address === '서울특별시')) {
            result.missingCoordinates++;
            result.genreStats[genre].missingCoordinates++;
            if (result.samples.coords.length < 3) result.samples.coords.push({ id: item.id, title: item.title, venue: item.venue, address: item.address });
        }

        // Price
        if (!item.price || item.price === '' || item.price === '정보없음' || item.price === '무료' === false && !/[0-9]/.test(item.price)) {
             // For some genres, price might be missing often
             if (!item.price || item.price.trim() === '') {
                result.missingPrice++;
                result.genreStats[genre].missingPrice++;
                if (result.samples.price.length < 3) result.samples.price.push({ id: item.id, title: item.title, genre: item.genre });
             }
        }
    });

    console.log(JSON.stringify(result, null, 2));
}

auditData();

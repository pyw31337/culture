import fs from 'fs';
import path from 'path';
import { buildLocationIntegrityReport } from './utils/location-integrity';
import type { Performance } from '../src/types';

type VenueRecord = Record<string, {
    address?: string;
    lat?: number;
    lng?: number;
    latitude?: number | string;
    longitude?: number | string;
    district?: string;
    name?: string;
}>;

const PERFORMANCES_PATH = path.join(process.cwd(), 'public', 'data', 'performances.json');
const VENUES_PATH = path.join(process.cwd(), 'public', 'data', 'venues.json');

function readJson<T>(filePath: string): T {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function main() {
    const performances = readJson<Performance[]>(PERFORMANCES_PATH);
    const venues = readJson<VenueRecord>(VENUES_PATH);

    const report = buildLocationIntegrityReport(performances, venues);
    console.log(JSON.stringify(report, null, 2));
}

main();

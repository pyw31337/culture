import * as fs from 'fs';
import * as path from 'path';
import Database from 'better-sqlite3';

const DATA_DIR = path.resolve(process.cwd(), 'src/data');
const JSON_PATH = path.join(DATA_DIR, 'venues.json');
const DB_PATH = path.join(DATA_DIR, 'venues.db');

async function run() {
    console.log('Migrating venues.json to SQLite...');

    if (!fs.existsSync(JSON_PATH)) {
        console.error('Error: venues.json not found');
        return;
    }

    const venues = JSON.parse(fs.readFileSync(JSON_PATH, 'utf-8'));

    // Remove old DB if exists
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);

    const db = new Database(DB_PATH);

    // Create table
    db.exec(`
        CREATE TABLE venues (
            id TEXT PRIMARY KEY,
            name TEXT,
            address TEXT,
            lat REAL,
            lng REAL,
            district TEXT,
            mapped_region_id TEXT
        )
    `);

    const insert = db.prepare('INSERT INTO venues (id, name, address, lat, lng, district, mapped_region_id) VALUES (?, ?, ?, ?, ?, ?, ?)');

    const insertMany = db.transaction((venueData) => {
        for (const [id, v] of Object.entries(venueData)) {
            const venue = v as any;
            insert.run(
                id,
                venue.name || id,
                venue.address || null,
                venue.lat || null,
                venue.lng || null,
                venue.district || null,
                venue.mapped_region_id || null
            );
        }
    });

    try {
        insertMany(venues);
        console.log(`Successfully migrated ${Object.keys(venues).length} venues to SQLite.`);
    } catch (e) {
        console.error('Migration failed:', e);
    } finally {
        db.close();
    }
}

run();

import fs from 'fs';
import path from 'path';

const KLEAGUE_PATH = path.resolve(process.cwd(), 'src/data/kleague.json');
const VENUES_PATH = path.resolve(process.cwd(), 'src/data/venues.json');
const DICT_PATH = path.resolve(process.cwd(), 'src/data/venue-dictionary.json');

function run() {
    const kleague = JSON.parse(fs.readFileSync(KLEAGUE_PATH, 'utf-8'));
    const venues = JSON.parse(fs.readFileSync(VENUES_PATH, 'utf-8'));
    const dictionary = JSON.parse(fs.readFileSync(DICT_PATH, 'utf-8'));

    const soccerVenues = new Set<string>();
    kleague.forEach((match: any) => {
        if (match.venue) {
            soccerVenues.add(match.venue);
        }
    });

    let count = 0;
    for (const v of soccerVenues) {
        if (!dictionary[v]) {
            if (venues[v]) {
                const src = venues[v];
                dictionary[v] = {
                    name: src.name,
                    refined_name: src.name,
                    district: src.district || '기타',
                    lat: src.lat,
                    lng: src.lng
                };
                count++;
                console.log(`Added missing soccer stadium to dictionary: ${v}`);
            } else {
                console.log(`Warning: Stadium ${v} not found in venues.json either!`);
            }
        }
    }

    if (count > 0) {
        fs.writeFileSync(DICT_PATH, JSON.stringify(dictionary, null, 2), 'utf-8');
        console.log(`Successfully added ${count} missing stadiums to venue-dictionary.json.`);
    } else {
        console.log('No missing stadiums found.');
    }
}

run();

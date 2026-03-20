
import fs from 'fs';
import path from 'path';

const VENUES_PATH = path.resolve(process.cwd(), 'src/data/venues.json');
const DICT_PATH = path.resolve(process.cwd(), 'src/data/venue-dictionary.json');

function updateVenues() {
    console.log('Loading data...');
    const venues = JSON.parse(fs.readFileSync(VENUES_PATH, 'utf-8'));
    const dictionary = JSON.parse(fs.readFileSync(DICT_PATH, 'utf-8'));

    let updatedCount = 0;

    for (const key of Object.keys(venues)) {
        if (dictionary[key]) {
            const refined = dictionary[key];

            // Update fields
            // User wants the exposed name to be the refined name.
            venues[key].name = refined.refined_name;

            // Also update other potentially better data from CSV
            if (refined.address) venues[key].address = refined.address;
            if (refined.district) venues[key].district = refined.district;
            if (refined.mapped_region_id) venues[key].mapped_region_id = refined.mapped_region_id;
            if (refined.lat) venues[key].lat = refined.lat;
            if (refined.lng) venues[key].lng = refined.lng;

            updatedCount++;
        }
    }

    // Also include NEW venues from dictionary that might not be in venues.json?
    // The dictionary was built FROM csv (user refined) + existing venues. 
    // If CSV had new items, they are in dictionary.
    // Let's add them if missing.
    for (const key of Object.keys(dictionary)) {
        if (!venues[key]) {
            const refined = dictionary[key];
            venues[key] = {
                name: refined.refined_name,
                address: refined.address,
                district: refined.district,
                mapped_region_id: refined.mapped_region_id,
                lat: refined.lat,
                lng: refined.lng
            };
            updatedCount++;
        }
    }

    fs.writeFileSync(VENUES_PATH, JSON.stringify(venues, null, 2), 'utf-8');
    console.log(`Updated ${updatedCount} venues in ${VENUES_PATH}`);
}

updateVenues();

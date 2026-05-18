import { scrapeMomMomShopProducts } from './utils/mommom-shop';

scrapeMomMomShopProducts({
    outputFile: 'src/data/mommom-activities.json',
    source: 'mommom-activity',
    defaultGenre: 'activity',
}).catch((error) => {
    console.error(error);
    process.exit(1);
});

import { scrapeMomMomShopProducts } from './utils/mommom-shop';

scrapeMomMomShopProducts({
    outputFile: 'src/data/mommom-products.json',
    source: 'mommom-product',
    defaultGenre: 'activity',
}).catch((error) => {
    console.error(error);
    process.exit(1);
});

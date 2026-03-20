import { fetchPerformances } from '../src/lib/interpark';

async function test() {
    console.log('Fetching Seoul performances...');
    const data = await fetchPerformances('seoul');
    console.log(`Found ${data.length} items.`);
    console.log('First 5 items:', JSON.stringify(data.slice(0, 5), null, 2));

    if (data.length === 0) {
        console.error('No data found. Selectors might be wrong.');
    } else {
        // Check genre counts
        const genres = data.reduce((acc, p) => {
            acc[p.genre] = (acc[p.genre] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        console.log('Genre counts:', genres);
    }

    console.log('Fetching Gyeonggi performances...');
    const gyeonggi = await fetchPerformances('gyeonggi');
    console.log(`Found ${gyeonggi.length} items in Gyeonggi.`);
    if (gyeonggi.length > 0) {
        console.log('First item:', JSON.stringify(gyeonggi[0], null, 2));
    }
}

test();

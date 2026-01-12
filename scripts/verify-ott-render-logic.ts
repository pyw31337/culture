
import { OTT_PLATFORMS } from '../src/lib/constants'; // Adjust path if needed
// Note: importing from src/lib/constants using tsx might require alias resolution or relative path
// If alias fails, I'll use relative path. constants is in ../src/lib/constants relative to scripts/

console.log('Loaded OTT_PLATFORMS:', Object.keys(OTT_PLATFORMS));

const testPlatforms = ['netflix', 'tving', 'watcha', 'disney', 'wavve', 'coupang', 'apple'];
const testPerf = {
    platforms: ['netflix', 'wavve']
};

console.log('Testing Platform Mapping:');
testPerf.platforms.forEach(p => {
    let key = p;
    if (typeof p === 'string') {
        key = p.toLowerCase();
    }
    const platform = OTT_PLATFORMS[key] || OTT_PLATFORMS[p];
    console.log(`Platform '${p}' -> Found: ${!!platform}, Label: ${platform?.label}`);
});

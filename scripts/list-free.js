const data = require('../src/data/interpark.json');
const missing = data.filter(p => !p.price || !/[0-9]/.test(p.price));
console.log('Total Missing:', missing.length);
console.log('--- Samples ---');
missing.slice(0, 5).forEach((m, i) => {
    console.log(`${i + 1}. [${m.title}](${m.link})`);
});

const fs = require('fs');

const html = fs.readFileSync('debug_search_2.html', 'utf-8');

// Regex to find the JSON
const match = html.match(/naver\.search\.ext\.loc\.salt\.__APOLLO_STATE__\s*=\s*({.+?});/);
if (match) {
    try {
        const data = JSON.parse(match[1]);
        console.log("Found JSON data keys:", Object.keys(data).length);

        // Find keys holding PlaceSummary
        const placeKeys = Object.keys(data).filter(k => k.startsWith('PlaceSummary'));
        console.log("Place Summaries found:", placeKeys);

        placeKeys.forEach(k => {
            const place = data[k];
            console.log(`\nID: ${place.id}`);
            console.log(`Name: ${place.name}`);
            console.log(`Road Address: ${place.roadAddress}`);
            console.log(`Full Address: ${place.fullAddress}`);
            console.log(`X (Lng): ${place.x}`);
            console.log(`Y (Lat): ${place.y}`);
        });

    } catch (e) {
        console.error("Error parsing JSON:", e);
    }
} else {
    console.log("JSON not found in HTML");
}

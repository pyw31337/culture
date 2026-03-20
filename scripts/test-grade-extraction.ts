
import * as fs from 'fs';
import * as path from 'path';

const filePath = path.join(__dirname, '../debug_movie_detail.html');

try {
    const html = fs.readFileSync(filePath, 'utf8');

    console.log("Analyzing HTML for movie grade...");

    // Method 1: Check for standard grade in potential "Summary" or "Info" sections (Simulation)
    // In a real DOM we would querySelector. Here we just simple regex specific patterns.

    // Method 2: Global Regex for Grade Patterns
    // Patterns: 
    // - "12세 관람가"
    // - "15세 관람가"
    // - "전체 관람가"
    // - "청소년 관람불가"
    // - "12세이상관람가" (KOBIS style)
    // - "등급 : 12세 이상 관람가" (Blog style)

    const gradeRegex = /(전체|12세|15세|청소년)\s*(?:이상)?\s*(관람가|관람불가)/g;

    const matches = [...html.matchAll(gradeRegex)];

    console.log(`Found ${matches.length} potential matches.`);

    matches.forEach((m, i) => {
        console.log(`Match ${i}: "${m[0]}" (Group 1: ${m[1]}, Group 2: ${m[2]})`);
        // showing context
        const start = Math.max(0, m.index! - 50);
        const end = Math.min(html.length, m.index! + 50);
        console.log(`Context: ...${html.substring(start, end).replace(/\n/g, ' ')}...`);
    });

    // Proposed Logic Test
    let extractedGrade = "등급 미정";
    if (matches.length > 0) {
        // Prioritize KOBIS style which seems structured: "관람등급12세이상관람가"
        // Or just take the first statistically reasonable one? 
        // The first match in the file might be from the main metadata.

        // Let's refine the regex relative to keywords like "관람등급"
        const kobisRegex = /관람등급\s*([0-9]+세|전체|청소년)(?:이상)?\s*(관람가|관람불가)/;
        const kobisMatch = html.match(kobisRegex);

        if (kobisMatch) {
            console.log("KOBIS Match Found:", kobisMatch[0]);
            extractedGrade = kobisMatch[0].replace("관람등급", "").trim();
        } else {
            // Fallback to simple first match
            extractedGrade = matches[0][0];
        }
    }

    console.log("Final Extracted Grade:", extractedGrade);

} catch (err) {
    console.error("Error reading file:", err);
}

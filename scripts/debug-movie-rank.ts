import { getAllPerformances } from '../src/lib/performance-data';
import { transformPerformance } from '../src/lib/data-transformer';
import fs from 'fs';

async function test() {
    console.log("Testing Movie Rank Retention...");
    const movies = JSON.parse(fs.readFileSync('src/data/movies.json', 'utf8'));
    console.log(`Raw movies count: ${movies.length}`);
    console.log(`Raw movies with ranks: ${movies.filter(m => m.rank != null).length}`);

    const transformed = movies.map(m => transformPerformance(m, 'movie'));
    console.log(`Transformed movies with ranks: ${transformed.filter(t => t.rank != null).length}`);

    const all = await getAllPerformances('ko', true);
    const resultMovies = all.filter(p => p.genre === 'movie');
    console.log(`Result movies count: ${resultMovies.length}`);
    console.log(`Result movies with ranks: ${resultMovies.filter(m => m.rank != null).length}`);
    
    if (resultMovies.length > 0 && resultMovies.filter(m => m.rank != null).length === 0) {
        console.log("CRITICAL: Ranks lost during getAllPerformances!");
        
        // Let's check a sample movie that should have a rank
        const targetTitle = movies.find(m => m.rank === 1)?.title;
        console.log(`Target movie for rank 1: ${targetTitle}`);
        const found = resultMovies.find(m => m.title === targetTitle);
        console.log(`Found in result: ${!!found}`);
        if (found) {
            console.log(`Rank in result: ${found.rank}`);
            console.log("Details:", JSON.stringify(found, null, 2));
        }
    }
}

test();

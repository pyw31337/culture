
import * as fs from 'fs';
import * as path from 'path';

const MOVIES_PATH = path.resolve(process.cwd(), 'src/data/movies.json');
const POSTERS_DIR = path.resolve(process.cwd(), 'public/images/posters/movies');

function repairMovieData() {
    console.log('Repairing movie data...');
    if (!fs.existsSync(MOVIES_PATH)) {
        console.error('movies.json not found!');
        return;
    }

    const movies = JSON.parse(fs.readFileSync(MOVIES_PATH, 'utf-8'));
    const posterFiles = fs.readdirSync(POSTERS_DIR);

    const repairedMovies = movies.map((movie: any) => {
        // 1. Map runtime to runningTime
        if (movie.runtime && !movie.runningTime) {
            movie.runningTime = `${movie.runtime}분`;
        }

        // 2. Fix image paths
        // Many paths like "/images/posters/movies/왕과_사는_남" are truncated.
        // We search for the actual file in the directory.
        if (movie.image && movie.image.startsWith('/images/posters/movies/')) {
            const basename = movie.title.replace(/\s+/g, '_');
            const possibleMatches = posterFiles.filter(f => f.includes(basename) || f.includes(movie.id.replace('movie_', '')));
            
            if (possibleMatches.length > 0) {
                // Pick the best match (shortest length or specific pattern)
                const bestMatch = possibleMatches.sort((a, b) => a.length - b.length)[0];
                movie.image = `/images/posters/movies/${bestMatch}`;
            } else {
                // Fallback: If literal title match fails, try to find by ID
                const idPart = movie.id.split('_').slice(1).join('_');
                const idMatch = posterFiles.find(f => f.includes(idPart));
                if (idMatch) {
                    movie.image = `/images/posters/movies/${idMatch}`;
                }
            }
        }

        // 3. Fix truncated synopsis if needed (though usually okay)
        if (movie.synopsis && movie.synopsis.endsWith('...')) {
            // Keep as is for now, but we could try to re-scrape if critical
        }

        return movie;
    });

    fs.writeFileSync(MOVIES_PATH, JSON.stringify(repairedMovies, null, 2));
    console.log(`Repaired ${repairedMovies.length} movies.`);
}

repairMovieData();

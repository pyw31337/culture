import { Performance, MoviePerformance, SportsPerformance, ClassPerformance, MuseumPerformance, BasePerformance } from '@/types';

export function isMovie(perf: Performance): perf is MoviePerformance {
    return perf.genre === 'movie';
}

export function isSports(perf: Performance): perf is SportsPerformance {
    return ['sports', 'baseball', 'football', 'basketball', 'volleyball', 'soccer'].includes(perf.genre);
}

export function isClass(perf: Performance): perf is ClassPerformance {
    return perf.genre === 'class';
}

export function isMuseum(perf: Performance): perf is MuseumPerformance {
    return perf.genre === 'exhibition' || perf.genre === 'museum';
}

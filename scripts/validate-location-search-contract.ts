import fs from 'node:fs';
import path from 'node:path';
import { buildLocalLocationCandidates } from '../src/lib/location-search';
import type { Performance } from '../src/types';

const dataPath = path.join(process.cwd(), 'public/data/performances.json');
const performances = JSON.parse(fs.readFileSync(dataPath, 'utf8')) as Performance[];

const guriCandidates = buildLocalLocationCandidates(performances, '구리');
if (guriCandidates.length === 0) {
    throw new Error('Location fallback must return venue/address candidates for "구리".');
}

const invalidGuriCandidate = guriCandidates.find((candidate) => {
    const target = `${candidate.name} ${candidate.address || ''} ${candidate.category || ''}`;
    return !target.includes('구리');
});
if (invalidGuriCandidate) {
    throw new Error(`Location fallback leaked a non-location candidate for "구리": ${invalidGuriCandidate.name}`);
}

const psyLocationCandidates = buildLocalLocationCandidates(performances, '싸이');
if (psyLocationCandidates.length > 0) {
    throw new Error('Location fallback must not search performance titles/artist keywords such as "싸이".');
}

const duplicateLeadingGuri = guriCandidates.find((candidate) => {
    return /^구리\s+구리/.test(candidate.name) || /^구리\s+구리/.test(candidate.address || '');
});
if (duplicateLeadingGuri) {
    throw new Error(`Location fallback must collapse duplicated leading "구리": ${duplicateLeadingGuri.name}`);
}

console.log(`[location-search] 구리 fallback candidates: ${guriCandidates.length}`);

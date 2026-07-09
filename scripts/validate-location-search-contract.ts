import fs from 'node:fs';
import path from 'node:path';
import { buildLocalLocationCandidates, performanceMatchesLocationQuery } from '../src/lib/location-search';
import type { Performance } from '../src/types';

const dataPath = path.join(process.cwd(), 'public/data/performances.json');
const performances = JSON.parse(fs.readFileSync(dataPath, 'utf8')) as Performance[];

const guriCandidates = buildLocalLocationCandidates(performances, '구리');
if (guriCandidates.length === 0) {
    throw new Error('Location fallback must return venue/address candidates for "구리".');
}

const guriSicheongCandidates = buildLocalLocationCandidates(performances, '구리시청');
if (guriSicheongCandidates.length === 0) {
    throw new Error('Location fallback must return venue/address candidates for "구리시청".');
}
const firstGuriSicheong = guriSicheongCandidates[0];
if (firstGuriSicheong.name !== '구리시청') {
    throw new Error(`Location fallback candidate name for "구리시청" must be exactly "구리시청", got: ${firstGuriSicheong.name}`);
}
if (Math.abs(firstGuriSicheong.lat - 37.5944) > 0.0001 || Math.abs(firstGuriSicheong.lng - 127.1296) > 0.0001) {
    throw new Error(`Location fallback coordinates for "구리시청" are incorrect: lat=${firstGuriSicheong.lat}, lng=${firstGuriSicheong.lng}`);
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

const falsePositiveGuriCandidate = guriCandidates.find((candidate) =>
    /개구리|강구리|대게거리/.test(`${candidate.name} ${candidate.address || ''}`),
);
if (falsePositiveGuriCandidate) {
    throw new Error(`Location fallback must not match embedded non-location words for "구리": ${falsePositiveGuriCandidate.name}`);
}

const guriLocationMatches = performances.filter((performance) => performanceMatchesLocationQuery(performance, '구리'));
if (guriLocationMatches.length === 0) {
    throw new Error('Location text fallback must return content whose venue/address/district/region matches "구리".');
}

const falsePositiveGuriMatch = guriLocationMatches.find((performance) =>
    /개구리|강구리|대게거리/.test(`${performance.title || ''} ${performance.venue || ''} ${performance.address || ''}`),
);
if (falsePositiveGuriMatch) {
    throw new Error(`Location text fallback must not match embedded non-location words for "구리": ${falsePositiveGuriMatch.title}`);
}

const psyTitleOnly = performances.find((performance) => {
    const title = String(performance.title || '').replace(/\s+/g, '');
    const locationFields = `${performance.venue || ''} ${performance.address || ''} ${performance.district || ''} ${performance.region || ''}`;
    return title.includes('싸이') && !locationFields.includes('싸이');
});
if (psyTitleOnly && performanceMatchesLocationQuery(psyTitleOnly, '싸이')) {
    throw new Error('Location text fallback must not match title-only keywords such as "싸이".');
}

console.log(`[location-search] 구리 fallback candidates: ${guriCandidates.length}`);
console.log(`[location-search] 구리 text fallback matches: ${guriLocationMatches.length}`);

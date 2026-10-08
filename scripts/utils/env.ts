/**
 * Shared secret/env loader for scrapers and maintenance scripts.
 *
 * API keys must never be committed. Locally put them in `.env.local`
 * (see `.env.example`); in GitHub Actions they come from repository secrets.
 */
import fs from 'fs';
import path from 'path';

let loaded = false;

function loadLocalEnvFile(fileName: string) {
    const filePath = path.join(process.cwd(), fileName);
    if (!fs.existsSync(filePath)) return;
    fs.readFileSync(filePath, 'utf8')
        .split(/\r?\n/)
        .forEach((line) => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) return;
            const separatorIndex = trimmed.indexOf('=');
            if (separatorIndex <= 0) return;
            const key = trimmed.slice(0, separatorIndex).trim().replace(/^export\s+/, '');
            const rawValue = trimmed.slice(separatorIndex + 1).trim();
            if (!key || process.env[key]) return;
            process.env[key] = rawValue.replace(/^['"]|['"]$/g, '');
        });
}

export function loadLocalEnv() {
    if (loaded) return;
    loaded = true;
    loadLocalEnvFile('.env');
    loadLocalEnvFile('.env.local');
}

export const SECRET_ENV_DOCS: Record<string, string> = {
    KOPIS_API_KEY: 'KOPIS 공연예술통합전산망 OpenAPI 서비스키 (https://www.kopis.or.kr/por/cs/openapi/openApiInfo.do)',
    KOBIS_API_KEY: 'KOBIS 영화진흥위원회 OpenAPI 키 (https://www.kobis.or.kr/kobisopenapi/)',
    TMDB_API_KEY: 'TMDB API v3 키 (https://www.themoviedb.org/settings/api)',
    KCISA_API_KEY: '문화포털(KCISA) 문화정보 OpenAPI 서비스키 (https://www.culture.go.kr/data/)',
    KAKAO_REST_API_KEY: 'Kakao Developers REST API 키 (로컬 Mac mini 전용, IP 제한)',
};

/** Returns the first non-empty value among `name` and its aliases. */
export function optionalEnv(name: string, aliases: string[] = []): string | undefined {
    loadLocalEnv();
    for (const key of [name, ...aliases]) {
        const value = process.env[key]?.trim();
        if (value) return value;
    }
    return undefined;
}

/** Throws a clear, actionable error when a required secret is missing. */
export function requireEnv(name: string, aliases: string[] = []): string {
    const value = optionalEnv(name, aliases);
    if (value) return value;
    const doc = SECRET_ENV_DOCS[name] ? ` — ${SECRET_ENV_DOCS[name]}` : '';
    const names = [name, ...aliases].join(' / ');
    throw new Error(
        `[env] Missing required environment variable ${names}${doc}. `
        + 'Set it in .env.local for local runs (cp .env.example .env.local) '
        + 'or as a GitHub Actions repository secret for CI.',
    );
}

/** Kakao REST key (KAKAO_REST_API_KEY, legacy alias KAKAO_LOCAL_REST_API_KEY). */
export function requireKakaoRestKey(): string {
    return requireEnv('KAKAO_REST_API_KEY', ['KAKAO_LOCAL_REST_API_KEY']);
}

# Culture Flow

한국 공연·전시·영화·스포츠·체험 일정을 여러 공식/티켓 소스에서 모아  
한곳에서 탐색할 수 있게 하는 **정적(Next.js export) 문화 일정 서비스**입니다.

- 라이브: https://pyw31337.github.io/culture/
- 저장소: https://github.com/pyw31337/culture/

---

## 기술 스택

- **Next.js** (App Router, `output: 'export'`) + React 19
- **Tailwind CSS 4** + PWA (`next-pwa`)
- 데이터: `src/data/*.json` → `npm run generate-data` → `public/data/*.json`
- 수집: TypeScript/Node 스크래퍼 (Playwright / Puppeteer / HTTP API)
- 배포: GitHub Pages (`basePath: /culture`)
- 갱신: 로컬 Mac mini 자정 잡(primary) + GitHub Actions 03:00 KST 폴백

---

## 빠른 시작

```bash
git clone https://github.com/pyw31337/culture.git
cd culture
npm install
npm run dev
```

브라우저에서 http://localhost:3000 을 엽니다.  
(프로덕션과 동일하게 보려면 `basePath` 없는 dev 모드가 기본입니다.)

---

## 주요 npm 스크립트

| 스크립트 | 설명 |
|----------|------|
| `npm run dev` | 로컬 개발 서버 |
| `npm run generate-data` | 소스 JSON → public 데이터 생성 |
| `npm run build` | 전체 파이프라인 + static export |
| `npm run build:site` | 포스터 prune 후 사이트만 빌드 |
| `npm run validate:content` | 콘텐츠 품질 검사 |
| `npm run validate:locations` | 위치/좌표 정합성 |
| `npm run audit:stability` | 서비스 안정성 리포트 |
| `npx tsx scripts/report-scraper-health.ts` | 소스별 신선도/헬스 |
| `npx tsx scripts/fix-region-mismatches.ts` | region 정규화 리포트 (`--write` 시 수정) |

개별 스크래퍼 예:

```bash
npx tsx scripts/scrape-movies.ts
npx tsx scripts/scrape-kbo.ts
```

---

## 데이터 갱신 구조

1. **Primary**: 로컬 `launchd` / `npm run local:update-data` (자정 KST 권장)
2. **Fallback**: `.github/workflows/daily-update.yml` (로컬 데이터가 신선하면 스킵)
3. 스크래퍼 실패 시 기존 `src/data` 체크포인트 유지 → validation이 게시 가능 여부 판단
4. 실패 내역은 `ERROR_TRACKER.md`에 누적

상세 복구 절차: [REMEDIATION.md](./REMEDIATION.md)

---

## 디렉터리 개요

```
src/app/          # 페이지 (홈, 장르, 지도, 달력, 상세, status)
src/components/   # UI
src/lib/          # 필터, 지역, venue, 데이터 로더
src/data/         # 스크래퍼 산출 JSON (소스 오브 트루스)
scripts/          # 스크래퍼, validate, audit, generate
public/data/      # 빌드 산출 (페이지가 fetch)
.github/workflows # daily-update, deploy
```

---

## 품질 / 안정화 원칙

1. **Region id는 canonical** (`seoul`, `gyeonggi`, …) — `src/lib/region-normalize.ts`
2. **Venue는 dictionary + normalizer** — 임의 문자열 최소화
3. **스크래퍼는 soft-fail** — 한 소스 실패가 전체 배포를 막지 않음 (critical 소스만 hard)
4. **디버그 산출물은 커밋 금지** — `scripts/cleanup-repo-junk.sh` + `.gitignore`
5. **시크릿은 GitHub Secrets / 로컬 env만** — 루트에 키 파일 두지 않음

정책 문서:

- [docs/SCRAPER_STABILITY.md](./docs/SCRAPER_STABILITY.md)
- [docs/REGION_VENUE_POLICY.md](./docs/REGION_VENUE_POLICY.md)
- [docs/BUILD_POLICY.md](./docs/BUILD_POLICY.md)

---

## 기여 / 이어서 작업

다른 머신에서 이어갈 때: [RESUME_GUIDE.md](./RESUME_GUIDE.md)

```bash
git pull
npm install
npm run generate-data
npx tsx scripts/validate-location-integrity.ts
```

---

## 라이선스 / 데이터 고지

개인 프로젝트입니다. 각 티켓·공연 사이트의 이용약관과 robots 정책을 존중하며,  
수집 데이터는 일정 탐색 목적의 메타데이터 중심으로 사용합니다. 상세 예매는 원 사이트로 연결됩니다.

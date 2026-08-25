# Culture Flow 개선사항 적용 가이드

이전 리뷰에서 도출한 개선점을 **우선순위 순서대로 전부** 적용하기 위한 가이드입니다.
아래 파일들을 로컬 저장소(`CultureFlow-New` 또는 `culture`) 루트에 복사/병합한 뒤 순서대로 실행하세요.

---

## P0-1. 저장소 위생 (Repo Hygiene)

### 1) 민감 파일 즉시 처리
```bash
# oracle_key 가 실제 키/시크릿이면 GitHub에서 즉시 revoke 후 삭제
git rm -f oracle_key
# 히스토리에 남아 있을 수 있으므로 필요 시 git filter-repo 또는 BFG 검토
```

### 2) 정크 파일 일괄 제거
```bash
chmod +x scripts/cleanup-repo-junk.sh
./scripts/cleanup-repo-junk.sh
# 스크립트가 git rm --cached 대상 목록을 출력하고 실행합니다.
git add -A
git commit -m "chore: remove debug artifacts, logs, and binary junk from repo"
```

### 3) .gitignore 교체/병합
`docs/gitignore.patch` 내용을 기존 `.gitignore`에 반영하거나
제공된 `.gitignore` 전체로 교체하세요.

---

## P0-2. 스크래퍼 안정성

### 1) 공통 유틸 강화
- `scripts/utils/scraper-utils.ts` → 제공 버전으로 교체/병합
  (타임아웃 래퍼, 헬스 기록, region normalize 강제)

### 2) 헬스 리포트
```bash
npx tsx scripts/report-scraper-health.ts
# public/data/scraper-health.json 생성
```

### 3) Interpark 등 반복 실패 소스
- `docs/SCRAPER_STABILITY.md` 의 체크리스트대로 selector/timeout 점검
- CI 폴백은 이미 shallow mode 이므로, **로컬 자정 잡**이 성공하는지 먼저 확인

---

## P1-1. Venue / Region 정규화

### 1) region canonical helper 추가
```bash
cp src/lib/region-normalize.ts <repo>/src/lib/region-normalize.ts
```

### 2) 데이터 생성 파이프라인에서 강제 적용
- `scripts/generate-performance-json.ts` 및 merger 경로에서
  `normalizeRegionId()` / `normalizeRegionLabel()` 호출
- 상세: `docs/REGION_VENUE_POLICY.md`

```bash
npx tsx scripts/fix-region-mismatches.ts   # soft fix 후보 리포트
npx tsx scripts/validate-location-integrity.ts
```

---

## P1-2. 스크래퍼 공통 프레임워크 + 헬스 메트릭

- `scripts/utils/scraper-runner.ts` 추가 (공통 run wrapper)
- `scripts/report-scraper-health.ts` 로 소스별 성공시각/건수 집계
- `/status` 페이지에서 `scraper-health.json` 소비 (선택)

---

## P2-1. 타입 정리 + README

```bash
# 타입은 하위 호환을 위해 확장 필드를 유지하면서 구조화
cp src/types.ts <repo>/src/types.ts   # 또는 병합
cp README.md <repo>/README.md
```

`package.json` name 변경:
```json
"name": "culture-flow"
```

---

## P2-2. 빌드 정책 명확화

- `docs/BUILD_POLICY.md` 참고
- `package.json` scripts 에 soft/hard validate 분리 예시 반영

```bash
npm run validate:content          # soft (경고)
npm run audit:stability           # hard (실패 시 배포 중단 여부 정책에 따름)
```

---

## 적용 후 검증 체크리스트

1. `npm run lint`
2. `npx tsx scripts/validate-content-quality.ts`
3. `npx tsx scripts/validate-location-integrity.ts`
4. `npx tsx scripts/audit-service-stability.ts`
5. `npm run generate-data` (로컬에서 시간 여유 있을 때)
6. `npm run dev` 로 홈/지도/달력 스모크 테스트
7. `git status` 에 debug/에러 산출물이 없는지 확인

---

## 파일 목록

| 경로 | 설명 |
|------|------|
| `scripts/cleanup-repo-junk.sh` | 정크 파일 제거 |
| `.gitignore` | 강화된 ignore |
| `src/lib/region-normalize.ts` | region 단일 정규화 |
| `scripts/utils/scraper-utils.ts` | 공통 스크래퍼 유틸 강화 |
| `scripts/utils/scraper-runner.ts` | 공통 실행 래퍼 |
| `scripts/report-scraper-health.ts` | 소스 헬스 리포트 |
| `scripts/fix-region-mismatches.ts` | region mismatch soft fix 리포트 |
| `src/types.ts` | 구조화된 Performance 타입 |
| `README.md` | 프로젝트 문서 |
| `docs/SCRAPER_STABILITY.md` | 스크래퍼 안정화 가이드 |
| `docs/REGION_VENUE_POLICY.md` | region/venue 정책 |
| `docs/BUILD_POLICY.md` | 빌드/검증 정책 |
| `package.json.patch` | name/scripts 패치 메모 |

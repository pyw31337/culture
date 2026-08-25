# 빌드 / 검증 정책

## 파이프라인 단계

```
[scrapers] → src/data/*.json
    → generate-data          # public/data 생성
    → cache:posters          # 원격 포스터 로컬화 (한도 있음)
    → generate:thumbs
    → validate:* (soft/hard)
    → audit:stability
    → next build --webpack   # static export → out/
    → deploy (GitHub Pages)
```

## Soft vs Hard 게이트

| 단계 | 기본 정책 | 실패 시 |
|------|-----------|---------|
| optional scraper | soft | 기존 데이터 유지, 경고 |
| critical scraper | soft+retry | 체크포인트 복구, ERROR_TRACKER 기록 |
| validate:content | soft | 리포트, 배포는 계속 가능 |
| validate:locations | soft→hard 전환 권장 | 좌표/region 치명 이슈 시 배포 중단 검토 |
| audit:stability | soft 리포트 | 지표만 기록 |
| generate-data 자체 실패 | **hard** | 배포 중단 |
| next build 실패 | **hard** | 배포 중단 |

GitHub fallback 워크플로는 의도적으로 **스크래퍼 실패를 job failure로 올리지 않습니다.**  
게시 가능 여부는 validation / data integrity 가 결정합니다.

## 권장 package.json 스크립트 분리

```json
{
  "scripts": {
    "validate:soft": "npx tsx scripts/validate-content-quality.ts && npx tsx scripts/report-scraper-health.ts",
    "validate:hard": "npx tsx scripts/validate-location-integrity.ts && npx tsx scripts/validate-display-integrity.ts",
    "build:data": "npm run generate-data && npm run cache:posters && npm run generate:thumbs",
    "build:site": "npm run prune:posters && next build --webpack",
    "build": "npm run build:data && npm run validate:soft && npm run validate:hard && npm run audit:stability && npm run build:site"
  }
}
```

로컬에서 빠른 사이트만 확인할 때:

```bash
npm run generate-data
npm run build:site
```

## 포스터 캐시

- `POSTER_CACHE_MAX_NEW_DOWNLOADS` 로 일일 한도 제한 (CI는 낮게, 로컬은 높게)
- `prune:posters` 로 미참조 파일 제거 — 저장소/Pages 용량 관리에 필수

## 산출물 커밋 정책

- `public/data/*.json` : 데이터 갱신 시 커밋 (서비스 소스)
- `src/data/*.json` : 스크래퍼 산출, 커밋
- debug 덤프, QUALITY_REPORT 대용량, PSD, zip : **커밋 금지**
- `public/data/scraper-health.json`, `region-mismatch-report.json` : 커밋 가능 (운영 가시성)

## 타임아웃 (참고)

- GitHub job: ~70분
- 개별 critical scraper: ~480s
- optional budget: ~1200s 누적

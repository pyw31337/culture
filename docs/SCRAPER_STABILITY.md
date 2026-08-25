# 스크래퍼 안정화 가이드

## 목표

- 개별 소스 실패가 **전체 서비스 다운**으로 이어지지 않게 한다.
- 실패 원인(셀렉터 변경, 타임아웃, 0건)을 빠르게 구분한다.
- 로컬 primary / GitHub fallback 역할을 명확히 유지한다.

## 실행 모델

| 환경 | 역할 | 깊이 |
|------|------|------|
| 로컬 Mac mini (자정) | Primary full refresh | 상세 enrichment 제한 완화 |
| GitHub Actions 03:00 KST | Fallback (로컬 신선하면 스킵) | shallow (`INTERPARK_FAST_MODE` 등) |

`scripts/scraper-plan.json` 의 `local` / `github` 플랜이 소스 목록과 priority를 정의합니다.

## Critical vs Optional

- **critical**: 실패 시 재시도, 체크포인트 복구 후에도 실패하면 경고 + 기존 데이터 유지
- **optional**: fallback 예산 초과 시 스킵 가능

권장 critical 예: `movies`, `interpark`(또는 kopis), `kbo`, `build-venues`, `mochaclass`  
나머지는 optional로 두고 헬스 대시보드로 모니터링.

## 공통 래퍼 사용법

```ts
import { runScraperJob } from './utils/scraper-runner';
import { saveJson, filterValidPerformances } from './utils/scraper-utils';

await runScraperJob({
  name: 'example',
  timeoutMs: 480_000,
  run: async () => {
    const items = await scrape();
    const valid = filterValidPerformances(items, 'example');
    saveJson('example.json', valid);
    return { itemCount: valid.length };
  },
});
```

## 0건 / 레이아웃 변경 대응

1. `npx tsx scripts/troubleshoot-scraper.ts <name>` (있으면 사용)
2. 브라우저로 원 페이지 열어 selector 재확인
3. 타임아웃·concurrency 환경변수 조정 (daily-update.yml 참고)
4. 수정 후 로컬 단독 실행 → `validate:*` → 커밋

## 헬스 리포트

```bash
npx tsx scripts/report-scraper-health.ts
# → public/data/scraper-health.json
```

`freshness`: `fresh` | `aging` | `stale` | `missing`  
status 페이지 또는 운영 알림에서 이 파일을 소비하세요.

## 금지 사항

- 실패한 스크래퍼가 빈 배열로 **성공 파일을 덮어쓰지 않기** (체크포인트 복구 유지)
- 디버그 HTML/PNG를 저장소에 커밋하지 않기
- CI에서 Kakao API 등 IP 제한 API 호출하지 않기 (`DISABLE_KAKAO_API=1`)

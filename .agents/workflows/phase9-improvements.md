---
description: Phase 9 코드 품질 & UX 개선 작업 이어서 진행하기
---

# Phase 9: CultureFlow Code Quality & UX Improvement

## 🚨 이 문서를 먼저 읽으세요 (Claude ↔ Gemini 전환 시)

이 워크플로우는 **Claude와 Gemini 사이 세션 전환 시** 작업 연속성을 보장하기 위해 작성되었습니다.

---

## 1단계: 현재 진행 상황 확인

// turbo
```bash
cat /Users/pyw31337/.gemini/antigravity/brain/618f310d-1ac5-4e72-9dfc-59d7759d36fe/task.md | grep -A2 "Phase 9"
```

위 명령으로 Phase 9의 체크리스트 상태를 확인하세요:
- `[ ]` = 미착수
- `[/]` = 진행 중
- `[x]` = 완료

## 2단계: 구현 계획서 확인

// turbo
```bash
cat /Users/pyw31337/.gemini/antigravity/brain/618f310d-1ac5-4e72-9dfc-59d7759d36fe/implementation_plan.md
```

5개 스프린트로 나뉘어져 있습니다. **순서대로 진행**하세요:
1. 스프린트 1: 긴급 버그 수정 (영화 예매 링크, HighlightText, useMemo)
2. 스프린트 2: 성능 최적화 (500ms 지연, sessionStorage, require())
3. 스프린트 3: i18n 완성 (가격 '무료', 공유 API, toMobileUrl)
4. 스프린트 4: 기능 개선 (추천 로직, 배지 분리)
5. 스프린트 5: 리팩토링 (타입 강화, 컴포넌트 분할)

## 3단계: 코드 감사 보고서 참조

// turbo
```bash
cat /Users/pyw31337/.gemini/antigravity/brain/618f310d-1ac5-4e72-9dfc-59d7759d36fe/site_audit.md
```

각 항목의 상세 분석, 현재 코드, 문제점이 기록되어 있습니다.

## 4단계: 진행 중인 스프린트 작업

각 스프린트 진행 시:

1. `task.md`에서 해당 항목을 `[/]`로 변경
2. `implementation_plan.md`의 코드 변경사항을 그대로 적용
3. 완료 후 `[x]`로 변경
4. 스프린트 전체 완료 시 커밋

## 5단계: 스프린트 완료 후 커밋

// turbo
```bash
cd /Users/pyw31337/Developer/CultureFlow-New && git add -A && git commit -m "COMMIT_MSG" && git push
```

커밋 메시지 형식:
- 스프린트 1: `fix: critical UX bugs — movie link, highlight, useMemo deps`
- 스프린트 2: `perf: remove data load delay, optimize sessionStorage parsing`
- 스프린트 3: `feat: complete i18n — free price, web share API, mobile URLs`
- 스프린트 4: `feat: real recommendations, separate like/venue badges`
- 스프린트 5: `refactor: type safety, component structure`

## 6단계: 검증

// turbo
```bash
cd /Users/pyw31337/Developer/CultureFlow-New && npx tsc --noEmit 2>&1 | tail -5
```

// turbo
```bash
cd /Users/pyw31337/Developer/CultureFlow-New && npm run build 2>&1 | tail -10
```

---

## 핵심 파일 위치 참조

| 파일 | 역할 |
|---|---|
| `src/components/ContentDetailView.tsx` | 상세 페이지 (영화 예매 링크) |
| `src/components/performance/PerformanceListItem.tsx` | 리스트 카드 (HighlightText, 가격) |
| `src/components/PerformanceList.tsx` | 메인 오케스트레이터 (추천) |
| `src/components/BottomNav.tsx` | 하단 네비 (배지) |
| `src/components/ImageWithFallback.tsx` | 이미지 Fallback |
| `src/hooks/usePerformanceData.ts` | 데이터 로딩 (500ms 지연) |
| `src/hooks/usePerformanceFilters.ts` | 필터 (sessionStorage, useMemo) |
| `src/lib/utils.ts` | 유틸 (가격, 날짜, URL) |

## 프로젝트 빌드 명령어

| 명령 | 용도 |
|---|---|
| `npm run dev` | 개발 서버 |
| `npm run build` | 프로덕션 빌드 (데이터 생성 포함) |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | 타입 체크 |
| `npm run generate-data` | 로케일별 데이터 JSON 생성 |

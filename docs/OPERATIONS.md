# Culture Flow — 운영 가이드

## 자동 파이프라인
- Daily Data Update: 로컬(Mac) 우선, GitHub Actions fallback
- Deploy to GitHub Pages: main push 시 build:site:ci (poster prune 없음)
- validate: content / details / search / locations / display / stability

## 스크래퍼 안전 규칙
- atomicWriteJsonPreserve: 빈 배열이고 기존 파일이 비어 있지 않으면 덮어쓰지 않음
- 의도적 비우기: SCRAPE_ALLOW_EMPTY=1
- KOVO 시즌: API probe 자동 (KOVO_SEASONS=023,024 로 강제 가능)
- K리그 연도: getFullYear() (KLEAGUE_YEAR=2026 로 강제 가능)

## 이미지
- prune 후 깨진 로컬 경로 → 장르 fallback
- 영화: /images/fallbacks/movie.svg
- 스포츠: baseball/basketball/volleyball/soccer/handball fallback

## 알림
- Deploy 실패 시 notify-failure job
- GitHub Settings → Notifications → Actions 에서 Failed workflow 수신 설정

## 로컬 일상 명령
npm run generate-data
npm run validate:content

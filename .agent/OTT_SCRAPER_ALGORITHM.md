# OTT Scraper Algorithm Documentation

> **Version**: v1.0.0-ott-perfect (2026-01-21)
> **Status**: 🏆 Gold Standard - DO NOT MODIFY

---

## Overview

이 문서는 완벽한 OTT 스크래핑 알고리즘을 기록합니다.
향후 모든 데일리 업데이트는 이 알고리즘을 사용합니다.

---

## Algorithm Summary

### 1. 날짜 추출 (오픈/개봉)

```typescript
// .info_group 내 "오픈" 또는 "개봉" 레이블에서 날짜 추출
const infoGroups = document.querySelectorAll('.info_group');
infoGroups.forEach(g => {
    const dt = g.querySelector('dt');
    const dd = g.querySelector('dd');
    if (dt && dd) {
        const label = dt.textContent?.trim() || '';
        if (label === '오픈' || label === '개봉') {
            const raw = dd.textContent?.trim() || '';
            const match = raw.match(/(\d{4})\.(\d{2})\.(\d{2})/);
            if (match) res.releaseDate = `${match[1]}-${match[2]}-${match[3]}`;
        }
    }
});
```

### 2. 출연진 추출 (컨테이너 스코핑 + 역할 레이블)

```typescript
// "출연진" 제목이 있는 컨테이너에서만 추출
const allContentAreas = Array.from(document.querySelectorAll('.cm_content_area, .api_subject_bx'));
const castContainer = allContentAreas.find(area => {
    const title = area.querySelector('h2, h3, .cm_title')?.textContent?.trim();
    return title && (title.includes('출연진') || title.includes('출연') || title.includes('제작진'));
});

if (castContainer) {
    castContainer.querySelectorAll('.card_item, .area_card, li, a.inner, .item').forEach(el => {
        const fullText = el.textContent?.trim() || '';
        // "출연" 또는 "감독" 역할 레이블이 있는 항목만 추출
        if (fullText.includes('출연') || fullText.includes('감독') || fullText.includes('연출')) {
            // ... name extraction logic
        }
    });
}
```

### 3. 이미지 404 처리

```typescript
// 404 에러 시 빈 문자열 반환 → 프론트엔드 플레이스홀더 사용
if (statusCode === 404) {
    console.warn(`[Image] 404 Not Found: ${url} - using empty fallback`);
    return '';
}
```

---

## Verified Results

| 항목 | 날짜 | 출연진 |
|------|------|--------|
| 무빙 | 2023-08-09 | 류승룡, 한효주, 조인성, 차태현, 류승범, 김성균, 김희원, 문성근 |
| 폭군 | 2024-08-14 | 차승원, 김선호, 김강우, 조윤수 |
| 러브 미 | 2026-01-21 | 서현진, 유재명, 이시우, 윤세아, 장률, 다현 |

---

## Restoration Guide

```bash
# 태그에서 스크래퍼 복원
git checkout v1.0.0-ott-perfect -- scripts/scrape-ott.ts

# 전체 태그 체크아웃
git checkout v1.0.0-ott-perfect
```

---

## Files Covered

- `scripts/scrape-ott.ts` - 메인 스크래퍼 (524줄)
- `scripts/utils/image-processor.ts` - 이미지 처리 (96줄)

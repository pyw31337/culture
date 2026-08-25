# Region / Venue 정책

## Region

### Canonical ID

모든 저장·필터·지도 로직은 **canonical id**를 사용합니다.

| id | label |
|----|-------|
| seoul | 서울 |
| busan | 부산 |
| daegu | 대구 |
| incheon | 인천 |
| gwangju | 광주 |
| daejeon | 대전 |
| ulsan | 울산 |
| sejong | 세종 |
| gyeonggi | 경기 |
| gangwon | 강원 |
| chungbuk | 충북 |
| chungnam | 충남 |
| jeonbuk | 전북 |
| jeonnam | 전남 |
| gyeongbuk | 경북 |
| gyeongnam | 경남 |
| jeju | 제주 |

헬퍼: `src/lib/region-normalize.ts`

- `normalizeRegionId()` — 입력 → id
- `normalizeRegionLabel()` — 표시용 한글
- `regionIdFromAddress()` — 주소에서 추론
- `resolveRegion(region, address)` — mismatch 시 주소 우선
- `isRegionAddressMismatch()`

### 규칙

1. 스크래퍼 저장 직전 `applyRegionCanonical` / `filterValidPerformances` 적용
2. UI 필터는 id 기준 (`region-selection.ts` 와 동일 계열)
3. `서울` / `seoul` / `서울특별시` 혼재를 허용하지 않고 저장 시 정규화
4. address와 region이 충돌하면 **address 파생 region을 채택**하고 리포트에 남김

### 일괄 수정

```bash
# 리포트만
npx tsx scripts/fix-region-mismatches.ts

# src/data 에 반영
npx tsx scripts/fix-region-mismatches.ts --write
npx tsx scripts/validate-location-integrity.ts
```

---

## Venue

1. `VenueNormalizer` + `src/data/venue-dictionary.json` 이 1차 진실
2. 스크래퍼는 가능한 한 `venueKey` / `venueCanonicalId` 를 채움
3. 좌표는 venue master / place enrich 단계에서 보강
4. 판매사 본사 주소(seller address)는 공연 장소로 쓰지 않음 (`location-display` 의 seller 패턴)

### 의심 신호 (QUALITY_REPORT)

- `REGION_ADDRESS_MISMATCH` → region normalize + address 재검토
- `SUSPICIOUS_VENUE_DENSITY` → 동일 venue 문자열 과다; dictionary 병합 또는 홀 단위 분리

### 권장 운영 주기

- 주 1회: `fix-region-mismatches.ts --write` + location validate
- 소스 대량 변경 후: `audit:venues:canonical`

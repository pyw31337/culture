# Stable Crawler Backup v1 (2026-01-22)

This directory contains a snapshot of the stable crawling algorithms for Movies and OTT as of January 22, 2026.

## Contents
- `scrape-movies.ts`: Movie crawler with stable image filename logic.
- `scrape-ott.ts`: OTT crawler with stable image filename logic and localized search.
- `utils/image-processor.ts`: Core image processing utility (WebP conversion, hash checking).
- `localize-ott-images.ts`: Migration script for stabilizing existing OTT images.
- `validate-images.ts`: Validation script to ensure all image links are valid.

## Restoration
To restore these versions, simply copy them back to the `scripts/` directory:
```bash
cp scripts/backups/stable-v1/*.ts scripts/
# Note: utils/image-processor.ts needs to go to scripts/utils/
cp scripts/backups/stable-v1/image-processor.ts scripts/utils/
```

## Git Tag
This state is also preserved with the git tag: `stable-crawler-v1`

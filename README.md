# CultureFlow (Culture & Sports Information Platform)

CultureFlow is a modern web application that provides real-time information and personalized recommendations for culture, sports, and entertainment events across Korea.

## Core Features
- **Comprehensive Listings**: Movies, Theater, Concerts, Sports (KBO, KBL, KOVO, K-League), Class, and Exhibitions.
- **Multilingual Support**: Fully localized in Korean (KR), English (EN), Chinese (CN), and Japanese (JP).
- **Location-Based Discovery**: Interactive maps and region-specific filtering.
- **Dynamic Content**: Daily data updates via automated scrapers.

## Technology Stack
- **Frontend**: Next.js 16 (React 19), Tailwind CSS, Framer Motion.
- **State Management**: Next-intl for i18n, Lucide-React for icons.
- **Data Pipeline**: Node.js scripts using Puppeteer, Cheerio, and Axios for scraping; customized translation engine for dynamic content.
- **Deployment**: Automatic deployment to GitHub Pages via GitHub Actions.

## Project Structure
- `src/`: Core application source code.
- `scripts/`: Data scrapers, generation tools, and utility scripts.
- `public/`: Static assets, including localized performance data JSONs.

## Data Generation & Scraping
Data is automatically collected and processed daily via the `Daily Data Update` workflow.
You can run scrapers manually using:
- `npm run scrape:movies` - Scrape latest movie rankings.
- `npm run scrape:kbo` - Update baseball schedules.
- `npm run generate-data` - Transform raw data into the final performance JSON.

## Recent Improvements (Phase 9)
- **Security**: Sensitive keys and temporary artifacts have been removed and secured via `.gitignore`.
- **Type Safety**: Core display components and configuration have been refactored for strict TypeScript compliance.
- **Optimization**: Scraping-only dependencies moved to devDependencies to reduce bundle size and improve CI build times.
- **Data Quality**: Automated address-to-region mapping and consistency checks.

## License
MIT License

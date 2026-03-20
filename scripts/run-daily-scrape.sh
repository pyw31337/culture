#!/bin/bash

# CultureFlow Daily Scrape Script
# This script is designed to be run via cron

# Source nvm if present to ensure node is available
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Navigate to project directory
PROJECT_DIR="/Users/pyw31337/Library/Mobile Documents/com~apple~CloudDocs/Antigravity/CultureFlow"
cd "$PROJECT_DIR" || exit 1

# Log file
LOG_FILE="$PROJECT_DIR/logs/scrape-ott-$(date +%Y-%m-%d).log"
mkdir -p "$PROJECT_DIR/logs"

echo "Starting Scrape at $(date)" >> "$LOG_FILE"

# Run Scraper
/usr/bin/env npx tsx scripts/scrape-ott.ts >> "$LOG_FILE" 2>&1

echo "Finished Scrape at $(date)" >> "$LOG_FILE"

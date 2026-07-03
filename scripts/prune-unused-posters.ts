import fs from 'fs';
import path from 'path';

const SRC_DATA_DIR = path.resolve(process.cwd(), 'src/data');
const PUBLIC_DATA_DIR = path.resolve(process.cwd(), 'public/data');
const POSTERS_DIR = path.resolve(process.cwd(), 'public/images/posters');
const THUMBS_DIR = path.resolve(process.cwd(), 'public/images/thumbs');

// Get all referenced poster paths from JSON, TS, and TSX files in src/ and public/data
function getReferencedPosters(): Set<string> {
    const referenced = new Set<string>();
    
    // Scan all json, ts, and tsx files in src/ and public/data/ to gather image paths (including Korean / unicode filenames)
    const imagePattern = /\/?images\/[^\s"']+\.(?:webp|png|jpe?g|gif)/gi;

    const dirsToScan = [
        path.resolve(process.cwd(), 'src'),
        path.resolve(process.cwd(), 'public/data')
    ];

    function scanDir(dir: string) {
        if (!fs.existsSync(dir)) return;
        const list = fs.readdirSync(dir);
        for (const item of list) {
            const fullPath = path.join(dir, item);
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory()) {
                scanDir(fullPath);
            } else if (item.endsWith('.json') || item.endsWith('.ts') || item.endsWith('.tsx')) {
                try {
                    const content = fs.readFileSync(fullPath, 'utf-8');
                    const matches = content.match(imagePattern);
                    if (matches) {
                        for (const match of matches) {
                            let normalized = match.trim();
                            if (!normalized.startsWith('/')) {
                                normalized = '/' + normalized;
                            }
                            referenced.add(normalized);
                        }
                    }
                } catch (e: any) {
                    console.error(`❌ Failed to read or parse file ${item}: ${e.message}`);
                }
            }
        }
    }

    for (const dir of dirsToScan) {
        scanDir(dir);
    }
    
    return referenced;
}

// Recursively find all files in a directory
function getAllFiles(dirPath: string): string[] {
    const files: string[] = [];
    if (!fs.existsSync(dirPath)) return files;

    const list = fs.readdirSync(dirPath);
    for (const item of list) {
        const fullPath = path.join(dirPath, item);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            files.push(...getAllFiles(fullPath));
        } else {
            files.push(fullPath);
        }
    }
    return files;
}

function pruneDirectory(targetDir: string, referenced: Set<string>, rootLabel: string) {
    if (!fs.existsSync(targetDir)) {
        console.log(`➖ Directory not found, skipping: ${targetDir}`);
        return;
    }

    console.log(`🔍 Scanning directory for unused files: ${targetDir}`);
    const localFiles = getAllFiles(targetDir);
    let deletedCount = 0;
    let reclaimedBytes = 0;

    for (const file of localFiles) {
        // Get path relative to the process cwd, e.g. "public/images/posters/festivals/abc.webp"
        const relativePath = path.relative(process.cwd(), file);
        
        // Convert to absolute-like web paths e.g., "/images/posters/festivals/abc.webp" or "images/posters/festivals/abc.webp"
        let webPathSlash = '/' + relativePath.replace('public/', '');
        let webPathNoSlash = relativePath.replace('public/', '');

        // Map thumbs directory paths to their corresponding poster paths for reference checking
        if (webPathSlash.startsWith('/images/thumbs/w320/posters/')) {
            webPathSlash = webPathSlash.replace('/images/thumbs/w320/posters/', '/images/posters/');
        }
        if (webPathNoSlash.startsWith('images/thumbs/w320/posters/')) {
            webPathNoSlash = webPathNoSlash.replace('images/thumbs/w320/posters/', 'images/posters/');
        }

        // If the file is not referenced anywhere in active JSONs, delete it
        if (!referenced.has(webPathSlash) && !referenced.has(webPathNoSlash)) {
            try {
                const stat = fs.statSync(file);
                reclaimedBytes += stat.size;
                fs.unlinkSync(file);
                deletedCount++;
            } catch (err: any) {
                console.error(`❌ Failed to delete ${file}: ${err.message}`);
            }
        }
    }

    const reclaimedMB = (reclaimedBytes / (1024 * 1024)).toFixed(2);
    console.log(`🧹 Done! Removed ${deletedCount} unused files from ${rootLabel}. Reclaimed space: ${reclaimedMB} MB.`);
}

async function runPrune() {
    console.log('🧹 Starting unused poster cache pruning...');
    const referenced = getReferencedPosters();
    console.log(`📊 Found ${referenced.size} unique image references in src/data.`);

    pruneDirectory(POSTERS_DIR, referenced, 'Posters Cache');
    pruneDirectory(THUMBS_DIR, referenced, 'Thumbs Cache');
}

runPrune().catch(e => {
    console.error('❌ Pruning failed:', e);
});

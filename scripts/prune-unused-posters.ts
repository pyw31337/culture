import fs from 'fs';
import path from 'path';

const SRC_DATA_DIR = path.resolve(process.cwd(), 'src/data');
const PUBLIC_DATA_DIR = path.resolve(process.cwd(), 'public/data');
const POSTERS_DIR = path.resolve(process.cwd(), 'public/images/posters');
const THUMBS_DIR = path.resolve(process.cwd(), 'public/images/thumbs');

// Recursively traverse JSON data to find any string that starts with '/images/'
function extractImagesFromObject(obj: any, set: Set<string>) {
    if (!obj) return;
    if (typeof obj === 'string') {
        if (obj.startsWith('/images/')) {
            set.add(obj);
        } else if (obj.startsWith('images/')) {
            set.add('/' + obj);
        }
        return;
    }
    if (Array.isArray(obj)) {
        for (const item of obj) {
            extractImagesFromObject(item, set);
        }
        return;
    }
    if (typeof obj === 'object') {
        for (const key of Object.keys(obj)) {
            extractImagesFromObject(obj[key], set);
        }
    }
}

// Get all referenced poster paths from JSON files in both src/data and public/data
function getReferencedPosters(): Set<string> {
    const referenced = new Set<string>();
    
    const dirs = [SRC_DATA_DIR, PUBLIC_DATA_DIR];
    for (const dir of dirs) {
        if (!fs.existsSync(dir)) {
            console.warn(`⚠️ Directory does not exist: ${dir}`);
            continue;
        }

        const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
        for (const file of files) {
            const filePath = path.join(dir, file);
            try {
                const content = fs.readFileSync(filePath, 'utf-8');
                const data = JSON.parse(content);
                extractImagesFromObject(data, referenced);
            } catch (e: any) {
                console.error(`❌ Failed to read or parse ${file} in ${dir}: ${e.message}`);
            }
        }
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
        const webPathSlash = '/' + relativePath.replace('public/', '');
        const webPathNoSlash = relativePath.replace('public/', '');

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

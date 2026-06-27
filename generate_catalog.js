/**
 * Catalog Generator for Sheet Music Viewer (Static Site Mode)
 * Scans local folders '가' ~ '하' for PDFs, extracts titles/artists,
 * and creates 'songs.json' in public assets.
 */

const fs = require('fs');
const path = require('path');

const CATEGORIES = ['가', '나', '다', '라', '마', '바', '사', '아', '자', '차', '카', '타', '파', '하'];
const ROOT_DIR = __dirname;
const TARGET_JSON_PATH = path.join(ROOT_DIR, 'viewer', 'public', 'songs.json');

function run() {
    console.log('[Catalog Gen] Starting to scan folders...');
    const allSongs = [];

    CATEGORIES.forEach(category => {
        const dirPath = path.join(ROOT_DIR, category);
        if (fs.existsSync(dirPath)) {
            try {
                const files = fs.readdirSync(dirPath);
                files.forEach(file => {
                    if (file.toLowerCase().endsWith('.pdf')) {
                        const namePart = file.replace('.pdf', '');
                        let title = namePart;
                        let artist = '';

                        // Split by last dash for Artist
                        const lastDashIndex = namePart.lastIndexOf('-');
                        if (lastDashIndex !== -1) {
                            title = namePart.substring(0, lastDashIndex).trim();
                            artist = namePart.substring(lastDashIndex + 1).trim();
                        }

                        // For static hosting, fullPath points directly to relative static path e.g. "./가/filename.pdf"
                        // Using encodeURIComponent only for category/filename parts to prevent breaking URLs
                        allSongs.push({
                            id: `${category}/${file}`,
                            category,
                            fileName: file,
                            title: title || namePart,
                            artist: artist,
                            fullPath: `./${encodeURIComponent(category)}/${encodeURIComponent(file)}`
                        });
                    }
                });
            } catch (err) {
                console.error(`[Catalog Gen] Error reading directory ${category}:`, err);
            }
        }
    });

    // Sort alphabetically by title
    allSongs.sort((a, b) => a.title.localeCompare(b.title, 'ko'));

    try {
        // Ensure directory exists
        const dir = path.dirname(TARGET_JSON_PATH);
        if (!fs.existsSync(dir)){
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(TARGET_JSON_PATH, JSON.stringify(allSongs, null, 2), 'utf-8');
        console.log(`[Catalog Gen] Successfully generated ${allSongs.length} songs at ${TARGET_JSON_PATH}`);
        
        // Optionally copy to dist/songs.json if dist folder exists (for hot previews)
        const distJsonPath = path.join(ROOT_DIR, 'viewer', 'dist', 'songs.json');
        if (fs.existsSync(path.dirname(distJsonPath))) {
            fs.writeFileSync(distJsonPath, JSON.stringify(allSongs, null, 2), 'utf-8');
            console.log(`[Catalog Gen] Also synced to ${distJsonPath}`);
        }
    } catch (err) {
        console.error('[Catalog Gen] Failed to write songs.json:', err);
    }
}

// Allow calling from command line or require()
if (require.main === module) {
    run();
}

module.exports = { run };

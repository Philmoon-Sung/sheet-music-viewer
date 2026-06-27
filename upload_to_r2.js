/**
 * Cloudflare R2 Migration and Upload Script for Sheet Music Viewer
 * This script scans local Hangul consonant folders, uploads all PDFs to R2,
 * and generates a 'songs.json' catalog metadata file.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const readline = require('readline');

// 1. Check & Auto-Install Required Packages
function ensureDependencies() {
    const deps = ['@aws-sdk/client-s3'];
    let needInstall = false;

    for (const dep of deps) {
        try {
            require(dep);
        } catch (e) {
            console.log(`[Dependencies] Missing package: ${dep}. Initiating installation...`);
            needInstall = true;
        }
    }

    if (needInstall) {
        try {
            execSync('npm install @aws-sdk/client-s3 --no-audit --no-fund', { stdio: 'inherit' });
            console.log('[Dependencies] All packages installed successfully.\n');
        } catch (err) {
            console.error('[Dependencies] Failed to install packages automatically. Please run:');
            console.error('npm install @aws-sdk/client-s3');
            process.exit(1);
        }
    }
}

ensureDependencies();

const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

// 2. Interactive Input helper
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const askQuestion = (query) => new Promise((resolve) => rl.question(query, resolve));

// 3. Load configurations (From env, dotenv-style or interactive prompt)
async function getConfigs() {
    let endpoint = process.env.R2_ENDPOINT || '';
    let accessKeyId = process.env.R2_ACCESS_KEY_ID || '';
    let secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || '';
    let bucket = process.env.R2_BUCKET || 'sheet-music-bucket';

    // Try reading local .env if exists
    const envPath = path.join(__dirname, '.env');
    if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf-8');
        envContent.split('\n').forEach(line => {
            const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
            if (match) {
                const key = match[1];
                let value = match[2] ? match[2].trim() : '';
                if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
                if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);

                if (key === 'R2_ENDPOINT') endpoint = value;
                if (key === 'R2_ACCESS_KEY_ID') accessKeyId = value;
                if (key === 'R2_SECRET_ACCESS_KEY') secretAccessKey = value;
                if (key === 'R2_BUCKET') bucket = value;
            }
        });
    }

    if (!endpoint || !accessKeyId || !secretAccessKey) {
        console.log('=== Cloudflare R2 Credentials Setup ===');
        console.log('Please enter the credentials generated in your Cloudflare R2 dashboard.');
        
        if (!endpoint) {
            endpoint = await askQuestion('R2 S3 API Endpoint (URL): ');
            endpoint = endpoint.trim();
        }
        if (!accessKeyId) {
            accessKeyId = await askQuestion('R2 Access Key ID: ');
            accessKeyId = accessKeyId.trim();
        }
        if (!secretAccessKey) {
            secretAccessKey = await askQuestion('R2 Secret Access Key: ');
            secretAccessKey = secretAccessKey.trim();
        }
        if (!bucket || bucket === 'sheet-music-bucket') {
            const resBucket = await askQuestion('R2 Bucket Name [sheet-music-bucket]: ');
            if (resBucket.trim()) bucket = resBucket.trim();
        }
        rl.close();
    } else {
        rl.close();
    }

    return { endpoint, accessKeyId, secretAccessKey, bucket };
}

// 4. Main script execution
async function main() {
    const configs = await getConfigs();
    if (!configs.endpoint || !configs.accessKeyId || !configs.secretAccessKey) {
        console.error('\n[Error] Access Key, Secret Key, and Endpoint are required to proceed.');
        process.exit(1);
    }

    console.log('\n[R2 Client] Initializing connection to S3 API endpoint...');
    const s3Client = new S3Client({
        region: 'auto',
        endpoint: configs.endpoint,
        credentials: {
            accessKeyId: configs.accessKeyId,
            secretAccessKey: configs.secretAccessKey,
        },
        forcePathStyle: true, // Crucial for R2 storage
    });

    const CATEGORIES = ['가', '나', '다', '라', '마', '바', '사', '아', '자', '차', '카', '타', '파', '하'];
    const ROOT_DIR = __dirname;
    const allFiles = [];

    // Scan directories
    console.log('[Scanner] Searching local directories for PDF files...');
    CATEGORIES.forEach(category => {
        const dirPath = path.join(ROOT_DIR, category);
        if (fs.existsSync(dirPath)) {
            const files = fs.readdirSync(dirPath);
            files.forEach(file => {
                if (file.toLowerCase().endsWith('.pdf')) {
                    allFiles.push({
                        localPath: path.join(dirPath, file),
                        category,
                        fileName: file
                    });
                }
            });
        }
    });

    const totalFiles = allFiles.length;
    console.log(`[Scanner] Found ${totalFiles} PDF files to upload.`);

    if (totalFiles === 0) {
        console.log('No PDF files found to upload. Exiting.');
        process.exit(0);
    }

    const songsCatalog = [];
    let uploadedCount = 0;
    const CONCURRENCY_LIMIT = 15; // Process up to 15 concurrent uploads
    const queue = [...allFiles];

    console.log(`\n[Uploader] Uploading files to R2 bucket "${configs.bucket}"...`);

    const worker = async () => {
        while (queue.length > 0) {
            const item = queue.shift();
            if (!item) continue;

            const r2Key = `${item.category}/${item.fileName}`;
            const fileStream = fs.createReadStream(item.localPath);
            
            try {
                // Upload file
                await s3Client.send(new PutObjectCommand({
                    Bucket: configs.bucket,
                    Key: r2Key,
                    Body: fileStream,
                    ContentType: 'application/pdf',
                }));

                // Parse title and artist
                const namePart = item.fileName.replace('.pdf', '');
                let title = namePart;
                let artist = '';

                const lastDashIndex = namePart.lastIndexOf('-');
                if (lastDashIndex !== -1) {
                    title = namePart.substring(0, lastDashIndex).trim();
                    artist = namePart.substring(lastDashIndex + 1).trim();
                }

                songsCatalog.push({
                    id: `${item.category}/${item.fileName}`,
                    category: item.category,
                    fileName: item.fileName,
                    title: title || namePart,
                    artist: artist,
                    fullPath: `/api/file/${encodeURIComponent(item.category)}/${encodeURIComponent(item.fileName)}`
                });

                uploadedCount++;
                if (uploadedCount % 100 === 0 || uploadedCount === totalFiles) {
                    const percent = ((uploadedCount / totalFiles) * 100).toFixed(1);
                    console.log(`[Uploader] Progress: ${uploadedCount}/${totalFiles} files uploaded (${percent}%).`);
                }
            } catch (err) {
                console.error(`[Uploader] Error uploading ${r2Key}:`, err.message);
                // Put back in queue to retry once
                if (!item.retried) {
                    item.retried = true;
                    queue.push(item);
                }
            }
        }
    };

    // Spin up concurrent workers
    const workers = Array(CONCURRENCY_LIMIT).fill(null).map(() => worker());
    await Promise.all(workers);

    console.log(`\n[Uploader] Upload complete. ${songsCatalog.length}/${totalFiles} files successfully pushed.`);

    // Sort songs catalog by title (similar to original display)
    songsCatalog.sort((a, b) => a.title.localeCompare(b.title, 'ko'));

    // 5. Generate and Upload songs.json
    console.log('[Metadata] Generating songs.json registry index...');
    const catalogJson = JSON.stringify(songsCatalog, null, 2);
    
    try {
        await s3Client.send(new PutObjectCommand({
            Bucket: configs.bucket,
            Key: 'songs.json',
            Body: catalogJson,
            ContentType: 'application/json',
            CacheControl: 'no-cache, no-store, must-revalidate',
        }));
        console.log('[Metadata] songs.json successfully uploaded to R2.');
        console.log('\n======================================================');
        console.log('🎉 Migration successful! All files and metadata index');
        console.log('   are now safely stored in Cloudflare R2.');
        console.log('======================================================');
    } catch (err) {
        console.error('[Metadata] Failed to upload songs.json metadata index:', err.message);
    }
}

main().catch(err => {
    console.error('An unexpected error occurred:', err);
    process.exit(1);
});

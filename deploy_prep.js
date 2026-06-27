/**
 * Deployment Preparation Tool for Static GitHub Pages mode.
 * 1. Generates songs.json catalog.
 * 2. Compiles React project using Vite.
 * 3. Copies compiled dist files to root directory for easy GitHub push.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const catalogGen = require('./generate_catalog');

const ROOT_DIR = __dirname;
const DIST_DIR = path.join(ROOT_DIR, 'viewer', 'dist');

function copyFolderRecursiveSync(source, target) {
    let files = [];

    // Check if folder needs to be created or integrated
    const targetFolder = target;
    if (!fs.existsSync(targetFolder)) {
        fs.mkdirSync(targetFolder, { recursive: true });
    }

    if (fs.lstatSync(source).isDirectory()) {
        files = fs.readdirSync(source);
        files.forEach(file => {
            const curSource = path.join(source, file);
            const curTarget = path.join(targetFolder, file);
            if (fs.lstatSync(curSource).isDirectory()) {
                copyFolderRecursiveSync(curSource, curTarget);
            } else {
                fs.copyFileSync(curSource, curTarget);
            }
        });
    }
}

function main() {
    console.log('=== [Static Deploy Prep] Starting Build Flow ===\n');

    // 1. Generate songs.json
    try {
        catalogGen.run();
    } catch (err) {
        console.error('Failed to run catalog generator:', err);
        process.exit(1);
    }

    // 2. Build Vite Frontend
    console.log('\n[Vite Build] Bundling React frontend components...');
    try {
        // Run with path adjustment for Node context
        const buildCmd = process.platform === 'win32' 
            ? '($env:PATH += ";E:\\Nnode\\node-v20.12.0-win-x64"); npm run build'
            : 'npm run build';
        
        execSync(buildCmd, { 
            cwd: path.join(ROOT_DIR, 'viewer'), 
            shell: process.platform === 'win32' ? 'powershell.exe' : '/bin/sh',
            stdio: 'inherit' 
        });
        console.log('[Vite Build] Bundle built successfully in viewer/dist/.');
    } catch (err) {
        console.error('[Vite Build] Build compilation failed:', err.message);
        process.exit(1);
    }

    // 3. Copy compiled assets to project root
    console.log('\n[Asset Copier] Migrating compiled static assets to root for GitHub Pages...');
    try {
        if (!fs.existsSync(DIST_DIR)) {
            throw new Error(`Build folder dist not found at ${DIST_DIR}`);
        }

        const files = fs.readdirSync(DIST_DIR);
        files.forEach(file => {
            const srcPath = path.join(DIST_DIR, file);
            const destPath = path.join(ROOT_DIR, file);

            if (fs.lstatSync(srcPath).isDirectory()) {
                copyFolderRecursiveSync(srcPath, destPath);
            } else {
                fs.copyFileSync(srcPath, destPath);
            }
        });

        console.log('[Asset Copier] Static files successfully copied to project root.');
        console.log('\n======================================================');
        console.log('🎉 Preparation complete! The root folder is now ready.');
        console.log('   Simply run the Git commands to deploy to GitHub:');
        console.log('   1. git add .');
        console.log('   2. git commit -m "Deploy to GitHub Pages"');
        console.log('   3. git push');
        console.log('======================================================');
    } catch (err) {
        console.error('[Asset Copier] Asset relocation failed:', err.message);
        process.exit(1);
    }
}

main();

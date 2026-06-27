const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const { PDFDocument, degrees } = require('pdf-lib');

const app = express();
const PORT = 9000;

app.use(cors());
app.use(express.json());

// Target directories (Korean consonants)
const CATEGORIES = ['가', '나', '다', '라', '마', '바', '사', '아', '자', '차', '카', '타', '파', '하'];

const ROOT_DIR = __dirname;
const upload = multer({ storage: multer.memoryStorage() });

// API to get list of all songs
app.get('/api/songs', (req, res) => {
    const allSongs = [];

    CATEGORIES.forEach(category => {
        const dirPath = path.join(ROOT_DIR, category);
        if (fs.existsSync(dirPath)) {
            try {
                const files = fs.readdirSync(dirPath);
                files.forEach(file => {
                    if (file.toLowerCase().endsWith('.pdf')) {
                        // Parse filename: "Title-Artist.pdf"
                        const namePart = file.replace('.pdf', '');
                        // Simple split by last dash for Artist, but file names vary.
                        // Strategy: Treat the whole name as title for search, 
                        // attempt to split for better display if possible.

                        let title = namePart;
                        let artist = '';

                        const lastDashIndex = namePart.lastIndexOf('-');
                        if (lastDashIndex !== -1) {
                            title = namePart.substring(0, lastDashIndex).trim();
                            artist = namePart.substring(lastDashIndex + 1).trim();
                        }

                        allSongs.push({
                            id: `${category}/${file}`,
                            category,
                            fileName: file,
                            title: title || namePart, // Fallback
                            artist: artist,
                            fullPath: `/api/file/${encodeURIComponent(category)}/${encodeURIComponent(file)}`
                        });
                    }
                });
            } catch (err) {
                console.error(`Error reading directory ${category}:`, err);
            }
        }
    });

    res.json(allSongs);
});

// API to serve a PDF file
app.get('/api/file/:category/:filename', (req, res) => {
    const { category, filename } = req.params;
    // Basic security check: ensure category is in allowed list
    if (!CATEGORIES.includes(category)) {
        return res.status(403).send('Invalid category');
    }

    const filePath = path.join(ROOT_DIR, category, filename);

    if (fs.existsSync(filePath)) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.sendFile(filePath);
    } else {
        res.status(404).send('File not found');
    }
});

// Serve the input tool
app.get('/input', (req, res) => {
    res.sendFile(path.join(__dirname, 'viewer', 'public', 'input.html'));
});

// Initial consonant mapping
function getCategoryFolder(char) {
    const hangulStart = 0xAC00;
    const hangulEnd = 0xD7A3;
    const code = char.charCodeAt(0);

    // If not Hangul
    if (code < hangulStart || code > hangulEnd) return null;

    // Chosung index (0-18)
    const chosungIndex = Math.floor((code - hangulStart) / 28 / 21);

    // Mapping 19 chosungs to our folder categories
    // 0:ㄱ, 1:ㄲ -> 가
    // 2:ㄴ -> 나
    // 3:ㄷ, 4:ㄸ -> 다
    // 5:ㄹ -> 라
    // 6:ㅁ -> 마
    // 7:ㅂ, 8:ㅃ -> 바
    // 9:ㅅ, 10:ㅆ -> 사
    // 11:ㅇ -> 아
    // 12:ㅈ, 13:ㅉ -> 자
    // 14:ㅊ -> 차
    // 15:ㅋ -> 카
    // 16:ㅌ -> 타
    // 17:ㅍ -> 파
    // 18:ㅎ -> 하

    const map = {
        0: '가', 1: '가',
        2: '나',
        3: '다', 4: '다',
        5: '라',
        6: '마',
        7: '바', 8: '바',
        9: '사', 10: '사',
        11: '아',
        12: '자', 13: '자',
        14: '차',
        15: '카',
        16: '타',
        17: '파',
        18: '하'
    };

    return map[chosungIndex];
}

// Upload API (Multi-file support)
app.post('/api/upload', upload.array('files'), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: '파일이 없습니다.' });
        }

        const title = req.body.title || 'Untitled';
        const firstChar = title.trim().charAt(0);
        const folder = getCategoryFolder(firstChar);

        if (!folder) {
            return res.status(400).json({ error: `한글로 시작하는 제목이어야 합니다. ('${firstChar}' is not valid)` });
        }

        const targetDir = path.join(ROOT_DIR, folder);
        // Ensure directory exists (it should based on CATEGORIES, but safe check)
        if (!fs.existsSync(targetDir)) {
            return res.status(500).json({ error: `Target folder '${folder}' does not exist.` });
        }

        const newFileName = title.trim().endsWith('.pdf') ? title.trim() : `${title.trim()}.pdf`;
        const savePath = path.join(targetDir, newFileName);

        if (fs.existsSync(savePath)) {
            return res.status(409).json({ error: '이미 존재하는 파일명입니다.' });
        }

        // Create a new PDF document
        const mergedPdf = await PDFDocument.create();

        for (const file of req.files) {
            if (file.mimetype.startsWith('image/')) {
                let image;
                if (file.mimetype === 'image/png') {
                    image = await mergedPdf.embedPng(file.buffer);
                } else if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/jpg') {
                    image = await mergedPdf.embedJpg(file.buffer);
                } else {
                    continue; // Skip unsupported
                }

                // A4 size usually or match image size? Matching image size is safer for random inputs.
                const page = mergedPdf.addPage([image.width, image.height]);
                page.drawImage(image, {
                    x: 0,
                    y: 0,
                    width: image.width,
                    height: image.height,
                });

            } else if (file.mimetype === 'application/pdf') {
                const srcPdf = await PDFDocument.load(file.buffer);
                const copiedPages = await mergedPdf.copyPages(srcPdf, srcPdf.getPageIndices());
                copiedPages.forEach((page) => mergedPdf.addPage(page));
            }
        }

        // If no pages added (e.g. all unsupported files)
        if (mergedPdf.getPageCount() === 0) {
            return res.status(400).json({ error: '유효한 파일이 없습니다. (이미지 또는 PDF)' });
        }

        const pdfBytes = await mergedPdf.save();
        fs.writeFileSync(savePath, pdfBytes);

        console.log(`File saved: ${savePath}`);
        res.json({ message: `'${folder}' 폴더에 저장되었습니다: ${newFileName}` });

    } catch (err) {
        console.error('Upload Error:', err);
        res.status(500).json({ error: '서버 저장 중 오류가 발생했습니다.' });
    }
});

// API to rotate a specific file
app.post('/api/rotate-file', async (req, res) => {
    const { category, filename, angle } = req.body;

    if (!CATEGORIES.includes(category)) {
        return res.status(403).json({ error: 'Invalid category' });
    }

    const filePath = path.join(ROOT_DIR, category, filename);
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found' });
    }

    try {
        // Use Async I/O to avoid blocking the Event Loop
        const fileBuffer = await fs.promises.readFile(filePath);
        const pdfDoc = await PDFDocument.load(fileBuffer);
        const pages = pdfDoc.getPages();

        const rotationAngle = parseInt(angle, 10);

        pages.forEach(page => {
            const currentRotation = page.getRotation().angle;
            page.setRotation(degrees(currentRotation + rotationAngle));
        });

        const pdfBytes = await pdfDoc.save();
        await fs.promises.writeFile(filePath, pdfBytes); // Async write

        console.log(`Rotated ${filename} by ${angle} degrees.`);
        res.json({ success: true, message: `Rotated ${filename} by ${angle} degrees.` });

    } catch (err) {
        console.error('Rotation Error:', err);
        res.status(500).json({ error: 'Failed to rotate file.' });
    }
});



// Serve frontend static files (Production build)
// Standard static assets (hashed) - defaults are usually fine, but let's be safe for index.html
app.use(express.static(path.join(__dirname, 'viewer', 'dist'), {
    setHeaders: (res, path) => {
        if (path.endsWith('index.html')) {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
        }
    }
}));

// Fallback for SPA routing
app.get('*', (req, res) => {
    // If request api, don't serve html
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: 'API not found' });
    }
    const indexHtml = path.join(__dirname, 'viewer', 'dist', 'index.html');
    if (fs.existsSync(indexHtml)) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.sendFile(indexHtml);
    } else {
        res.send('Frontend not built yet. Run "npm run build" in viewer directory.');
    }
});

// Helper to get local IP address
function getLocalIp() {
    const { networkInterfaces } = require('os');
    const nets = networkInterfaces();
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
            if (net.family === 'IPv4' && !net.internal) {
                return net.address;
            }
        }
    }
    return 'localhost';
}

app.listen(PORT, '0.0.0.0', () => {
    const ip = getLocalIp();
    console.log(`Server is running!`);
    console.log(`- Local:   http://localhost:${PORT}`);
    console.log(`- Mobile:  http://${ip}:${PORT}`);
});

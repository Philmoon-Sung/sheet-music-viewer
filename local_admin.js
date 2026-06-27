/**
 * Local Admin Server for Sheet Music Viewer (Static Site Mode)
 * Runs locally on Port 9000 to serve the upload interface (http://localhost:9000/input),
 * merges uploaded sheets into PDF, and updates the local songs.json catalog.
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const { PDFDocument } = require('pdf-lib');
const catalogGen = require('./generate_catalog');

const app = express();
const PORT = 9000;

app.use(cors());
app.use(express.json());

// Serve input tool and static public resources locally
app.use('/viewer', express.static(path.join(__dirname, 'viewer', 'public')));

app.get('/input', (req, res) => {
    const inputPath = path.join(__dirname, 'viewer', 'public', 'input.html');
    if (fs.existsSync(inputPath)) {
        res.sendFile(inputPath);
    } else {
        res.status(404).send('input.html not found under viewer/public/.');
    }
});

const ROOT_DIR = __dirname;
const upload = multer({ storage: multer.memoryStorage() });

// Initial consonant mapping
function getCategoryFolder(char) {
    const hangulStart = 0xAC00;
    const hangulEnd = 0xD7A3;
    const code = char.charCodeAt(0);

    if (code < hangulStart || code > hangulEnd) return null;

    const chosungIndex = Math.floor((code - hangulStart) / 28 / 21);

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

// Upload and PDF merge API
app.post('/api/upload', upload.array('files'), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: '파일이 없습니다.' });
        }

        const title = req.body.title || 'Untitled';
        const firstChar = title.trim().charAt(0);
        const folder = getCategoryFolder(firstChar);

        if (!folder) {
            return res.status(400).json({ error: `한글로 시작하는 제목이어야 합니다. ('${firstChar}'은(는) 유효하지 않음)` });
        }

        const targetDir = path.join(ROOT_DIR, folder);
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }

        const newFileName = title.trim().endsWith('.pdf') ? title.trim() : `${title.trim()}.pdf`;
        const savePath = path.join(targetDir, newFileName);

        if (fs.existsSync(savePath)) {
            return res.status(409).json({ error: '이미 존재하는 파일명입니다.' });
        }

        // Create merged PDF Document
        const mergedPdf = await PDFDocument.create();
        let pagesAdded = 0;

        for (const file of req.files) {
            if (file.mimetype.startsWith('image/')) {
                let image;
                if (file.mimetype === 'image/png') {
                    image = await mergedPdf.embedPng(file.buffer);
                } else if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/jpg') {
                    image = await mergedPdf.embedJpg(file.buffer);
                } else {
                    continue;
                }

                const page = mergedPdf.addPage([image.width, image.height]);
                page.drawImage(image, {
                    x: 0,
                    y: 0,
                    width: image.width,
                    height: image.height,
                });
                pagesAdded++;
            } else if (file.mimetype === 'application/pdf') {
                const srcPdf = await PDFDocument.load(file.buffer);
                const copiedPages = await mergedPdf.copyPages(srcPdf, srcPdf.getPageIndices());
                copiedPages.forEach((page) => mergedPdf.addPage(page));
                pagesAdded += copiedPages.length;
            }
        }

        if (pagesAdded === 0) {
            return res.status(400).json({ error: '유효한 이미지 또는 PDF 파일이 없습니다.' });
        }

        const pdfBytes = await mergedPdf.save();
        fs.writeFileSync(savePath, pdfBytes);
        console.log(`[Local Admin] Saved new sheet: ${savePath}`);

        // Regenerate catalog songs.json immediately
        catalogGen.run();

        res.json({ success: true, message: `성공적으로 저장 및 색인이 완료되었습니다: ${newFileName}` });
    } catch (err) {
        console.error('[Local Admin] Upload error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`🚀 Local Admin server running at http://localhost:${PORT}`);
    console.log(`👉 Open http://localhost:${PORT}/input to add new sheets.`);
    console.log(`======================================================\n`);
});

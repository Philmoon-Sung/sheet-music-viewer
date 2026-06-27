import { PDFDocument } from 'pdf-lib';

// Map Korean character to its corresponding category folder
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

export async function onRequest(context) {
    const { request, env } = context;

    if (request.method !== 'POST') {
        return new Response("Method not allowed", { status: 405 });
    }

    if (!env.MUSIC_BUCKET) {
        return new Response(JSON.stringify({ error: "MUSIC_BUCKET binding is missing in Cloudflare." }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }

    try {
        const formData = await request.formData();
        const title = formData.get('title');
        const files = formData.getAll('files');

        if (!title || files.length === 0) {
            return new Response(JSON.stringify({ error: "제목과 파일(이미지 또는 PDF)을 업로드해 주세요." }), {
                status: 400,
                headers: { "Content-Type": "application/json" }
            });
        }

        const trimmedTitle = title.trim();
        const firstChar = trimmedTitle.charAt(0);
        const folder = getCategoryFolder(firstChar);

        if (!folder) {
            return new Response(JSON.stringify({ error: `한글로 시작하는 제목이어야 합니다. ('${firstChar}'은(는) 유효하지 않음)` }), {
                status: 400,
                headers: { "Content-Type": "application/json" }
            });
        }

        // Initialize new PDF Document
        const mergedPdf = await PDFDocument.create();
        let pagesAdded = 0;

        for (const file of files) {
            if (!(file instanceof File)) continue;
            
            const arrayBuffer = await file.arrayBuffer();

            if (file.type.startsWith('image/')) {
                let image;
                if (file.type === 'image/png') {
                    image = await mergedPdf.embedPng(arrayBuffer);
                } else if (file.type === 'image/jpeg' || file.type === 'image/jpg') {
                    image = await mergedPdf.embedJpg(arrayBuffer);
                } else {
                    continue; // Skip unsupported images
                }

                const page = mergedPdf.addPage([image.width, image.height]);
                page.drawImage(image, {
                    x: 0,
                    y: 0,
                    width: image.width,
                    height: image.height,
                });
                pagesAdded++;
            } else if (file.type === 'application/pdf') {
                const srcPdf = await PDFDocument.load(arrayBuffer);
                const copiedPages = await mergedPdf.copyPages(srcPdf, srcPdf.getPageIndices());
                copiedPages.forEach((page) => mergedPdf.addPage(page));
                pagesAdded += copiedPages.length;
            }
        }

        if (pagesAdded === 0) {
            return new Response(JSON.stringify({ error: "유효한 PDF 또는 이미지 파일이 없습니다." }), {
                status: 400,
                headers: { "Content-Type": "application/json" }
            });
        }

        // Serialize the merged PDF
        const pdfBytes = await mergedPdf.save();
        const targetFilename = trimmedTitle.endsWith('.pdf') ? trimmedTitle : `${trimmedTitle}.pdf`;
        const r2Key = `${folder}/${targetFilename}`;

        // Check if file already exists in R2
        const checkExist = await env.MUSIC_BUCKET.head(r2Key);
        if (checkExist) {
            return new Response(JSON.stringify({ error: "이미 존재하는 파일명입니다." }), {
                status: 409,
                headers: { "Content-Type": "application/json" }
            });
        }

        // Upload new PDF to R2
        await env.MUSIC_BUCKET.put(r2Key, pdfBytes, {
            contentType: 'application/pdf',
        });

        // Update songs.json metadata index
        let songsCatalog = [];
        const indexObject = await env.MUSIC_BUCKET.get('songs.json');
        if (indexObject) {
            const rawIndex = await indexObject.text();
            songsCatalog = JSON.parse(rawIndex);
        }

        // Parse title and artist from filename
        const namePart = targetFilename.replace('.pdf', '');
        let displayTitle = namePart;
        let artist = '';

        const lastDashIndex = namePart.lastIndexOf('-');
        if (lastDashIndex !== -1) {
            displayTitle = namePart.substring(0, lastDashIndex).trim();
            artist = namePart.substring(lastDashIndex + 1).trim();
        }

        // Push new song info
        const newSong = {
            id: `${folder}/${targetFilename}`,
            category: folder,
            fileName: targetFilename,
            title: displayTitle || namePart,
            artist: artist,
            fullPath: `/api/file/${encodeURIComponent(folder)}/${encodeURIComponent(targetFilename)}`
        };

        songsCatalog.push(newSong);
        
        // Sort registry alphabetically
        songsCatalog.sort((a, b) => a.title.localeCompare(b.title, 'ko'));

        // Save updated songs.json back to R2
        await env.MUSIC_BUCKET.put('songs.json', JSON.stringify(songsCatalog, null, 2), {
            contentType: 'application/json',
            cacheControl: 'no-cache, no-store, must-revalidate'
        });

        return new Response(JSON.stringify({ success: true, message: `성공적으로 업로드 및 병합되었습니다: ${targetFilename}` }), {
            status: 200,
            headers: { 
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            }
        });

    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }
}

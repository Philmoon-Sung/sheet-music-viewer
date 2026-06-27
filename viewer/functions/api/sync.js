export async function onRequest(context) {
    const { env } = context;

    if (!env.MUSIC_BUCKET) {
        return new Response(JSON.stringify({ error: "MUSIC_BUCKET binding is missing in Cloudflare." }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }

    try {
        const songsCatalog = [];
        let hasMore = true;
        let cursor = undefined;

        console.log("[Sync API] Scanning R2 bucket for PDF objects...");

        while (hasMore) {
            // Retrieve list of objects (max 1000 per call)
            const listResponse = await env.MUSIC_BUCKET.list({
                cursor: cursor
            });

            const objects = listResponse.objects;

            for (const obj of objects) {
                const key = obj.key;

                // Skip catalog index metadata file itself
                if (key === 'songs.json') continue;

                // Parse standard keys, structure: "category/filename.pdf"
                if (key.toLowerCase().endsWith('.pdf') && key.includes('/')) {
                    const parts = key.split('/');
                    const category = parts[0];
                    const filename = parts.slice(1).join('/');

                    const namePart = filename.replace('.pdf', '');
                    let title = namePart;
                    let artist = '';

                    const lastDashIndex = namePart.lastIndexOf('-');
                    if (lastDashIndex !== -1) {
                        title = namePart.substring(0, lastDashIndex).trim();
                        artist = namePart.substring(lastDashIndex + 1).trim();
                    }

                    songsCatalog.push({
                        id: key,
                        category: category,
                        fileName: filename,
                        title: title || namePart,
                        artist: artist,
                        fullPath: `/api/file/${encodeURIComponent(category)}/${encodeURIComponent(filename)}`
                    });
                }
            }

            hasMore = listResponse.truncated;
            if (hasMore) {
                cursor = listResponse.cursor;
            }
        }

        // Sort catalog by title (Hangul native collation)
        songsCatalog.sort((a, b) => a.title.localeCompare(b.title, 'ko'));

        // Save catalog JSON back to R2
        await env.MUSIC_BUCKET.put('songs.json', JSON.stringify(songsCatalog, null, 2), {
            contentType: 'application/json',
            cacheControl: 'no-cache, no-store, must-revalidate'
        });

        return new Response(JSON.stringify({ 
            success: true, 
            message: `성공적으로 동기화가 완료되었습니다.`,
            totalSongs: songsCatalog.length
        }), {
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

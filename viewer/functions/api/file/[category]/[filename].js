export async function onRequest(context) {
    const { env, params } = context;

    if (!env.MUSIC_BUCKET) {
        return new Response("MUSIC_BUCKET binding is missing in Cloudflare.", { status: 500 });
    }

    try {
        const category = decodeURIComponent(params.category);
        const filename = decodeURIComponent(params.filename);
        const r2Key = `${category}/${filename}`;

        const object = await env.MUSIC_BUCKET.get(r2Key);

        if (!object) {
            return new Response("Sheet music file not found in storage.", { status: 404 });
        }

        const headers = new Headers();
        // Forward metadata headers (Content-Length, ETag, etc.)
        object.writeHttpMetadata(headers);
        
        // Ensure browser displays PDF properly rather than downloading it
        headers.set("Content-Type", "application/pdf");
        // Safe cross-origin access for PDF loading
        headers.set("Access-Control-Allow-Origin", "*");
        // Cache PDFs heavily since sheets are static
        headers.set("Cache-Control", "public, max-age=31536000, immutable");

        return new Response(object.body, {
            status: 200,
            headers
        });
    } catch (err) {
        return new Response(`Error retrieving file: ${err.message}`, { status: 500 });
    }
}

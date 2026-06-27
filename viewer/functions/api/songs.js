export async function onRequest(context) {
    const { env } = context;

    // Check if R2 bucket binding is present
    if (!env.MUSIC_BUCKET) {
        return new Response(JSON.stringify({ error: "MUSIC_BUCKET binding is missing in Cloudflare." }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }

    try {
        // Fetch the songs.json index from R2
        const object = await env.MUSIC_BUCKET.get('songs.json');

        if (!object) {
            // Fallback empty list if not initialized yet
            return new Response(JSON.stringify([]), {
                status: 200,
                headers: { 
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*"
                }
            });
        }

        const body = await object.text();
        return new Response(body, {
            status: 200,
            headers: {
                "Content-Type": "application/json",
                "Cache-Control": "public, max-age=60", // Cache index for 1 minute
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

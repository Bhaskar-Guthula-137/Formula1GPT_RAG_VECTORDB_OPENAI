import OpenAI from "openai";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export const POST = async (request: Request) => {
    const { query } = await request.json() as { query: string };

    let env: CloudflareEnv | undefined;
    try {
        env = getCloudflareContext().env;
    } catch {
        // not in Cloudflare Workers runtime
    }

    const apiKey = env?.OPENAI_API_KEY ?? process.env.OPENAI_API_KEY;

    if (!env?.VECTORIZE) {
        return Response.json({
            available: false,
            note: 'Vectorize not available in local dev',
            chunks: 0,
            matches: []
        });
    }

    try {
        const openai = new OpenAI({ apiKey });

        const embedding = await openai.embeddings.create({
            model: "text-embedding-3-small",
            input: query,
            encoding_format: "float"
        });

        const vectorEmbedding = embedding.data[0].embedding;

        const result = await env.VECTORIZE.query(vectorEmbedding, {
            topK: 5,
            returnMetadata: true,
            returnValues: false
        });

        return Response.json({
            available: true,
            chunks: result.matches.length,
            matches: result.matches.map((m) => ({
                score: Math.round(m.score * 1000) / 1000,
                preview: ((m.metadata as any)?.text ?? '').slice(0, 120).trim()
            }))
        });
    } catch (error) {
        return Response.json({ available: false, chunks: 0, matches: [], error: String(error) });
    }
};

import OpenAI from "openai";
import { streamText, convertToModelMessages } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { UIMessage } from 'ai';

// ── Rate limiter ────────────────────────────────────────────────────────────
// In-memory per worker instance. Fine for learning/testing.
// For global limiting across all instances use Cloudflare KV or Durable Objects.
const RATE_LIMIT = 5          // max requests
const WINDOW_MS  = 60 * 1000  // per 60 seconds

const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(ip: string): { allowed: boolean; resetIn: number } {
    const now = Date.now()
    const entry = rateLimitMap.get(ip)

    if (!entry || now > entry.resetAt) {
        rateLimitMap.set(ip, { count: 1, resetAt: now + WINDOW_MS })
        return { allowed: true, resetIn: 0 }
    }

    if (entry.count >= RATE_LIMIT) {
        return { allowed: false, resetIn: Math.ceil((entry.resetAt - now) / 1000) }
    }

    entry.count++
    return { allowed: true, resetIn: 0 }
}
// ───────────────────────────────────────────────────────────────────────────

export const POST = async (request: Request) => {
    // Cloudflare sets CF-Connecting-IP; fallback to a static key in local dev
    const ip = request.headers.get('CF-Connecting-IP') ?? 'local'
    const { allowed, resetIn } = checkRateLimit(ip)

    if (!allowed) {
        return Response.json(
            { error: 'Rate limit exceeded', resetIn },
            { status: 429, headers: { 'Retry-After': String(resetIn) } }
        )
    }

    let env: CloudflareEnv | undefined;
    try {
        env = getCloudflareContext().env;
    } catch {
        // not in Cloudflare Workers runtime
    }

    const { messages } = await request.json() as { messages: UIMessage[] };

    const lastMessage = messages[messages.length - 1];
    const latestText = lastMessage?.parts
        .filter((p) => p.type === 'text')
        .map((p) => (p as { type: 'text'; text: string }).text)
        .join('') ?? '';

    const apiKey = env?.OPENAI_API_KEY ?? process.env.OPENAI_API_KEY;
    const openai = new OpenAI({ apiKey });
    const openaiProvider = createOpenAI({ apiKey });

    let chatContext = "";

    try {
        const embedding = await openai.embeddings.create({
            model: "text-embedding-3-small",
            input: latestText,
            encoding_format: "float"
        });

        const vectorEmbedding = embedding.data[0].embedding;

        if (env?.VECTORIZE) {
            try {
                const matches = await env.VECTORIZE.query(vectorEmbedding, {
                    topK: 5,
                    returnMetadata: true,
                    returnValues: false
                });

                chatContext = matches.matches
                    .map(match => (match.metadata as any)?.text)
                    .filter(Boolean)
                    .join('\n\n---\n\n');

            } catch (error) {
                console.error("Error querying Vectorize", error);
            }
        }
    } catch (error) {
        console.error("Error generating embedding", error);
    }

    const modelMessages = await convertToModelMessages(messages);

    const result = streamText({
        model: openaiProvider('gpt-4o-mini'),
        system: `You are an AI assistant who knows everything about Formula One.

Use the context below to augment your knowledge about Formula One racing.

If the context does not include the information needed to answer the question, respond using your existing knowledge. Do not mention whether the information came from the context or from your own knowledge.

Format responses using Markdown where appropriate. Do not return images.
--------------------------
START CONTEXT

${chatContext}

END CONTEXT
--------------------------`,
        messages: modelMessages,
    });

    return result.toUIMessageStreamResponse();
}

import OpenAI from "openai";
import { streamText, convertToModelMessages } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import type { CloudflareContext } from "@opennextjs/cloudflare";
import type { UIMessage } from 'ai';

export const POST = async (request: Request, context: CloudflareContext) => {
    const env = (context as any)?.env as CloudflareEnv | undefined;
    const { messages } = await request.json() as { messages: UIMessage[] };

    const lastMessage = messages[messages.length - 1];
    const latestText = lastMessage?.parts
        .filter((p) => p.type === 'text')
        .map((p) => (p as { type: 'text'; text: string }).text)
        .join('') ?? '';

    const apiKey = process.env.OPENAI_API_KEY ?? env?.OPENAI_API_KEY;
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

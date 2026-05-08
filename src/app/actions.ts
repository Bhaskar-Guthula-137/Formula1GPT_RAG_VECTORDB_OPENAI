'use server'

import { getRequestContext } from '@opennextjs/cloudflare'
import OpenAI from 'openai'

export async function chat(messages: { role: 'user' | 'assistant', content: string }[]) {
  const env = getRequestContext().env as CloudflareEnv

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || (env as any).OPENAI_API_KEY
  })

  const userMessage = messages[messages.length - 1].content

  // 1. Generate embedding for the user message
  const embeddingResponse = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: userMessage,
  })
  const queryVector = embeddingResponse.data[0].embedding

  // 2. Query Vectorize
  const matches = await env.VECTORIZE.query(queryVector, {
    topK: 5,
    returnValues: false,
    returnMetadata: true,
  })

  // 3. Extract context from metadata
  const context = matches.matches
    .map(match => (match.metadata as any)?.text)
    .filter(Boolean)
    .join('\n\n---\n\n')

  // 4. Generate response using RAG
  const systemPrompt = `
You are an F1 expert assistant. Use the following context from Formula One records and news to answer the user's question. 
If the context doesn't contain the answer, use your general knowledge but mention if you are doing so.
Keep the tone professional, engaging, and informative.

Context:
${context}
`

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages
    ],
  })

  return {
    role: 'assistant' as const,
    content: response.choices[0].message.content || 'I apologize, but I could not generate a response.'
  }
}

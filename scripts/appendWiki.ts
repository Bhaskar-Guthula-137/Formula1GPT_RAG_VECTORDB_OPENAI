import * as fs from "fs/promises";
import * as crypto from "crypto";
import { PuppeteerWebBaseLoader } from "@langchain/community/document_loaders/web/puppeteer";
import OpenAI from "openai";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import "dotenv/config";

const { OPENAI_API_KEY } = process.env;

const openai = new OpenAI({
    apiKey: OPENAI_API_KEY
});

const url = "https://en.wikipedia.org/wiki/Formula_One";

const scrapePage = async (url: string) => {
    const loader = new PuppeteerWebBaseLoader(url);
    const docs = await loader.load();
    return docs[0].pageContent;
}

const spiltter = new RecursiveCharacterTextSplitter({
    chunkSize: 512,
    chunkOverlap: 100
});

const appendData = async () => {
    const vectors = [];
    console.log(`Loading ${url}...`);
    try {
        const content = await scrapePage(url);
        const chunks = await spiltter.splitText(content);

        // Process in batches of 100 to speed up OpenAI API calls
        const batchSize = 100;
        for (let i = 0; i < chunks.length; i += batchSize) {
            const batch = chunks.slice(i, i + batchSize);
            const embeddingResponse = await openai.embeddings.create({
                input: batch,
                model: "text-embedding-3-small",
                encoding_format: "float"
            });

            for (let j = 0; j < batch.length; j++) {
                vectors.push({
                    id: crypto.randomUUID(),
                    values: embeddingResponse.data[j].embedding,
                    metadata: {
                        url: url,
                        text: batch[j]
                    }
                });
            }
            console.log(`Processed batch ${Math.floor(i/batchSize) + 1} / ${Math.ceil(chunks.length/batchSize)}`);
        }
        
        if (vectors.length > 0) {
            const ndjson = vectors.map(v => JSON.stringify(v)).join('\n') + '\n';
            await fs.appendFile('vectors.ndjson', ndjson);
            console.log(`Successfully appended ${vectors.length} vectors for Wikipedia to vectors.ndjson`);
        } else {
            console.log("No vectors generated.");
        }
    } catch (e) {
        console.error(`Error loading ${url}:`, e);
    }
}

appendData().catch(console.error);

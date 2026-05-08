import * as fs from "fs/promises";
import * as crypto from "crypto";
import { PuppeteerWebBaseLoader } from "@langchain/community/document_loaders/web/puppeteer";
import OpenAI from "openai";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import "dotenv/config";

// ENV's
const {
    OPENAI_API_KEY
} = process.env;

const openai = new OpenAI({
    apiKey: OPENAI_API_KEY
})

const f1DataSources = [
    "https://en.wikipedia.org/wiki/Formula_One",
    "https://www.skysports.com/f1/news/12433/13117256/lewis",
    "https://www.formula1.com/en/latest/all",
    "https://www.autosport.com",
    "https://www.motorsport.com",
    "https://www.racefans.net",
    "https://www.formula1.com/en/results.html/2025/races.html",
    "https://www.formula1.com/en/racing/2025.html",
    "https://www.fia.com/documents/2025/fia-formula-one-world-championship-event-calendar-2"
]

const scrapePage = async (url: string) => {
    const loader = new PuppeteerWebBaseLoader(url);
    const docs = await loader.load();
    return docs[0].pageContent;
}

const spiltter = new RecursiveCharacterTextSplitter({
    chunkSize: 512,
    chunkOverlap: 100
})

const loadData = async () => {
    const vectors = [];

    for await (const url of f1DataSources) {
        console.log(`Loading ${url}...`);
        try {
            const content = await scrapePage(url);

            const chunks = await spiltter.splitText(content);

            for await (const chunk of chunks) {
                const embedding = await openai.embeddings.create({
                    input: chunk,
                    model: "text-embedding-3-small",
                    encoding_format: "float"
                });

                const vector = embedding.data[0].embedding;

                // Vectorize expects this exact structure
                vectors.push({
                    id: crypto.randomUUID(),
                    values: vector,
                    metadata: {
                        url: url,
                        text: chunk
                    }
                });
            }
        } catch (e) {
            console.error(`Error loading ${url}:`, e);
        }
    }

    // Write to NDJSON (Newline Delimited JSON) file
    const ndjson = vectors.map(v => JSON.stringify(v)).join('\n');
    await fs.writeFile('vectors.ndjson', ndjson);
    console.log(`Successfully wrote ${vectors.length} vectors to vectors.ndjson`);
}

loadData().catch(console.error);
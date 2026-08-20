import {  Worker } from 'bullmq';
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import path from 'path';
import { unlinkSync } from 'fs';
import { OpenAIEmbeddings } from "@langchain/openai";
import { QdrantVectorStore } from "@langchain/qdrant";

const connection = {
    host: process.env.REDIS_HOST,
    port: parseInt(String(process.env.REDIS_PORT) , 10)
};

const embeddings = new OpenAIEmbeddings({
  modelName: "nvidia/nemotron-3-embed-1b:free",
  apiKey:process.env.OPEN_ROUTER_API_KEY,

  configuration: {
    baseURL: "https://openrouter.ai/api/v1",
  },
   encodingFormat: "float",
});

const vectorStore = await QdrantVectorStore.fromExistingCollection(
  embeddings,
  {
    url: process.env.QDRANT_URL,
    collectionName: "pdf-docs",
  }
);


const worker = new Worker('upload-processing-queue', async ({ data: jobData }) => {
  const data =
    typeof jobData === "string"
      ? JSON.parse(jobData)
      : jobData;

    const loader = new PDFLoader(path.resolve(__dirname, '../storage', data.filename), {
      splitPages: true, // Separates documents by page natively
    });
    const rawDocuments = await loader.load();
    console.log("raw doc:",rawDocuments);
    console.log("uploaded");


    const documents = rawDocuments.map((document) => ({
      ...document,
      metadata: {
        ...document.metadata,
        userId: data.userId,
      },
    }));

    await vectorStore.addDocuments(documents);
    console.log("stored in vector store")
    const filePath = path.resolve(__dirname, '../storage', data.filename)
    unlinkSync(filePath)
}, { connection });

worker.on('completed', (job) => {
  console.log(`Job ${job.id} completed successfully`);
});

worker.on('failed', (job, err) => {
  console.error(`Job failed with error:`, err);
});

worker.on('error', (err) => {
  console.error('Worker encountered an error:', err);
});

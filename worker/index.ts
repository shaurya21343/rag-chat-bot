import { Worker } from "bullmq";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import path from "path";
import { unlink } from "fs/promises";
import { OpenAIEmbeddings } from "@langchain/openai";
import { QdrantVectorStore } from "@langchain/qdrant";
import IORedis from "ioredis";
import "dotenv/config";
import { WebPDFLoader } from "@langchain/community/document_loaders/web/pdf";


// --------------------------------------------------
// Environment validation
// --------------------------------------------------

const requiredEnv = [
  "REDIS_URL",
  "OPEN_ROUTER_API_KEY",
  "QDRANT_URL",
  "QDRANT_API_KEY",
];

for (const key of requiredEnv) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}


// --------------------------------------------------
// Redis connection
// --------------------------------------------------

const connection = new IORedis(process.env.REDIS_URL!, {
   maxRetriesPerRequest: null, // Required by BullMQ
  tls: {},  
});

connection.on("connect", () => {
  console.log("Redis connected");
});

connection.on("ready", () => {
  console.log("Redis ready");
});

connection.on("error", (err) => {
  console.error("Redis connection error:", err);
});

connection.on("close", () => {
  console.warn("Redis connection closed");
});


// --------------------------------------------------
// Embeddings
// --------------------------------------------------

const embeddings = new OpenAIEmbeddings({
  modelName: "nvidia/nemotron-3-embed-1b:free",
  apiKey: process.env.OPEN_ROUTER_API_KEY,

  configuration: {
    baseURL: "https://openrouter.ai/api/v1",
  },

  encodingFormat: "float",
});


// --------------------------------------------------
// Qdrant
// --------------------------------------------------

let vectorStore: QdrantVectorStore;

try {
  vectorStore = await QdrantVectorStore.fromExistingCollection(
    embeddings,
    {
      url: process.env.QDRANT_URL!,
      collectionName: "pdf-docs",
      apiKey: process.env.QDRANT_API_KEY!,
    }
  );

  console.log("Qdrant connected");
} catch (error) {
  console.error("Failed to connect to Qdrant:", error);
  process.exit(1);
}


// --------------------------------------------------
// Worker
// --------------------------------------------------

const worker = new Worker(
  "upload-processing-queue",

  async (job) => {
    console.log(`\nProcessing job ${job.id}`);

    let data;

    // ----------------------------------------------
    // Parse job data
    // ----------------------------------------------

    try {
      data =
        typeof job.data === "string"
          ? JSON.parse(job.data)
          : job.data;
        
    } catch (error) {
      console.error("Invalid job data:", error);

      throw new Error(
        `Invalid job data for job ${job.id}`
      );
    }


    // ----------------------------------------------
    // Validate job data
    // ----------------------------------------------

    if (!data?.fileUrl) {
      throw new Error(
        `Missing file url in job ${job.id}`
      );
    }

    if (!data?.userId) {
      throw new Error(
        `Missing userId in job ${job.id}`
      );
    }


    const fileUrl = data.fileUrl

    console.log("File:", fileUrl);
    console.log("User:", data.userId);

    const response = await fetch(fileUrl);

    if (!response.ok) {
      throw new Error(`Failed to fetch PDF: ${response.statusText}`);
    }
    const blob = await response.blob();

    // ----------------------------------------------
    // Check PDF
    // ----------------------------------------------

    try {
      const loader = new WebPDFLoader(blob,{
        splitPages:true
      })

      const rawDocuments = await loader.load();

      if (!rawDocuments || rawDocuments.length === 0) {
        throw new Error(
          "PDF contains no readable documents"
        );
      }

      console.log(
        `Loaded ${rawDocuments.length} pages`
      );


      // --------------------------------------------
      // Add user metadata
      // --------------------------------------------

      const documents = rawDocuments.map((document) => ({
        ...document,

        metadata: {
          ...document.metadata,

          userId: data.userId,
        },
      }));


      // --------------------------------------------
      // Store embeddings in Qdrant
      // --------------------------------------------

      console.log("Generating embeddings...");

      await vectorStore.addDocuments(documents);

      console.log(
        `Stored ${documents.length} documents in Qdrant`
      );


      // --------------------------------------------
      // Delete PDF ONLY after successful processing
      // --------------------------------------------

      try {

        console.log(
          `Deleted processed file: ${data.fileUrl}`
        );
      } catch (deleteError) {
        console.error(
          `Failed to delete file ${data.fileUrl}:`,
          deleteError
        );

        // Don't fail the entire job because cleanup failed
      }


      console.log(
        `Job ${job.id} completed successfully`
      );

      return {
        success: true,
        userId: data.userId,
        pages: documents.length,
      };

    } catch (error) {

      // --------------------------------------------
      // Processing error
      // --------------------------------------------

      console.error(
        `Processing failed for job ${job.id}:`,
        error
      );

      // Important:
      // Re-throw so BullMQ marks the job as FAILED
      // and can retry it.
      throw error;
    }
  },

  {
    connection,

    // Number of PDFs processed simultaneously
    concurrency: 2,

    // Don't let a job stay active forever
    lockDuration: 60000,
  }
);


// --------------------------------------------------
// Worker events
// --------------------------------------------------

worker.on("completed", (job, result) => {
  console.log(
    `Job ${job.id} completed`,
    result
  );
});


worker.on("failed", (job, error) => {
  console.error(
    `Job ${job?.id ?? "unknown"} failed:`,
    error
  );
});


worker.on("error", (error) => {
  console.error(
    "Worker encountered an error:",
    error
  );
});


worker.on("stalled", (jobId) => {
  console.warn(
    `Job ${jobId} has stalled`
  );
});


// --------------------------------------------------
// Graceful shutdown
// --------------------------------------------------

const shutdown = async (signal: string) => {
  console.log(
    `\nReceived ${signal}. Shutting down worker...`
  );

  try {
    await worker.close();

    console.log("Worker closed");

    await connection.quit();

    console.log("Redis connection closed");

    process.exit(0);
  } catch (error) {
    console.error(
      "Error during shutdown:",
      error
    );

    process.exit(1);
  }
};


process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
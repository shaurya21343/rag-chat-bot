import { NextResponse } from "next/server";
import { ChatOpenRouter } from "@langchain/openrouter";
import { OpenAIEmbeddings } from "@langchain/openai";
import { QdrantVectorStore } from "@langchain/qdrant";
import { auth } from "@clerk/nextjs/server";

const embeddings = new OpenAIEmbeddings({
  modelName: "nvidia/nemotron-3-embed-1b:free",
  apiKey: process.env.OPEN_ROUTER_API_KEY,

  configuration: {
    baseURL: "https://openrouter.ai/api/v1",
  },

  encodingFormat: "float",
});

const model = new ChatOpenRouter({
  model: "nvidia/nemotron-3-ultra-550b-a55b:free",
  temperature: 0.7,
  apiKey: process.env.OPEN_ROUTER_API_KEY,
});

export async function POST(request: Request) {
  try {
    // -----------------------------------------
    // Authentication
    // -----------------------------------------

    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized",
        },
        {
          status: 401,
        }
      );
    }

    // -----------------------------------------
    // Get query
    // -----------------------------------------

    const body = await request.json();

    const { query } = body;

    if (!query || typeof query !== "string") {
      return NextResponse.json(
        {
          success: false,
          error: "Query is required",
        },
        {
          status: 400,
        }
      );
    }

    // -----------------------------------------
    // Connect to existing Qdrant collection
    // -----------------------------------------

    const vectorStore =
      await QdrantVectorStore.fromExistingCollection(
        embeddings,
        {
          url: process.env.QDRANT_URL!,
          apiKey: process.env.QDRANT_API_KEY!,
          collectionName: "pdf-docs",
        }
      );

    // -----------------------------------------
    // Similarity search
    // -----------------------------------------

    const documents = await vectorStore.similaritySearch(
      query,
      4,
      {
        must: [
          {
            key: "metadata.userId",
            match: {
              value: userId,
            },
          },
        ],
      }
    );

    console.log("Retrieved documents:", documents.length);

    // -----------------------------------------
    // Prepare context
    // -----------------------------------------

    const context = documents
      .map((doc, index) => {
        return `
--- Document ${index + 1} ---

${doc.pageContent}
`;
      })
      .join("\n");

    // -----------------------------------------
    // LLM prompt
    // -----------------------------------------

    const systemPrompt = `
You are a helpful AI assistant that answers questions
based on the provided PDF context.

Rules:

1. Use the PDF context as the primary source.
2. If the answer is present in the context, answer using it.
3. If the context does not contain the answer, you may use
   your general knowledge, but clearly state that the answer
   was not found in the uploaded PDF.
4. Do not make up information.
5. Keep the answer professional and easy to read.
6. Use paragraphs or bullet points when useful.
7. Do not unnecessarily repeat the question.

PDF CONTEXT:

${context}
`;

    // -----------------------------------------
    // Generate answer
    // -----------------------------------------

    const response = await model.invoke([
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: query,
      },
    ]);

    // -----------------------------------------
    // Response
    // -----------------------------------------

    return NextResponse.json({
      success: true,
      message: response.content,
      sources: documents.map((doc) => ({
        page: doc.metadata?.loc?.pageNumber,
        filename: doc.metadata?.source,
      })),
    });

  } catch (error) {
    console.error("Chat API error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to process query",
      },
      {
        status: 500,
      }
    );
  }
}
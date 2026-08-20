import { NextResponse } from 'next/server';
import { OpenAIEmbeddings } from "@langchain/openai";
import { QdrantVectorStore } from "@langchain/qdrant";
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

const embeddings = new OpenAIEmbeddings({
  modelName: "nvidia/nemotron-3-embed-1b:free",
  apiKey:process.env.OPEN_ROUTER_API_KEY,

  configuration: {
    baseURL: "https://openrouter.ai/api/v1",

    defaultHeaders: {
      "HTTP-Referer": "http://localhost:3000",
      "X-Title": "Qdrant Free Embeddings App",
    },
  },
   encodingFormat: "float",
});

const vectorStore = await QdrantVectorStore.fromExistingCollection(
  embeddings,
  {
    url:process.env.QDRANT_URL ,
    collectionName: "pdf-docs",
  }
);

export async function POST(request: Request) {
   
    const {userId}= await auth()

      const result = await vectorStore.delete({
    filter: {
      must: [
        {
          key: 'metadata.userId',
          match: {
            value: userId,
          },
        },
      ],
    }
  });

  console.log(result)

  return NextResponse.json({success:true})
}
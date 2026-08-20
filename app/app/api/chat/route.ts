import { NextResponse } from 'next/server';
import { ChatOpenRouter } from "@langchain/openrouter";
import { OpenAIEmbeddings } from "@langchain/openai";
import { QdrantVectorStore } from "@langchain/qdrant";
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

const embeddings = new OpenAIEmbeddings({
    modelName: "nvidia/nemotron-3-embed-1b:free",
    apiKey: process.env.OPEN_ROUTER_API_KEY,

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
        url: process.env.QDRANT_URL,
        collectionName: "pdf-docs",
    }
);



const model = new ChatOpenRouter({
    model: "nvidia/nemotron-3-ultra-550b-a55b:free", // Specify any OpenRouter model id
    temperature: 0.7,
    apiKey: process.env.OPEN_ROUTER_API_KEY
});

export async function POST(request: Request) {
    const { userId } = await auth()
    if (!userId) {
        redirect("/")
    }
    const body = await request.json();

    const { query } = body;

    const ret = vectorStore.asRetriever({
        searchType: "similarity",
        // Fetch top 2 most relevant chunks
        k: 2,
        filter: {
            must: [
                {
                    // Target the exact path LangChain uses for metadata
                    key: "metadata.userId",
                    match: {
                        value: userId
                    }
                }
            ]
        }
    });

    const result = await ret.invoke(query);


    const system_prompt = `
    you are an helpfull ai assistant who answeres the user query based on th available context from PDF file

    context:
    ${JSON.stringify(result)} 

    if the the provided content is not  helpfull you can use your own knowledge but state that it was not in context
    and structure your response to llok good and it should not messy and make your response profetional and sum it up in one para 
    `

    const response = await model.invoke(
        `
        ${system_prompt}

        ${query}

        `
    )
    return NextResponse.json({ message: response.content })



}
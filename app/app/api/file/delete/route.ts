import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { QdrantClient } from "@qdrant/js-client-rest";

const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL!,
  apiKey: process.env.QDRANT_API_KEY!,
});

export async function POST() {
  try {
    const { userId } = await auth();

    // User must be logged in
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
    await qdrant.createPayloadIndex("pdf-docs", {
  field_name: "metadata.userId",
  field_schema: "keyword",
});


    // Delete all vectors belonging to this user
    const result = await qdrant.delete("pdf-docs", {
      filter: {
        must: [
          {
            key: "metadata.userId",
            match: {
              value: userId,
            },
          },
        ],
      },
      wait: true,
    });

    console.log("Qdrant delete result:", result);

    return NextResponse.json({
      success: true,
      message: "All files deleted successfully",
    });
  } catch (error) {
    console.error("Failed to delete files:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete files",
      },
      {
        status: 500,
      }
    );
  }
}
import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { Queue } from 'bullmq';
import { mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import { redirect } from 'next/navigation';
import IORedis from "ioredis";
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';

const connection = new IORedis(process.env.REDIS_URL!, {
   maxRetriesPerRequest: null, // Required by BullMQ
  tls: {},  
});

const fileQueue = new Queue("upload-processing-queue", {
  connection,
});




cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function uploadPdfAsRaw(filePath: string): Promise<UploadApiResponse> {
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      resource_type: 'raw', // Crucial: treats the file as generic binary data without image processing
      folder: 'rag-documents', // Optional folder name in your media library
      use_filename: true,
      unique_filename: true,
    });
    
    return result;
  } catch (error) {
    throw new Error(`Cloudinary upload failed: ${error instanceof Error ? error.message : error}`);
  }
}

export async function POST(request: Request) {
    try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.redirect(new URL('/', request.url));
    }

    console.log(userId);
    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: 'No file uploaded' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const sanitizedFilename = file.name
      .replace(/\s+/g, '-')
      .replace(/[^a-zA-Z0-9.\-_]/g, '');

const uploadResult = await new Promise<UploadApiResponse>(
  (resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: "raw",
        folder: "rag-documents",
      },
      (error, result) => {
        if (error) {
          console.error("CLOUDINARY ERROR:");
          console.error(error);
          console.error("FULL ERROR:");
          console.error(JSON.stringify(error, null, 2));

          reject(error);
          return;
        }

        if (!result) {
          reject(new Error("No result from Cloudinary"));
          return;
        }

        resolve(result);
      }
    );

    uploadStream.end(buffer);
  }
);

    console.log(uploadResult);

      await fileQueue.add('process-file', {
        fileUrl:uploadResult.url,
        userId
    });

    return NextResponse.json({ success: true, data: uploadResult });
  } catch (error) {
    console.error('Upload failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Something went wrong while uploading the file',
      },
      { status: 500 }
    );
  }


}
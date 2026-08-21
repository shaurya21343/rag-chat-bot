import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { Queue } from 'bullmq';
import { mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import { redirect } from 'next/navigation';
import IORedis from "ioredis";

const connection = new IORedis(process.env.REDIS_URL!, {
   maxRetriesPerRequest: null, // Required by BullMQ
  tls: {},  
});

const fileQueue = new Queue("upload-processing-queue", {
  connection,
});

export async function POST(request: Request) {
    const { userId } = await auth();
    if(!userId){
      redirect("/")
    }

    console.log(userId)
    const formData = await request.formData();

    const file = formData.get("file") as File;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const storageDir = path.resolve(process.cwd(), '..', 'storage');
    mkdirSync(storageDir, { recursive: true });

    const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const fileName = `${Date.now()}-${safeFileName}`
    const storedFilePath = path.join(storageDir, fileName);
    writeFileSync(storedFilePath, buffer);

    console.log(file)

      await fileQueue.add('process-file', {
        filename:fileName,
        userId
    });

    return NextResponse.json({ success:true })


}
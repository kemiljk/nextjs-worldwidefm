import { NextRequest, NextResponse } from "next/server";
import { createBucketClient } from "@cosmicjs/sdk";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("image") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Create write-enabled Cosmic client
    const cosmic = createBucketClient({
      bucketSlug: process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG as string,
      readKey: process.env.NEXT_PUBLIC_COSMIC_READ_KEY as string,
      writeKey: process.env.COSMIC_WRITE_KEY as string,
    });

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Cosmic
    const media = await cosmic.media.insertOne({
      media: {
        originalname: file.name,
        buffer: buffer,
      },
    });

    return NextResponse.json({
      success: true,
      url: media.media.url,
    });
  } catch (error) {
    console.error("Error uploading image:", error);
    return NextResponse.json({ error: "Failed to upload image" }, { status: 500 });
  }
}

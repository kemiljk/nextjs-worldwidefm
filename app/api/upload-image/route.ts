import { NextRequest, NextResponse } from 'next/server';
import { createBucketClient } from '@cosmicjs/sdk';

// Force Node.js runtime to avoid Edge body-size limits for multipart uploads
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    console.log('📸 Image upload API called');

    const formData = await request.formData();
    const file = formData.get('image') as File;

    if (!file) {
      console.error('❌ No file provided in request');
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    console.log('📸 Image file received:', {
      name: file.name,
      size: `${(file.size / 1024 / 1024).toFixed(2)}MB`,
      type: file.type,
    });

    // Create write-enabled Cosmic client
    const cosmic = createBucketClient({
      bucketSlug: process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG as string,
      readKey: process.env.NEXT_PUBLIC_COSMIC_READ_KEY as string,
      writeKey: process.env.COSMIC_WRITE_KEY as string,
    });

    // Convert File to Buffer
    console.log('📸 Converting file to buffer...');
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Cosmic
    console.log('📸 Uploading to Cosmic...');
    const media = await cosmic.media.insertOne({
      media: {
        originalname: file.name,
        buffer: buffer,
      },
    });

    console.log('✅ Image uploaded successfully:', {
      name: media.media.name,
      url: media.media.url,
    });

    return NextResponse.json({
      success: true,
      media: media.media,
    });
  } catch (error) {
    console.error('❌ Error uploading image:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorDetails = {
      message: errorMessage,
      type: error?.constructor?.name,
      stack: error instanceof Error ? error.stack : undefined,
    };

    console.error('Full error details:', errorDetails);

    let statusCode = 500;
    let userMessage = 'Failed to upload image';

    if (errorMessage.includes('413') || errorMessage.toLowerCase().includes('too large')) {
      statusCode = 413;
      userMessage = 'Image file is too large. Please use a smaller image (under 2MB).';
    } else if (errorMessage.includes('CORS') || errorMessage.includes('Access-Control')) {
      userMessage = 'Connection error. Please check your network and try again.';
    }

    return NextResponse.json(
      {
        error: userMessage,
        details: errorMessage,
      },
      { status: statusCode }
    );
  }
}

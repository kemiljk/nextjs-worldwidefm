import { NextRequest, NextResponse } from 'next/server';
import { createBucketClient } from '@cosmicjs/sdk';

export async function POST(request: NextRequest) {
  try {
    console.log('🎵 Media upload API called');

    const formData = await request.formData();
    const file = formData.get('media') as File;
    const metadata = formData.get('metadata') as string;

    if (!file) {
      console.error('❌ No file provided in request');
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    console.log('🎵 Media file received:', {
      name: file.name,
      size: `${(file.size / 1024 / 1024).toFixed(2)}MB`,
      type: file.type,
    });

    // Parse metadata
    let parsedMetadata = {};
    if (metadata) {
      try {
        parsedMetadata = JSON.parse(metadata);
        console.log('📝 Metadata parsed:', parsedMetadata);
      } catch (error) {
        console.error('❌ Error parsing metadata:', error);
      }
    }

    // Try to upload to RadioCult (optional - may not be permitted for all stations)
    let radiocultMediaId: string | undefined = undefined;
    let radiocultError: string | undefined = undefined;
    const stationId = process.env.NEXT_PUBLIC_RADIOCULT_STATION_ID;
    const secretKey = process.env.RADIOCULT_SECRET_KEY;

    if (stationId && secretKey) {
      try {
        console.log('📡 Attempting RadioCult upload...');

        // Convert file to buffer first to ensure we have actual binary data
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        // Create a Blob-like object for FormData that includes filename and content type
        // This is more robust than passing the File object directly in some environments
        const fileBlob = new Blob([buffer], { type: file.type });

        // Prepare form data for RadioCult
        const rcForm = new FormData();
        rcForm.append('stationMedia', fileBlob, file.name);
        rcForm.append('metadata', JSON.stringify(parsedMetadata));

        const rcRes = await fetch(`https://api.radiocult.fm/api/station/${stationId}/media/track`, {
          method: 'POST',
          headers: {
            'x-api-key': secretKey,
          },
          body: rcForm,
        });

        if (rcRes.ok) {
          const rcJson = await rcRes.json();
          radiocultMediaId = rcJson.track?.id;
          console.log('✅ RadioCult upload SUCCESS - Media ID:', radiocultMediaId);
          console.log('📝 RadioCult response:', JSON.stringify(rcJson, null, 2));
        } else {
          radiocultError = await rcRes.text();
          console.warn('❌ RadioCult upload FAILED (status:', rcRes.status, '):', radiocultError);
        }
      } catch (error) {
        console.warn('⚠️ RadioCult upload error:', error);
        radiocultError = error instanceof Error ? error.message : 'Unknown upload error';
      }
    } else {
      console.log('ℹ️ RadioCult credentials not configured, skipping RadioCult upload');
    }

    // Upload to Cosmic
    console.log('☁️ Uploading to Cosmic...');
    const cosmic = createBucketClient({
      bucketSlug: process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG as string,
      readKey: process.env.NEXT_PUBLIC_COSMIC_READ_KEY as string,
      writeKey: process.env.COSMIC_WRITE_KEY as string,
    });

    console.log('🔄 Converting file to buffer...');
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log('📤 Uploading buffer to Cosmic...');
    const cosmicMedia = await cosmic.media.insertOne({
      media: {
        originalname: file.name,
        buffer: buffer,
      },
    });

    console.log('✅ Media uploaded successfully:', {
      name: cosmicMedia.media.name,
      url: cosmicMedia.media.url,
      radiocultId: radiocultMediaId,
    });

    return NextResponse.json({
      success: true,
      radiocultMediaId: radiocultMediaId || null,
      radiocultError: radiocultError || null,
      cosmicMedia: cosmicMedia.media,
      message: radiocultMediaId
        ? 'Successfully uploaded to both RadioCult and Cosmic'
        : radiocultError
        ? `Successfully uploaded to Cosmic, but RadioCult failed: ${radiocultError}`
        : 'Successfully uploaded to Cosmic (RadioCult upload skipped)',
    });
  } catch (error) {
    console.error('❌ Error uploading media:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorDetails = {
      message: errorMessage,
      type: error?.constructor?.name,
      stack: error instanceof Error ? error.stack : undefined,
    };

    console.error('Full error details:', errorDetails);

    return NextResponse.json(
      {
        error: 'Failed to upload media',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}

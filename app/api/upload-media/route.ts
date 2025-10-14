import { NextRequest, NextResponse } from 'next/server';
import { createBucketClient } from '@cosmicjs/sdk';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('media') as File;
    const metadata = formData.get('metadata') as string;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Parse metadata
    let parsedMetadata = {};
    if (metadata) {
      try {
        parsedMetadata = JSON.parse(metadata);
      } catch (error) {
        console.error('Error parsing metadata:', error);
      }
    }

    // Try to upload to RadioCult (optional - may not be permitted for all stations)
    let radiocultMediaId: string | undefined = undefined;
    const stationId = process.env.NEXT_PUBLIC_RADIOCULT_STATION_ID;
    const secretKey = process.env.RADIOCULT_SECRET_KEY;

    if (stationId && secretKey) {
      try {
        // Prepare form data for RadioCult
        const rcForm = new FormData();
        rcForm.append('stationMedia', file);
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
          const errorText = await rcRes.text();
          console.warn('❌ RadioCult upload FAILED (status:', rcRes.status, '):', errorText);
          // Continue without RadioCult media upload
        }
      } catch (error) {
        console.warn('RadioCult upload failed:', error);
        // Continue without RadioCult media upload
      }
    }

    // Upload to Cosmic
    const cosmic = createBucketClient({
      bucketSlug: process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG as string,
      readKey: process.env.NEXT_PUBLIC_COSMIC_READ_KEY as string,
      writeKey: process.env.COSMIC_WRITE_KEY as string,
    });

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const cosmicMedia = await cosmic.media.insertOne({
      media: {
        originalname: file.name,
        buffer: buffer,
      },
    });

    return NextResponse.json({
      success: true,
      radiocultMediaId: radiocultMediaId || null,
      cosmicMedia: cosmicMedia.media,
      message: radiocultMediaId
        ? 'Successfully uploaded to both RadioCult and Cosmic'
        : 'Successfully uploaded to Cosmic (RadioCult upload skipped due to permissions)',
    });
  } catch (error) {
    console.error('Error uploading media:', error);
    return NextResponse.json(
      {
        error: 'Failed to upload media',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

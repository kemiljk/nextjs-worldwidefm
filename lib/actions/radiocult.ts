'use server';

import { createBucketClient } from '@cosmicjs/sdk';
import { getHostByName, getHosts } from '../cosmic-service';

export async function uploadMediaToRadioCultAndCosmic(formData: FormData) {
  const file = formData.get('media') as File;
  const metadataStr = formData.get('metadata') as string;

  if (!file) {
    return { success: false, error: 'No file provided' };
  }

  console.log('🎵 Media upload server action called:', {
    name: file.name,
    size: `${(file.size / 1024 / 1024).toFixed(2)}MB`,
    type: file.type,
  });

  let parsedMetadata: Record<string, any> = {};
  if (metadataStr) {
    try {
      parsedMetadata = JSON.parse(metadataStr);
    } catch {
      console.error('❌ Error parsing metadata');
    }
  }

  // Convert file to buffer once for reuse
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Try to upload to RadioCult (optional — continues if it fails)
  let radiocultMediaId: string | undefined = undefined;
  let radiocultError: string | undefined = undefined;
  const stationId = process.env.NEXT_PUBLIC_RADIOCULT_STATION_ID;
  const secretKey = process.env.RADIOCULT_SECRET_KEY;

  if (stationId && secretKey) {
    try {
      console.log('📡 Attempting RadioCult upload...');
      const fileBlob = new Blob([buffer], { type: file.type });
      const rcForm = new FormData();
      rcForm.append('stationMedia', fileBlob, file.name);
      rcForm.append('metadata', JSON.stringify(parsedMetadata));

      const rcRes = await fetch(
        `https://api.radiocult.fm/api/station/${stationId}/media/track`,
        {
          method: 'POST',
          headers: { 'x-api-key': secretKey },
          body: rcForm,
        }
      );

      if (rcRes.ok) {
        const rcJson = await rcRes.json();
        radiocultMediaId = rcJson.track?.id;
        console.log('✅ RadioCult upload SUCCESS - Media ID:', radiocultMediaId);
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

  return {
    success: true,
    radiocultMediaId: radiocultMediaId || null,
    radiocultError: radiocultError || null,
    cosmicMedia: cosmicMedia.media,
    message: radiocultMediaId
      ? 'Successfully uploaded to both RadioCult and Cosmic'
      : radiocultError
        ? `Successfully uploaded to Cosmic, but RadioCult failed: ${radiocultError}`
        : 'Successfully uploaded to Cosmic (RadioCult upload skipped)',
  };
}

export async function getHostProfileUrl(hostName: string): Promise<string | null> {
  try {
    let host = await getHostByName(hostName);

    if (!host) {
      const allHosts = await getHosts({ limit: 1000 });
      host = allHosts.objects.find(
        h =>
          h.title.toLowerCase().includes(hostName.toLowerCase()) ||
          hostName.toLowerCase().includes(h.title.toLowerCase())
      );
    }

    return host ? `/hosts/${host.slug}` : null;
  } catch (error) {
    console.error('Error getting host profile URL:', error);
    return null;
  }
}

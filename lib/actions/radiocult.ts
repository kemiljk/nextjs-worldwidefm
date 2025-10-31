'use server';

import FormData from 'form-data';
import { getHostByName, getHosts } from '../cosmic-service';

export async function uploadMediaToRadioCultAndCosmic(
  file: File,
  metadata: Record<string, any> = {}
) {
  const stationId = process.env.NEXT_PUBLIC_RADIOCULT_STATION_ID;
  const secretKey = process.env.RADIOCULT_SECRET_KEY;
  if (!stationId || !secretKey) {
    throw new Error('Missing RadioCult station ID or secret key');
  }

  const rcForm = new FormData();
  rcForm.append('stationMedia', file as any);
  rcForm.append('metadata', JSON.stringify(metadata));

  const rcRes = await fetch(`https://api.radiocult.fm/api/station/${stationId}/media/track`, {
    method: 'POST',
    headers: {
      ...rcForm.getHeaders?.(),
      'x-api-key': secretKey,
    },
    body: rcForm as any,
  });
  if (!rcRes.ok) {
    throw new Error('Failed to upload to RadioCult');
  }
  const rcJson = await rcRes.json();
  const radiocultMediaId = rcJson.track?.id;

  const cosmicForm = new FormData();
  cosmicForm.append('media', file as any);
  const cosmicRes = await fetch(
    `https://api.cosmicjs.com/v2/buckets/${process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG}/media`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.COSMIC_WRITE_KEY}`,
        ...cosmicForm.getHeaders?.(),
      },
      body: cosmicForm as any,
    }
  );
  if (!cosmicRes.ok) {
    throw new Error('Failed to upload to Cosmic');
  }
  const cosmicJson = await cosmicRes.json();
  const cosmicMedia = cosmicJson.media;

  return {
    radiocultMediaId,
    cosmicMedia,
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


import { NextRequest, NextResponse } from 'next/server';
import { del, isVercelBlobUrl } from '@/lib/blob-client';
import { uploadMediaToMixcloud } from '@/lib/mixcloud-upload';
import { saveMixcloudLinkToEpisode } from '@/lib/episode-archive';

// Must be a literal — Next.js rejects imported segment config. Keep in sync with lib/upload-config.ts.
export const maxDuration = 800;

export async function POST(request: NextRequest) {
  let mediaUrlForCleanup: string | undefined;
  let shouldCleanupMediaUrl = false;

  try {
    const accessToken = process.env.MIXCLOUD_ACCESS_TOKEN;
    const formData = await request.formData();

    const audioFile = formData.get('audio') as File | null;
    const mediaUrl = formData.get('mediaUrl') as string | null;
    const requestedFileName = formData.get('fileName') as string | null;
    const episodeId = (formData.get('episodeId') as string | null)?.trim() || '';
    const episodeSlug = (formData.get('episodeSlug') as string | null)?.trim() || '';
    const title = formData.get('title') as string | null;
    const description = formData.get('description') as string | null;
    const imageUrl = formData.get('imageUrl') as string | null;
    const tagsJson = formData.get('tags') as string | null;
    const hostsJson = formData.get('hosts') as string | null;
    const broadcastDate = formData.get('broadcastDate') as string | null;
    const broadcastTime = formData.get('broadcastTime') as string | null;
    const duration = formData.get('duration') as string | null;

    shouldCleanupMediaUrl = formData.get('cleanup') === 'true';
    mediaUrlForCleanup = mediaUrl || undefined;

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Mixcloud not configured (MIXCLOUD_ACCESS_TOKEN)' },
        { status: 503 }
      );
    }

    const result = await uploadMediaToMixcloud({
      audioFile,
      mediaUrl,
      fileName: requestedFileName,
      title: title || '',
      description,
      imageUrl,
      tagsJson,
      hostsJson,
      broadcastDate,
      broadcastTime,
      duration,
      accessToken,
    });

    if (!result.success) {
      console.error('Mixcloud upload rejected:', {
        status: result.status,
        error: result.error,
        details: result.details,
      });
      return NextResponse.json(
        {
          error: result.error,
          details: result.details,
        },
        {
          status:
            result.status && result.status >= 400 && result.status < 500 ? result.status : 502,
        }
      );
    }

    // Save the cloudcast URL to Cosmic here rather than relying on the browser to
    // follow up: a long master upload can outlive the client, and the episode page
    // is useless without its player.
    let episodeUpdated = false;
    let episodeUpdateError: string | undefined;

    if (episodeId) {
      try {
        await saveMixcloudLinkToEpisode(episodeId, result.url, episodeSlug || undefined);
        episodeUpdated = true;
      } catch (updateError) {
        episodeUpdateError =
          updateError instanceof Error && updateError.message
            ? updateError.message
            : 'Failed to save the Mixcloud link to the episode';
        console.error('Failed to save Mixcloud link to episode:', updateError);
      }
    }

    return NextResponse.json({
      url: result.url,
      key: result.key,
      warning: result.warning,
      episodeUpdated,
      episodeUpdateError,
    });
  } catch (error) {
    console.error('Mixcloud upload error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Mixcloud upload failed' },
      { status: 500 }
    );
  } finally {
    if (shouldCleanupMediaUrl && mediaUrlForCleanup && isVercelBlobUrl(mediaUrlForCleanup)) {
      try {
        await del(mediaUrlForCleanup);
      } catch (cleanupError) {
        console.error('Failed to delete temporary Mixcloud upload blob:', cleanupError);
      }
    }
  }
}

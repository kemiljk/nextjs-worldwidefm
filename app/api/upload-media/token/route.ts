import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextResponse } from 'next/server';

export const maxDuration = 60;

export async function POST(request: Request): Promise<NextResponse> {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      console.error('❌ Vercel Blob token request failed: BLOB_READ_WRITE_TOKEN is not configured');
      return NextResponse.json(
        {
          error: 'Vercel Blob is not configured. Set BLOB_READ_WRITE_TOKEN before uploading audio.',
        },
        { status: 500 }
      );
    }

    const body = (await request.json()) as HandleUploadBody;
    const tokenRequest = body as HandleUploadBody & {
      pathname?: string;
      payload?: unknown;
    };
    console.log('🎵 Vercel Blob client token requested:', {
      type: body.type,
      pathname: tokenRequest.pathname,
      payload: tokenRequest.payload,
    });

    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async pathname => {
        /**
         * Generate a client token for the browser to upload the file directly.
         * You can add authorization logic here.
         */
        return {
          allowedContentTypes: [
            'audio/mpeg',
            'audio/mp3',
            'audio/wav',
            'audio/x-wav',
            'audio/ogg',
            'audio/aac',
            'audio/mp4',
            'audio/m4a',
            'audio/x-m4a',
            'audio/flac',
            'application/octet-stream', // Fallback for files with missing ID3 tags
          ],
          maximumSizeInBytes: 700 * 1024 * 1024, // 700MB
          tokenPayload: JSON.stringify({
            pathname,
          }),
        };
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    console.error('❌ Vercel Blob token request failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate upload token' },
      { status: 400 } // The client will use this to show a nice error message
    );
  }
}

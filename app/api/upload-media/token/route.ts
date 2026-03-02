import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextResponse } from 'next/server';

export const maxDuration = 60;

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
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
            // optional, sent to your server on upload completion
          }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        // This callback is called on your server after the upload is completed
        console.log('✅ Vercel Blob upload completed:', blob.url);
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 } // The client will use this to show a nice error message
    );
  }
}

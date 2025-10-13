import { revalidateTag, revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // Verify webhook secret
    const secret = request.headers.get('x-cosmic-webhook-secret');
    if (secret !== process.env.COSMIC_WEBHOOK_SECRET) {
      console.warn('Invalid Cosmic webhook secret received');
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    console.log('Cosmic webhook received:', JSON.stringify(body, null, 2));

    const { type, data } = body;
    const objectType = data?.type || data?.object?.type;
    const slug = data?.slug || data?.object?.slug;

    const revalidatedItems: string[] = [];

    // Handle different object types
    switch (objectType) {
      case 'episode':
      case 'episodes':
        // Revalidate episode-related pages
        revalidateTag('episodes');
        revalidatePath('/', 'page');
        revalidatePath('/shows', 'page');
        
        if (slug) {
          revalidatePath(`/episode/${slug}`, 'page');
          revalidatedItems.push(`/episode/${slug}`);
        }
        
        revalidatedItems.push('episodes', '/', '/shows');
        console.log(`Episode ${type}: ${slug || 'unknown'}`);
        break;

      case 'regular-hosts':
      case 'hosts':
        // Revalidate host-related pages
        revalidateTag('hosts');
        revalidatePath('/', 'page');
        
        if (slug) {
          revalidatePath(`/hosts/${slug}`, 'page');
          revalidatedItems.push(`/hosts/${slug}`);
        }
        
        revalidatedItems.push('hosts', '/');
        console.log(`Host ${type}: ${slug || 'unknown'}`);
        break;

      case 'takeovers':
        // Revalidate takeover-related pages
        revalidateTag('takeovers');
        revalidatePath('/', 'page');
        
        if (slug) {
          revalidatePath(`/takeovers/${slug}`, 'page');
          revalidatedItems.push(`/takeovers/${slug}`);
        }
        
        revalidatedItems.push('takeovers', '/');
        console.log(`Takeover ${type}: ${slug || 'unknown'}`);
        break;

      case 'genres':
        // Revalidate genre-related pages
        revalidateTag('genres');
        revalidatePath('/shows', 'page');
        
        if (slug) {
          revalidatePath(`/genre/${slug}`, 'page');
          revalidatedItems.push(`/genre/${slug}`);
        }
        
        revalidatedItems.push('genres', '/shows');
        console.log(`Genre ${type}: ${slug || 'unknown'}`);
        break;

      case 'posts':
      case 'editorial':
        // Revalidate editorial pages
        revalidateTag('posts');
        revalidatePath('/', 'page');
        revalidatePath('/editorial', 'page');
        
        if (slug) {
          revalidatePath(`/editorial/${slug}`, 'page');
          revalidatedItems.push(`/editorial/${slug}`);
        }
        
        revalidatedItems.push('posts', '/', '/editorial');
        console.log(`Post ${type}: ${slug || 'unknown'}`);
        break;

      case 'videos':
        // Revalidate video pages
        revalidateTag('videos');
        revalidatePath('/', 'page');
        revalidatePath('/videos', 'page');
        
        if (slug) {
          revalidatePath(`/videos/${slug}`, 'page');
          revalidatedItems.push(`/videos/${slug}`);
        }
        
        revalidatedItems.push('videos', '/', '/videos');
        console.log(`Video ${type}: ${slug || 'unknown'}`);
        break;

      default:
        // For unknown types, revalidate homepage and shows
        console.log(`Unknown object type: ${objectType}, revalidating common pages`);
        revalidatePath('/', 'page');
        revalidatePath('/shows', 'page');
        revalidatedItems.push('/', '/shows');
    }

    console.log(`Cosmic webhook processed at ${new Date().toISOString()}`);
    console.log(`Revalidated: ${revalidatedItems.join(', ')}`);

    return NextResponse.json({
      success: true,
      revalidated: revalidatedItems,
      message: `Successfully processed ${type} for ${objectType}`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error processing Cosmic webhook:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}


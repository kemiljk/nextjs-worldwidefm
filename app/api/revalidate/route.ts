import { unstable_rethrow } from 'next/navigation';
import { timingSafeEqual } from 'node:crypto';
import { revalidateContent } from '@/lib/content-revalidation';
import { revalidateTag, revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Available cache tags for manual revalidation:
 *
 * Content Tags:
 * - homepage     → Homepage sections and layout
 * - hero         → Homepage hero section (weekly updates)
 * - episodes     → All episode listings
 * - latest       → Latest episodes section
 * - shows        → Show/episode archive
 * - schedule     → Weekly schedule
 * - editorial    → Posts and editorial content
 * - posts        → Individual posts
 * - hosts        → Host profiles
 * - takeovers    → Takeover pages
 * - genres       → Genre listings
 * - categories   → Post categories
 * - navigation   → Site navigation
 * - about        → About page
 * - membership   → Membership page
 *
 * Usage examples:
 * - POST /api/revalidate?secret=xxx&tag=hero        → Refresh hero section
 * - POST /api/revalidate?secret=xxx&tag=episodes    → Refresh all episodes
 * - POST /api/revalidate?secret=xxx&tag=latest      → Refresh latest episodes
 * - POST /api/revalidate?secret=xxx&tag=schedule    → Refresh schedule
 * - POST /api/revalidate?secret=xxx&tag=editorial   → Refresh editorial content
 * - POST /api/revalidate?secret=xxx                 → Refresh everything (default)
 * - GET  /api/revalidate?secret=xxx&tag=hero        → Same as POST (for easy browser testing)
 */

async function handleRevalidation(request: NextRequest) {
  try {
    const secret =
      request.headers.get('authorization')?.replace(/^Bearer /, '') ||
      request.nextUrl.searchParams.get('secret');
    const expected = process.env.REVALIDATION_SECRET;
    if (
      !secret ||
      !expected ||
      Buffer.byteLength(secret) !== Buffer.byteLength(expected) ||
      !timingSafeEqual(Buffer.from(secret), Buffer.from(expected))
    ) {
      console.warn('Invalid revalidation secret received');
      return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
    }

    const tag = request.nextUrl.searchParams.get('tag');
    const path = request.nextUrl.searchParams.get('path');
    const type = request.nextUrl.searchParams.get('type');

    let body: Record<string, unknown> = {};
    if (request.method === 'POST') {
      try {
        body = await request.json();
      } catch {
        body = {};
      }
    }

    const revalidatedItems: string[] = [];
    const payload = (body.object || body.data || body) as Record<string, unknown>;
    const objectType =
      typeof payload.type === 'string' && payload.type !== 'page' && payload.type !== 'layout'
        ? payload.type
        : undefined;
    if (objectType && !tag && !path && !body.tag && !body.path) {
      const slug = typeof payload.slug === 'string' ? payload.slug : undefined;
      if (objectType.length > 100 || (slug && slug.length > 150)) {
        return NextResponse.json({ message: 'Invalid content identity' }, { status: 400 });
      }
      revalidatedItems.push(...revalidateContent(objectType, slug).map(t => `tag:${t}`));
    }

    // Revalidate by tag if specified
    if (tag || body.tag) {
      const tagInput = (tag || body.tag) as unknown;
      const rawTagString = typeof tagInput === 'string' ? tagInput : '';
      const tagsToRevalidate = rawTagString
        .split(',')
        .map(t => t.trim())
        .filter(Boolean);

      for (const tagToRevalidate of tagsToRevalidate) {
        revalidateTag(tagToRevalidate, { expire: 0 });
        revalidatedItems.push(`tag:${tagToRevalidate}`);
        console.log(`Revalidated tag: ${tagToRevalidate}`);
      }
    }

    // Revalidate by path if specified
    if (path || body.path) {
      const pathToRevalidate = (path || body.path) as string;
      const revalidationType = (type || body.type || 'page') as 'page' | 'layout';
      revalidatePath(pathToRevalidate, revalidationType);
      revalidatedItems.push(`path:${pathToRevalidate}(${revalidationType})`);
      console.log(`Revalidated path: ${pathToRevalidate} (${revalidationType})`);
    }

    // If no specific tag or path, revalidate all major content tags
    if (!objectType && !tag && !path && !body.tag && !body.path) {
      const allTags = [
        'public-content',
        'content-relationships',
        'videos',
        'locations',
        'about',
        'membership',
        'homepage',
        'hero',
        'episodes',
        'latest',
        'shows',
        'schedule',
        'editorial',
        'posts',
        'hosts',
        'takeovers',
        'genres',
        'categories',
        'navigation',
      ];

      for (const t of allTags) {
        revalidateTag(t, { expire: 0 });
        revalidatedItems.push(`tag:${t}`);
      }

      revalidatePath('/', 'page');
      revalidatePath('/shows', 'page');
      revalidatePath('/schedule', 'page');
      revalidatePath('/editorial', 'page');
      revalidatedItems.push(
        'path:/(page)',
        'path:/shows(page)',
        'path:/schedule(page)',
        'path:/editorial(page)'
      );
      console.log('Revalidated all content');
    }

    console.log(`Revalidation completed at ${new Date().toISOString()}`);

    return NextResponse.json({
      revalidated: true,
      now: Date.now(),
      items: revalidatedItems,
      message: `Successfully revalidated: ${revalidatedItems.join(', ')}`,
    });
  } catch (error) {
    unstable_rethrow(error);
    console.error('Error revalidating content:', error);
    return NextResponse.json(
      {
        message: 'Error revalidating content',
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// Support both GET and POST for easier manual triggering
export async function GET(request: NextRequest) {
  return handleRevalidation(request);
}

export async function POST(request: NextRequest) {
  return handleRevalidation(request);
}

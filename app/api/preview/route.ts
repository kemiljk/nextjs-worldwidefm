import { NextRequest, NextResponse } from 'next/server';
import {
  createPreviewToken,
  isValidPreviewSecret,
  PREVIEW_PATHS,
  type PreviewType,
} from '@/lib/preview-token';

/**
 * Cosmic's "Preview" button for posts and episodes points here:
 *   /api/preview?secret=<PREVIEW_SECRET>&type=posts&slug=[object_slug]
 * It redirects to the page with a token for that one slug, which is the URL to share.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const slug = searchParams.get('slug')?.trim();
  const type = (searchParams.get('type') || 'posts') as PreviewType;

  if (!isValidPreviewSecret(searchParams.get('secret'))) {
    return NextResponse.json({ error: 'Invalid preview link' }, { status: 401 });
  }
  if (!slug || !Object.hasOwn(PREVIEW_PATHS, type)) {
    return NextResponse.json({ error: 'Missing or unsupported slug/type' }, { status: 400 });
  }

  const token = createPreviewToken(type, slug);
  const destination = new URL(`${PREVIEW_PATHS[type]}/${encodeURIComponent(slug)}`, request.url);
  destination.searchParams.set('preview', token!);

  return NextResponse.redirect(destination);
}

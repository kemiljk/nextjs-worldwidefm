import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPostBySlug, getRelatedPosts } from '@/lib/actions';
import { format } from 'date-fns';
import EditorialSection from '@/components/editorial/editorial-section';
import { generatePostMetadata } from '@/lib/metadata-utils';
import { PostObject } from '@/lib/cosmic-config';
import {
  StandardLayout,
  FeaturedLayout,
  GalleryLayout,
  MinimalLayout,
} from '@/components/editorial/editorial-layouts';
import { PreviewBanner } from '@/components/ui/preview-banner';

export const dynamic = 'force-dynamic';
export const dynamicParams = true;
export const revalidate = 0;

interface Props {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ preview?: string }>;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  try {
    const { slug } = await params;
    const { preview } = await (searchParams || Promise.resolve({ preview: undefined }));

    const response = await getPostBySlug(slug);

    if (response?.object) {
      return generatePostMetadata(response.object);
    }

    return generatePostMetadata({ title: 'Article Not Found' });
  } catch (error) {
    console.error('Error generating editorial metadata:', error);
    return generatePostMetadata({ title: 'Article Not Found' });
  }
}

export default async function EditorialArticlePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ preview?: string }>;
}) {
  // Await the entire params object first
  const resolvedParams = await params;
  const resolvedSearchParams = await (searchParams || Promise.resolve({ preview: undefined }));
  const preview = resolvedSearchParams.preview;

  if (preview) {
    console.log('[Editorial Preview] Preview mode enabled for slug:', resolvedParams.slug);
  }

  const response = await getPostBySlug(resolvedParams.slug);

  if (!response?.object) {
    notFound();
  }

  const post = response.object;

  // Get related posts based on categories
  let relatedPosts: PostObject[] = [];
  try {
    relatedPosts = await getRelatedPosts(post);
  } catch (error) {
    console.error('Error fetching related posts in EditorialArticlePage:', error);
    relatedPosts = [];
  }

  // Format the date
  const postDate = post.metadata?.date ? new Date(post.metadata.date) : null;
  const formattedDate = postDate ? format(postDate, 'dd-MM-yyyy') : '';
  const imageGallery = post.metadata?.image_gallery || [];

  // Smart props for layout control
  const postType = post.metadata?.type?.key || 'article';
  const isFeatured = post.metadata?.is_featured || false;
  const featuredSize = post.metadata?.featured_size?.key || 'small';
  const imageAspectRatio = post.metadata?.image_aspect_ratio?.key || '1_1';
  const textFocus = post.metadata?.text_focus || false;

  // Determine which layout to use based on smart props
  const getLayoutComponent = () => {
    // Video posts get special treatment - use Gallery layout for better video display
    if (postType === 'video') {
      return <GalleryLayout post={post} formattedDate={formattedDate} />;
    }

    // Featured posts get special treatment (only large featured posts use FeaturedLayout)
    if (isFeatured && featuredSize === 'large') {
      return <FeaturedLayout post={post} formattedDate={formattedDate} />;
    }

    // Gallery-focused posts (with image gallery and 4:3 aspect ratio)
    if (imageGallery.length > 0 && imageAspectRatio === '4_3') {
      return <GalleryLayout post={post} formattedDate={formattedDate} />;
    }

    // Minimal layout for text-focused posts or posts with no image/gallery
    if (textFocus || (!post.metadata?.image?.imgix_url && !imageGallery.length)) {
      return <MinimalLayout post={post} formattedDate={formattedDate} />;
    }

    // Default standard layout
    return <StandardLayout post={post} formattedDate={formattedDate} />;
  };

  // Check if this is a draft post
  const isDraft = post.status === 'draft';

  return (
    <>
      {/* Preview Banner - show when post is a draft */}
      {isDraft && <PreviewBanner />}

      {getLayoutComponent()}

      {/* Related Articles */}
      {relatedPosts.length > 0 && (
        <div className='border-t'>
          <div className='max-w-7xl mx-auto px-4 py-16'>
            <EditorialSection title='Related Articles' posts={relatedPosts} layout='grid' />
          </div>
        </div>
      )}
    </>
  );
}

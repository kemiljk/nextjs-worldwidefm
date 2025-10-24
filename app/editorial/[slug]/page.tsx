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

interface Props {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ preview?: string }>;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  try {
    const { slug } = await params;
    const { preview } = await (searchParams || Promise.resolve({ preview: undefined }));

    const response = await getPostBySlug(slug, preview);

    if (response?.object) {
      return generatePostMetadata(response.object);
    }

    return generatePostMetadata({ title: 'Article Not Found' });
  } catch (error) {
    console.error('Error generating editorial metadata:', error);
    return generatePostMetadata({ title: 'Article Not Found' });
  }
}

interface Category {
  id: string;
  slug: string;
  title: string;
  content: string;
  bucket: string;
  created_at: string;
  modified_at: string;
  status: string;
  published_at: string;
  modified_by: string;
  created_by: string;
  type: string;
  metadata: null;
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
  const { preview } = await (searchParams || Promise.resolve({ preview: undefined }));

  const response = await getPostBySlug(resolvedParams.slug, preview);

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

  // Determine layout style from metadata with defaults
  const imageUrl = post.metadata?.image?.imgix_url || '';
  const description = post.metadata?.excerpt || '';
  const content = post.metadata?.content || '';
  const categories = post.metadata?.categories || [];
  const author = post.metadata?.author;
  const imageGallery = post.metadata?.image_gallery || [];

  // Smart props for layout control
  const postType = post.metadata?.type?.key || 'article';
  const featuredSize = post.metadata?.featured_size?.key || 'small';
  const imageAspectRatio = post.metadata?.image_aspect_ratio?.key || '1_1';
  const displayStyle = post.metadata?.display_style?.key || 'standard';
  const isFeatured = post.metadata?.is_featured || false;

  // Generate alt text for the hero image
  const heroImageAlt = `${post.title} - Featured image`;

  // Define breadcrumbs
  const breadcrumbs = [
    { href: '/', label: 'Home' },
    { href: '/editorial', label: 'Editorial' },
    { label: post.title },
  ];

  // Determine which layout to use based on smart props
  const getLayoutComponent = () => {
    // Featured posts get special treatment
    if (isFeatured && featuredSize === 'large') {
      return <FeaturedLayout post={post} formattedDate={formattedDate} />;
    }

    // Gallery-focused posts
    if (imageGallery.length > 0 && imageAspectRatio === '4_3') {
      return <GalleryLayout post={post} formattedDate={formattedDate} />;
    }

    // Minimal layout for text-heavy posts
    if (displayStyle === 'minimal' || (!post.metadata?.image?.imgix_url && !imageGallery.length)) {
      return <MinimalLayout post={post} formattedDate={formattedDate} />;
    }

    // Default standard layout
    return <StandardLayout post={post} formattedDate={formattedDate} />;
  };

  return (
    <>
      {/* Preview Banner - only show when in preview mode */}
      {preview && <PreviewBanner />}

      <div className={preview ? 'pt-12' : ''}>
        {getLayoutComponent()}

        {/* Related Articles */}
        {relatedPosts.length > 0 && (
          <div className='border-t'>
            <div className='max-w-7xl mx-auto px-4 py-16'>
              <EditorialSection title='Related Articles' posts={relatedPosts} layout='grid' />
            </div>
          </div>
        )}
      </div>
    </>
  );
}

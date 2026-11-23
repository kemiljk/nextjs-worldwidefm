import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPostBySlug, getRelatedPosts } from '@/lib/actions/posts';
import { format } from 'date-fns';
import EditorialSection from '@/components/editorial/editorial-section';
import { generatePostMetadata } from '@/lib/metadata-utils';
import { PostObject } from '@/lib/cosmic-config';
import { ShowCard } from '@/components/ui/show-card';
import { transformShowToViewData } from '@/lib/cosmic-service';
import {
  StandardLayout,
  FeaturedLayout,
  GalleryLayout,
  MinimalLayout,
} from '@/components/editorial/editorial-layouts';
import { PreviewBanner } from '@/components/ui/preview-banner';
import { isValidPreviewToken } from '@/lib/preview-token';
import { getPostKind } from '@/lib/post-kind';

interface Props {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ preview?: string }>;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { preview } = await (searchParams || Promise.resolve({ preview: undefined }));
  try {
    const response = await getPostBySlug(slug, {
      includeDrafts: isValidPreviewToken('posts', slug, preview),
    });

    if (response?.object) {
      return generatePostMetadata({
        ...response.object,
        noIndex: response.object.status === 'draft',
      });
    }

    return generatePostMetadata({ title: 'Article Not Found', noIndex: true });
  } catch (error) {
    console.error('Error generating editorial metadata:', error);
    return generatePostMetadata({ title: 'Article Not Found', noIndex: true });
  }
}

export default async function EditorialArticlePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ preview?: string }>;
}) {
  const resolvedParams = await params;
  const { preview } = await (searchParams || Promise.resolve({ preview: undefined }));

  // A valid token (from /api/preview) unlocks this post's draft; anything else sees published only.
  const response = await getPostBySlug(resolvedParams.slug, {
    includeDrafts: isValidPreviewToken('posts', resolvedParams.slug, preview),
  });

  if (!response?.object) {
    notFound();
  }

  const post = response.object;

  let relatedPosts: PostObject[] = [];
  try {
    relatedPosts = await getRelatedPosts(post);
  } catch (error) {
    console.error('Error fetching related posts in EditorialArticlePage:', error);
    relatedPosts = [];
  }

  const postDate = post.metadata?.date ? new Date(post.metadata.date) : null;
  const formattedDate = postDate ? format(postDate, 'dd-MM-yyyy') : '';
  const imageGallery = post.metadata?.image_gallery || [];

  const postType = getPostKind(post);
  const isFeatured = post.metadata?.is_featured || false;
  const featuredSize = post.metadata?.featured_size?.key || 'small';
  const imageAspectRatio = post.metadata?.image_aspect_ratio?.key || '1_1';
  const textFocus = post.metadata?.text_focus || false;

  const getLayoutComponent = () => {
    // Video posts get special treatment - use Gallery layout for better video display
    if (postType === 'video') {
      return <GalleryLayout post={post} formattedDate={formattedDate} />;
    }

    if (isFeatured && featuredSize === 'large') {
      return <FeaturedLayout post={post} formattedDate={formattedDate} />;
    }

    if (imageGallery.length > 0 && imageAspectRatio === '4_3') {
      return <GalleryLayout post={post} formattedDate={formattedDate} />;
    }

    if (
      textFocus ||
      (!post.metadata?.external_image_url &&
        !post.metadata?.image?.imgix_url &&
        !imageGallery.length)
    ) {
      return <MinimalLayout post={post} formattedDate={formattedDate} />;
    }

    return <StandardLayout post={post} formattedDate={formattedDate} />;
  };

  const isDraft = post.status === 'draft';

  // Shows/episodes linked to this editorial piece (special projects, partnerships)
  const relatedShows = post.metadata?.related_shows || [];

  return (
    <>
      {}
      {isDraft && <PreviewBanner />}

      {getLayoutComponent()}

      {}
      {relatedShows.length > 0 && (
        <div className='border-t'>
          <div className='max-w-7xl mx-auto px-4 py-16'>
            <h2 className='text-h8 md:text-h7 font-bold mb-4 tracking-tight uppercase'>
              Related Shows
            </h2>
            <div className='grid grid-cols-2 md:grid-cols-5 gap-3 w-full h-auto'>
              {relatedShows.map((show, index) => {
                const transformed = transformShowToViewData(show);
                const player = show.metadata?.player;
                return (
                  <ShowCard
                    key={show.id || show.slug || index}
                    show={{
                      ...transformed,
                      url: player
                        ? player.startsWith('http')
                          ? player
                          : `https://www.mixcloud.com${player}`
                        : '',
                      key: show.slug,
                    }}
                    slug={`/episode/${show.slug}`}
                    playable
                  />
                );
              })}
            </div>
          </div>
        </div>
      )}

      {}
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

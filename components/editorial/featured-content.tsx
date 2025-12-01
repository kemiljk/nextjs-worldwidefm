import { PostObject } from '@/lib/cosmic-config';
import { ArticleCard } from '@/components/ui/article-card';
import { getPostThumbnail, getPostVideoUrl } from '@/lib/post-thumbnail-utils';

interface FeaturedContentProps {
  posts: PostObject[];
}

export default function FeaturedContent({ posts }: FeaturedContentProps) {
  if (!posts.length) return null;

  // Sort posts by featured_size if available
  const sortedPosts = [...posts].sort((a, b) => {
    const aSize =
      a.metadata.featured_size?.key === 'large'
        ? 3
        : a.metadata.featured_size?.key === 'medium'
          ? 2
          : 1;
    const bSize =
      b.metadata.featured_size?.key === 'large'
        ? 3
        : b.metadata.featured_size?.key === 'medium'
          ? 2
          : 1;
    return bSize - aSize;
  });

  const featuredPost = sortedPosts[0];
  
  // Check if there's a video URL - if so, link to the video source
  const videoUrl = getPostVideoUrl(featuredPost);
  const hasVideoThumbnail = Boolean(videoUrl && getPostThumbnail(featuredPost) !== '/image-placeholder.png');
  
  // Use video URL if there's a video thumbnail, otherwise use featured_link or default
  const customLink = hasVideoThumbnail 
    ? videoUrl 
    : (featuredPost.metadata?.is_featured && featuredPost.metadata?.featured_link 
      ? featuredPost.metadata.featured_link 
      : undefined);

  return (
    <div className='py-20 w-full items-center justify-center flex h-auto'>
      <div className=''>
        <ArticleCard
          key={featuredPost.slug}
          slug={featuredPost.slug}
          title={featuredPost.title ?? ''}
          date={featuredPost.metadata?.date ?? undefined}
          excerpt={featuredPost.metadata?.excerpt ?? undefined}
          image={getPostThumbnail(featuredPost)}
          tags={featuredPost.metadata.categories?.map(c => c.title) ?? []}
          variant='featured'
          href={customLink}
        />
      </div>
    </div>
  );
}

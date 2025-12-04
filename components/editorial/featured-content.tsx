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
  
  // Always link to article page, but allow featured_link override for external links
  const customLink = featuredPost.metadata?.is_featured && featuredPost.metadata?.featured_link 
    ? featuredPost.metadata.featured_link 
    : undefined;

  return (
    <div className='py-20 w-full'>
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
  );
}

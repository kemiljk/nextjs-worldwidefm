import { PostObject } from '@/lib/cosmic-config';
import { ArticleCard } from '@/components/ui/article-card';

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

  return (
    <div className='my-4 w-full items-center justify-center flex h-90'>
      <div className=''>
        <ArticleCard
          key={sortedPosts[0].slug}
          slug={sortedPosts[0].slug}
          title={sortedPosts[0].title ?? ''}
          date={sortedPosts[0].metadata?.date ?? undefined}
          excerpt={sortedPosts[0].metadata?.excerpt ?? undefined}
          image={
            sortedPosts[0].thumbnail?.imgix_url ||
            sortedPosts[0].metadata?.image?.imgix_url ||
            '/image-placeholder.png'
          }
          tags={sortedPosts[0].metadata.categories?.map(c => c.title) ?? []}
          variant='featured'
        />
      </div>
    </div>
  );
}

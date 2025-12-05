import { CategoryTag } from '@/components/ui/category-tag';
import { ImageGallery } from '@/components/ui/image-gallery';
import { PostObject } from '@/lib/cosmic-config';
import { PostVideoPlayer } from './post-video-player';
import { getPostVideoUrl } from '@/lib/post-thumbnail-utils';

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

interface EditorialLayoutProps {
  post: PostObject;
  formattedDate: string;
}

// Standard Layout - Current layout
export function StandardLayout({ post, formattedDate }: EditorialLayoutProps) {
  const { title, metadata } = post;
  const baseImageUrl = metadata?.image?.imgix_url;
  const imageUrl = baseImageUrl ? `${baseImageUrl}?w=1000&auto=format,compress` : '';
  const description = metadata?.excerpt || '';
  const content = metadata?.content || '';
  const categories = metadata?.categories || [];
  const author = metadata?.author;
  const imageGallery = metadata?.image_gallery || [];
  const hasVideo = !!getPostVideoUrl(post);

  return (
    <article className='w-full'>
      {/* Hero Section */}
      <div className='w-full mt-20 mb-40 px-5 md:px-20 flex flex-col lg:flex-row gap-20 justify-center items-center md:items-start'>
        {/* Video or Image */}
        <div className='sm:w-[80vw] lg:w-[50vw] flex items-center justify-center overflow-hidden relative'>
          {hasVideo ? (
            <PostVideoPlayer post={post} />
          ) : (
            <img
              src={imageUrl}
              alt={`${title} - Featured image`}
              style={{ width: '100%', height: 'auto' }}
              className='object-contain'
            />
          )}
        </div>

        {/* Text */}
        <div className='w-full sm:w-[80vw] lg:w-[35vw] text-almostblack dark:text-white'>
          <p className='font-sans text-[28px] md:text-[40px] lg:text-[50px] leading-none mb-4'>
            {title}
          </p>
          <p className='text-sans text-b3'>{description}</p>
          <div className='flex flex-col gap-1 mt-4'>
            <div className='text-m7 leading-none font-mono tracking-wider'>{formattedDate}</div>
            {author && (
              <div className='text-m7 font-mono leading-none uppercase tracking-wider text-muted-foreground'>
                By {typeof author === 'string' ? author : author.title || 'Unknown'}
              </div>
            )}
            <div className='flex pt-4 flex-wrap gap-3'>
              {categories.map((category: Category) => (
                <CategoryTag key={category.slug} categorySlug={category.slug}>
                  {category.title}
                </CategoryTag>
              ))}
            </div>
          </div>
          {/* Image Gallery */}
          {imageGallery.length > 0 && (
            <div className='mt-10 md:mt-20'>
              <ImageGallery
                images={imageGallery}
                layout={
                  metadata?.gallery_layout?.value?.toLowerCase() as
                    | 'thumbnail'
                    | 'grid'
                    | 'carousel'
                }
              />
            </div>
          )}
          {/* Main Content */}
          <div>
            {content && (
              <div
                dangerouslySetInnerHTML={{ __html: content }}
                className='wrap-break-word font-sans text-b6 mt-10 md:mt-20 space-y-4 editorial-content'
              />
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

// Featured Layout - Large hero with centered content
export function FeaturedLayout({ post, formattedDate }: EditorialLayoutProps) {
  const { title, metadata } = post;
  const baseImageUrl = metadata?.image?.imgix_url;
  const imageUrl = baseImageUrl ? `${baseImageUrl}?w=1920&h=1080&fit=crop&auto=format,compress` : '';
  const description = metadata?.excerpt || '';
  const content = metadata?.content || '';
  const categories = metadata?.categories || [];
  const author = metadata?.author;
  const imageGallery = metadata?.image_gallery || [];
  const hasVideo = !!getPostVideoUrl(post);

  return (
    <article className='w-full'>
      {/* Large Hero Video or Image */}
      <div className='relative w-full h-[60vh] mb-20'>
        {hasVideo ? (
          <PostVideoPlayer post={post} className='h-full' />
        ) : (
          <img src={imageUrl} alt={`${title} - Featured image`} className='absolute inset-0 w-full h-full object-cover' />
        )}
        <div className='absolute inset-0 bg-black bg-opacity-40 flex items-end'>
          <div className='w-full px-5 md:px-20 pb-20 text-white'>
            <text className='text-[32px] md:text-[60px] lg:text-[80px] leading-none mb-6'>
              {title}
            </text>
            <p className='text-sans text-b2 mb-4 max-w-3xl'>{description}</p>
            <div className='flex items-center gap-4'>
              <div className='text-[14px] font-mono tracking-wider'>{formattedDate}</div>
              {author && (
                <div className='text-[14px] font-mono uppercase tracking-wider'>
                  By {typeof author === 'string' ? author : author.title || 'Unknown'}
                </div>
              )}
            </div>
            <div className='flex pt-4 flex-wrap gap-3'>
              {categories.map((category: Category) => (
                <CategoryTag key={category.slug} categorySlug={category.slug} variant='white'>
                  {category.title}
                </CategoryTag>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Centered Content */}
      <div className='max-w-4xl mx-auto px-5 md:px-20'>
        {content && (
          <div
            dangerouslySetInnerHTML={{ __html: content }}
            className='wrap-break-word font-sans text-b6 space-y-6 editorial-content'
          />
        )}

        {/* Image Gallery */}
        {imageGallery.length > 0 && (
          <div className='mt-20'>
            <ImageGallery
              images={imageGallery}
              layout={
                metadata?.gallery_layout?.value?.toLowerCase() as 'thumbnail' | 'grid' | 'carousel'
              }
            />
          </div>
        )}
      </div>
    </article>
  );
}

// Gallery Layout - Image-focused layout
export function GalleryLayout({ post, formattedDate }: EditorialLayoutProps) {
  const { title, metadata } = post;
  const baseImageUrl = metadata?.image?.imgix_url;
  const imageUrl = baseImageUrl ? `${baseImageUrl}?w=1920&auto=format,compress` : '';
  const description = metadata?.excerpt || '';
  const content = metadata?.content || '';
  const categories = metadata?.categories || [];
  const author = metadata?.author;
  const imageGallery = metadata?.image_gallery || [];
  const hasVideo = !!getPostVideoUrl(post);

  return (
    <article className='w-full'>
      {/* Title Section */}
      <div className='w-full px-10 md:px-20 py-20 text-center'>
        <text className='font-sans text-[32px] sm:text-[50px] lg:text-[60px] leading-none mb-4 text-almostblack dark:text-white'>
          {title}
        </text>
        <p className='text-sans text-[15px] leading-tight py-12 max-w-2xl mx-auto'>{description}</p>
        <div className='flex flex-col md:flex-row items-center justify-center gap-4 md:gap-10 mb-6'>
          <div className='flex justify-center flex-wrap gap-3'>
            {categories.map((category: Category) => (
              <CategoryTag key={category.slug} categorySlug={category.slug}>
                {category.title}
              </CategoryTag>
            ))}
          </div>
          <div className='text-[12px] font-mono tracking-wider text-muted-foreground'>
            {formattedDate}
          </div>
          {author && (
            <div className='text-[12px] font-mono uppercase tracking-wider text-muted-foreground'>
              WRITTEN BY: {typeof author === 'string' ? author : author.title || 'Unknown'}
            </div>
          )}
        </div>
      </div>

      {/* Main Video or Image */}
      {hasVideo ? (
        <div className='w-full mb-20 px-5 md:px-20'>
          <PostVideoPlayer post={post} />
        </div>
      ) : (
        imageUrl && (
          <div className='w-full mb-20'>
            <img
              src={imageUrl}
              alt={`${title} - Featured image`}
              style={{ width: '100%', height: 'auto' }}
              className='object-contain'
            />
          </div>
        )
      )}

      {/* Content */}
      {content && (
        <div
          className={`max-w-4xl mx-auto px-5 md:px-40 ${imageGallery.length > 0 ? '' : 'mb-20'}`}
        >
          <div
            dangerouslySetInnerHTML={{ __html: content }}
            className='wrap-break-word font-sans text-b6 leading-6 space-y-3 editorial-content'
          />
        </div>
      )}

      {/* Image Gallery */}
      {imageGallery.length > 0 && (
        <div className='max-w-4xl mx-auto px-5 md:px-20 mb-20'>
          <ImageGallery
            images={imageGallery}
            layout={
              metadata?.gallery_layout?.value?.toLowerCase() as 'thumbnail' | 'grid' | 'carousel'
            }
          />
        </div>
      )}
    </article>
  );
}

// Minimal Layout - Text-focused
export function MinimalLayout({ post, formattedDate }: EditorialLayoutProps) {
  const { title, metadata } = post;
  const description = metadata?.excerpt || '';
  const content = metadata?.content || '';
  const categories = metadata?.categories || [];
  const author = metadata?.author;
  const hasVideo = !!getPostVideoUrl(post);

  return (
    <article className='w-full'>
      <div className='max-w-3xl mx-auto px-5 md:px-20 py-20'>
        <h1 className='font-sans text-[28px] md:text-[40px] lg:text-[50px] leading-none mb-6 text-almostblack dark:text-white'>
          {title}
        </h1>
        <p className='text-sans text-b3 mb-8'>{description}</p>

        <div className='flex items-center gap-4 mb-8'>
          <div className='text-[12px] font-mono tracking-wider text-muted-foreground'>
            {formattedDate}
          </div>
          {author && (
            <div className='text-[12px] font-mono uppercase tracking-wider text-muted-foreground'>
              By {typeof author === 'string' ? author : author.title || 'Unknown'}
            </div>
          )}
        </div>

        <div className='flex flex-wrap gap-3 mb-12'>
          {categories.map((category: Category) => (
            <CategoryTag key={category.slug} categorySlug={category.slug}>
              {category.title}
            </CategoryTag>
          ))}
        </div>

        {hasVideo && (
          <div className='mb-12'>
            <PostVideoPlayer post={post} />
          </div>
        )}

        {content && (
          <div
            dangerouslySetInnerHTML={{ __html: content }}
            className='wrap-break-word font-sans text-b6 space-y-6 editorial-content'
          />
        )}
      </div>
    </article>
  );
}

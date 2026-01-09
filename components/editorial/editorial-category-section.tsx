'use client';

import Link from 'next/link';
import { PostObject } from '@/lib/cosmic-config';
import { GenreTag } from '@/components/ui/genre-tag';
import { Card, CardContent } from '@/components/ui/card';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import { getPostThumbnail } from '@/lib/post-thumbnail-utils';

interface EditorialCategorySectionProps {
  title: string;
  posts: PostObject[];
}

export default function EditorialCategorySection({ title, posts }: EditorialCategorySectionProps) {
  if (!posts.length) return null;

  return (
    <section className='mb-12'>
      <h3 className='text-h8 md:text-[32px] tracking-tight font-display uppercase font-normal text-almostblack dark:text-white mb-4 border-b border-almostblack/20 dark:border-white/20 pb-2'>
        {title}
      </h3>
      <div className='relative'>
        <Carousel
          opts={{
            align: 'start',
            loop: false,
          }}
          className='w-full'
        >
          <CarouselContent className='-ml-3'>
            {posts.map((post, index) => {
              const thumbnailUrl = getPostThumbnail(post);
              const categories = (post.metadata?.categories || [])
                .map((cat: any) => {
                  if (typeof cat === 'string') return null;
                  if (cat && typeof cat === 'object' && typeof cat.title === 'string') {
                    return cat;
                  }
                  return null;
                })
                .filter(Boolean);

              return (
                <CarouselItem
                  key={`editorial-cat-${post.id}-${post.slug}-${index}`}
                  className='pl-3 basis-[85%] sm:basis-1/2 lg:basis-1/3'
                >
                  <Link href={`/editorial/${post.slug}`} className='group block h-full'>
                    <Card className='flex flex-col h-full'>
                      <CardContent className='flex flex-col flex-1 p-0 border border-white group-hover:border-almostblack'>
                        <div className='relative aspect-video'>
                          <img
                            src={thumbnailUrl}
                            alt={post.title}
                            className='absolute inset-0 w-full h-full object-cover'
                          />
                          {categories.length > 0 && (
                            <div className='absolute top-3 left-3 flex flex-wrap gap-1'>
                              {categories.map((cat: any) =>
                                cat ? (
                                  <GenreTag key={cat.id} className='border-white text-white'>
                                    {cat.title}
                                  </GenreTag>
                                ) : null
                              )}
                            </div>
                          )}
                        </div>
                        <div className='relative border-t border-white flex-row flex justify-between pl-2 min-h-[48px] w-full bg-almostblack text-white items-stretch group-hover:bg-white group-hover:text-almostblack group-hover:border-almostblack'>
                          <h3 className='font-bold py-2 pr-2 flex-1 leading-tight text-[18px] sm:text-[20px] group-hover:text-almostblack'>
                            {post.title}
                          </h3>
                          <div className='border-l border-white px-3 flex items-center group-hover:border-almostblack group-hover:text-almostblack select-none shrink-0 text-[18px] sm:text-[20px]'>
                            ▶
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                </CarouselItem>
              );
            })}
          </CarouselContent>
          {posts.length > 3 && (
            <>
              <CarouselPrevious className='hidden sm:flex -left-4 bg-white dark:bg-almostblack border-almostblack dark:border-white' />
              <CarouselNext className='hidden sm:flex -right-4 bg-white dark:bg-almostblack border-almostblack dark:border-white' />
            </>
          )}
        </Carousel>
      </div>
    </section>
  );
}

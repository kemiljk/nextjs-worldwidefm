import Image from 'next/image';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { getArticles, getWatchAndListenItems, getMoods } from '@/lib/cosmic-service';
import { formatDate } from '@/lib/utils';

export default async function EditorialPage() {
  // Fetch ALL content, not just featured items

  // Fetch articles - no featured filter
  const articlesResponse = await getArticles({
    limit: 20,
    sort: '-metadata.date',
  });
  const articles = articlesResponse.objects || [];

  // Fetch all watch and listen items
  const watchListenResponse = await getWatchAndListenItems({ limit: 10 });
  const watchListenItems = watchListenResponse.objects || [];

  // Fetch all moods
  const moodsResponse = await getMoods({ limit: 20 });
  const moods = moodsResponse.objects || [];

  // Organize watch and listen items by type
  let albumOfTheWeek = watchListenItems.find((item) => item.slug === 'album-of-the-week');
  let events = watchListenItems.find((item) => item.slug === 'events');
  let video = watchListenItems.find((item) => item.slug === 'video');

  // Other watch and listen items
  const otherWatchListenItems = watchListenItems.filter(
    (item) => item.slug !== 'album-of-the-week' && item.slug !== 'events' && item.slug !== 'video'
  );

  return (
    <div className='min-h-screen bg-sky-700 dark:bg-sky-900'>
      <div className='container mx-auto pt-32 pb-32'>
        <div className='flex items-center justify-between mb-8'>
          <h1 className='text-3xl font-medium text-white'>Editorial</h1>
          <div className='flex items-center gap-2 text-sm text-white/70'>
            <Link
              href='/'
              className='hover:text-brand-orange transition-colors'
            >
              Home
            </Link>
            <ChevronRight className='h-3 w-3' />
            <span className='text-white'>Editorial</span>
          </div>
        </div>

        {/* Watch and Listen Section */}
        <div className='mb-12'>
          <h2 className='text-2xl font-medium mb-6 text-white'>Watch and Listen</h2>

          {/* Featured Watch & Listen - 3 main items in a row */}
          {(albumOfTheWeek || events || video) && (
            <div className='grid grid-cols-1 md:grid-cols-3 gap-6 mb-8'>
              {/* Album of the Week */}
              {albumOfTheWeek && (
                <Card className='overflow-hidden border-none shadow-md'>
                  <CardContent className='p-0 relative'>
                    <div className='absolute top-4 left-4 bg-black/70 text-white text-xs font-medium py-1 px-2 z-10'>
                      {albumOfTheWeek.title}
                    </div>
                    <Image
                      src={albumOfTheWeek.metadata.image.imgix_url || '/placeholder.svg'}
                      alt={albumOfTheWeek.title}
                      width={400}
                      height={400}
                      className='w-full aspect-square object-cover'
                    />
                    <div className='absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-2xl p-4 text-white'>
                      <p className='text-sm line-clamp-2 mb-2'>
                        {albumOfTheWeek.metadata.description}
                      </p>
                      <Link
                        href={albumOfTheWeek.metadata.link}
                        className='text-brand-orange text-sm font-medium flex items-center'
                      >
                        Learn More <ChevronRight className='h-4 w-4 ml-1' />
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Events */}
              {events && (
                <Card className='overflow-hidden border-none shadow-md'>
                  <CardContent className='p-0 relative overflow-hidden'>
                    <div className='absolute top-4 left-4 bg-black/70 text-white text-xs font-medium py-1 px-2 z-10'>
                      {events.title}
                    </div>
                    <Image
                      src={events.metadata.image.imgix_url || '/placeholder.svg'}
                      alt={events.title}
                      width={400}
                      height={400}
                      className='w-full aspect-square object-cover'
                    />
                    <div className='absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-2xl p-4 text-white'>
                      <p className='text-sm line-clamp-2 mb-2'>{events.metadata.description}</p>
                      <Link
                        href={events.metadata.link}
                        className='text-brand-orange text-sm font-medium flex items-center'
                      >
                        View Events <ChevronRight className='h-4 w-4 ml-1' />
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Video */}
              {video && (
                <Card className='overflow-hidden border-none shadow-md'>
                  <CardContent className='p-0 relative'>
                    <div className='absolute top-4 left-4 bg-black/70 text-white text-xs font-medium py-1 px-2 z-10'>
                      {video.title}
                    </div>
                    <Image
                      src={video.metadata.image.imgix_url || '/placeholder.svg'}
                      alt={video.title}
                      width={400}
                      height={400}
                      className='w-full aspect-square object-cover'
                    />
                    <div className='absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-2xl p-4 text-white'>
                      <p className='text-sm line-clamp-2 mb-2'>{video.metadata.description}</p>
                      <Link
                        href={video.metadata.link}
                        className='text-brand-orange text-sm font-medium flex items-center'
                      >
                        Watch Videos <ChevronRight className='h-4 w-4 ml-1' />
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Other Watch & Listen items */}
          {otherWatchListenItems.length > 0 && (
            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
              {otherWatchListenItems.map((item) => (
                <Card
                  key={item.id}
                  className='overflow-hidden border-none shadow-md'
                >
                  <CardContent className='p-0 relative'>
                    <div className='aspect-video w-full relative'>
                      <Image
                        src={item.metadata.image.imgix_url || '/placeholder.svg'}
                        alt={item.title}
                        fill
                        className='object-cover'
                      />
                    </div>
                    <div className='p-4'>
                      <h3 className='font-medium mb-2'>{item.title}</h3>
                      <p className='text-sm text-muted-foreground line-clamp-2 mb-3'>
                        {item.metadata.description}
                      </p>
                      <Link
                        href={item.metadata.link}
                        className='text-brand-orange text-sm font-medium flex items-center'
                      >
                        View <ChevronRight className='h-4 w-4 ml-1' />
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Articles Section */}
        {articles.length > 0 && (
          <div>
            <h2 className='text-2xl font-medium mb-6 text-white'>Posts</h2>

            {/* Featured article - larger format */}
            {articles.length > 0 && (
              <div className='mb-8'>
                <Card className='overflow-hidden border-none shadow-md'>
                  <CardContent className='p-0 flex flex-col md:flex-row'>
                    <div className='md:w-1/2 relative'>
                      <Image
                        src={articles[0].metadata.image?.imgix_url || '/placeholder.svg'}
                        alt={articles[0].title}
                        width={800}
                        height={500}
                        className='w-full aspect-video md:h-full object-cover'
                      />
                    </div>
                    <div className='md:w-1/2 p-6 flex flex-col'>
                      <div className='text-sm text-muted-foreground mb-2'>
                        {formatDate(articles[0].metadata.date)} •{' '}
                        {articles[0].metadata.author?.title || 'Unknown Author'}
                      </div>
                      <h3 className='text-2xl font-medium mb-3'>{articles[0].title}</h3>
                      <p className='text-muted-foreground mb-6 line-clamp-3'>
                        {articles[0].metadata.excerpt}
                      </p>
                      <Link
                        href={`/articles/${articles[0].slug}`}
                        className='mt-auto text-brand-orange font-medium flex items-center'
                      >
                        Read Post <ChevronRight className='h-4 w-4 ml-1' />
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Other articles in grid */}
            {articles.length > 1 && (
              <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
                {articles.slice(1).map((article) => (
                  <Link
                    key={article.id}
                    href={`/articles/${article.slug}`}
                  >
                    <Card className='overflow-hidden border-none shadow-md h-full hover:shadow-lg transition-shadow'>
                      <CardContent className='p-0 flex flex-col h-full'>
                        <div className='relative aspect-video w-full'>
                          <Image
                            src={article.metadata.image?.imgix_url || '/placeholder.svg'}
                            alt={article.title}
                            fill
                            className='object-cover'
                          />
                        </div>
                        <div className='p-5 flex-grow flex flex-col'>
                          <div className='text-sm text-muted-foreground mb-2'>
                            {formatDate(article.metadata.date)} •{' '}
                            {article.metadata.author?.title || 'Unknown Author'}
                          </div>
                          <h3 className='text-xl font-medium mb-2'>{article.title}</h3>
                          <p className='text-sm text-muted-foreground line-clamp-3 mb-4'>
                            {article.metadata.excerpt}
                          </p>
                          <div className='mt-auto text-brand-orange font-medium text-sm flex items-center'>
                            Read More <ChevronRight className='h-4 w-4 ml-1' />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}

            {/* View all articles link */}
            <div className='mt-8 text-center'>
              <Link
                href='/articles'
                className='inline-block px-6 py-3 bg-brand-orange text-white rounded-lg hover:bg-brand-orange/90 transition-colors'
              >
                View All Posts
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

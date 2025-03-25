import Image from 'next/image';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { WatchAndListenObject } from '@/lib/cosmic-config';

interface WatchAndListenSectionProps {
  title: string;
  albumOfTheWeek: WatchAndListenObject | null;
  events: WatchAndListenObject | null;
  video: WatchAndListenObject | null;
}

export default function WatchAndListenSection({
  title,
  albumOfTheWeek,
  events,
  video,
}: WatchAndListenSectionProps) {
  return (
    <div>
      <h3 className='text-lg font-medium text-gray-300 mb-4'>{title}</h3>

      <div className='grid grid-cols-2 gap-4'>
        {/* Album of the Week */}
        {albumOfTheWeek && (
          <Card className='overflow-hidden border-none shadow-md bg-brand-blue-light'>
            <CardContent className='p-0 relative'>
              <div className='absolute top-4 left-4 bg-black/70 text-white text-xs font-medium py-1 px-2 z-10'>
                {albumOfTheWeek.title}
              </div>
              <Image
                src={albumOfTheWeek.metadata.image.imgix_url || '/placeholder.svg'}
                alt={albumOfTheWeek.title}
                width={300}
                height={300}
                className='w-full aspect-square object-cover'
              />
              <div className='absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-2xl p-3 text-white'>
                <div className='flex items-center justify-between'>
                  <p className='text-sm pr-2'>{albumOfTheWeek.metadata.description}</p>
                  <Link href={albumOfTheWeek.metadata.link}>
                    <Button
                      variant='ghost'
                      className='text-white rounded-full p-2 hover:bg-white/20 flex-shrink-0'
                    >
                      <ChevronRight className='h-4 w-4' />
                    </Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Events */}
        {events && (
          <Card className='overflow-hidden border-none shadow-md bg-brand-blue-light'>
            <CardContent className='p-0 relative'>
              <div className='absolute top-4 left-4 bg-black/70 text-white text-xs font-medium py-1 px-2 z-10'>
                {events.title}
              </div>
              <Image
                src={events.metadata.image.imgix_url || '/placeholder.svg'}
                alt={events.title}
                width={300}
                height={300}
                className='w-full aspect-square object-cover'
              />
              <div className='absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-2xl p-3 text-white'>
                <div className='flex items-center justify-between'>
                  <p className='text-sm pr-2'>{events.metadata.description}</p>
                  <Link href={events.metadata.link}>
                    <Button
                      variant='ghost'
                      className='text-white rounded-full p-2 hover:bg-white/20 flex-shrink-0'
                    >
                      <ChevronRight className='h-4 w-4' />
                    </Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Video - Full width */}
        {video && (
          <Card className='overflow-hidden border-none shadow-md bg-brand-blue-light col-span-2 mt-4'>
            <CardContent className='p-0 relative'>
              <div className='absolute top-4 left-4 bg-black/70 text-white text-xs font-medium py-1 px-2 z-10'>
                {video.title}
              </div>
              <Image
                src={video.metadata.image.imgix_url || '/placeholder.svg'}
                alt={video.title}
                width={600}
                height={300}
                className='w-full aspect-video object-cover'
              />
              <div className='absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-2xl p-3 text-white'>
                <div className='flex items-center justify-between'>
                  <p className='text-sm pr-2'>{video.metadata.description}</p>
                  <Link href={video.metadata.link}>
                    <Button
                      variant='ghost'
                      className='text-white rounded-full p-2 hover:bg-white/20 flex-shrink-0'
                    >
                      <ChevronRight className='h-4 w-4' />
                    </Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

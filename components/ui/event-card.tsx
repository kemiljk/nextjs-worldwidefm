'use client';

import Link from 'next/link';

interface EventCardProps {
  title: string;
  slug: string;
  image: string;
  eventDate: string;
  location: string;
  ticketLink?: string;
  description?: string;
}

export function EventCard({
  title,
  slug,
  image,
  eventDate,
  location,
  ticketLink,
  description,
}: EventCardProps) {
  return (
    <Link href={`/editorial/${slug}`} className='block group'>
      <div className='relative w-full flex flex-col md:flex-row gap-6 items-start'>
        <div className='flex-1 relative h-auto'>
          <img
            src={image}
            alt={title}
            className='w-full max-h-100 h-full object-cover border border-black'
          />
        </div>
        <div className='pt-4 pb-4 flex-1 flex flex-col justify-center'>
          <div className='pl-1 pb-6 font-mono uppercase text-b1 md:text-b1 leading-none'>
            {title}
          </div>
          {eventDate && (
            <p className='pl-1 pb-3 text-m8 font-mono text-almostblack'>
              {new Date(eventDate).toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
              })}
            </p>
          )}
          {location && <p className='pl-1 pb-3 text-m8 font-mono text-almostblack'>{location}</p>}
          {description && <p className='pl-1 pb-3 text-sans text-b4'>{description}</p>}
          {ticketLink && (
            <a
              href={ticketLink}
              target='_blank'
              rel='noopener noreferrer'
              onClick={e => e.stopPropagation()}
              className='mt-4 inline-block px-6 py-3 bg-almostblack text-white hover:bg-almostblack/80 transition-colors uppercase font-mono text-sm'
            >
              Get Tickets
            </a>
          )}
        </div>
      </div>
    </Link>
  );
}

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getUKTimezoneAbbreviation } from '@/lib/date-utils';

interface ScheduleShow {
  show_key: string;
  event_id: string;
  show_time: string;
  show_day: string;
  name: string;
  url: string;
  picture: string;
  created_time: string;
  tags: string[];
  hosts: string[];
  duration: number;
}

interface ScheduleDisplayProps {
  scheduleItems: ScheduleShow[];
  episodeSlugMap: Record<string, string>;
  isActive: boolean;
  error?: string;
}

export default function ScheduleDisplay({
  scheduleItems,
  episodeSlugMap,
  isActive,
  error,
}: ScheduleDisplayProps) {
  const [userTimezone, setUserTimezone] = useState<string>('Europe/London');
  const [userTimezoneAbbr, setUserTimezoneAbbr] = useState<string>(getUKTimezoneAbbreviation());

  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setUserTimezone(tz);

    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      timeZoneName: 'short',
    });
    const parts = formatter.formatToParts(now);
    const tzPart = parts.find(part => part.type === 'timeZoneName');
    if (tzPart) {
      setUserTimezoneAbbr(`[${tzPart.value}]`);
    }
  }, []);

  // Convert UTC time to user's timezone
  const convertTime = (utcTime: string, day: string) => {
    try {
      // Get the date for the specified day
      const daysOrder = [
        'Sunday',
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
      ];
      const today = new Date();
      const todayDayIndex = today.getDay();
      const targetDayIndex = daysOrder.indexOf(day);
      const daysToAdd = (targetDayIndex - todayDayIndex + 7) % 7;

      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + daysToAdd);

      // Parse UTC time (HH:MM format)
      const [hours, minutes] = utcTime.split(':').map(Number);
      targetDate.setUTCHours(hours, minutes, 0, 0);

      // Format in user's timezone
      const timeFormatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: userTimezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });

      return timeFormatter.format(targetDate);
    } catch (error) {
      console.error('Error converting time:', error);
      return utcTime;
    }
  };

  // Group shows by day
  const daysOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const showsByDay = scheduleItems.reduce(
    (acc, show) => {
      if (!acc[show.show_day]) {
        acc[show.show_day] = [];
      }
      acc[show.show_day].push(show);
      return acc;
    },
    {} as Record<string, ScheduleShow[]>
  );

  // Sort shows within each day by time
  Object.keys(showsByDay).forEach(day => {
    showsByDay[day].sort((a, b) => {
      const timeA = a.show_time.split(':').map(Number);
      const timeB = b.show_time.split(':').map(Number);
      return timeA[0] * 60 + timeA[1] - (timeB[0] * 60 + timeB[1]);
    });
  });

  if (!isActive || scheduleItems.length === 0) {
    return (
      <div className='flex flex-col items-center justify-center py-24 text-center'>
        <h2 className='text-2xl font-bold text-black dark:text-white mb-4'>
          {error ? 'Schedule Temporarily Unavailable' : 'No Current Schedule'}
        </h2>
        <p className='text-gray-600 dark:text-gray-400 mb-8 max-w-lg'>
          {error
            ? "We're having trouble connecting to our schedule service. Please check back later while we resolve this issue."
            : 'Our weekly schedule is currently being updated. In the meantime, you can browse our complete archive of shows.'}
        </p>
        <div className='flex gap-4'>
          <Link
            href='/'
            className='px-4 py-2 border border-black dark:border-white text-black dark:text-white hover:bg-black dark:hover:bg-white hover:text-white dark:hover:text-black transition-colors'
          >
            Back to Home
          </Link>
          <Link
            href='/shows'
            className='px-4 py-2 bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors'
          >
            Browse All Shows
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Times note at top-left */}
      <div className='mb-3 pl-5'>
        <p className='text-sm font-mono text-black dark:text-white'>
          *TIMES ARE DISPLAYED IN {userTimezoneAbbr}
        </p>
      </div>

      {/* Schedule list */}
      <div className='space-y-0 px-5'>
        {daysOrder.map(day => {
          const dayShows = showsByDay[day] || [];
          if (dayShows.length === 0) return null;

          // Format day header (e.g., "TUE 01/07")
          const dayDate = new Date();
          const dayIndex = daysOrder.indexOf(day);
          const targetDate = new Date(dayDate);
          targetDate.setDate(dayDate.getDate() + (dayIndex - dayDate.getDay() + 1));
          const dayAbbr = day.substring(0, 3).toUpperCase();
          const dayNum = targetDate.getDate().toString().padStart(2, '0');
          const monthNum = (targetDate.getMonth() + 1).toString().padStart(2, '0');
          const dayHeader = `${dayAbbr} ${dayNum}.${monthNum}`;

          return (
            <div key={day}>
              {/* Black day header */}
              <div className='bg-almostblack py-0.5 dark:bg-white pl-1'>
                <h2 className='text-white dark:text-black font-display tracking-tight text-[22px]'>{dayHeader}</h2>
              </div>

              {/* Show entries */}
              <div className='divide-y divide-gray-200 dark:divide-gray-700'>
                {dayShows.map((show, index) => {
                  const startTime = convertTime(show.show_time, show.show_day);

                  const [hours, minutes] = show.show_time.split(':').map(Number);
                  const endHours = (hours + 2) % 24;
                  const endTimeUTC = `${endHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
                  const endTime = convertTime(endTimeUTC, show.show_day);

                  const timeRange = `${startTime}-${endTime}`;

                  const showName =
                    show.hosts.length > 0 ? `${show.name}: ${show.hosts.join(', ')}` : show.name;

                  const content = (
                    <div className='flex items-start'>
                      <span className='w-[30vw] lg:w-[15vw] text-m7 font-mono text-black dark:text-white pr-8'>
                        {timeRange}
                      </span>
                      <span className='w-[60vw] uppercase font-mono text-m7 text-almostblack dark:text-white flex-1 pl-8'>
                        {showName}
                      </span>
                    </div>
                  );

                  // Check if this is a valid episode link
                  const isEpisodeLink = show.url.startsWith('/episode/');
                  const isShowLink = show.url.startsWith('/shows/');

                  if (isEpisodeLink || isShowLink) {
                    return (
                      <Link
                        href={show.url}
                        key={`${show.show_day}-${show.show_time}-${show.name}`}
                        className='flex-row flex py-4 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors'
                      >
                        {content}
                      </Link>
                    );
                  } else {
                    return (
                      <div
                        key={`${show.show_day}-${show.show_time}-${show.name}`}
                        className='flex-row flex py-4 opacity-60 cursor-default'
                      >
                        {content}
                      </div>
                    );
                  }
                })}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

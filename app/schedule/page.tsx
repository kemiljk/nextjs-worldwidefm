import { Metadata } from 'next';
import Link from 'next/link';
import { getEvents, transformRadioCultEvent } from '@/lib/radiocult-service';
import { generateScheduleMetadata } from '@/lib/metadata-utils';
import { PageHeader } from '@/components/shared/page-header';

export const generateMetadata = async (): Promise<Metadata> => {
  return generateScheduleMetadata();
};

interface ScheduleShow {
  show_key: string;
  show_time: string;
  show_day: string;
  name: string;
  url: string;
  picture: string;
  created_time: string;
  tags: string[];
  hosts: string[];
  duration: number;
  play_count: number;
  favorite_count: number;
  comment_count: number;
  listener_count: number;
  repost_count: number;
}

/**
 * Fetch data from RadioCult and transform it into a weekly schedule
 */
async function getWeeklySchedule(): Promise<{
  scheduleItems: ScheduleShow[];
  isActive: boolean;
  error?: string;
}> {
  try {
    // Get all events from RadioCult for the next 7 days
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 7);

    // Because we're using date ranges, we need to use the schedule endpoint
    const { events = [] } = await getEvents({
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      limit: 100, // High limit to ensure we get all events
    });

    // Check if events is valid and not empty
    if (!events || events.length === 0) {
      return {
        scheduleItems: [],
        isActive: false,
        error: 'No schedule available at this time',
      };
    }

    // Transform RadioCult events to schedule items
    const scheduleItems = events.map((event) => {
      const eventDate = new Date(event.startTime);
      const hours = eventDate.getHours().toString().padStart(2, '0');
      const minutes = eventDate.getMinutes().toString().padStart(2, '0');

      // Get day name
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const dayName = days[eventDate.getDay()];

      return {
        show_key: event.slug,
        show_time: `${hours}:${minutes}`,
        show_day: dayName,
        name: event.showName,
        url: `/shows/${event.slug}`,
        picture: event.imageUrl || '/image-placeholder.png',
        created_time: event.createdAt,
        tags: event.tags || [],
        hosts: (event.artists || []).map((artist) => artist.name || 'Unknown Artist'),
        duration: event.duration || 0,
        play_count: 0,
        favorite_count: 0,
        comment_count: 0,
        listener_count: 0,
        repost_count: 0,
      };
    });

    return {
      scheduleItems,
      isActive: scheduleItems.length > 0,
    };
  } catch (error) {
    console.error('Error fetching RadioCult schedule:', error);
    return {
      scheduleItems: [],
      isActive: false,
      error:
        error instanceof Error ? error.message : 'An error occurred while fetching the schedule',
    };
  }
}

export default async function SchedulePage() {
  // Get the schedule data from RadioCult
  const { scheduleItems, isActive, error } = await getWeeklySchedule();

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
  Object.keys(showsByDay).forEach((day) => {
    showsByDay[day].sort((a, b) => {
      const timeA = a.show_time.split(':').map(Number);
      const timeB = b.show_time.split(':').map(Number);
      return timeA[0] * 60 + timeA[1] - (timeB[0] * 60 + timeB[1]);
    });
  });

  return (
    <div className='min-h-screen bg-white dark:bg-black'>
      <div className=''>
        <div className='relative w-full h-[25vh] sm:h-[35vh] overflow-hidden'>
          <div className='absolute bottom-0 left-0 w-full px-5 z-10'>
            <PageHeader title='schedule' />
          </div>
        </div>
        {/* Times note at top-left */}
        <div className='mb-3 pl-5 '>
          <p className='text-sm font-mono text-black dark:text-white'>
            *TIMES ARE DISPLAYED IN [BST]
          </p>
        </div>

        {/* Schedule list */}
        <div className='space-y-0 px-5'>
          {isActive && scheduleItems.length > 0 ? (
            <>
              {daysOrder.map((day) => {
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
                const dayHeader = `${dayAbbr} ${dayNum}/${monthNum}`;

                return (
                  <div key={day}>
                    {/* Black day header */}
                    <div className='bg-almostblack dark:bg-white pl-1'>
                      <h2 className='text-white dark:text-black font-display text-[25px]'>
                        {dayHeader}
                      </h2>
                    </div>

                    {/* Show entries */}
                    <div className='divide-y divide-gray-200 dark:divide-gray-700'>
                      {dayShows.map((show, index) => {
                        let showPath = show.show_key;
                        if (showPath.startsWith('worldwidefm/')) {
                          showPath = showPath.replace(/^worldwidefm\//, '');
                        }

                        // Calculate end time (assuming 2-hour shows by default)
                        const startTime = show.show_time;
                        const [hours, minutes] = startTime.split(':').map(Number);
                        const endHours = (hours + 2) % 24;
                        const endTime = `${endHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
                        const timeRange = `${startTime}-${endTime}`;

                        // Format show name with host
                        const showName =
                          show.hosts.length > 0
                            ? `${show.name}: ${show.hosts.join(', ')}`
                            : show.name;

                        return (
                          <Link
                            href={`/episode${showPath}`}
                            key={`${show.show_day}-${show.show_time}-${show.name}`}
                            className='flex-row flex py-4'
                          >
                            <div className='flex items-center'>
                              <span className='w-[15vw] text-m6 font-mono text-black dark:text-white pr-8'>
                                {timeRange}
                              </span>
                              <span className='w-[50vw] uppercase font-mono text-m6 text-almostblack dark:text-white flex-1 pl-8'>
                                {showName}
                              </span>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </>
          ) : (
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
          )}
        </div>
      </div>
    </div>
  );
}

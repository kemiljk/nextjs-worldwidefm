import { Metadata } from 'next';
import { getEvents } from '@/lib/radiocult-service';
import { generateScheduleMetadata } from '@/lib/metadata-utils';
import { PageHeader } from '@/components/shared/page-header';
import ScheduleDisplay from '@/components/schedule-display';

export const generateMetadata = async (): Promise<Metadata> => {
  return generateScheduleMetadata();
};

export const revalidate = 60; // 1 minute

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
    const scheduleItems = events.map(event => {
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
        hosts: (event.artists || []).map(artist => artist.name || 'Unknown Artist'),
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

  return (
    <div className='min-h-screen bg-white dark:bg-black'>
      <div className=''>
        <div className='relative w-full pt-20 overflow-hidden'>
          <div className='relative left-0 w-full px-5 z-10'>
            <PageHeader title='schedule' />
          </div>
        </div>
        <ScheduleDisplay scheduleItems={scheduleItems} isActive={isActive} error={error} />
      </div>
    </div>
  );
}

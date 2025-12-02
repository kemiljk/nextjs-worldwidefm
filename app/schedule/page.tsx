import { Metadata } from 'next';
import { generateScheduleMetadata } from '@/lib/metadata-utils';
import { PageHeader } from '@/components/shared/page-header';
import ScheduleDisplay from '@/components/schedule-display';
import { getWeeklySchedule } from '@/lib/schedule-service';

export const generateMetadata = async (): Promise<Metadata> => {
  return generateScheduleMetadata();
};

export const revalidate = 60; // 1 minute

export default async function SchedulePage() {
  const { scheduleItems, dayDates, isActive, error } = await getWeeklySchedule();

  return (
    <div className='min-h-screen bg-white pb-40 dark:bg-black'>
      <div className=''>
        <div className='relative w-full pt-10 overflow-hidden'>
          <div className='relative left-0 w-full px-5 z-1 '>
            <PageHeader title='schedule' />
          </div>
        </div>
        <ScheduleDisplay
          scheduleItems={scheduleItems}
          dayDates={dayDates}
          isActive={isActive}
          error={error}
        />
      </div>
    </div>
  );
}

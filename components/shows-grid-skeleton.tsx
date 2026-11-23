import { Skeleton } from './ui/skeleton';
import { SHOW_CARD_LAYOUT } from './ui/show-card-layout';

interface ShowsGridSkeletonProps {
  count?: number;
}

function ShowCardSkeleton() {
  return (
    <div className={`${SHOW_CARD_LAYOUT.frameBorder} ${SHOW_CARD_LAYOUT.frame}`}>
      <div className={SHOW_CARD_LAYOUT.media}>
        <Skeleton className='absolute inset-0 w-full h-full border border-almostblack dark:border-0 rounded-none' />
      </div>

      <div className={SHOW_CARD_LAYOUT.details}>
        <div className='w-auto h-auto flex-1 gap-1 flex flex-col'>
          <Skeleton className='h-4 w-full rounded-none font-mono text-m8 sm:text-m6' />
          <Skeleton className='h-3 w-3/4 rounded-none pt-1' />
        </div>

        <div className={SHOW_CARD_LAYOUT.tags}>
          <div className='flex flex-row flex-wrap gap-1'>
            <Skeleton className='rounded-full px-1.5 py-0.5 h-[18px] w-14' />
            <Skeleton className='rounded-full px-1.5 py-0.5 h-[18px] w-16' />
          </div>
        </div>
      </div>
    </div>
  );
}

export function ShowsGridSkeleton({ count = 20 }: ShowsGridSkeletonProps) {
  return (
    <div className='grid grid-cols-2 md:grid-cols-5 gap-3 w-full h-auto'>
      {Array.from({ length: count }).map((_, index) => (
        <ShowCardSkeleton key={index} />
      ))}
    </div>
  );
}

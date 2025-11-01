import { Skeleton } from './ui/skeleton';

interface ShowsGridSkeletonProps {
  count?: number;
}

export function ShowsGridSkeleton({ count = 20 }: ShowsGridSkeletonProps) {
  return (
    <div className='grid grid-cols-2 md:grid-cols-5 gap-3 w-full h-auto'>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className='w-full flex flex-col gap-2'>
          <Skeleton className='w-full aspect-square rounded-none' />
          <Skeleton className='h-4 w-full rounded-none' />
          <Skeleton className='h-3 w-3/4 rounded-none' />
        </div>
      ))}
    </div>
  );
}


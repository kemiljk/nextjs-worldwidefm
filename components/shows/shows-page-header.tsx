import { PageHeader } from '@/components/shared/page-header';

export function ShowsPageHeader() {
  return (
    <div className='relative w-full h-[25vh] sm:h-[35vh] overflow-hidden'>
      <div className='absolute inset-0 bg-hyperpop' />
      <div
        className='absolute inset-0 bg-linear-to-b from-white via-white/0 to-white'
        style={{ mixBlendMode: 'hue' }}
      />
      <div
        className='absolute inset-0'
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          backgroundSize: '200px 200px',
          mixBlendMode: 'screen',
        }}
      />
      <div className='absolute bottom-0 left-0 w-full px-5 z-10'>
        <PageHeader title='Shows' />
      </div>
    </div>
  );
}

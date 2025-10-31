'use client';

import Link from 'next/link';
import { Button } from '@/cosmic/elements/Button';
import { usePlausible } from 'next-plausible';

interface MembershipPromoSectionProps {
  config?: {
    title?: string;
    description?: string;
    button_text?: string;
  };
}

export default function MembershipPromoSection({ config }: MembershipPromoSectionProps) {
  const plausible = usePlausible();
  const title = config?.title || 'Become a Member';
  const description =
    config?.description || 'Support Worldwide FM and keep independent radio alive.';
  const buttonText = config?.button_text || 'learn more';

  const handleMembershipClick = () => {
    plausible('Membership CTA Clicked', {
      props: {
        source: 'promo_section',
      },
    });
  };

  return (
    <section className='relative h-[80vh] mb-20 overflow-hidden'>
      <div className='absolute inset-0 bg-soul-200' />
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
          opacity: '40%',
        }}
      />
      <div className='relative z-10 h-full w-full px-20 gap-4 flex-col flex justify-center'>
        <h2 className='relative font-display text-h6 md:text-h5 font-bold uppercase text-white'>
          {title}
        </h2>
        <p className='max-w-100 text-white leading-tight font-sans text-body'>{description}</p>

        <Link className='h-fit w-50 pt-5 ' href='/membership' onClick={handleMembershipClick}>
          <Button variant='inverted' className='font-mono uppercase'>
            {buttonText}
          </Button>
        </Link>
      </div>
    </section>
  );
}

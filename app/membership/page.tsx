import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import MembershipSignupClient from '@/cosmic/blocks/user-management/MembershipSignupClient';
import { generateBaseMetadata } from '@/lib/metadata-utils';
import { getMembershipPage } from '@/lib/cosmic-service';

export const generateMetadata = async (): Promise<Metadata> => {
  try {
    const membership = await getMembershipPage();
    if (!membership?.metadata) {
      return generateBaseMetadata({
        title: 'Membership - Worldwide FM',
        description:
          'Support Worldwide FM, an independent radio station bringing you quality music from around the world.',
        noIndex: true,
      });
    }

    const metadata = membership.metadata as { description?: string };
    return generateBaseMetadata({
      title: membership.title || 'Membership - Worldwide FM',
      description:
        metadata.description ||
        'Support Worldwide FM, an independent radio station bringing you quality music from around the world.',
      noIndex: true,
    });
  } catch (error) {
    console.error('Error generating membership metadata:', error);
    return generateBaseMetadata({
      title: 'Membership - Worldwide FM',
      description:
        'Support Worldwide FM, an independent radio station bringing you quality music from around the world.',
      noIndex: true,
    });
  }
};

export default async function MembershipPage() {
  const membership = await getMembershipPage();

  if (!membership?.metadata) {
    notFound();
  }

  return (
    <div className='mx-auto'>
      <MembershipSignupClient
        heading={membership.title ?? 'Membership'}
        body={(membership.metadata as { body?: string }).body ?? ''}
      />
    </div>
  );
}

import { Metadata } from 'next';
import MembershipSignupClient from '@/cosmic/blocks/user-management/MembershipSignupClient';
import { generateBaseMetadata } from '@/lib/metadata-utils';
import { getMembershipPage } from '@/lib/cosmic-service';

export const generateMetadata = async (): Promise<Metadata> => {
  try {
    const membership = await getMembershipPage();
    return generateBaseMetadata({
      title: membership.title || 'Membership - Worldwide FM',
      description:
        membership.metadata.description ||
        'Support Worldwide FM, an independent radio station bringing you quality music from around the world.',
      noIndex: true, // Don't index subscription pages
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

  return (
    <div className='mx-auto'>
      <MembershipSignupClient
        heading={membership.title}
        body={membership.metadata.body}
      />
    </div>
  );
}

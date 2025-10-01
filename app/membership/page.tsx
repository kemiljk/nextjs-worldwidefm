import { Metadata } from 'next';
import MembershipSignupClient from '@/cosmic/blocks/user-management/MembershipSignupClient';
import { generateBaseMetadata } from '@/lib/metadata-utils';

export const generateMetadata = async (): Promise<Metadata> => {
  return generateBaseMetadata({
    title: 'Membership - Worldwide FM',
    description:
      'Subscribe to Worldwide FM membership for exclusive content, ad-free listening, and premium features.',
    noIndex: true, // Don't index subscription pages
  });
};

export default function MembershipPage() {
  return (
    <div className='container mx-auto py-8 px-4'>
      <MembershipSignupClient />
    </div>
  );
}

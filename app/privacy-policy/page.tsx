import { Metadata } from 'next';
import LegalContent from '@/components/shared/legal-content';
import { generatePrivacyMetadata } from '@/lib/metadata-utils';

export async function generateMetadata(): Promise<Metadata> {
  return generatePrivacyMetadata();
}

async function getPrivacyPolicyContent() {
  try {
    const { cosmic } = await import('@/cosmic/client');

    const response = await cosmic.objects
      .findOne({
        id: '68b2cb04dea361e2db6caf86',
      })
      .props('slug,title,metadata,type');

    return response?.object || null;
  } catch (error) {
    console.error('Error fetching privacy policy:', error);
    return null;
  }
}

export default async function PrivacyPolicyPage() {
  const privacyPolicy = await getPrivacyPolicyContent();

  if (!privacyPolicy) {
    return (
      <div className='max-w-4xl mx-auto py-8'>
        <h1 className='text-4xl font-display font-bold mb-4'>Privacy Policy</h1>
        <p className='text-muted-foreground'>
          Unable to load privacy policy content at this time. Please try again later.
        </p>
      </div>
    );
  }

  return <LegalContent title={privacyPolicy.title} content={privacyPolicy.metadata.text} />;
}

import { Metadata } from 'next';
import { PageHeader } from '@/components/shared/page-header';
import { getAboutPage } from '@/lib/cosmic-service';
import type { AboutPage } from '@/lib/cosmic-service';
import { generateAboutMetadata } from '@/lib/metadata-utils';

export async function generateMetadata(): Promise<Metadata> {
  try {
    const about = await getAboutPage();
    return generateAboutMetadata(about);
  } catch (error) {
    console.error('Error generating about page metadata:', error);
    return generateAboutMetadata();
  }
}

export default async function AboutPage() {
  const about = await getAboutPage();

  return (
    <main>
      <div className='relative w-full h-[25vh] sm:h-[35vh] overflow-hidden'>
        <div className='absolute inset-0 bg-jazz' />
        <div
          className='absolute inset-0 bg-gradient-to-b from-white via-white/0 to-white'
          style={{ mixBlendMode: 'hue' }}
        />
        <div
          className='absolute inset-0'
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
            backgroundSize: '50px 50px',
            mixBlendMode: 'screen',
          }}
        />
        <div className='absolute bottom-0 left-0 w-full px-5 z-10'>
          <PageHeader title='ABOUT' />
        </div>
      </div>

      <div className='pt-5 px-5 flex flex-col md:flex-row gap-10 justify-between'>
        {/* Mission Content */}
        <div className='w-[90vw] md:w-[50vw] lg:w-[40vw]'>
          <div
            className='font-sans text-[16px] leading-5 dark:prose-invert'
            dangerouslySetInnerHTML={{ __html: about.metadata.mission_content }}
          />
        </div>

        {/* Other Sections in One Column */}
        <div className='flex flex-col w-[90vw] md:w-[40vw] gap-10 mr-10'>
          {/* Connect, Contact, Social wrapper */}
          <div className='flex flex-col gap-10'>
            {/* Connect */}
            <div>
              <h2 className='text-m7 font-mono uppercase text-almostblack dark:text-white pb-2'>
                {about.metadata.connect_title}
              </h2>
              <div
                className='w-70 prose dark:prose-invert text-b3'
                dangerouslySetInnerHTML={{ __html: about.metadata.connect_content }}
              />
            </div>

            {/* Contact */}
            <div>
              <h2 className='text-m7 font-mono uppercase text-almostblack dark:text-white pb-2'>
                Contact
              </h2>
              <p className='w-70 prose dark:prose-invert text-b3'>
                {about.metadata.contact_info.metadata.email}
                <br />
                {about.metadata.contact_info.metadata.phone}
                <br />
                {about.metadata.contact_info.metadata.location}
              </p>
            </div>

            {/* Social */}
            <div>
              <h3 className='text-m7 font-mono uppercase text-almostblack dark:text-white pb-2'>
                Social
              </h3>
              <div className='flex gap-4'>
                <a
                  href={about.metadata.social_links.metadata.instagram}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='text-muted-foreground hover:underline transition-colors text-sm'
                >
                  Instagram
                </a>
                <a
                  href={about.metadata.social_links.metadata.twitter}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='text-muted-foreground hover:underline transition-colors text-sm'
                >
                  Twitter
                </a>
                <a
                  href={about.metadata.social_links.metadata.facebook}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='text-muted-foreground hover:underline transition-colors text-sm'
                >
                  Facebook
                </a>
              </div>
            </div>
          </div>

          {/* Partner */}
          <div className='space-y-2 pb-20'>
            <h2 className='text-m7 font-mono uppercase text-almostblack dark:text-white pb-2'>
              {about.metadata.partner_with_us_title}
            </h2>
            <div
              className='w-100 prose dark:prose-invert text-b3 prose-mono'
              dangerouslySetInnerHTML={{ __html: about.metadata.partner_with_us_description }}
            />
            <div className='mt-2'>
              <h3 className='pt-4 text-m7 font-mono uppercase text-almostblack dark:text-white mb-2'>
                Partners
              </h3>
              <div className='flex flex-wrap gap-2'>
                {about.metadata.partner_with_us.map(partner => (
                  <div key={partner.name}>
                    <img src={partner.logo.url} alt={partner.name} className='size-24' />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

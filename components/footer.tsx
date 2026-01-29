import Link from 'next/link';
import * as SimpleIcons from 'simple-icons';
import { Button } from '@/components/ui/button';
import { cosmic } from '@/cosmic/client';

// Helper function to get icon by name
const getIcon = (iconName: string) => {
  return (SimpleIcons as any)[iconName];
};

export default async function Footer() {
  const socialLinks = await cosmic.objects
    .findOne({
      type: 'social-links',
      slug: 'social-links',
    })
    .props('slug,title,metadata,type')
    .depth(1);

  return (
    <footer className='bg-white dark:bg-gray-900 text-almostblack dark:text-white pt-8 border-t border-almostblack w-full'>
      <div className='mx-auto px-5'>
        <div className='flex flex-col sm:flex-row sm:justify-between sm:w-full gap-10'>
          <div className='w-full sm:w-[30vw] sm:pr-10 flex flex-col gap-10'>
            {/* About section */}
            <div>
              <p className='font-sans text-b3 leading-5'>
                Worldwide FM is a global music radio platform founded by Gilles Peterson, connecting
                people through music that transcends borders and cultures.
              </p>
            </div>
            {/* Connect section */}
            <div className='w-auto pr-10'>
              <h3 className='text-m7 font-mono uppercase font-normal text-almostblack dark:text-white pb-4'>
                Connect
              </h3>
              <div className='flex gap-4'>
                {socialLinks.object?.metadata?.social_link?.map((link: any, index: number) => {
                  const icon = getIcon(link.icon);

                  if (!icon) {
                    return (
                      <span key={index} className='text-red-500'>
                        ❌ {link.icon}
                      </span>
                    );
                  }

                  return (
                    <Link key={index} href={link.link} target='_blank' rel='noopener noreferrer'>
                      <div
                        dangerouslySetInnerHTML={{
                          __html: icon.svg.replace(/<path /g, '<path fill="currentColor" '),
                        }}
                        className='h-5 w-5 text-black dark:text-white'
                      />
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Quick links + Newsletter wrapper */}
          <div className='w-full sm:max-w-[60vw] flex flex-col md:flex-row gap-20'>
            {/* Quick links */}
            <div className='w-auto pr-10'>
              <h3 className='text-m7 whitespace-nowrap font-mono uppercase font-normal text-almostblack dark:text-white pb-3'>
                Quick Links
              </h3>
              <ul className='w-full flex flex-col '>
                <li className='w-full hover:underline'>
                  <Link href='/shows' className='font-sans text-b3 w-full'>
                    Archive
                  </Link>
                </li>
                <li className='inline hover:underline'>
                  <Link href='/about' className='font-sans text-b3 w-full'>
                    About
                  </Link>
                </li>
                <li className='inline hover:underline'>
                  <Link href='/contact' className='font-sans text-b3 w-full'>
                    Contact
                  </Link>
                </li>
                <li className='inline hover:underline'>
                  <Link href='/privacy-policy' className='font-sans text-b3 w-full'>
                    Privacy Policy
                  </Link>
                </li>
                <li className='inline hover:underline'>
                  <Link href='/terms-and-conditions' className='font-sans text-b3 w-full'>
                    Terms & Conditions
                  </Link>
                </li>
              </ul>
            </div>

            {/* Newsletter section */}
            <div className='w-full lg:w-80'>
              <h3 className='text-m7 font-mono uppercase font-normal text-almostblack dark:text-white pb-3'>
                BECOME A MEMBER
              </h3>
              <p className='font-sans text-b3 pb-4'>
                Support independent global radio for £6 a month
              </p>
              <Button
                variant='outline'
                className='w-auto border-black font-mono text-[12px] dark:border-white text-foreground'
                asChild
              >
                <Link href='/membership'>JOIN NOW</Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className='pt-20 pb-10 border-white/10 text-center font-sans text-b4 text-almostblack dark:text-white'>
          <p>&copy; {new Date().getFullYear()} Worldwide FM. All rights reserved.</p>
          <p className='mt-2'>
            <Link
              href='https://cosmicjs.com'
              target='_blank'
              rel='noopener noreferrer'
              className='hover:underline'
            >
              Website powered by Cosmic
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}

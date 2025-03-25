import Link from 'next/link';
import { Instagram, Twitter, Facebook, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Footer() {
  return (
    <footer className='bg-brand-blue text-white py-12'>
      <div className='container mx-auto px-4'>
        <div className='grid grid-cols-1 md:grid-cols-4 gap-8'>
          {/* About section */}
          <div>
            <h3 className='text-lg font-medium mb-4'>Worldwide FM</h3>
            <p className='text-sm opacity-80'>
              A global music radio platform founded by Gilles Peterson, connecting people through
              music that transcends borders and cultures.
            </p>
          </div>

          {/* Quick links */}
          <div>
            <h3 className='text-lg font-medium mb-4'>Quick Links</h3>
            <ul className='space-y-2'>
              <li>
                <Link
                  href='/archive'
                  className='text-sm opacity-80 hover:text-brand-orange transition-colors'
                >
                  Archive
                </Link>
              </li>
              <li>
                <Link
                  href='/about'
                  className='text-sm opacity-80 hover:text-brand-orange transition-colors'
                >
                  About
                </Link>
              </li>
              <li>
                <Link
                  href='/contact'
                  className='text-sm opacity-80 hover:text-brand-orange transition-colors'
                >
                  Contact
                </Link>
              </li>
              <li>
                <Link
                  href='/privacy'
                  className='text-sm opacity-80 hover:text-brand-orange transition-colors'
                >
                  Privacy Policy
                </Link>
              </li>
            </ul>
          </div>

          {/* Connect section */}
          <div>
            <h3 className='text-lg font-medium mb-4'>Connect</h3>
            <div className='flex gap-4'>
              <Button
                variant='ghost'
                size='icon'
                className='text-white hover:bg-white/10'
                asChild
              >
                <Link
                  href='https://discord.gg/worldwidefm'
                  target='_blank'
                  rel='noopener noreferrer'
                >
                  <MessageCircle className='h-5 w-5' />
                </Link>
              </Button>
              <Button
                variant='ghost'
                size='icon'
                className='text-white hover:bg-white/10'
                asChild
              >
                <Link
                  href='https://instagram.com/worldwidefm'
                  target='_blank'
                  rel='noopener noreferrer'
                >
                  <Instagram className='h-5 w-5' />
                </Link>
              </Button>
              <Button
                variant='ghost'
                size='icon'
                className='text-white hover:bg-white/10'
                asChild
              >
                <Link
                  href='https://twitter.com/worldwidefm'
                  target='_blank'
                  rel='noopener noreferrer'
                >
                  <Twitter className='h-5 w-5' />
                </Link>
              </Button>
              <Button
                variant='ghost'
                size='icon'
                className='text-white hover:bg-white/10'
                asChild
              >
                <Link
                  href='https://facebook.com/worldwidefm'
                  target='_blank'
                  rel='noopener noreferrer'
                >
                  <Facebook className='h-5 w-5' />
                </Link>
              </Button>
            </div>
          </div>

          {/* Newsletter section */}
          <div>
            <h3 className='text-lg font-medium mb-4'>Stay Updated</h3>
            <p className='text-sm opacity-80 mb-4'>
              Subscribe to our newsletter for the latest updates and exclusive content.
            </p>
            <Button
              variant='outline'
              className='w-full border-white text-white hover:bg-white/10'
              asChild
            >
              <Link href='/newsletter'>Subscribe</Link>
            </Button>
          </div>
        </div>

        {/* Copyright */}
        <div className='mt-12 pt-8 border-t border-white/10 text-center text-sm opacity-60'>
          <p>&copy; {new Date().getFullYear()} Worldwide FM. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

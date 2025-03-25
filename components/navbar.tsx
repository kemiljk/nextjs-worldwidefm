'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Radio } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import Logo from './logo';
import { getSchedule, transformShowToViewData } from '@/lib/cosmic-service';

type NavItem = {
  name: string;
  link: string;
};

interface NavbarProps {
  navItems: NavItem[];
}

export default function Navbar({ navItems }: NavbarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentShow, setCurrentShow] = useState<ReturnType<typeof transformShowToViewData> | null>(
    null
  );

  useEffect(() => {
    async function fetchCurrentShow() {
      try {
        console.log('Fetching schedule...');
        const scheduleResponse = await getSchedule();
        console.log('Schedule response:', scheduleResponse);

        if (scheduleResponse.object?.metadata?.shows) {
          console.log('Found shows in schedule:', scheduleResponse.object.metadata.shows);
          const currentShowData = scheduleResponse.object.metadata.shows[0];
          console.log('Current show data:', currentShowData);

          if (currentShowData) {
            const transformedShow = transformShowToViewData(currentShowData);
            console.log('Transformed show:', transformedShow);
            setCurrentShow(transformedShow);
          }
        } else {
          console.log('No shows found in schedule');
        }
      } catch (error) {
        console.error('Error fetching current show:', error);
      }
    }

    fetchCurrentShow();
  }, []);

  return (
    <header className='fixed top-0 border-b border-tan-100 dark:border-tan-800 left-0 right-0 z-50 transition-all duration-300 bg-background shadow-2xl shadow-tan-900/20 dark:shadow-tan-900'>
      <div className='mx-auto px-4 flex justify-between items-center'>
        <div className='flex items-center gap-4 py-4'>
          <Link
            href='/'
            className='flex items-center'
          >
            <Logo className='w-auto h-8' />
          </Link>

          {/* Now Playing indicator */}
          {currentShow && (
            <div className='hidden md:flex items-center gap-2 px-6 py-2 bg-black/5 rounded-full'>
              <div className='w-2 h-2 rounded-full bg-red-500 animate-pulse'></div>
              <div className='flex flex-col'>
                <span className='text-xs font-medium text-muted-foreground uppercase'>On now</span>
                <span className='text-sm font-medium'>{currentShow.title}</span>
              </div>
            </div>
          )}
        </div>

        <Sheet
          open={isOpen}
          onOpenChange={setIsOpen}
        >
          <SheetTrigger asChild>
            <Button
              variant='ghost'
              size='icon'
              className='text-foreground'
              onClick={() => setIsOpen(true)}
            >
              <MoreHorizontal className='size-6' />
              <span className='sr-only'>Open menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent
            side='right'
            className='w-[300px] sm:w-[400px]'
          >
            <SheetHeader>
              <SheetTitle className='text-left'>Menu</SheetTitle>
            </SheetHeader>
            <nav className='mt-8'>
              <ul className='space-y-4'>
                {navItems.map((item) => (
                  <li key={item.name}>
                    <Link
                      href={item.link}
                      className='block py-2 text-lg hover:text-brand-orange transition-colors'
                      onClick={() => setIsOpen(false)}
                    >
                      {item.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}

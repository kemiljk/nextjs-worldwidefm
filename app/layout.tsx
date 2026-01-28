import type React from 'react';
import { Suspense } from 'react';
import type { Metadata } from 'next';
import Script from 'next/script';
import Nimbus from 'next/font/local';
import AirCompressed from 'next/font/local';
import FoundersGrotesk from 'next/font/local';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Providers } from '@/components/providers';
import NavWrapper from '@/components/nav-wrapper';
import Footer from '@/components/footer';
import LivePlayer from '@/components/live-player';
import ArchivePlayer from '@/components/archive-player';
import DiscordButton from '@/components/discord-button';
import './globals.css';

const sans = Nimbus({
  src: './fonts/Nimbus-Sans-D-OT_32758.woff2',
  weight: '400',
  style: 'normal',
  display: 'swap',
  variable: '--font-sans',
});

const display = AirCompressed({
  src: './fonts/AirCompressed-Black-WWFM.woff',
  weight: '900',
  style: 'normal',
  display: 'swap',
  variable: '--font-display',
});

const mono = FoundersGrotesk({
  src: './fonts/Founders Grotesk Mono Regular Regular.woff2',
  weight: '400',
  style: 'normal',
  display: 'swap',
  variable: '--font-mono',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://worldwidefm.net'),
  title: 'Worldwide FM',
  description:
    'A global music radio platform founded by Gilles Peterson, connecting people through music that transcends borders and cultures.',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    apple: [{ url: '/favicon.svg', type: 'image/svg+xml' }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang='en' suppressHydrationWarning>
      <body
        className={`${sans.variable} ${display.variable} ${mono.variable} min-h-screen w-full bg-background font-sans`}
      >
        <Script src='https://cdn.socket.io/4.7.2/socket.io.min.js' strategy='lazyOnload' />
        <Providers>
          <Suspense
            fallback={
              <nav className='fixed top-11 z-40 w-full border-b border-almostblack bg-almostwhite dark:bg-almostblack h-14' />
            }
          >
            <NavWrapper />
          </Suspense>
          <LivePlayer />
          <main className='w-full pt-14 overflow-x-hidden'>
            <Suspense>{children}</Suspense>
          </main>
          <ArchivePlayer />
          <DiscordButton />
        </Providers>
        <Suspense
          fallback={
            <footer className='bg-white dark:bg-gray-900 pt-8 border-t border-almostblack w-full h-64' />
          }
        >
          <Footer />
        </Suspense>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}

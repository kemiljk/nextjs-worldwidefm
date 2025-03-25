import type React from 'react';
import type { Metadata } from 'next';
import ABCDiatype_SemiMono from 'next/font/local';
import './globals.css';
import NavWrapper from '@/components/nav-wrapper';
import Footer from '@/components/footer';
import { ThemeProvider } from '@/components/theme-provider';

const sans = ABCDiatype_SemiMono({
  src: '/fonts/ABCDiatypeSemi-MonoVariable-Trial.woff2',
  variable: '--font-sans',
  style: 'normal',
  display: 'swap',
  weight: '400 500 600 700 800 900',
});

export const metadata: Metadata = {
  title: 'Worldwide FM',
  description: 'Worldwide FM',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    apple: [{ url: '/favicon.svg', type: 'image/svg+xml' }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang='en'
      className={sans.variable}
    >
      <body className='font-sans bg-background text-foreground'>
        <ThemeProvider attribute='class'>
          <NavWrapper />
          <main>{children}</main>
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  );
}

import './globals.css';

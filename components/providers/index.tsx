'use client';

import { ReactNode } from 'react';
import { ThemeProvider } from './theme-provider';
import SearchProvider from './search-provider';
import { AuthProvider } from '@/cosmic/blocks/user-management/AuthContext';
import { MediaPlayerProvider } from './media-player-provider';
import PlausibleProvider from 'next-plausible';

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <PlausibleProvider domain='worldwidefm.net'>
      <ThemeProvider
        attribute='class'
        defaultTheme='system'
        enableSystem
        disableTransitionOnChange
        storageKey='worldwidefm-theme'
      >
        <AuthProvider>
          <SearchProvider>
            <MediaPlayerProvider>
              {children}
            </MediaPlayerProvider>
          </SearchProvider>
        </AuthProvider>
      </ThemeProvider>
    </PlausibleProvider>
  );
}


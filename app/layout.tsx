import type React from "react";
import type { Metadata } from "next";
import ABCDiatype from "next/font/local";
import Mono from "next/font/local";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/theme-provider";
import SearchProvider from "@/components/providers/search-provider";
import { MediaPlayerProvider } from "@/components/providers/media-player-provider";
import MediaPlayer from "@/components/media-player";
import NavWrapper from "@/components/nav-wrapper";
import Footer from "@/components/footer";

const sans = ABCDiatype({
  src: "./fonts/ABCDiatypeSemi-MonoVariable-Trial.woff2",
  weight: "300 400 500 600 700 800",
  style: "normal",
  display: "swap",
  variable: "--font-sans",
});

const mono = Mono({
  src: "./fonts/PPFraktionMono-Regular.woff2",
  style: "normal",
  display: "swap",
  weight: "400",
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Worldwide FM",
  description: "A global music radio platform founded by Gilles Peterson, connecting people through music that transcends borders and cultures.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/favicon.svg", type: "image/svg+xml" }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${sans.variable} ${mono.variable} min-h-screen bg-background font-sans`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange storageKey="worldwidefm-theme">
          <SearchProvider>
            <MediaPlayerProvider>
              <NavWrapper />
              <main className="px-4 md:px-8 lg:px-16 mx-auto pt-24">{children}</main>
              <Footer />
              <MediaPlayer />
            </MediaPlayerProvider>
          </SearchProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

import "./globals.css";

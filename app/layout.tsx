import type React from "react";
import type { Metadata } from "next";
import Nimbus from "next/font/local";
import AirCompressed from "next/font/local";
import FoundersGrotesk from "next/font/local";
import { ThemeProvider } from "@/components/providers/theme-provider";
import SearchProvider from "@/components/providers/search-provider";
import { AuthProvider } from "@/cosmic/blocks/user-management/AuthContext";
import { MediaPlayerProvider } from "@/components/providers/media-player-provider";
import NavWrapper from "@/components/nav-wrapper";
import Footer from "@/components/footer";
import LivePlayer from "@/components/live-player";
import ArchivePlayer from "@/components/archive-player";
import DiscordButton from "@/components/discord-button";
import "./globals.css";

const sans = Nimbus({
  src: "./fonts/Nimbus-Sans-D-OT_32758.woff2",
  weight: "400",
  style: "normal",
  display: "swap",
  variable: "--font-sans",
});

const display = AirCompressed({
  src: "./fonts/AirCompressed.woff2",
  weight: "900",
  style: "normal",
  display: "swap",
  variable: "--font-display",
});

const mono = FoundersGrotesk({
  src: "./fonts/Founders Grotesk Mono Regular Regular.woff2",
  weight: "400",
  style: "normal",
  display: "swap",
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
      <body className={`${sans.variable} ${display.variable} ${mono.variable} min-h-screen bg-background font-sans`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange storageKey="worldwidefm-theme">
          <AuthProvider>
            <SearchProvider>
              <MediaPlayerProvider>
                <LivePlayer />
                <NavWrapper />
                <main className="px-4 md:px-8 lg:px-16 mx-auto pt-24 overflow-x-hidden">{children}</main>
                <ArchivePlayer />
                <Footer />
                <DiscordButton />
              </MediaPlayerProvider>
            </SearchProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

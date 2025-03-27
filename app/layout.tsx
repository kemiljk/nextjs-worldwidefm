import type React from "react";
import type { Metadata } from "next";
import ABCDiatype from "next/font/local";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { SearchProvider } from "@/components/providers/search-provider";
import NavWrapper from "@/components/nav-wrapper";
import Footer from "@/components/footer";

const sans = ABCDiatype({
  src: "./fonts/ABCDiatypeSemi-MonoVariable-Trial.woff2",
  weight: "300 400 500 600 700 800",
  style: "normal",
  display: "swap",
  variable: "--font-sans",
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
      <body className={`${sans.className} min-h-screen bg-background`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange storageKey="worldwidefm-theme">
          <SearchProvider>
            <NavWrapper />
            <main className="max-w-screen-2xl mx-auto">{children}</main>
            <Footer />
          </SearchProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

import "./globals.css";

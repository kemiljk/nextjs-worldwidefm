import type React from "react";
import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";
import NavWrapper from "@/components/nav-wrapper";
import { ThemeProvider } from "@/components/theme-provider";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
});

export const metadata: Metadata = {
  title: "Worldwide Radio",
  description: "Modern radio streaming platform",
  generator: "v0.dev",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={spaceGrotesk.variable}>
      <body className="font-sans bg-background text-foreground">
        <ThemeProvider attribute="class">
          <NavWrapper />
          <main>{children}</main>
        </ThemeProvider>
      </body>
    </html>
  );
}

import "./globals.css";

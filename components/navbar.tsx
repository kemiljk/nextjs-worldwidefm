"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MoreHorizontal } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import Logo from "./logo";

type NavItem = {
  name: string;
  link: string;
};

interface NavbarProps {
  navItems: NavItem[];
}

export default function Navbar({ navItems }: NavbarProps) {
  const [currentTime, setCurrentTime] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Update time every minute
    const updateTime = () => {
      const date = new Date();
      setCurrentTime(date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    };

    updateTime();
    const interval = setInterval(updateTime, 60000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  return (
    <header className="fixed top-2 rounded-xl border border-tan-100 dark:border-tan-800 left-0 right-0 z-50 transition-all duration-300 bg-background shadow-2xl shadow-tan-50 dark:shadow-tan-900 mx-8">
      <div className="mx-auto px-4">
        <div className="flex items-center justify-between py-4">
          <Link href="/" className="flex items-center">
            <Logo className="w-auto h-8" />
          </Link>

          <div className="text-sm text-muted-foreground">London, England • {currentTime}</div>

          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="text-foreground" onClick={() => setIsOpen(true)}>
                <MoreHorizontal className="size-6" />
                <span className="sr-only">Open menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px] sm:w-[400px]">
              <SheetHeader>
                <SheetTitle className="text-left">Menu</SheetTitle>
              </SheetHeader>
              <nav className="mt-8">
                <ul className="space-y-4">
                  {navItems.map((item) => (
                    <li key={item.name}>
                      <Link href={item.link} className="block py-2 text-lg hover:text-brand-orange transition-colors" onClick={() => setIsOpen(false)}>
                        {item.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MoreHorizontal } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import Logo from "./logo";
import { SearchButton } from "./search/search-button";

type NavItem = {
  name: string;
  link: string;
};

interface NavbarProps {
  navItems: NavItem[];
}

export default function Navbar({ navItems }: NavbarProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Split nav items into visible and overflow items
  const visibleNavItems = navItems.slice(0, 5);
  const overflowNavItems = navItems.slice(5);

  return (
    <header className="fixed top-12 left-0 right-0 z-50 transition-all border-b border-almostblack dark:border-white duration-300 bg-background">
      <div className="mx-auto pl-4 flex justify-between items-center">
        <div className="flex items-center w-full">
          <Link href="/" className="flex items-center">
            <Logo className="w-auto h-8 text-foreground" />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:block ml-auto">
            <ul className="flex items-center uppercase">
              {visibleNavItems.map((item) => (
                <li key={item.name}>
                  <Link href={item.link} className="flex font-mono items-center h-16 hover:bg-almostblack text-almostblack hover:text-white dark:text-white transition-colors px-8 dark:hover:bg-white dark:hover:text-almostblack">
                    {item.name}
                  </Link>
                </li>
              ))}
              {overflowNavItems.length > 0 && (
                <li>
                  <Sheet>
                    <SheetTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-foreground h-16 hover:bg-almostblack text-almostblack hover:text-white dark:text-white transition-colors px-8 dark:hover:bg-white dark:hover:text-almostblack">
                        <MoreHorizontal className="size-4" />
                        <span className="sr-only">More menu items</span>
                      </Button>
                    </SheetTrigger>
                    <SheetContent side="right" className="w-[300px] sm:w-[400px]">
                      <SheetHeader>
                        <SheetTitle className="text-left">More</SheetTitle>
                      </SheetHeader>
                      <nav className="mt-8">
                        <ul className="space-y-4">
                          {overflowNavItems.map((item) => (
                            <li key={item.name}>
                              <Link href={item.link} className="block py-2 text-lg hover:bg-bronze-500 transition-colors px-4">
                                {item.name}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </nav>
                    </SheetContent>
                  </Sheet>
                </li>
              )}
            </ul>
          </nav>
        </div>

        <div className="flex items-center">
          <div className="hidden md:block">
            <SearchButton />
          </div>

          {/* Mobile Menu */}
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="text-foreground size-16 md:hidden" onClick={() => setIsOpen(true)}>
                <MoreHorizontal className="size-6" />
                <span className="sr-only">Open menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px] sm:w-[400px]">
              <SheetHeader>
                <SheetTitle className="text-left">Menu</SheetTitle>
              </SheetHeader>
              <nav className="mt-8">
                <div className="mb-4 md:hidden">
                  <SearchButton />
                </div>
                <ul className="space-y-4">
                  {navItems.map((item) => (
                    <li key={item.name}>
                      <Link href={item.link} className="block py-2 text-lg hover:text-bronze-500 transition-colors" onClick={() => setIsOpen(false)}>
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

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Menu, User, X } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import Logo from "./logo";
import { SearchButton } from "./search/search-button";
import { useAuth } from "@/cosmic/blocks/user-management/AuthContext";
import { getUserData } from "@/cosmic/blocks/user-management/actions";
import clsx from "clsx";

type NavItem = {
  name: string;
  link: string;
};

interface NavbarProps {
  navItems: NavItem[];
}

export default function Navbar({ navItems }: NavbarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      getUserData(user.id)
        .then((response) => {
          if (response.data) {
            setUserData(response.data);
          }
        })
        .catch((error) => console.error("Error fetching user data:", error));
    } else {
      setUserData(null);
    }
  }, [user]);

  // Close mobile Sheet if resizing to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        // md breakpoint
        setIsOpen(false);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Split nav items into visible and overflow items
  const processedNavItems = navItems.map((item) => {
    if (item.name.toLowerCase() === "log in") {
      return { ...item, name: user ? "" : "Log In", showAsAvatar: !!user };
    }
    return item;
  });
  const processedVisibleNavItems = processedNavItems.slice(0, 6);
  const processedOverflowNavItems = processedNavItems.slice(6);

  return (
    <header className="w-full fixed top-7 left-0 right-0 z-50 transition-all border-b border-t border-almostblack dark:border-white duration-300 bg-background">
      <div className="w-full flex flex-1 justify-between">
        <div className="flex items-center ml-4 w-full">
          <Link href="/" className="flex items-center">
            <Logo className="w-auto h-5 text-foreground" />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:block ml-auto">
            <ul className="flex items-center uppercase pr-0 border-r border-black ">
              {processedVisibleNavItems.map((item) => (
                <li key={item.name}>
                  <Link href={item.link} className="flex font-mono text-m8 items-center h-10 hover:text-almostblack/20 text-almostblack dark:text-white transition-colors px-4 dark:hover:text-white/20">
                    {(item as any).showAsAvatar && user ? (
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6 border border-almostblack dark:border-white">
                          <AvatarImage src={userData?.metadata?.avatar?.imgix_url || user.image} alt="Profile" />
                          <AvatarFallback>
                            <User className="h-4 w-4" />
                          </AvatarFallback>
                        </Avatar>
                        <span className="sr-only">Profile</span>
                      </div>
                    ) : (
                      item.name
                    )}
                  </Link>
                </li>
              ))}
              {processedOverflowNavItems.length > 0 && (
                <li>
                  <Sheet>
                    <SheetTrigger asChild>
                      <Button variant="ghost" className="flex flex-row px-2 text-almostblack dark:text-white hover:text-white transition-colors dark:hover:bg-white dark:hover:text-almostblack">
                        <Menu className="size-2" />
                        <span className="sr-only">More menu items</span>
                      </Button>
                    </SheetTrigger>
                    <SheetContent side="right" className="w-[300px] sm:w-[400px]">
                      <SheetHeader>
                        <SheetTitle className="text-left">More</SheetTitle>
                      </SheetHeader>
                      <nav className="mt-2">
                        <ul className="space-y-4">
                          {processedOverflowNavItems.map((item) => (
                            <li key={item.name}>
                              <Link href={item.link} className="block py-1 text-lg hover:bg-almostblack dark:hover:bg-white text-almostblack dark:text-white hover:text-white transition-colors px-4 font-mono uppercase">
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

        <div className="flex items-center flex-wrap">
          <div className="hidden md:block">
            <SearchButton />
          </div>

          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <div className="md:hidden flex items-center">
              <div className="border-r border-l border-almostblack">
                <SearchButton />
              </div>
              <SheetTrigger asChild>
                <Button className={clsx("h-10 w-10 p-0 transition-colors text-almostblack hover:text-white dark:hover:text-black", isOpen ? "bg-almostblack text-white dark:bg-white dark:text-black" : "bg-white text-almostblack dark:bg-black dark:text-white")}>
                  {isOpen ? <X className="size-3" /> : <Menu className="size-3" />}
                  <span className="sr-only">{isOpen ? "Close menu" : "Open menu"}</span>
                </Button>
              </SheetTrigger>
            </div>
            <SheetContent side="right" className="top-17 w-auto min-w-[25vw] h-auto max-h-fit overflow-auto">
              <nav>
                <ul className="flex flex-col gap-0">
                  {processedNavItems.map((item) => (
                    <li key={item.name}>
                      <Link href={item.link} className="block text-m8 py-2.5 px-2 border-b border-almostblack text-almostblack dark:text-white hover:text-white hover:bg-almostblack dark:hover:text-white transition-colors font-mono uppercase" onClick={() => setIsOpen(false)}>
                        {(item as any).showAsAvatar && user ? (
                          <div className="flex items-center gap-3">
                            <Avatar className="h-6 w-6 border border-almostblack dark:border-white">
                              <AvatarImage src={userData?.metadata?.avatar?.imgix_url || user.image} alt="Profile" />
                              <AvatarFallback>
                                <User className="h-3 w-3" />
                              </AvatarFallback>
                            </Avatar>
                            <span>Profile</span>
                          </div>
                        ) : (
                          item.name
                        )}
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

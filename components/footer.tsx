import Link from "next/link";
import { siInstagram, siX, siFacebook, siDiscord } from "simple-icons";
import { Button } from "@/components/ui/button";

export default function Footer() {
  return (
    <footer className="bg-white dark:bg-gray-900 text-foreground py-12 border-t border-black w-full">
      <div className="mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* About section */}
          <div>
            <h3 className="text-m4 font-display uppercase font-normal text-almostblack dark:text-white mb-4">Worldwide FM</h3>
            <p className="text-sm">A global music radio platform founded by Gilles Peterson, connecting people through music that transcends borders and cultures.</p>
          </div>

          {/* Quick links */}
          <div>
            <h3 className="text-m4 font-display uppercase font-normal text-almostblack dark:text-white mb-4">Quick Links</h3>
            <ul className="space-y-2 w-full">
              <li className="w-full">
                <Link href="/shows" className="text-sm py-2 w-full">
                  Archive
                </Link>
              </li>
              <li className="w-full">
                <Link href="/about" className="text-sm py-2 w-full">
                  About
                </Link>
              </li>
              <li className="w-full">
                <Link href="/contact" className="text-sm py-2 w-full">
                  Contact
                </Link>
              </li>
              <li className="w-full">
                <Link href="/privacy-policy" className="text-sm py-2 w-full">
                  Privacy Policy
                </Link>
              </li>
              <li className="w-full">
                <Link href="/terms-and-conditions" className="text-sm py-2 w-full">
                  Terms & Conditions
                </Link>
              </li>
            </ul>
          </div>

          {/* Connect section */}
          <div>
            <h3 className="text-m4 font-display uppercase font-normal text-almostblack dark:text-white mb-4">Connect</h3>
            <div className="flex gap-4">
              <Link href="https://discord.gg/worldwidefm" target="_blank" rel="noopener noreferrer">
                <div dangerouslySetInnerHTML={{ __html: siDiscord.svg }} className="h-5 w-5" />
              </Link>
              <Link href="https://instagram.com/worldwidefm" target="_blank" rel="noopener noreferrer">
                <div dangerouslySetInnerHTML={{ __html: siInstagram.svg }} className="h-5 w-5" />
              </Link>
              <Link href="https://twitter.com/worldwidefm" target="_blank" rel="noopener noreferrer">
                <div dangerouslySetInnerHTML={{ __html: siX.svg }} className="h-5 w-5" />
              </Link>
              <Link href="https://facebook.com/worldwidefm" target="_blank" rel="noopener noreferrer">
                <div dangerouslySetInnerHTML={{ __html: siFacebook.svg }} className="h-5 w-5" />
              </Link>
            </div>
          </div>

          {/* Newsletter section */}
          <div>
            <h3 className="text-m4 font-display uppercase font-normal text-almostblack dark:text-white mb-4">Stay Updated</h3>
            <p className="text-sm mb-4">Subscribe to our newsletter for the latest updates and exclusive content.</p>
            <Button variant="outline" className="w-full border-black rounded-full dark:border-white text-foreground" asChild>
              <Link href="/newsletter">Subscribe</Link>
            </Button>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-12 pt-8 border-t border-white/10 text-center text-sm opacity-60">
          <p>&copy; {new Date().getFullYear()} Worldwide FM. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

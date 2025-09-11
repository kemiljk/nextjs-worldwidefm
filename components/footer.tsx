import Link from "next/link";
import { siInstagram, siX, siFacebook, siDiscord } from "simple-icons";
import { Button } from "@/components/ui/button";

export default function Footer() {
  return (
    <footer className="bg-white dark:bg-gray-900 text-almostblack pt-8 border-t border-almostblack w-full">
      <div className="mx-auto px-5">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:w-full gap-10">

          <div className="w-full sm:w-[30vw] sm:pr-10 flex flex-col gap-10" >
            {/* About section */}
            <div>
              <p className="font-sans text-b3 leading-5">Worldwide FM is a global music radio platform founded by Gilles Peterson, connecting people through music that transcends borders and cultures.</p>
            </div>
            {/* Connect section */}
            <div className="w-auto pr-10">
              <h3 className="text-m7 font-mono uppercase  uppercase font-normal text-almostblack dark:text-white pb-4">Connect</h3>
              <div className="flex gap-4">
                <Link href="https://discord.gg/worldwidefm" target="_blank" rel="noopener noreferrer">
                  <div dangerouslySetInnerHTML={{ __html: siDiscord.svg }} className="h-5 w-5" />
                </Link>
                <Link href="https://instagram.com/worldwide.fm" target="_blank" rel="noopener noreferrer">
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
          </div>

          {/* Quick links + Newsletter wrapper */}
          <div className="w-full sm:max-w-[60vw] flex flex-row gap-20">
            {/* Quick links */}
            <div className="w-auto pr-10">
              <h3 className="text-m7 whitespace-nowrap font-mono uppercase font-normal text-almostblack dark:text-white pb-3">Quick Links</h3>
              <ul className="w-full flex flex-col ">
                <li className="w-full hover:underline">
                  <Link href="/shows" className="font-sans text-b3 w-full">
                    Archive
                  </Link>
                </li>
                <li className="inline hover:underline">
                  <Link href="/about" className="font-sans text-b3 w-full">
                    About
                  </Link>
                </li>
                <li className="inline hover:underline">
                  <Link href="/contact" className="font-sans text-b3 w-full">
                    Contact
                  </Link>
                </li>
                <li className="inline hover:underline">
                  <Link href="/privacy-policy" className="font-sans text-b3 w-full">
                    Privacy Policy
                  </Link>
                </li>
                <li className="inline hover:underline">
                  <Link href="/terms-and-conditions" className="font-sans text-b3 w-full">
                    Terms & Conditions
                  </Link>
                </li>
              </ul>
            </div>

            {/* Newsletter section */}
            <div className="w-80">
              <h3 className="text-m7 font-mono uppercase font-normal text-almostblack dark:text-white pb-3">Stay Updated</h3>
              <p className="font-sans text-b3 pb-4">Subscribe to our newsletter for the latest updates and exclusive content.</p>
              <Button variant="outline" className="w-auto border-black font-mono text-[12px] dark:border-white text-foreground" asChild>
                <Link href="/newsletter">Subscribe</Link>
              </Button>
            </div>
          </div>

        </div>

        {/* Copyright */}
        <div className="pt-20 pb-10 border-white/10 text-center font-sans text-b4 text-almostblack">
          <p>&copy; {new Date().getFullYear()} Worldwide FM. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

import Image from "next/image";
import Link from "next/link";
import { ChevronRight, Instagram, Twitter, Facebook } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AboutPage() {
  return (
    <div className="min-h-screen">
      <div className="container mx-auto pt-32 pb-32">
        {/* Header with breadcrumb */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Link href="/" className="hover:text-brand-orange transition-colors">
              Home
            </Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground">About</span>
          </div>
        </div>

        {/* Hero section */}
        <div className="relative h-[50vh] mb-16 rounded-lg overflow-hidden">
          <Image src="/placeholder.svg" alt="Worldwide FM Studio" fill className="object-cover" priority />
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 to-transparent" />
          <div className="absolute bottom-0 left-0 p-8 md:p-12 text-white max-w-2xl">
            <h1 className="text-4xl md:text-5xl font-medium mb-4">Worldwide FM</h1>
            <p className="text-xl md:text-2xl opacity-90">A global music radio platform founded by Gilles Peterson.</p>
          </div>
        </div>

        {/* Mission statement */}
        <div className="mb-20">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl font-medium text-brand-orange mb-6">Our Mission</h2>
            <p className="text-lg mb-6">Worldwide FM showcases emerging talent and celebrates musical heritage, with a focus on global perspectives and local specialists. Our mission is to connect people through music that transcends borders and cultures.</p>
            <p className="text-lg">Broadcasting high-quality shows, mixes, and live performances from our studios around the world, we aim to promote diversity, discovery, and community through sound.</p>
          </div>
        </div>

        {/* Our Story with Timeline */}
        <div className="mb-20">
          <h2 className="text-3xl font-medium mb-6">Our Story</h2>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            <div className="md:col-span-5">
              <div className="aspect-square relative rounded-lg overflow-hidden">
                <Image src="/placeholder.svg" alt="Worldwide FM History" fill className="object-cover" />
              </div>
            </div>
            <div className="md:col-span-7">
              <div className="border-l-2 border-brand-orange pl-6 space-y-8">
                <div>
                  <h3 className="text-xl font-medium">2016</h3>
                  <p className="text-muted-foreground mt-1">Worldwide FM is founded by Gilles Peterson, inspired by his virtual radio station in the video game Grand Theft Auto.</p>
                </div>
                <div>
                  <h3 className="text-xl font-medium">2017</h3>
                  <p className="text-muted-foreground mt-1">The station expands its reach globally, opening studios in multiple cities around the world.</p>
                </div>
                <div>
                  <h3 className="text-xl font-medium">2019</h3>
                  <p className="text-muted-foreground mt-1">Worldwide FM wins "Best Online Radio Station" award for its innovative programming and global outlook.</p>
                </div>
                <div>
                  <h3 className="text-xl font-medium">2022</h3>
                  <p className="text-muted-foreground mt-1">The station launches new initiatives focusing on emergent global scenes, rising talent, and environmental awareness.</p>
                </div>
                <div>
                  <h3 className="text-xl font-medium">Today</h3>
                  <p className="text-muted-foreground mt-1">Continuing to grow as a platform for musical discovery, community building, and cultural exchange.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Connect section */}
        <div className="bg-brand-blue text-white rounded-lg p-8 md:p-12">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h2 className="text-3xl font-medium mb-4">Connect With Us</h2>
              <p className="mb-6">Have questions, feedback, or want to get involved? We'd love to hear from you. Reach out through our social channels or send us an email.</p>
              <div className="flex gap-4">
                <Button variant="outline" className="border-white text-white hover:bg-white/10 rounded-full p-3">
                  <Instagram className="h-5 w-5" />
                </Button>
                <Button variant="outline" className="border-white text-white hover:bg-white/10 rounded-full p-3">
                  <Twitter className="h-5 w-5" />
                </Button>
                <Button variant="outline" className="border-white text-white hover:bg-white/10 rounded-full p-3">
                  <Facebook className="h-5 w-5" />
                </Button>
              </div>
            </div>
            <div>
              <h3 className="text-xl font-medium mb-4">Contact Information</h3>
              <p className="mb-2">Email: info@worldwidefm.net</p>
              <p className="mb-2">General Inquiries: +44 (0)20 1234 5678</p>
              <p className="mb-6">Studio Location: London, UK</p>
              <Button className="bg-brand-orange hover:bg-brand-orange/90 text-white">Contact Us</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

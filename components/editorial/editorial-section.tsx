import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { WatchAndListenObject, ArticleObject, MoodObject } from "@/lib/cosmic-config";
import WatchAndListenSection from "./watch-and-listen-section";
import ArticlesSection from "./articles-section";
import MoodsSection from "./moods-section";

interface EditorialSectionProps {
  title?: string;
  albumOfTheWeek: WatchAndListenObject | null;
  events: WatchAndListenObject | null;
  video: WatchAndListenObject | null;
  articles: ArticleObject[];
  moods: MoodObject[];
  className?: string;
}

export default function EditorialSection({ title = "EDITORIAL", albumOfTheWeek, events, video, articles, moods, className = "mb-12 bg-sky-700 p-8 rounded-lg z-10" }: EditorialSectionProps) {
  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-white">{title}</h2>
        <Link href="/editorial" className="text-sm text-gray-300 flex items-center hover:text-white transition-colors group">
          View All <ChevronRight className="h-4 w-4 ml-1 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        {/* WATCH AND LISTEN */}
        <div className="md:col-span-6">
          <WatchAndListenSection title="WATCH AND LISTEN" albumOfTheWeek={albumOfTheWeek} events={events} video={video} />
        </div>

        {/* READ */}
        <div className="md:col-span-6">
          <ArticlesSection title="READ" articles={articles} />

          {/* Moods section */}
          {moods.length > 0 && <MoodsSection moods={moods} />}
        </div>
      </div>
    </div>
  );
}

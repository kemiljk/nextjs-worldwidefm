import Image from "next/image";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { MixcloudShow } from "@/lib/mixcloud-service";

interface ShowsGridProps {
  shows: MixcloudShow[];
}

export function ShowsGrid({ shows }: ShowsGridProps) {
  if (shows.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600">No shows found</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {shows.map((show) => (
        <article key={show.key} className="bg-white rounded-lg overflow-hidden shadow-sm border border-gray-100">
          <div className="aspect-video relative">
            <Image src={show.pictures.extra_large} alt={show.name} fill className="object-cover" />
          </div>
          <div className="p-4">
            <div className="flex flex-wrap gap-2 mb-2">
              {show.tags.slice(0, 3).map((tag) => (
                <span key={tag.key} className="text-xs px-2 py-1 rounded-full bg-gray-100">
                  {tag.name}
                </span>
              ))}
            </div>
            <h3 className="font-medium line-clamp-1">{show.name}</h3>
            <div className="mt-2 space-y-1">
              {show.hosts.length > 0 && <p className="text-sm text-gray-600 line-clamp-1">Hosted by: {show.hosts.map((host) => host.name).join(", ")}</p>}
              <p className="text-xs text-gray-500">{new Date(show.created_time).toLocaleDateString()}</p>
            </div>
            <div className="flex justify-between items-center mt-4">
              <Link href={`/shows/${show.key}`} className="text-orange-500 hover:text-orange-600 text-sm font-medium">
                View Details
              </Link>
              <ChevronRight className="w-4 h-4 text-orange-500" />
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

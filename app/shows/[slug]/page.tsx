import Image from "next/image";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getShowBySlug, getMixcloudShows } from "@/lib/actions";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { MixcloudShow } from "@/lib/mixcloud-service";

// Generate static params for all shows
export async function generateStaticParams() {
  const { shows } = await getMixcloudShows();
  return shows.map((show) => ({
    slug: show.key,
  }));
}

export default async function ShowPage({ params }: { params: { slug: string } }) {
  const show = await getShowBySlug(params.slug);

  if (!show) {
    notFound();
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <Link href="/shows" className="text-orange-500 hover:text-orange-600 flex items-center gap-1">
          <ChevronRight className="w-4 h-4 rotate-180" />
          Back to Shows
        </Link>
      </div>

      <PageHeader title={show.name} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-8">
        <div className="md:col-span-2">
          <div className="aspect-video relative mb-6">
            <Image src={show.pictures.extra_large} alt={show.name} fill className="object-cover rounded-lg" />
          </div>

          <div className="prose max-w-none">
            <h2>About this show</h2>
            <p>{show.name}</p>

            {show.tags.length > 0 && (
              <>
                <h3>Genres</h3>
                <div className="flex flex-wrap gap-2">
                  {show.tags.map((tag) => (
                    <span key={tag.key} className="bg-gray-100 px-3 py-1 rounded-full text-sm">
                      {tag.name}
                    </span>
                  ))}
                </div>
              </>
            )}

            {show.hosts.length > 0 && (
              <>
                <h3>Hosts</h3>
                <div className="flex flex-wrap gap-2">
                  {show.hosts.map((host) => (
                    <span key={host.key} className="bg-gray-100 px-3 py-1 rounded-full text-sm">
                      {host.name}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <div>
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h3 className="text-lg font-semibold mb-4">Show Details</h3>
            <dl className="space-y-4">
              <div>
                <dt className="text-gray-600">Air Date</dt>
                <dd>{new Date(show.created_time).toLocaleDateString()}</dd>
              </div>
              <div>
                <dt className="text-gray-600">Duration</dt>
                <dd>{Math.floor(show.audio_length / 60)} minutes</dd>
              </div>
              <div>
                <dt className="text-gray-600">Listen on Mixcloud</dt>
                <dd>
                  <a href={show.url} target="_blank" rel="noopener noreferrer" className="text-orange-500 hover:text-orange-600">
                    Open in Mixcloud
                  </a>
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}

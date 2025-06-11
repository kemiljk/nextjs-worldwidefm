import Image from "next/image";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { getRadioShows } from "@/lib/cosmic-service";
import { cosmic } from "@/lib/cosmic-config";
import { PlayButton } from "@/components/play-button";

// Add consistent revalidation time
export const revalidate = 900; // 15 minutes

// Generate static params for all hosts
export async function generateStaticParams() {
  try {
    // Get all hosts from Cosmic CMS
    const response = await cosmic.objects
      .find({
        type: "hosts",
        status: "published",
      })
      .props("slug")
      .limit(1000);

    return (
      response.objects?.map((host: any) => ({
        slug: host.slug,
      })) || []
    );
  } catch (error) {
    console.error("Error generating static params for hosts:", error);
    return [];
  }
}

async function getHostBySlug(slug: string) {
  try {
    const response = await cosmic.objects
      .findOne({
        type: "hosts",
        slug: slug,
      })
      .props("id,slug,title,content,metadata")
      .depth(1);

    return response?.object || null;
  } catch (error) {
    console.error(`Error fetching host by slug ${slug}:`, error);
    return null;
  }
}

async function getShowsByHost(hostId: string) {
  try {
    const response = await getRadioShows({
      filters: { host: hostId },
      limit: 50,
      sort: "-metadata.broadcast_date",
    });

    return response.objects || [];
  } catch (error) {
    console.error(`Error fetching shows for host ${hostId}:`, error);
    return [];
  }
}

export default async function HostPage({ params }: { params: { slug: string } }) {
  const host = await getHostBySlug(params.slug);

  if (!host) {
    notFound();
  }

  // Get shows hosted by this person
  const hostedShows = await getShowsByHost(host.id);

  const hostImage = host.metadata?.image?.imgix_url || "/image-placeholder.svg";
  const hostDescription = host.metadata?.description || host.content || "";

  return (
    <div className="space-y-8">
      <Link href="/shows" className="text-foreground flex items-center gap-1">
        <ChevronRight className="w-4 h-4 rotate-180" />
        Back to Shows
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="aspect-square relative">
          <Image src={hostImage} alt={host.title} fill className="object-cover rounded-lg" />
        </div>

        <div>
          <PageHeader title={host.title} description={hostDescription} />

          {hostedShows.length > 0 && (
            <div className="mt-8">
              <h3 className="text-lg font-semibold mb-4">Shows ({hostedShows.length})</h3>
              <p className="text-muted-foreground mb-4">Recent shows hosted by {host.title}</p>
            </div>
          )}
        </div>
      </div>

      {/* Hosted Shows */}
      {hostedShows.length > 0 && (
        <section className="space-y-6">
          <h2 className="text-2xl font-bold">Recent Shows</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {hostedShows.slice(0, 9).map((show) => {
              const showImage = show.metadata?.image?.imgix_url || "/image-placeholder.svg";
              const broadcastDate = show.metadata?.broadcast_date ? new Date(show.metadata.broadcast_date).toLocaleDateString() : "";

              return (
                <Link key={show.id} href={`/shows/${show.slug}`}>
                  <Card className="overflow-hidden h-full hover:shadow-lg transition-all">
                    <div className="aspect-square relative">
                      <Image src={showImage} alt={show.title} fill className="object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex items-end">
                        <div className="p-4 w-full">
                          <h3 className="text-white font-medium line-clamp-2">{show.title}</h3>
                          {broadcastDate && <p className="text-white/70 text-sm mt-1">{broadcastDate}</p>}
                        </div>
                      </div>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {hostedShows.length === 0 && (
        <div className="text-center py-12">
          <h3 className="text-lg font-semibold text-muted-foreground mb-2">No Shows Found</h3>
          <p className="text-muted-foreground">This host doesn't have any shows yet.</p>
        </div>
      )}
    </div>
  );
}

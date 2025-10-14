import { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { cosmic } from "@/lib/cosmic-config";
import { getEpisodesForShows } from "@/lib/episode-service";
import { generateBaseMetadata } from "@/lib/metadata-utils";

// Revalidate frequently to show new shows quickly
export const revalidate = 60; // 1 minute

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const { slug } = await params;
    const takeover = await getTakeoverBySlug(slug);

    if (takeover) {
      return generateBaseMetadata({
        title: `${takeover.title} - Takeover - Worldwide FM`,
        description: takeover.metadata?.description || `Experience the ${takeover.title} takeover on Worldwide FM.`,
        image: takeover.metadata?.image?.imgix_url,
        keywords: ["takeover", "guest programming", "curated music", "worldwide fm", takeover.title.toLowerCase()],
      });
    }

    return generateBaseMetadata({
      title: "Takeover Not Found - Worldwide FM",
      description: "The requested takeover could not be found.",
      noIndex: true,
    });
  } catch (error) {
    console.error("Error generating takeover metadata:", error);
    return generateBaseMetadata({
      title: "Takeover Not Found - Worldwide FM",
      description: "The requested takeover could not be found.",
      noIndex: true,
    });
  }
}

// Generate static params for all takeovers
export async function generateStaticParams() {
  try {
    // Get all takeovers from Cosmic CMS
    const response = await cosmic.objects
      .find({
        type: "takeovers",
        status: "published",
      })
      .props("slug")
      .limit(1000);

    const params =
      response.objects?.map((takeover: any) => ({
        slug: takeover.slug,
      })) || [];

    return params;
  } catch (error) {
    console.error("Error generating static params for takeovers:", error);
    return [];
  }
}

async function getTakeoverBySlug(slug: string) {
  try {
    const response = await cosmic.objects
      .findOne({
        type: "takeovers",
        slug: slug,
      })
      .props("id,slug,title,content,metadata")
      .depth(1);

    return response?.object || null;
  } catch (error) {
    console.error(`Error fetching takeover by slug ${slug}:`, error);
    return null;
  }
}

async function getEpisodesByTakeover(takeoverId: string) {
  try {
    // Get episodes that have this takeover
    const response = await getEpisodesForShows({
      takeover: takeoverId,
      limit: 50,
    });

    return response.shows || [];
  } catch (error) {
    console.error(`Error fetching episodes for takeover ${takeoverId}:`, error);
    return [];
  }
}

export default async function TakeoverPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const takeover = await getTakeoverBySlug(slug);

  if (!takeover) {
    notFound();
  }

  // Get episodes with this takeover
  const takeoverEpisodes = await getEpisodesByTakeover(takeover.id);

  const takeoverImage = takeover.metadata?.image?.imgix_url || "/image-placeholder.svg";
  const takeoverDescription = takeover.metadata?.description || takeover.content || "";

  return (
    <div className="space-y-8 mt-8">
      <Link href="/shows" className="text-foreground flex items-center gap-1">
        <ChevronRight className="w-4 h-4 rotate-180" />
        Back to Shows
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="aspect-square relative overflow-hidden">
          <Image src={takeoverImage} alt={takeover.title} fill className="object-cover rounded-none" />
        </div>

        <div>
          <PageHeader title={takeover.title} description={takeoverDescription} />

          {takeoverEpisodes.length > 0 && (
            <div className="mt-8">
              <h3 className="text-m5 font-mono font-normal text-almostblack dark:text-white mb-4">Episodes ({takeoverEpisodes.length})</h3>
              <p className="text-muted-foreground mb-4">Recent episodes from {takeover.title}</p>
            </div>
          )}
        </div>
      </div>

      {/* Takeover Episodes */}
      {takeoverEpisodes.length > 0 && (
        <section className="space-y-6">
          <h2 className="text-h7 font-display uppercase font-normal text-almostblack dark:text-white">Recent Episodes</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {takeoverEpisodes.slice(0, 9).map((episode) => {
              const episodeImage = episode.enhanced_image || episode.pictures?.extra_large || "/image-placeholder.svg";
              const broadcastDate = episode.broadcast_date ? new Date(episode.broadcast_date).toLocaleDateString() : "";

              return (
                <Link key={episode.id || episode.slug} href={`/episode${episode.slug}`}>
                  <Card className="overflow-hidden h-full hover:shadow-lg transition-all">
                    <div className="aspect-square relative overflow-hidden">
                      <Image src={episodeImage} alt={episode.title || episode.name} fill className="object-cover" />
                      <div className="absolute inset-0 bg-linear-to-t from-black/70 to-transparent flex items-end">
                        <div className="p-4 w-full">
                          <h3 className="text-m7 font-mono font-normal text-white line-clamp-2">{episode.title || episode.name}</h3>
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

      {takeoverEpisodes.length === 0 && (
        <div className="text-center py-12">
          <h3 className="text-m5 font-mono font-normal text-almostblack dark:text-white mb-2">No Episodes Found</h3>
          <p className="text-muted-foreground">This takeover doesn't have any episodes yet.</p>
        </div>
      )}
    </div>
  );
}

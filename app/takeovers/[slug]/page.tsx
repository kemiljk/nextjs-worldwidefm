import Image from "next/image";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { cosmic } from "@/lib/cosmic-config";
import { getEpisodesForShows } from "@/lib/episode-service";

// Add consistent revalidation time
export const revalidate = 900; // 15 minutes

// Generate static params for all takeovers
export async function generateStaticParams() {
  console.log("🔍 generateStaticParams: Starting takeover static params generation");
  console.log("Environment check:", {
    bucketSlug: process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG ? "✅ Set" : "❌ Missing",
    readKey: process.env.NEXT_PUBLIC_COSMIC_READ_KEY ? "✅ Set" : "❌ Missing",
  });

  try {
    // Get all takeovers from Cosmic CMS
    const response = await cosmic.objects
      .find({
        type: "takeovers",
        status: "published",
      })
      .props("slug")
      .limit(1000);

    console.log("🔍 generateStaticParams: Cosmic response:", {
      totalObjects: response.objects?.length || 0,
      hasObjects: !!response.objects,
      firstFewSlugs: response.objects?.slice(0, 5).map((t: any) => t.slug) || [],
    });

    const params =
      response.objects?.map((takeover: any) => ({
        slug: takeover.slug,
      })) || [];

    console.log("🔍 generateStaticParams: Generated params:", params);
    return params;
  } catch (error) {
    console.error("❌ Error generating static params for takeovers:", error);
    if (error instanceof Error) {
      console.error("Error details:", {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });
    }
    return [];
  }
}

async function getTakeoverBySlug(slug: string) {
  console.log(`🔍 getTakeoverBySlug: Fetching takeover with slug: ${slug}`);

  try {
    const response = await cosmic.objects
      .findOne({
        type: "takeovers",
        slug: slug,
      })
      .props("id,slug,title,content,metadata")
      .depth(1);

    console.log(`🔍 getTakeoverBySlug: Response for ${slug}:`, {
      hasObject: !!response?.object,
      objectId: response?.object?.id,
      objectTitle: response?.object?.title,
    });

    return response?.object || null;
  } catch (error) {
    console.error(`❌ Error fetching takeover by slug ${slug}:`, error);
    if (error instanceof Error) {
      console.error("Error details:", {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });
    }
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
  console.log(`🔍 TakeoverPage: Starting render for slug: ${slug}`);

  const takeover = await getTakeoverBySlug(slug);

  console.log(`🔍 TakeoverPage: Takeover fetch result for ${slug}:`, {
    takeoverFound: !!takeover,
    takeoverId: takeover?.id,
    takeoverTitle: takeover?.title,
  });

  if (!takeover) {
    console.log(`❌ TakeoverPage: No takeover found for slug ${slug}, calling notFound()`);
    notFound();
  }

  // Get episodes with this takeover
  const takeoverEpisodes = await getEpisodesByTakeover(takeover.id);
  console.log(`🔍 TakeoverPage: Found ${takeoverEpisodes.length} episodes for takeover ${takeover.title}`);

  const takeoverImage = takeover.metadata?.image?.imgix_url || "/image-placeholder.svg";
  const takeoverDescription = takeover.metadata?.description || takeover.content || "";

  return (
    <div className="space-y-8">
      <Link href="/shows" className="text-foreground flex items-center gap-1">
        <ChevronRight className="w-4 h-4 rotate-180" />
        Back to Shows
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="aspect-square relative">
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
                    <div className="aspect-square relative">
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

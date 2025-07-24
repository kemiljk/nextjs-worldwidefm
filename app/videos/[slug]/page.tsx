import { notFound } from "next/navigation";
import { getVideos } from "@/lib/actions";
import { format } from "date-fns";
import { VideoPlayer } from "@/components/video/video-player";
import { PageHeader } from "@/components/shared/page-header";

export default async function VideoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const allVideos = await getVideos({ limit: 50 });
  const video = allVideos.videos.find((v) => v.slug === slug);

  if (!video) {
    notFound();
  }

  // Format the date
  const videoDate = video.metadata?.date ? new Date(video.metadata.date) : null;
  const formattedDate = videoDate ? format(videoDate, "dd-MM-yyyy") : "";

  return (
    <article className="min-h-dvh">
      {/* Header Section */}
      <div className="max-w-4xl text-balance mx-auto px-4">
        <div className="mb-8">
          <div className="text-[12px] leading-none uppercase tracking-wider text-muted-foreground mb-4">{formattedDate}</div>
          <PageHeader title={video.title} description={video.metadata?.description} />
        </div>

        {/* Video Categories */}
        {video.metadata?.categories && (
          <div className="flex flex-wrap gap-3 mb-8">
            {video.metadata.categories.map((category: { slug: string; title: string }) => (
              <span key={category.slug + category.title} className="text-[10px] leading-none uppercase tracking-wider px-2 py-1 rounded-full border border-almostblack dark:border-white">
                {category.title}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Video Player Section */}
      <div className="w-[90%] mx-auto aspect-video">
        <VideoPlayer video={video} />
      </div>
    </article>
  );
}

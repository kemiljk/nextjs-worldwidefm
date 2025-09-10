import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getVideos } from "@/lib/actions";
import { format } from "date-fns";
import { VideoPlayer } from "@/components/video/video-player";
import { PageHeader } from "@/components/shared/page-header";
import { generateVideoMetadata } from "@/lib/metadata-utils";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const { slug } = await params;
    const allVideos = await getVideos({ limit: 50 });
    const video = allVideos.videos.find((v) => v.slug === slug);
    
    if (video) {
      return generateVideoMetadata(video);
    }
    
    return generateVideoMetadata({ title: "Video Not Found" });
  } catch (error) {
    console.error("Error generating video metadata:", error);
    return generateVideoMetadata({ title: "Video Not Found" });
  }
}

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
    <article className="bg-almostblack text-white min-h-dvh px-5 pt-10 pb-20">
      {/* Video Player Section */}
      <div className="aspect-video">
        <VideoPlayer video={video} />
      </div>

      {/* Header Section */}
      <div className="max-w-[80vh] h-auto">
        <div className="pb-4">
          <div className="font-mono uppercase text-m8 leading-none text-white mb-4">{formattedDate}</div>
          <PageHeader
            title={video.title}
            description={video.metadata?.description}
            className="text-white"
          />
        </div>

        {/* Video Categories */}
        {video.metadata?.categories && (
          <div className="flex flex-wrap gap-3 mb-8">
            {video.metadata.categories.map((category: { slug: string; title: string }) => (
              <span key={category.slug + category.title} className="text-m8 font-mono leading-none uppercase px-2 py-1 rounded-full border border-white dark:border-almostblack">
                {category.title}
              </span>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

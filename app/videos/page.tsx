import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { getVideos, getVideoCategories } from "@/lib/actions";
import VideosClient from "./videos-client";

export default async function VideosPage() {
  const [videos, videoCategories] = await Promise.all([getVideos({ limit: 50 }), getVideoCategories()]);

  return (
    <div className="mx-auto px-4 py-16">
      <PageHeader title="Videos" />
      <Suspense fallback={<div>Loading...</div>}>
        <VideosClient initialVideos={videos.videos} availableCategories={videoCategories} />
      </Suspense>
    </div>
  );
}

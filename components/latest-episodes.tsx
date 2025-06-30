"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { useMediaPlayer } from "@/components/providers/media-player-provider";
import type { MixcloudShow } from "@/lib/mixcloud-service";
import { PlayButton } from "@/components/play-button";

const fetchEpisodes = async (): Promise<MixcloudShow[]> => {
  const res = await fetch(`https://api.mixcloud.com/worldwidefm/cloudcasts/?limit=6`);
  if (!res.ok) throw new Error("Failed to fetch episodes");
  const data = await res.json();
  return data.data.map((item: any) => ({
    key: item.key,
    name: item.name,
    url: item.url,
    pictures: item.pictures,
    created_time: item.created_time,
    updated_time: item.updated_time,
    play_count: item.play_count,
    favorite_count: item.favorite_count,
    comment_count: item.comment_count,
    listener_count: item.listener_count,
    repost_count: item.repost_count,
    tags: item.tags || [],
    slug: item.key.split("/").pop() || item.key,
    user: item.user,
    hosts: item.hosts || [],
    hidden_stats: item.hidden_stats ?? false,
    audio_length: item.audio_length ?? 0,
    filteredTags: () => (item.tags || []).filter((tag: any) => tag.name.toLowerCase() !== "worldwide fm"),
  }));
};

export default function LatestEpisodes() {
  const [episodes, setEpisodes] = useState<MixcloudShow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { playShow, currentShow, isPlaying, pauseShow } = useMediaPlayer();

  useEffect(() => {
    fetchEpisodes()
      .then(setEpisodes)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleShowClick = (episode: MixcloudShow) => {
    const isCurrentShow = currentShow?.key === episode.key;
    const isCurrentlyPlaying = isCurrentShow && isPlaying;
    if (isCurrentlyPlaying) {
      pauseShow();
    } else {
      playShow(episode);
    }
  };

  if (loading) return <div>Loading latest episodes...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 px-5">
      {episodes.slice(2, 6).map((episode) => (
        <Card key={episode.key} className="overflow-hidden shadow-none relative cursor-pointer border border-almostblack dark:border-white h-full flex flex-col" onClick={() => handleShowClick(episode)}>
          <CardContent className="p-0 flex flex-col h-full">
            <div className="relative aspect-square w-full">
              <Image src={episode.pictures.extra_large} alt={episode.name} fill className="object-cover" sizes="(max-width: 768px) 100vw, 50vw" priority />
            </div>
            <div className="flex flex-col flex-1 p-2 min-h-0">
              <h3 className="text-m4 font-mono text-almostblack pt-2 p-1 mb-2 flex-grow">{episode.name}</h3>
              {episode.tags && (
                <div className="flex items-end justify-between mt-auto">
                  <div className="flex flex-wrap gap-y-1 gap-x-2">
                    {episode.tags
                      .filter((tag) => tag.name.toLocaleLowerCase() !== "worldwide fm")
                      .slice(0, 3)
                      .map((tag: { key: string; name: string }) => (
                        <p key={tag.key} className="text-m7 font-mono uppercase text-almostblack border border-almostblack rounded-full px-2 py-1 line-clamp-3">
                          {tag.name}
                        </p>
                      ))}
                  </div>
                  <PlayButton show={episode} variant="secondary" size="icon" className="ml-2 bg-almostblack hover:bg-almostblack/80 text-white shrink-0" />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

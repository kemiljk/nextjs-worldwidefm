"use client";

import { useState, useEffect } from "react";
import { getEpisodesForShows } from "@/lib/episode-service";
import { ShowCard } from "./ui/show-card";

const LatestEpisodes: React.FC = () => {
  const [episodes, setEpisodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEpisodes = async () => {
      try {
        setLoading(true);
        const response = await getEpisodesForShows({ limit: 4 });
        setEpisodes(response.shows || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch episodes");
        console.error("Error fetching latest episodes:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchEpisodes();
  }, []);

  if (error) {
    return;
  }

  if (episodes.length === 0) {
    return;
  }

  return (
    <section className="py-8 px-5">
      <h2 className="text-h8 md:text-h7 font-bold mb-4 tracking-tight">LATEST SHOWS</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 w-full h-auto ">
        {episodes.map((episode) => (
          <ShowCard key={episode.key || episode.id || episode.slug} show={episode} slug={`/episode/${episode.slug}`} playable />
        ))}
      </div>
    </section>
  );
};

export default LatestEpisodes;

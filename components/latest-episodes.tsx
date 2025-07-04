"use client";

import { useState, useEffect } from "react";
import { getAllShows } from "@/lib/actions";
import { ShowCard } from "./ui/show-card";

const LatestEpisodes: React.FC = () => {
  const [episodes, setEpisodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEpisodes = async () => {
      try {
        setLoading(true);
        const response = await getAllShows(2, 2, 4);
        setEpisodes(response.shows || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch shows");
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
      <h2 className="text-h7 font-bold mb-8 tracking-wide">LATEST SHOWS</h2>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 w-full h-full">
        {episodes.map((episode) => (
          <ShowCard key={episode.key || episode.id || episode.slug} show={episode} slug={`/episode${episode.key.replace("worldwidefm/", "")}`} playable />
        ))}
      </div>
    </section>
  );
};

export default LatestEpisodes;

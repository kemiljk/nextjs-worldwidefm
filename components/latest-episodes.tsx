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
        // Fetch latest shows using the same function as the shows page
        const response = await getAllShows(0, 0, 4); // Get 8 shows for horizontal scroll
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

  if (loading) {
    return (
      <section className="py-8 px-5">
        <h2 className="text-h7 font-bold mb-8 tracking-wide">LATEST SHOWS</h2>
        <div className="flex gap-6 overflow-x-auto pb-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex-none w-full animate-pulse">
              <div className="bg-gray-200 h-60 rounded-lg mb-4"></div>
              <div className="h-6 bg-gray-200 rounded mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-2/3"></div>
            </div>
          ))}
        </div>
      </section>
    );
  }

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
          <ShowCard key={episode.key || episode.id || episode.slug} show={episode} className="h-full w-full" />
        ))}
      </div>
    </section>
  );
};

export default LatestEpisodes;

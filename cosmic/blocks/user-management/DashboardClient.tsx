"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getUserData } from "@/cosmic/blocks/user-management/actions";
import { useAuth } from "@/cosmic/blocks/user-management/AuthContext";
import { UserProfileForm } from "@/cosmic/blocks/user-management/UserProfileForm";
import { Loader2, XIcon } from "lucide-react";
import { addFavouriteGenre, removeFavouriteGenre, addFavouriteShow, removeFavouriteShow, addFavouriteHost, removeFavouriteHost } from "./actions";
import type { GenreObject, RadioShowObject, HostObject } from "@/lib/cosmic-config";
import { Button } from "@/components/ui/button";
import { ShowCard } from "@/components/ui/show-card";
import { getAllGenres } from "@/lib/get-all-genres";
import { getAllHosts } from "@/lib/get-all-hosts";
import { getAllShows } from "@/lib/get-all-shows";

export default function DashboardClient() {
  const { user, isLoading, logout } = useAuth();
  const [userData, setUserData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const [isAdding, setIsAdding] = useState<null | "genre" | "show" | "host">(null);
  const [allGenres, setAllGenres] = useState<GenreObject[]>([]);
  const [allHosts, setAllHosts] = useState<HostObject[]>([]);
  const [allShows, setAllShows] = useState<RadioShowObject[]>([]);

  useEffect(() => {
    let isMounted = true;

    const checkUserAndFetchData = async () => {
      if (isLoading) return;

      if (!user) {
        router.push("/login");
        return;
      }

      try {
        const { data, error } = await getUserData(user.id);

        if (!isMounted) return;

        if (error) {
          if (error === "Account is not active") {
            logout();
            router.push("/login?error=Your account is no longer active");
            return;
          }
          setError(error);
        } else {
          setUserData(data);
        }
      } catch (err) {
        if (!isMounted) return;
        setError("Failed to fetch user data");
      }
    };

    checkUserAndFetchData();

    return () => {
      isMounted = false;
    };
  }, [user, isLoading, logout, router]);

  useEffect(() => {
    if (!userData) return;
    getAllGenres().then(setAllGenres);
    getAllHosts().then(setAllHosts);
    getAllShows().then(setAllShows);
  }, [userData]);

  // Hydrate favorites
  const hydratedGenres = (userData?.metadata?.favourite_genres || []).map((idOrSlug: any) => allGenres.find((g) => g.id === idOrSlug || g.slug === idOrSlug)).filter(Boolean) as GenreObject[];

  const hydratedHosts = (userData?.metadata?.favourite_hosts || []).map((idOrSlug: any) => allHosts.find((h) => h.id === idOrSlug || h.slug === idOrSlug)).filter(Boolean) as HostObject[];

  const hydratedShows = (userData?.metadata?.favourite_shows || []).map((idOrSlug: any) => allShows.find((s) => s.id === idOrSlug || s.slug === idOrSlug)).filter(Boolean) as RadioShowObject[];

  // --- FAVOURITE HANDLERS ---
  const handleRemoveGenre = async (genreId: string) => {
    if (!user) return;
    const res = await removeFavouriteGenre(user.id, genreId);
    if (res.success) setUserData(res.data);
  };
  const handleRemoveShow = async (showId: string) => {
    if (!user) return;
    const res = await removeFavouriteShow(user.id, showId);
    if (res.success) setUserData(res.data);
  };
  const handleRemoveHost = async (hostId: string) => {
    if (!user) return;
    const res = await removeFavouriteHost(user.id, hostId);
    if (res.success) setUserData(res.data);
  };

  // Placeholder for add actions (would open modal/search in real app)
  const handleAddClick = (type: "genre" | "show" | "host") => setIsAdding(type);
  const handleAddClose = () => setIsAdding(null);

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-4">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (error === "Account is not active") {
    return null; // Don't show anything while redirecting
  }

  if (error) {
    return (
      <div className="py-8">
        <div className="mx-auto max-w-md">
          <div className="bg-card p-8 shadow-xs text-center">
            <div className="text-crimson-500 mb-4">Error: {error}</div>
          </div>
        </div>
      </div>
    );
  }

  if (!userData) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-4">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="py-8">
      <div className="mx-auto px-4 flex flex-col gap-8">
        <h1 className="font-display uppercase text-4xl font-normal tracking-tight text-center mb-8">Welcome, {userData.metadata.first_name}!</h1>
        <UserProfileForm user={userData} />

        {/* FAVOURITE GENRES */}
        <section className="mt-10">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-2xl font-bold">Favourite Genres</h2>
            <Button variant="outline" onClick={() => handleAddClick("genre")}>
              Add Genre
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {hydratedGenres.map((genre: GenreObject) => (
              <span key={genre.id + genre.title} className="inline-flex items-center bg-gray-200 dark:bg-gray-700 rounded-full px-3 py-1 text-sm font-medium text-almostblack dark:text-white">
                {genre.title}
                <button className="ml-2 text-red-500" onClick={() => handleRemoveGenre(genre.id)} aria-label="Remove genre">
                  <XIcon className="size-4" />
                </button>
              </span>
            ))}
            {hydratedGenres.length === 0 && <span className="text-muted-foreground">No favourite genres yet.</span>}
          </div>
        </section>

        {/* FAVOURITE SHOWS */}
        <section className="mt-10">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-2xl font-bold">Favourite Shows</h2>
            <Button variant="outline" onClick={() => handleAddClick("show")}>
              Add Show
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {hydratedShows.map((show: RadioShowObject) => (
              <div key={show.id} className="relative">
                <ShowCard show={show} slug={`/episode/${show.slug}`} playable={false} />
                <button className="absolute top-2 right-2 text-red-500 p-1" onClick={() => handleRemoveShow(show.id)} aria-label="Remove show">
                  <XIcon className="size-4" />
                </button>
              </div>
            ))}
            {hydratedShows.length === 0 && <span className="text-muted-foreground">No favourite shows yet.</span>}
          </div>
        </section>

        {/* FAVOURITE HOSTS */}
        <section className="mt-10">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-2xl font-bold">Favourite Hosts</h2>
            <Button variant="outline" onClick={() => handleAddClick("host")}>
              Add Host
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {hydratedHosts.map((host: HostObject) => (
              <span key={host.id} className="inline-flex items-center bg-gray-200 dark:bg-gray-700 rounded-full px-3 py-1 text-sm font-medium">
                {host.title}
                <button className="ml-2 text-red-500" onClick={() => handleRemoveHost(host.id)} aria-label="Remove host">
                  <XIcon className="size-4" />
                </button>
              </span>
            ))}
            {hydratedHosts.length === 0 && <span className="text-muted-foreground">No favourite hosts yet.</span>}
          </div>
        </section>

        {/* Placeholder for add modals */}
        {isAdding && (
          <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-900 p-8 rounded shadow-lg max-w-md w-full">
              <h3 className="text-xl font-bold mb-4">Add Favourite {isAdding.charAt(0).toUpperCase() + isAdding.slice(1)}</h3>
              <p>Search and select a {isAdding} to add. (UI to be implemented)</p>
              <Button variant="outline" onClick={handleAddClose} className="mt-4">
                Close
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState, useTransition, useOptimistic } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/cosmic/blocks/user-management/AuthContext";
import { UserProfileForm } from "@/cosmic/blocks/user-management/UserProfileForm";
import { XIcon, Settings, LogOut } from "lucide-react";
import { addFavouriteGenre, removeFavouriteGenre, addFavouriteShow, removeFavouriteShow, addFavouriteHost, removeFavouriteHost } from "./actions";
import type { GenreObject, RadioShowObject, HostObject } from "@/lib/cosmic-config";
import { Button } from "@/components/ui/button";
import { ShowCard } from "@/components/ui/show-card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface DashboardClientProps {
  userData: any;
  allGenres: GenreObject[];
  allHosts: HostObject[];
  allShows: RadioShowObject[];
  canonicalGenres: { slug: string; title: string }[];
  genreShows: { [key: string]: any[] };
  hostShows: { [key: string]: any[] };
  favouriteGenres: GenreObject[];
  favouriteHosts: HostObject[];
  favouriteShows: RadioShowObject[];
}

// Function to calculate similarity score between genres

export default function DashboardClient({ userData, allGenres, allHosts, allShows, canonicalGenres = [], genreShows, hostShows, favouriteGenres = [], favouriteHosts = [], favouriteShows = [] }: DashboardClientProps) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isAdding, setIsAdding] = useState<null | "genre" | "show" | "host">(null);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [selectedGenre, setSelectedGenre] = useState<string>("");
  const [selectedHost, setSelectedHost] = useState<string>("");
  const [selectedShow, setSelectedShow] = useState<string>("");

  const [optimisticGenres, addOptimisticGenre] = useOptimistic(favouriteGenres, (state, newGenre: GenreObject) => [...state, newGenre]);
  const [optimisticHosts, addOptimisticHost] = useOptimistic(favouriteHosts, (state, newHost: HostObject) => [...state, newHost]);
  const [optimisticShows, addOptimisticShow] = useOptimistic(favouriteShows, (state, newShow: RadioShowObject) => [...state, newShow]);

  const [optimisticGenresRemove, removeOptimisticGenre] = useOptimistic(optimisticGenres, (state, genreId: string) => state.filter((genre) => genre.id !== genreId));
  const [optimisticHostsRemove, removeOptimisticHost] = useOptimistic(optimisticHosts, (state, hostId: string) => state.filter((host) => host.id !== hostId));
  const [optimisticShowsRemove, removeOptimisticShow] = useOptimistic(optimisticShows, (state, showId: string) => state.filter((show) => show.id !== showId));

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  const handleServerAction = async (action: () => Promise<any>) => {
    if (!user) return;

    startTransition(async () => {
      const res = await action();
      if (res.success) {
        router.refresh();
      }
    });
  };

  const handleRemoveGenre = (genreId: string) => {
    const genreToRemove = optimisticGenresRemove.find((g) => g.id === genreId);
    if (genreToRemove) {
      startTransition(() => {
        removeOptimisticGenre(genreId);
      });
    }
    handleServerAction(() => removeFavouriteGenre(user!.id, genreId));
  };

  const handleRemoveShow = (showId: string) => {
    const showToRemove = optimisticShowsRemove.find((s) => s.id === showId);
    if (showToRemove) {
      startTransition(() => {
        removeOptimisticShow(showId);
      });
    }
    handleServerAction(() => removeFavouriteShow(user!.id, showId));
  };

  const handleRemoveHost = (hostId: string) => {
    const hostToRemove = optimisticHostsRemove.find((h) => h.id === hostId);
    if (hostToRemove) {
      startTransition(() => {
        removeOptimisticHost(hostId);
      });
    }
    handleServerAction(() => removeFavouriteHost(user!.id, hostId));
  };

  const handleAddClick = (type: "genre" | "show" | "host") => {
    setIsAdding(type);
    setSelectedGenre("");
    setSelectedHost("");
    setSelectedShow("");
  };

  const handleAddClose = () => {
    setIsAdding(null);
    setSelectedGenre("");
    setSelectedHost("");
    setSelectedShow("");
  };

  const handleSave = async () => {
    if (!user) return;

    startTransition(async () => {
      let res;

      if (isAdding === "genre" && selectedGenre) {
        const genre = allGenres.find((g) => g.id === selectedGenre);
        if (!genre) return;
        startTransition(() => {
          addOptimisticGenre(genre);
        });
        res = await addFavouriteGenre(user.id, genre);
      } else if (isAdding === "host" && selectedHost) {
        const host = allHosts.find((h) => h.id === selectedHost);
        if (!host) return;
        startTransition(() => {
          addOptimisticHost(host);
        });
        res = await addFavouriteHost(user.id, host);
      } else if (isAdding === "show" && selectedShow) {
        const show = allShows.find((s) => s.id === selectedShow);
        if (!show) return;
        startTransition(() => {
          addOptimisticShow(show);
        });
        res = await addFavouriteShow(user.id, show);
      }

      if (res?.success) {
        handleAddClose();
        router.refresh();
      }
    });
  };

  if (!userData) {
    return null;
  }

  const renderFavouriteBadge = (item: GenreObject | HostObject, onRemove: () => void, type: "genre" | "host") => (
    <span key={item.id} className="inline-flex items-center border border-almostblack dark:border-white rounded-full px-2.5 py-1 text-[12px] font-mono uppercase text-almostblack dark:text-white">
      {item.title}
      <button className="ml-2 text-red-500 hover:text-red-700 disabled:opacity-50" onClick={onRemove} disabled={isPending} aria-label={`Remove ${type}`}>
        <XIcon className="size-3" />
      </button>
    </span>
  );

  const renderShowsSection = (items: (GenreObject | HostObject)[], showsMap: { [key: string]: any[] }, type: "genre" | "host") => {
    if (items.length === 0) {
      return <p className="text-gray-500 italic">No favorite {type}s yet. Add some to see their latest shows!</p>;
    }

    return (
      <div className="space-y-8">
        {/* Badges */}
        <div className="flex flex-wrap gap-2">
          {items.map((item) => (
            <div key={item.id}>{renderFavouriteBadge(item, () => (type === "genre" ? handleRemoveGenre(item.id) : handleRemoveHost(item.id)), type)}</div>
          ))}
        </div>

        {/* Latest shows */}
        {items.map((item) => {
          const shows = showsMap[item.id] || [];
          if (shows.length === 0) return null;

          return (
            <div key={item.id} className="space-y-4">
              <h3 className="text-xl font-semibold">
                Latest {type === "genre" ? "in" : "from"} {item.title}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {shows.map((show: any) => (
                  <ShowCard key={show.key || show.id || show.slug} show={show} slug={show.url || `/episode/${show.slug}`} playable />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderModalContent = () => {
    switch (isAdding) {
      case "genre":
        return (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Select a genre to add to your favorites:</p>
            <Select onValueChange={setSelectedGenre} value={selectedGenre}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a genre..." />
              </SelectTrigger>
              <SelectContent>
                {allGenres
                  .filter((genre) => !optimisticGenresRemove.some((favGenre) => favGenre.id === genre.id))
                  .sort((a, b) => a.title.localeCompare(b.title))
                  .map((genre) => (
                    <SelectItem key={genre.id} value={genre.id}>
                      {genre.title}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        );

      case "host":
        return (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Select a host to add to your favorites:</p>
            <Select onValueChange={setSelectedHost} value={selectedHost}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a host..." />
              </SelectTrigger>
              <SelectContent>
                {allHosts
                  .filter((host) => !optimisticHostsRemove.some((favHost) => favHost.id === host.id))
                  .sort((a, b) => a.title.localeCompare(b.title))
                  .map((host) => (
                    <SelectItem key={host.id} value={host.id}>
                      {host.title}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        );

      case "show":
        return (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Select a show to add to your favorites:</p>
            <Select onValueChange={setSelectedShow} value={selectedShow}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a show..." />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {allShows
                  .filter((show) => !optimisticShowsRemove.some((favShow) => favShow.id === show.id))
                  .sort((a, b) => a.title.localeCompare(b.title))
                  .slice(0, 50)
                  .map((show) => (
                    <SelectItem key={show.id} value={show.id}>
                      {show.title}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="py-8">
      <div className="mx-auto px-4 flex flex-col gap-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="font-display uppercase text-4xl font-normal tracking-tight">Welcome, {userData.metadata.first_name}!</h1>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowEditProfile(!showEditProfile)}>
              <Settings className="size-4 mr-2" />
              {showEditProfile ? "Hide" : "Edit"} Profile
            </Button>
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="size-4 mr-2" />
              Log Out
            </Button>
          </div>
        </div>

        {/* Edit Profile Form */}
        {showEditProfile && (
          <div className="mb-8">
            <UserProfileForm user={userData} />
          </div>
        )}

        {/* Favourite Genres */}
        <section className="mt-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold">Favourite Genres</h2>
            <Button variant="outline" onClick={() => handleAddClick("genre")} disabled={isPending}>
              Add Genre
            </Button>
          </div>
          {renderShowsSection(optimisticGenresRemove, genreShows, "genre")}
        </section>

        {/* Favourite Shows */}
        <section className="mt-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold">Favourite Shows</h2>
            <Button variant="outline" onClick={() => handleAddClick("show")} disabled={isPending}>
              Add Show
            </Button>
          </div>

          {favouriteShows.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {favouriteShows.map((show: any) => (
                <div key={show.id || show.slug} className="relative">
                  <ShowCard show={show} slug={`/episode/${show.slug}`} playable />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 italic">No favorite shows yet. Add some!</p>
          )}
        </section>

        {/* Favourite Hosts */}
        <section className="mt-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold">Favourite Hosts</h2>
            <Button variant="outline" onClick={() => handleAddClick("host")} disabled={isPending}>
              Add Host
            </Button>
          </div>
          {renderShowsSection(optimisticHostsRemove, hostShows, "host")}
        </section>

        {/* Add Favorites Modal */}
        {isAdding && (
          <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-900 p-8 rounded shadow-lg max-w-md w-full mx-4 relative">
              <button onClick={handleAddClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200" aria-label="Close modal">
                <XIcon className="size-5" />
              </button>

              <h3 className="text-xl font-bold mb-4 pr-8">Add Favourite {isAdding.charAt(0).toUpperCase() + isAdding.slice(1)}</h3>

              {renderModalContent()}

              <div className="flex gap-2 mt-6">
                <Button variant="outline" onClick={handleAddClose} className="flex-1" disabled={isPending}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={(!selectedGenre && !selectedHost && !selectedShow) || isPending} className="flex-1">
                  {isPending ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

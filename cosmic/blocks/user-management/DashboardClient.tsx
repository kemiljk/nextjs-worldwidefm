'use client';

import { useState, useTransition, useOptimistic } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/cosmic/blocks/user-management/AuthContext';
import { UserProfileForm } from '@/cosmic/blocks/user-management/UserProfileForm';
import { XIcon, Settings, LogOut, Crown, CreditCard, CheckCircle } from 'lucide-react';
import {
  addFavouriteGenre,
  removeFavouriteGenre,
  addFavouriteHost,
  removeFavouriteHost,
} from './actions';
import { Music, Users, Bookmark, Sparkles } from 'lucide-react';
import { EmptyState } from '@/components/dashboard/empty-state';
import type { GenreObject, HostObject } from '@/lib/cosmic-config';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import Link from 'next/link';
import { ForYouClient } from '@/components/for-you-client';
import { SaveShowButton } from '@/components/save-show-button';
import { ShowCard } from '@/components/ui/show-card';

interface DashboardClientProps {
  userData: any;
  allGenres: GenreObject[];
  allHosts: HostObject[];
  canonicalGenres: { slug: string; title: string }[];
  genreShows: { [key: string]: any[] };
  hostShows: { [key: string]: any[] };
  favouriteGenres: GenreObject[];
  favouriteHosts: HostObject[];
  listenLater: any[];
}

export default function DashboardClient({
  userData,
  allGenres,
  allHosts,
  canonicalGenres = [],
  genreShows,
  hostShows,
  favouriteGenres = [],
  favouriteHosts = [],
  listenLater = [],
}: DashboardClientProps) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isAdding, setIsAdding] = useState<null | 'genre' | 'host'>(null);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [selectedGenre, setSelectedGenre] = useState<string>('');
  const [selectedHost, setSelectedHost] = useState<string>('');

  const [optimisticGenres, addOptimisticGenre] = useOptimistic(
    favouriteGenres,
    (state, newGenre: GenreObject) => [...state, newGenre]
  );
  const [optimisticHosts, addOptimisticHost] = useOptimistic(
    favouriteHosts,
    (state, newHost: HostObject) => [...state, newHost]
  );

  const [optimisticGenresRemove, removeOptimisticGenre] = useOptimistic(
    optimisticGenres,
    (state, genreId: string) => state.filter(genre => genre.id !== genreId)
  );
  const [optimisticHostsRemove, removeOptimisticHost] = useOptimistic(
    optimisticHosts,
    (state, hostId: string) => state.filter(host => host.id !== hostId)
  );

  const handleLogout = async () => {
    await logout();
    router.push('/login');
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
    const genreToRemove = optimisticGenresRemove.find(g => g.id === genreId);
    if (genreToRemove) {
      startTransition(() => {
        removeOptimisticGenre(genreId);
      });
    }
    handleServerAction(() => removeFavouriteGenre(user!.id, genreId));
  };

  const handleRemoveHost = (hostId: string) => {
    const hostToRemove = optimisticHostsRemove.find(h => h.id === hostId);
    if (hostToRemove) {
      startTransition(() => {
        removeOptimisticHost(hostId);
      });
    }
    handleServerAction(() => removeFavouriteHost(user!.id, hostId));
  };

  const handleAddClick = (type: 'genre' | 'host') => {
    setIsAdding(type);
    setSelectedGenre('');
    setSelectedHost('');
  };

  const handleAddClose = () => {
    setIsAdding(null);
    setSelectedGenre('');
    setSelectedHost('');
  };

  const handleSave = async () => {
    if (!user) return;

    startTransition(async () => {
      let res;

      if (isAdding === 'genre' && selectedGenre) {
        const genre = allGenres.find(g => g.id === selectedGenre);
        if (!genre) return;
        startTransition(() => {
          addOptimisticGenre(genre);
        });
        res = await addFavouriteGenre(user.id, genre);
      } else if (isAdding === 'host' && selectedHost) {
        const host = allHosts.find(h => h.id === selectedHost);
        if (!host) return;
        startTransition(() => {
          addOptimisticHost(host);
        });
        res = await addFavouriteHost(user.id, host);
      }

      if (res?.success) {
        handleAddClose();
        router.refresh();
      }
    });
  };

  // Ensure we have safe defaults for metadata
  const metadata = userData?.metadata || {};
  const firstName = metadata.first_name || 'Member';
  const subscriptionStatus = metadata.subscription_status || 'inactive';

  const safeUser = {
    ...userData,
    metadata: {
      ...metadata,
      first_name: firstName,
      last_name: metadata.last_name || '',
      email: metadata.email || '',
      avatar: metadata.avatar,
    },
  };

  const renderFavouriteBadge = (
    item: GenreObject | HostObject,
    onRemove: () => void,
    type: 'genre' | 'host'
  ) => (
    <span
      key={item.id}
      className="inline-flex items-center border border-almostblack dark:border-white rounded-full px-2.5 py-1 text-[12px] font-mono uppercase text-almostblack dark:text-white"
    >
      {item.title}
      <button
        className="ml-2 text-red-500 hover:text-red-700 disabled:opacity-50"
        onClick={onRemove}
        disabled={isPending}
        aria-label={`Remove ${type}`}
      >
        <XIcon className="size-3" />
      </button>
    </span>
  );

  const renderShowsSection = (
    items: (GenreObject | HostObject)[],
    showsMap: { [key: string]: any[] },
    type: 'genre' | 'host'
  ) => {
    if (items.length === 0) {
      return (
        <EmptyState
          icon={type === 'genre' ? Music : Users}
          title={`No Favourite ${type === 'genre' ? 'Genres' : 'Hosts'} yet`}
          description={`Add your favourite ${type}s to see their latest shows here.`}
          actionLabel={`Add ${type === 'genre' ? 'Genre' : 'Host'}`}
          onAction={() => handleAddClick(type)}
        />
      );
    }

    return (
      <div className="space-y-8">
        {/* Badges */}
        <div className="flex flex-wrap gap-2">
          {items.map(item => (
            <div key={item.id}>
              {renderFavouriteBadge(
                item,
                () => (type === 'genre' ? handleRemoveGenre(item.id) : handleRemoveHost(item.id)),
                type
              )}
            </div>
          ))}
        </div>

        {/* Latest shows */}
        {items.map(item => {
          const shows = showsMap[item.id] || [];
          if (shows.length === 0) return null;

          return (
            <div key={item.id} className="space-y-4">
              <h3 className="text-xl font-semibold">
                Latest {type === 'genre' ? 'in' : 'from'} {item.title}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {shows.map((show: any) => (
                  <div key={show.key || show.id || show.slug} className="relative">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
                      <div className="aspect-video bg-gray-200 dark:bg-gray-700">
                        <img
                          src={
                            show.enhanced_image || show.pictures?.large || '/image-placeholder.png'
                          }
                          alt={show.name || show.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="p-4">
                        <h4 className="font-semibold text-sm mb-2 line-clamp-2">
                          {show.name || show.title}
                        </h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                          {show.host || show.user?.name || 'Worldwide FM'}
                        </p>
                        <a
                          href={show.url || `/episode/${show.slug}`}
                          className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          Listen Now
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const favoriteGenreIds = favouriteGenres.map(g => (typeof g === 'string' ? g : g.id));
  const favoriteHostIds = favouriteHosts.map(h => (typeof h === 'string' ? h : h.id));
  const hasFavorites = favoriteGenreIds.length > 0 || favoriteHostIds.length > 0;

  const renderModalContent = () => {
    switch (isAdding) {
      case 'genre':
        return (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Select a genre to add to your favorites:
            </p>
            <Select onValueChange={setSelectedGenre} value={selectedGenre}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a genre..." />
              </SelectTrigger>
              <SelectContent>
                {allGenres
                  .filter(
                    genre => !optimisticGenresRemove.some(favGenre => favGenre.id === genre.id)
                  )
                  .sort((a, b) => a.title.localeCompare(b.title))
                  .map(genre => (
                    <SelectItem key={genre.id} value={genre.id}>
                      {genre.title}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        );

      case 'host':
        return (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Select a host to add to your favorites:
            </p>
            <Select onValueChange={setSelectedHost} value={selectedHost}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a host..." />
              </SelectTrigger>
              <SelectContent>
                {allHosts
                  .filter(host => !optimisticHostsRemove.some(favHost => favHost.id === host.id))
                  .sort((a, b) => a.title.localeCompare(b.title))
                  .map(host => (
                    <SelectItem key={host.id} value={host.id}>
                      {host.title}
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
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h1 className="font-display uppercase text-4xl font-normal tracking-tight">
            Welcome, {firstName}!
          </h1>
          <div className="flex gap-2 self-start md:self-auto">
            <Button variant="outline" onClick={() => setShowEditProfile(!showEditProfile)}>
              <Settings className="size-4 mr-2" />
              {showEditProfile ? 'Hide' : 'Edit'} Profile
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
            <UserProfileForm user={safeUser} />
          </div>
        )}

        {/* Membership Section */}
        <section className="mb-8">
          <div className="p-6 border border-primary/20">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start md:items-center space-x-3">
                <Crown className="size-8 text-primary shrink-0" />
                <div>
                  <h2 className="text-2xl font-bold">Membership</h2>
                  <p className="text-muted-foreground">
                    {subscriptionStatus === 'active'
                      ? 'You have an active membership'
                      : 'Support Worldwide FM, an independent radio station'}
                  </p>
                </div>
              </div>
              <div className="text-left md:text-right">
                {subscriptionStatus === 'active' ? (
                  <div className="flex items-center space-x-2 text-green-600">
                    <CheckCircle className="size-5" />
                    <span className="font-medium">Active</span>
                  </div>
                ) : (
                  <Button asChild className="px-6">
                    <Link href="/membership">
                      <CreditCard className="size-4 mr-2" />
                      Subscribe
                    </Link>
                  </Button>
                )}
              </div>
            </div>

            {subscriptionStatus === 'active' && (
              <div className="mt-4 pt-4 border-t border-primary/20">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="size-4 text-green-500" />
                    <span>Ad-free listening</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="size-4 text-green-500" />
                    <span>Exclusive content</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="size-4 text-green-500" />
                    <span>Early access</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Favourite Genres */}
        <section className="mt-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold">Favourite Genres</h2>
            <Button variant="outline" onClick={() => handleAddClick('genre')} disabled={isPending}>
              Add Genre
            </Button>
          </div>
          {renderShowsSection(optimisticGenresRemove, genreShows, 'genre')}
        </section>

        {/* Favourite Hosts */}
        <section className="mt-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold">Favourite Hosts</h2>
            <Button variant="outline" onClick={() => handleAddClick('host')} disabled={isPending}>
              Add Host
            </Button>
          </div>
          {renderShowsSection(optimisticHostsRemove, hostShows, 'host')}
        </section>

        {/* Listen Later */}
        <section className="mt-10">
          <h2 className="text-2xl font-bold mb-4">Listen Later</h2>
          {listenLater.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {listenLater.map((show: any) => (
                <div key={show.id} className="relative group">
                  <ShowCard show={show} slug={`/episode/${show.slug}`} playable />
                  <div className="absolute top-4 right-4 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                    <SaveShowButton
                      show={{ id: show.id, slug: show.slug, title: show.title }}
                      isSaved={true}
                      className="bg-white/90 dark:bg-black/90"
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Bookmark}
              title="No Saved Shows"
              description="Save episodes to 'Listen Later' while browsing and they'll appear here."
            />
          )}
        </section>

        {/* For You Section */}
        <section className="mt-10">
          <h2 className="text-2xl font-bold mb-4">Recommended For You</h2>
          {hasFavorites ? (
            <ForYouClient
              favoriteGenreIds={favoriteGenreIds}
              favoriteHostIds={favoriteHostIds}
              limit={10}
              title=""
            />
          ) : (
            <EmptyState
              icon={Sparkles}
              title="No Recommendations"
              description="Follow your favourite genres and hosts to get personalized recommendations."
            />
          )}
        </section>

        {/* Add Favorites Modal */}
        {isAdding && (
          <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-900 p-8 rounded shadow-lg max-w-md w-full mx-4 relative">
              <button
                onClick={handleAddClose}
                className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                aria-label="Close modal"
              >
                <XIcon className="size-5" />
              </button>

              <h3 className="text-xl font-bold mb-4 pr-8">
                Add Favourite {isAdding.charAt(0).toUpperCase() + isAdding.slice(1)}
              </h3>

              {renderModalContent()}

              <div className="flex gap-2 mt-6">
                <Button
                  variant="outline"
                  onClick={handleAddClose}
                  className="flex-1"
                  disabled={isPending}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={(!selectedGenre && !selectedHost) || isPending}
                  className="flex-1"
                >
                  {isPending ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

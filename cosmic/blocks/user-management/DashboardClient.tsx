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
  addFavouriteGenres,
  addFavouriteHosts,
} from './actions';
import { Music, Users, Bookmark, Sparkles } from 'lucide-react';
import { createStripePortalSession } from './stripe-actions';
import { cn } from '@/lib/utils';
import { DashboardSectionShows } from '@/components/dashboard/dashboard-section-shows';
import { ListenLaterClient } from '@/components/dashboard/listen-later-client';
import { EmptyState } from '@/components/dashboard/empty-state';
import type { GenreObject, HostObject } from '@/lib/cosmic-config';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ForYouClient } from '@/components/for-you-client';

interface DashboardClientProps {
  userData: any;
  allGenres: GenreObject[];
  allHosts: HostObject[];
  canonicalGenres: { slug: string; title: string }[];
  favouriteGenres: GenreObject[];
  favouriteHosts: HostObject[];
}

export default function DashboardClient({
  userData,
  allGenres,
  allHosts,
  canonicalGenres = [],
  favouriteGenres = [],
  favouriteHosts = [],
}: DashboardClientProps) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isAdding, setIsAdding] = useState<null | 'genre' | 'host'>(null);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedHosts, setSelectedHosts] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const [optimisticGenres, addOptimisticGenres] = useOptimistic(
    favouriteGenres,
    (state, newGenres: GenreObject[]) => [...state, ...newGenres]
  );
  const [optimisticHosts, addOptimisticHosts] = useOptimistic(
    favouriteHosts,
    (state, newHosts: HostObject[]) => [...state, ...newHosts]
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
    setSelectedGenres([]);
    setSelectedHosts([]);
    setSearchQuery('');
  };

  const handleAddClose = () => {
    setIsAdding(null);
    setSelectedGenres([]);
    setSelectedHosts([]);
    setSearchQuery('');
  };

  const handleSave = async () => {
    if (!user) return;

    startTransition(async () => {
      let res;

      if (isAdding === 'genre' && selectedGenres.length > 0) {
        const genresToAdd = allGenres.filter(g => selectedGenres.includes(g.id));
        if (genresToAdd.length === 0) return;
        startTransition(() => {
          addOptimisticGenres(genresToAdd);
        });
        res = await addFavouriteGenres(user.id, genresToAdd);
      } else if (isAdding === 'host' && selectedHosts.length > 0) {
        const hostsToAdd = allHosts.filter(h => selectedHosts.includes(h.id));
        if (hostsToAdd.length === 0) return;
        startTransition(() => {
          addOptimisticHosts(hostsToAdd);
        });
        res = await addFavouriteHosts(user.id, hostsToAdd);
      }

      if (res?.success) {
        handleAddClose();
        router.refresh();
      }
    });
  };

  const handleManageSubscription = async () => {
    if (!user) return;
    
    startTransition(async () => {
      const res = await createStripePortalSession(user.id);
      if (res.url) {
        window.location.href = res.url;
      } else if (res.error) {
        console.error('Error creating portal session:', res.error);
        // You might want to show a toast error here
      }
    });
  };

  // Ensure we have safe defaults for metadata
  const metadata = userData?.metadata || {};
  const firstName = metadata.first_name || 'Member';
  const rawStatus = metadata.subscription_status || 'inactive';
  const isActive = ['active', 'trialing', 'past_due'].includes(rawStatus);

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
      className='inline-flex items-center border border-almostblack dark:border-white rounded-none px-2.5 py-1 text-[12px] font-mono uppercase text-almostblack dark:text-white'
    >
      {item.title}
      <button
        className='ml-2 text-red-500 hover:text-red-700 disabled:opacity-50'
        onClick={onRemove}
        disabled={isPending}
        aria-label={`Remove ${type}`}
      >
        <XIcon className='size-3' />
      </button>
    </span>
  );

  const favoriteGenreIds = favouriteGenres.map(g => (typeof g === 'string' ? g : g.id));
  const favoriteHostIds = favouriteHosts.map(h => (typeof h === 'string' ? h : h.id));
  const listenLaterIds = (userData.metadata?.listen_later || [])
    .map((s: any) => (typeof s === 'string' ? s : s?.id || s?._id))
    .filter(Boolean);
  const hasFavorites = favoriteGenreIds.length > 0 || favoriteHostIds.length > 0;

  const toggleGenre = (genreId: string) => {
    setSelectedGenres(prev =>
      prev.includes(genreId) ? prev.filter(id => id !== genreId) : [...prev, genreId]
    );
  };

  const toggleHost = (hostId: string) => {
    setSelectedHosts(prev =>
      prev.includes(hostId) ? prev.filter(id => id !== hostId) : [...prev, hostId]
    );
  };

  const renderModalContent = () => {
    const items = isAdding === 'genre' ? allGenres : allHosts;
    const selected = isAdding === 'genre' ? selectedGenres : selectedHosts;
    const toggle = isAdding === 'genre' ? toggleGenre : toggleHost;
    const alreadyFavorited = isAdding === 'genre' ? optimisticGenresRemove : optimisticHostsRemove;

    const filteredItems = items
      .filter(item => !alreadyFavorited.some(fav => fav.id === item.id))
      .filter(item => item.title.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => a.title.localeCompare(b.title));

    return (
      <div className='space-y-4'>
        <p className='text-sm text-gray-600 dark:text-gray-400'>
          Select one or more {isAdding}s to add to your favorites:
        </p>

        <div className='relative'>
          <input
            type='text'
            placeholder={`Search ${isAdding}s...`}
            className='w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-none bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-primary'
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        <div className='max-h-60 overflow-y-auto border border-gray-200 dark:border-gray-800 rounded-none divide-y divide-gray-100 dark:divide-gray-800'>
          {filteredItems.length === 0 ? (
            <div className='p-4 text-center text-sm text-gray-500'>No results found</div>
          ) : (
            filteredItems.map(item => (
              <label
                key={item.id}
                className='flex items-center p-3 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors'
              >
                <input
                  type='checkbox'
                  className='hidden'
                  checked={selected.includes(item.id)}
                  onChange={() => toggle(item.id)}
                />
                <div
                  className={cn(
                    'size-4 rounded-none border mr-3 flex items-center justify-center transition-colors',
                    selected.includes(item.id)
                      ? 'bg-almostblack border-almostblack dark:bg-white dark:border-white'
                      : 'border-gray-300 dark:border-gray-600'
                  )}
                >
                  {selected.includes(item.id) && (
                    <svg
                      className='size-3 text-white dark:text-almostblack'
                      fill='none'
                      viewBox='0 0 24 24'
                      stroke='currentColor'
                      strokeWidth={4}
                    >
                      <path strokeLinecap='round' strokeLinejoin='round' d='M5 13l4 4L19 7' />
                    </svg>
                  )}
                </div>
                <span className='text-sm uppercase font-mono'>{item.title}</span>
              </label>
            ))
          )}
        </div>
        {selected.length > 0 && (
          <p className='text-xs text-almostblack dark:text-gray-400 font-mono'>
            {selected.length} item{selected.length !== 1 ? 's' : ''} selected
          </p>
        )}
      </div>
    );
  };

  return (
    <div className='py-8'>
      <div className='mx-auto px-4 flex flex-col gap-8'>
        {/* Header */}
        <div className='flex flex-col md:flex-row md:items-center justify-between gap-4'>
          <h1 className='font-display uppercase text-4xl font-normal tracking-tight'>
            Welcome{firstName ? ', ' + firstName : ''}!
          </h1>
          <div className='flex gap-2 self-start md:self-auto'>
            <Button variant='outline' onClick={() => setShowEditProfile(!showEditProfile)}>
              <Settings className='size-4 mr-2' />
              {showEditProfile ? 'Hide' : 'Edit'} Profile
            </Button>
            <Button variant='outline' onClick={handleLogout}>
              <LogOut className='size-4 mr-2' />
              Log Out
            </Button>
          </div>
        </div>

        {/* Edit Profile Form */}
        {showEditProfile && (
          <div className='mb-8'>
            <UserProfileForm user={safeUser} />
          </div>
        )}

        {/* Membership Section */}
        <section className='mb-8'>
          <div className='p-6 border border-primary/20'>
            <div className='flex flex-col md:flex-row md:items-center justify-between gap-4'>
              <div className='flex items-start md:items-center space-x-3'>
                <Crown className='size-8 text-primary shrink-0' />
                <div>
                  <h2 className='text-2xl font-bold uppercase font-mono tracking-tight'>Membership</h2>
                  <p className='text-muted-foreground'>
                    {isActive
                      ? 'You have an active membership'
                      : 'Support Worldwide FM, an independent radio station'}
                  </p>
                </div>
              </div>
              <div className='text-left md:text-right'>
                {isActive ? (
                  <div className='flex items-center space-x-2 text-green-600'>
                    <CheckCircle className='size-5' />
                    <span className='font-medium uppercase font-mono'>Active</span>
                  </div>
                ) : (
                  <Button asChild className='px-6 uppercase font-mono'>
                    <Link href='/membership'>
                      <CreditCard className='size-4 mr-2' />
                      Subscribe
                    </Link>
                  </Button>
                )}
              </div>
            </div>

            {isActive && (
              <div className='mt-4 pt-4 border-t border-primary/20'>
                <div className='grid grid-cols-1 md:grid-cols-3 gap-4 text-sm'>
                  <div className='flex items-center space-x-2'>
                    <CheckCircle className='size-4 text-green-500' />
                    <span className='uppercase font-mono'>Ad-free listening</span>
                  </div>
                  <div className='flex items-center space-x-2'>
                    <CheckCircle className='size-4 text-green-500' />
                    <span className='uppercase font-mono'>Exclusive content</span>
                  </div>
                  <div className='flex items-center space-x-2'>
                    <CheckCircle className='size-4 text-green-500' />
                    <span className='uppercase font-mono'>Early access</span>
                  </div>
                </div>
                
                <div className='mt-6'>
                    <Button 
                        variant="outline" 
                        onClick={handleManageSubscription}
                        disabled={isPending}
                        className="uppercase font-mono"
                    >
                        Manage Subscription
                    </Button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Listen Later */}
        <section className='mt-10'>
          <h2 className='text-2xl font-bold mb-4 uppercase font-mono tracking-tight'>Listen Later</h2>
          <ListenLaterClient listenLaterIds={listenLaterIds} />
        </section>

        {/* Favourite Genres */}
        <section className='mt-10'>
          <div className='flex items-center justify-between mb-4'>
            <h2 className='text-2xl font-bold uppercase font-mono tracking-tight'>Favourite Genres</h2>
            <Button variant='outline' onClick={() => handleAddClick('genre')} disabled={isPending} className='uppercase font-mono'>
              Add Genre
            </Button>
          </div>
          {optimisticGenresRemove.length === 0 ? (
            <EmptyState
              icon={Music}
              title='No Favourite Genres yet'
              description='Add your favourite genres to see their latest shows here.'
              actionLabel='Add Genre'
              onAction={() => handleAddClick('genre')}
            />
          ) : (
            <div className='space-y-8'>
              <div className='flex flex-wrap gap-2'>
                {optimisticGenresRemove.map(genre => renderFavouriteBadge(genre, () => handleRemoveGenre(genre.id), 'genre'))}
              </div>
              {optimisticGenresRemove.map(genre => (
                <DashboardSectionShows key={genre.id} genreId={genre.id} title={`Latest in ${genre.title}`} limit={5} />
              ))}
            </div>
          )}
        </section>

        {/* Favourite Hosts */}
        <section className='mt-10'>
          <div className='flex items-center justify-between mb-4'>
            <h2 className='text-2xl font-bold uppercase font-mono tracking-tight'>Favourite Hosts</h2>
            <Button variant='outline' onClick={() => handleAddClick('host')} disabled={isPending} className='uppercase font-mono'>
              Add Host
            </Button>
          </div>
          {optimisticHostsRemove.length === 0 ? (
            <EmptyState
              icon={Users}
              title='No Favourite Hosts yet'
              description='Add your favourite hosts to see their latest shows here.'
              actionLabel='Add Host'
              onAction={() => handleAddClick('host')}
            />
          ) : (
            <div className='space-y-8'>
              <div className='flex flex-wrap gap-2'>
                {optimisticHostsRemove.map(host => renderFavouriteBadge(host, () => handleRemoveHost(host.id), 'host'))}
              </div>
              {optimisticHostsRemove.map(host => (
                <DashboardSectionShows key={host.id} hostId={host.id} title={`Latest from ${host.title}`} limit={5} />
              ))}
            </div>
          )}
        </section>

        {/* For You Section */}
        <section className='mt-10'>
          <h2 className='text-2xl font-bold mb-4 uppercase font-mono tracking-tight'>Recommended For You</h2>
          {hasFavorites ? (
            <ForYouClient
              favoriteGenreIds={favoriteGenreIds}
              favoriteHostIds={favoriteHostIds}
              limit={10}
              title=''
            />
          ) : (
            <EmptyState
              icon={Sparkles}
              title='No Recommendations'
              description='Follow your favourite genres and hosts to get personalized recommendations.'
            />
          )}
        </section>

        {/* Add Favorites Modal */}
        {isAdding && (
          <div className='fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50'>
            <div className='bg-white dark:bg-gray-900 p-8 rounded-none shadow-lg max-w-md w-full mx-4 relative'>
              <button
                onClick={handleAddClose}
                className='absolute top-4 right-4 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                aria-label='Close modal'
              >
                <XIcon className='size-5' />
              </button>

              <h3 className='text-xl font-bold mb-4 pr-8'>
                Add Favourite {isAdding.charAt(0).toUpperCase() + isAdding.slice(1)}
              </h3>

              {renderModalContent()}

              <div className='flex gap-2 mt-6'>
                <Button
                  variant='outline'
                  onClick={handleAddClose}
                  className='flex-1'
                  disabled={isPending}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={(selectedGenres.length === 0 && selectedHosts.length === 0) || isPending}
                  className='flex-1'
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

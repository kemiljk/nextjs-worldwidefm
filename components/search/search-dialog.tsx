'use client';

import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  X,
  Search,
  Minus,
  Music2,
  Newspaper,
  Calendar,
  Video,
  Loader,
  AlertCircle,
  FileQuestion,
  MicVocal,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import Link from 'next/link';
import { format } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getAllPosts, getVideos, getAllEvents, getTakeovers, searchEpisodes } from '@/lib/actions';
import type { ContentType } from '@/lib/search/types';
import type { PostObject, VideoObject } from '@/lib/cosmic-config';
import { useDebounce } from '@/hooks/use-debounce';
import { useInView } from 'react-intersection-observer';

interface SearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const typeLabels: Record<ContentType, { label: string; icon: React.ElementType; color: string }> = {
  episodes: { label: 'Episodes', icon: Music2, color: 'text-foreground' },
  posts: { label: 'Posts', icon: Newspaper, color: 'text-foreground' },
  events: { label: 'Events', icon: Calendar, color: 'text-foreground' },
  videos: { label: 'Videos', icon: Video, color: 'text-foreground' },
  takeovers: { label: 'Takeovers', icon: MicVocal, color: 'text-foreground' },
};

// Helper function to extract YouTube video ID from URL
function getYouTubeThumbnail(url: string): string {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  if (match && match[2].length === 11) {
    return `https://img.youtube.com/vi/${match[2]}/maxresdefault.jpg`;
  }
  return '';
}

// Helper function to extract Vimeo video ID from URL
function getVimeoThumbnail(url: string): string {
  const regExp = /(?:vimeo\.com\/|player\.vimeo\.com\/video\/)([0-9]+)/;
  const match = url.match(regExp);
  if (match && match[1]) {
    return `https://vumbnail.com/${match[1]}.jpg`;
  }
  return '';
}

export default function SearchDialog({ open, onOpenChange }: SearchDialogProps) {
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [results, setResults] = useState<any[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [availableTypes, setAvailableTypes] = useState<string[]>([]);
  const [videoCategories, setVideoCategories] = useState<any[]>([]);
  // On mobile: showFilters = false means show results, true means show filters overlay.
  const [showFilters, setShowFilters] = useState(false); // For mobile toggle: start with results list
  const { ref: observerTarget, inView } = useInView({
    threshold: 0.1,
    rootMargin: '100px',
  });
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const PAGE_SIZE = 20;

  // On dialog open, check which types have at least one result and fetch video categories
  useEffect(() => {
    if (!open) return;
    async function checkTypes() {
      try {
        const types: string[] = [];
        const [episodes, posts, videos, events, takeovers, videoCategories] = await Promise.all([
          searchEpisodes({ limit: 1 }),
          getAllPosts({ limit: 1 }),
          getVideos({ limit: 1 }),
          getAllEvents({ limit: 1 }),
          getTakeovers({ limit: 1 }),
          import('@/lib/actions').then(m => m.getVideoCategories()),
        ]);
        if (episodes?.shows?.length > 0) types.push('episodes');
        if (posts?.posts?.length > 0) types.push('posts');
        if (events?.events?.length > 0) types.push('events');
        if (videos?.videos?.length > 0) types.push('videos');
        if (takeovers?.takeovers?.length > 0) types.push('takeovers');
        setAvailableTypes(types);
        setVideoCategories(videoCategories);
      } catch (error) {
        console.warn('Error checking available types:', error);
        setAvailableTypes([]);
      }
    }
    checkTypes();
  }, [open]);

  // Determine selected content type and selected tags
  const selectedType = activeFilters.find(f => Object.keys(typeLabels).includes(f)) || 'episodes';
  const selectedTags = activeFilters.filter(f => !Object.keys(typeLabels).includes(f));

  // Fetch tags for the selected type
  useEffect(() => {
    if (!open) return;
    async function fetchTags() {
      try {
        const tagSet = new Set<string>();
        if (selectedType === 'episodes') {
          const response = await searchEpisodes({ limit: 100, offset: 0 });
          response?.shows?.forEach((episode: any) => {
            const genres = episode?.metadata?.genres || [];
            genres.forEach((genre: any) => {
              if (genre?.title && genre?.id) {
                // Store both title and ID for easy access
                tagSet.add(`${genre.title}|${genre.id}`);
              }
            });
          });
        } else if (selectedType === 'posts') {
          const { posts } = await getAllPosts({ limit: 100, offset: 0 });
          posts?.forEach((post: PostObject) => {
            post?.metadata?.categories?.forEach((cat: any) => {
              if (cat?.title) tagSet.add(cat.title);
            });
          });
        } else if (selectedType === 'videos') {
          const { videos } = await getVideos({ limit: 100, offset: 0 });
          videos?.forEach((video: VideoObject) => {
            video?.metadata?.categories?.forEach((cat: any) => {
              if (cat?.title) tagSet.add(cat.title);
            });
          });
        } else if (selectedType === 'events') {
          const { events } = await getEvents({ limit: 100, offset: 0 });
          events?.forEach((event: any) => {
            event?.metadata?.categories?.forEach((cat: any) => {
              if (cat?.title) tagSet.add(cat.title);
            });
          });
        } else if (selectedType === 'takeovers') {
          const { takeovers } = await getTakeovers({ limit: 100, offset: 0 });
          takeovers?.forEach((takeover: any) => {
            takeover?.metadata?.categories?.forEach((cat: any) => {
              if (cat?.title) tagSet.add(cat.title);
            });
          });
        }
        setTags(Array.from(tagSet).sort((a, b) => a.localeCompare(b)));
      } catch (error) {
        console.warn('Error fetching tags:', error);
        setTags([]);
      }
    }
    fetchTags();
  }, [open, selectedType]);

  // Fetch results for the selected type, tags, and search
  useEffect(() => {
    if (!open) return;

    let isMounted = true;
    setIsLoading(true);
    setPage(1);
    setHasNext(true);

    async function fetchResults() {
      try {
        let res: any;
        let allResults: any[] = [];

        if (selectedType === 'episodes') {
          // Fetch episodes from Cosmic using server action to avoid CORS issues
          const searchParams: any = {
            limit: debouncedSearchTerm || selectedTags.length > 0 ? 1000 : PAGE_SIZE, // Higher limit for search/genre filtering, normal limit for browsing
            offset: 0,
          };

          // Add search term if present
          if (debouncedSearchTerm) {
            searchParams.searchTerm = debouncedSearchTerm;
          }

          // If tags selected, extract genre IDs directly from selected tags
          if (selectedTags.length > 0) {
            const ids = selectedTags
              .map(tag => {
                // For episodes, tags are in format "title|id"
                if (selectedType === 'episodes' && tag.includes('|')) {
                  return tag.split('|')[1]; // Extract ID part
                }
                return null;
              })
              .filter(Boolean);

            console.log('[SearchDialog] Selected tags:', selectedTags);
            console.log('[SearchDialog] Genre IDs extracted:', ids);

            if (ids.length > 0) {
              searchParams.genre = ids;
            }
          }

          console.log('[SearchDialog] Fetching episodes with params:', searchParams);
          res = await searchEpisodes(searchParams);
          allResults = res?.shows || [];
          console.log('[SearchDialog] Found episodes:', allResults.length);
          console.log('[SearchDialog] Raw response:', res);
          // Episodes are already sorted by Cosmic order/broadcast_date from server query
        } else if (selectedType === 'posts') {
          const searchParams = debouncedSearchTerm
            ? { searchTerm: debouncedSearchTerm, limit: 1000, offset: 0 } // Increased limit for search
            : { limit: selectedTags.length > 0 ? 1000 : 100, offset: 0 }; // Increased limit for genre filtering
          res = await getAllPosts(searchParams);
          allResults = res?.posts || [];
          // Note: Posts don't have server-side genre filtering yet, so we keep client-side filtering for now
          if (selectedTags.length > 0) {
            allResults = allResults.filter((post: any) =>
              selectedTags.every(
                tag =>
                  Array.isArray(post?.metadata?.categories) &&
                  post.metadata.categories.some(
                    (cat: any) => cat?.title && cat.title.toLowerCase() === tag.toLowerCase()
                  )
              )
            );
          }
        } else if (selectedType === 'videos') {
          const searchParams = debouncedSearchTerm
            ? { searchTerm: debouncedSearchTerm, limit: 1000, offset: 0 } // Increased limit for search
            : { limit: selectedTags.length > 0 ? 1000 : 100, offset: 0 }; // Increased limit for genre filtering
          res = await getVideos(searchParams);
          allResults = res?.videos || [];
          if (selectedTags.length > 0) {
            allResults = allResults.filter((video: any) =>
              selectedTags.every(
                tag =>
                  Array.isArray(video?.metadata?.categories) &&
                  video.metadata.categories.some(
                    (cat: any) => cat?.title && cat.title.toLowerCase() === tag.toLowerCase()
                  )
              )
            );
          }
        } else if (selectedType === 'events') {
          const searchParams = debouncedSearchTerm
            ? { searchTerm: debouncedSearchTerm, limit: 1000, offset: 0 } // Increased limit for search
            : { limit: selectedTags.length > 0 ? 1000 : 100, offset: 0 }; // Increased limit for genre filtering
          res = await getEvents(searchParams);
          allResults = res?.events || [];
          if (selectedTags.length > 0) {
            allResults = allResults.filter((event: any) =>
              selectedTags.every(
                tag =>
                  Array.isArray(event?.metadata?.categories) &&
                  event.metadata.categories.some(
                    (cat: any) => cat?.title && cat.title.toLowerCase() === tag.toLowerCase()
                  )
              )
            );
          }
        } else if (selectedType === 'takeovers') {
          const searchParams = debouncedSearchTerm
            ? { searchTerm: debouncedSearchTerm, limit: 1000, offset: 0 } // Increased limit for search
            : { limit: selectedTags.length > 0 ? 1000 : 100, offset: 0 }; // Increased limit for genre filtering
          res = await getTakeovers(searchParams);
          allResults = res?.takeovers || [];
          if (selectedTags.length > 0) {
            allResults = allResults.filter((takeover: any) =>
              selectedTags.every(
                tag =>
                  Array.isArray(takeover?.metadata?.categories) &&
                  takeover.metadata.categories.some(
                    (cat: any) => cat?.title && cat.title.toLowerCase() === tag.toLowerCase()
                  )
              )
            );
          }
        }

        if (isMounted) {
          setResults(allResults.slice(0, PAGE_SIZE));
          setHasNext(allResults.length > PAGE_SIZE);
        }
      } catch (error) {
        console.warn('Error fetching search results:', error);
        if (isMounted) {
          setResults([]);
          setHasNext(false);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    // Always fetch results - either default episodes or filtered/search results
    fetchResults();

    setTimeout(() => searchInputRef.current?.focus(), 100);

    return () => {
      isMounted = false;
    };
  }, [open, selectedType, selectedTags.join('|'), debouncedSearchTerm]);

  // Infinite scroll: load more when sentinel is in view
  useEffect(() => {
    if (inView && hasNext && !isLoadingMore) {
      // Add a small delay to prevent rapid API calls
      const timeoutId = setTimeout(() => {
        setIsLoadingMore(true);
        const nextOffset = page * PAGE_SIZE;

        async function fetchMore() {
          try {
            let res: any;
            if (selectedType === 'episodes') {
              const searchParams = debouncedSearchTerm
                ? { searchTerm: debouncedSearchTerm, limit: PAGE_SIZE, offset: nextOffset }
                : { limit: PAGE_SIZE, offset: nextOffset };
              res = await searchEpisodes(searchParams);
              setResults(prev => [...prev, ...(res?.shows || [])]);
              setHasNext(res?.hasNext || false);
            } else if (selectedType === 'posts') {
              const searchParams = debouncedSearchTerm
                ? {
                    tag: selectedTags.join('|'),
                    searchTerm: debouncedSearchTerm,
                    limit: PAGE_SIZE,
                    offset: nextOffset,
                  }
                : { tag: selectedTags.join('|'), limit: PAGE_SIZE, offset: nextOffset };
              res = await getAllPosts(searchParams);
              setResults(prev => [...prev, ...(res?.posts || [])]);
              setHasNext(res?.hasNext || false);
            } else if (selectedType === 'videos') {
              const searchParams = debouncedSearchTerm
                ? {
                    tag: selectedTags.join('|'),
                    searchTerm: debouncedSearchTerm,
                    limit: PAGE_SIZE,
                    offset: nextOffset,
                  }
                : { tag: selectedTags.join('|'), limit: PAGE_SIZE, offset: nextOffset };
              res = await getVideos(searchParams);
              setResults(prev => [...prev, ...(res?.videos || [])]);
              setHasNext(res?.hasNext || false);
            } else if (selectedType === 'events') {
              const searchParams = debouncedSearchTerm
                ? {
                    tag: selectedTags.join('|'),
                    searchTerm: debouncedSearchTerm,
                    limit: PAGE_SIZE,
                    offset: nextOffset,
                  }
                : { tag: selectedTags.join('|'), limit: PAGE_SIZE, offset: nextOffset };
              res = await getEvents(searchParams);
              setResults(prev => [...prev, ...(res?.events || [])]);
              setHasNext(res?.hasNext || false);
            } else if (selectedType === 'takeovers') {
              const searchParams = debouncedSearchTerm
                ? {
                    tag: selectedTags.join('|'),
                    searchTerm: debouncedSearchTerm,
                    limit: PAGE_SIZE,
                    offset: nextOffset,
                  }
                : { tag: selectedTags.join('|'), limit: PAGE_SIZE, offset: nextOffset };
              res = await getTakeovers(searchParams);
              setResults(prev => [...prev, ...(res?.takeovers || [])]);
              setHasNext(res?.hasNext || false);
            }
            setPage(prev => prev + 1);
          } catch (error) {
            console.warn('Error loading more results:', error);
            setHasNext(false);
          } finally {
            setIsLoadingMore(false);
          }
        }

        fetchMore();
      }, 1000); // 1000ms delay to match debounce

      return () => {
        clearTimeout(timeoutId);
      };
    }
  }, [
    inView,
    hasNext,
    isLoadingMore,
    page,
    selectedType,
    selectedTags.join('|'),
    debouncedSearchTerm,
  ]);

  // Filter toggle logic (content type and tags)
  const handleFilterToggle = (filter: { type: string; slug: string }) => {
    setActiveFilters(prev => {
      if (filter.type === 'types') {
        // Only one type filter at a time
        return prev.includes(filter.slug)
          ? prev.filter(f => f !== filter.slug)
          : [filter.slug, ...prev.filter(f => f !== filter.slug && !tags.includes(f))];
      } else {
        // Allow multiple tags to be selected
        return prev.includes(filter.slug)
          ? prev.filter(f => f !== filter.slug)
          : [...prev, filter.slug];
      }
    });

    // Clear search term when applying filters to show filtered results more clearly
    if (searchTerm) {
      setSearchTerm('');
    }
  };

  // Clear all filters
  const clearAllFilters = () => {
    setActiveFilters([]);
    setSearchTerm('');
    setPage(1);
    setResults([]);
    setHasNext(true);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-[90vw] h-[80vh] p-0 gap-0 overflow-hidden'>
        <div className='flex h-full overflow-hidden relative flex-col sm:flex-row'>
          {/* --- Mobile: Search bar always at top, toggle below it --- */}
          <div className='sm:hidden w-full z-40 bg-background border-b shrink-0'>
            {/* Search Input and Edit filters button always at top */}
            <form
              onSubmit={e => {
                e.preventDefault();
                setPage(1);
                setHasNext(true);
                setResults([]);
              }}
              className='flex gap-2'
            >
              <div className='px-4 h-12 items-center flex flex-1'>
                <Search className='h-6 w-6 text-muted-foreground' />
                <Input
                  ref={searchInputRef}
                  placeholder='Search'
                  className='border-none pl-4 font-mono text-m8 uppercase bg-background'
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
                {/* Edit filters button always visible on mobile, to right of input */}
                <div className='w-auto flex justify-left py-2 bg-background'>
                  {!showFilters ? (
                    <Button
                      variant='none'
                      size='sm'
                      className='border py-1 px-2 font-mono text-center uppercase text-m8'
                      onClick={() => {
                        setShowFilters(true); // Show filters overlay
                      }}
                      type='button'
                    >
                      Edit filters
                    </Button>
                  ) : (
                    <Button
                      variant='none'
                      size='sm'
                      className='border py-1 px-2 font-mono text-center uppercase text-m8'
                      onClick={() => {
                        // Apply filters: hide overlay and refresh results
                        setShowFilters(false);
                        setPage(1);
                        setResults([]);
                        setHasNext(true);
                        // Clear search term when applying filters to show filtered results
                        setSearchTerm('');
                      }}
                      type='button'
                    >
                      Apply filters
                    </Button>
                  )}
                </div>
              </div>
            </form>
          </div>

          {/* Main flex: Filters and Results (desktop: row, mobile: overlays below search bar) */}
          <div className='flex flex-1 w-full h-full relative overflow-hidden'>
            {/* Filters Section */}
            <div
              className={cn(
                'w-full md:w-[30%] lg:w-[25%] border-r bg-background relative inset-y-0 left-0 z-30 sm:relative sm:block transition-transform duration-200 ease-in-out',
                'sm:static absolute h-full',
                // On mobile: overlay left, show/hide with showFilters, always block on desktop
                showFilters ? 'translate-x-0' : '-translate-x-full',
                'sm:translate-x-0'
              )}
              style={{
                display:
                  typeof window !== 'undefined' && window.innerWidth >= 640
                    ? 'block'
                    : showFilters
                      ? 'block'
                      : 'none',
              }}
            >
              {/* On mobile, add top margin for search bar and toggle */}
              <div className={cn('flex flex-col h-full', 'sm:mt-0', 'mt-0')}>
                <div className='px-4 py-3 sm:border-b'>
                  <div className='flex h-4 items-center justify-between'>
                    <h3 className='font-mono uppercase text-m8'>Filters</h3>
                    <div className='flex items-center gap-2'>
                      {activeFilters.length > 0 && (
                        <Button
                          variant='outline'
                          size='sm'
                          className='hidden sm:block rounded-full text-[12px]'
                          onClick={clearAllFilters}
                        >
                          Clear all
                        </Button>
                      )}
                      {activeFilters.length > 0 && (
                        <Button
                          variant='none'
                          size='icon'
                          className='sm:hidden'
                          onClick={clearAllFilters}
                        >
                          <Minus className='h-4 w-4' />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
                <div className='overflow-y-auto h-full bg-background hide-scrollbar'>
                  <div>
                    {/* Content Type Section */}
                    <div className='border-b border-almostblack dark:border-white sm:py-2 pb-4'>
                      <div className='pl-2 space-y-2'>
                        {availableTypes.map(type => {
                          const { label, icon: Icon } = typeLabels[type as ContentType];
                          return (
                            <button
                              key={type}
                              onClick={() => handleFilterToggle({ type: 'types', slug: type })}
                              className={cn(
                                'uppercase font-mono gap-3 rounded-full flex items-center px-3 py-2',
                                activeFilters.includes(type)
                                  ? 'bg-accent text-accent-foreground'
                                  : 'hover:bg-accent/100 hover:text-white hover:cursor-pointer'
                              )}
                            >
                              <Icon className='h-4 w-4' />
                              <span className='text-m8 leading-none'>{label} </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    {/* Tags Section */}
                    <div
                      className={`${selectedType === 'episodes' && results.length > 0 ? 'border-b border-almostblack dark:border-white' : ''} py-3`}
                    >
                      <div className='pl-2 space-y-1'>
                        {tags.map(tag => {
                          // For episodes, extract just the title part for display
                          const displayTitle =
                            selectedType === 'episodes' && tag.includes('|')
                              ? tag.split('|')[0]
                              : tag;

                          return (
                            <button
                              key={tag}
                              onClick={() => handleFilterToggle({ type: 'tags', slug: tag })}
                              className={cn(
                                'uppercase font-mono text-m8 gap-2 rounded-full flex text-left items-start w-fit px-3 py-2',
                                activeFilters.includes(tag)
                                  ? 'bg-accent text-accent-foreground'
                                  : 'hover:bg-accent/100 hover:text-white hover:cursor-pointer'
                              )}
                            >
                              <span className='text-m8 leading-none'>{displayTitle}</span>
                              {activeFilters.includes(tag) && <X className='h-3 w-3' />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Main Content Section */}
            <div
              className={cn(
                'flex-1 w-full justify-left flex-col min-w-0 overflow-hidden transition-all duration-200',
                'sm:static absolute h-full left-0',
                // On mobile: hide results if showFilters is true, always show on desktop
                !showFilters ? 'translate-x-0' : 'translate-x-full',
                'sm:translate-x-0'
              )}
              style={{
                display:
                  typeof window !== 'undefined' && window.innerWidth >= 640
                    ? 'block'
                    : !showFilters
                      ? 'block'
                      : 'none',
              }}
            >
              {/* Desktop search bar (mobile: already at top) */}
              <div className='hidden sm:block border-b shrink-0 w-full z-10'>
                <form
                  onSubmit={e => {
                    e.preventDefault();
                    setPage(1);
                    setHasNext(true);
                    setResults([]);
                  }}
                  className='flex gap-2'
                >
                  <div className='px-4 h-10 items-center flex flex-1'>
                    <Search className='h-4 w-4 text-muted-foreground' />
                    <Input
                      ref={searchInputRef}
                      placeholder='Search'
                      className='border-none pl-4 font-mono text-m8 uppercase focus-visible:ring-0'
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                    />
                  </div>
                </form>
              </div>

              {/* Results Section */}
              <ScrollArea
                className='flex-1 w-full hide-scrollbar min-h-0 h-[calc(100%-2.5rem)]'
                ref={scrollAreaRef}
              >
                <div className='p-8 space-y-6 min-h-0'>
                  {results.length > 0 ? (
                    <>
                      {results.map((result, idx) => {
                        const TypeIcon =
                          typeLabels[selectedType as keyof typeof typeLabels]?.icon || Music2;
                        const typeLabel =
                          typeLabels[selectedType as keyof typeof typeLabels]?.label || 'Content';

                        // Determine the correct link based on content type
                        let linkHref = '';
                        switch (selectedType) {
                          case 'episodes':
                            linkHref = `/episode/${result.slug}`;
                            break;
                          case 'posts':
                            linkHref = `/editorial/${result.slug}`;
                            break;
                          case 'videos':
                            linkHref = `/videos/${result.slug}`;
                            break;
                          case 'events':
                            linkHref = `/events/${result.slug}`;
                            break;
                          case 'takeovers':
                            linkHref = `/takeovers/${result.slug}`;
                            break;
                          default:
                            linkHref = `/episode/${result.slug}`;
                        }

                        // Enhanced image handling for videos (YouTube/Vimeo thumbnails)
                        let imageUrl =
                          result.metadata?.image?.imgix_url ||
                          result.metadata?.image?.url ||
                          '/image-placeholder.png';

                        if (selectedType === 'videos' && result.metadata?.video_url) {
                          const youtubeThumbnail = getYouTubeThumbnail(result.metadata.video_url);
                          const vimeoThumbnail = getVimeoThumbnail(result.metadata.video_url);
                          imageUrl =
                            result.metadata?.image?.imgix_url ||
                            youtubeThumbnail ||
                            vimeoThumbnail ||
                            '/image-placeholder.png';
                        }

                        return (
                          <Link
                            key={`${result.id}-${result.slug}-${idx}`}
                            href={linkHref}
                            onClick={() => onOpenChange(false)}
                            className='group block w-full'
                          >
                            <div className='flex items-start gap-6 w-full pb-6'>
                              <div className='size-32 relative shrink-0 overflow-hidden'>
                                <Image
                                  src={imageUrl}
                                  alt={result.title || 'Content Cover'}
                                  fill
                                  className='object-cover transition-opacity duration-200 group-hover:opacity-70'
                                />
                              </div>
                              <div className='flex-1 flex flex-col font-mono uppercase min-w-0 h-32 pb-1 justify-between gap-2'>
                                <div className='flex flex-col gap-.5'>
                                  <div className='flex items-center gap-2 text-m8 text-muted-foreground mb-1'>
                                    <TypeIcon className='w-3 h-3 text-foreground' />
                                    <span>{typeLabel}</span>
                                  </div>
                                  <h3 className='w-[90%] pl-1 text-[16px] sm:text-[18px] font-mono line-clamp-2'>
                                    {result.title}
                                  </h3>
                                </div>
                                <div className='flex flex-col gap-2'>
                                  {/* Date display - different fields for different content types */}
                                  {(result.metadata?.broadcast_date ||
                                    result.metadata?.date ||
                                    result.created_at) && (
                                    <span className='pl-1 text-m8'>
                                      {format(
                                        new Date(
                                          result.metadata?.broadcast_date ||
                                            result.metadata?.date ||
                                            result.created_at
                                        ),
                                        'MMM d, yyyy'
                                      )}
                                    </span>
                                  )}

                                  {/* Categories/Tags display - different for different content types */}
                                  {selectedType === 'episodes' &&
                                    Array.isArray(result.metadata?.genres) &&
                                    result.metadata.genres.length > 0 && (
                                      <div className='flex flex-row sm:flex-wrap'>
                                        {result.metadata.genres.map((genre: any) => (
                                          <Badge
                                            key={genre.id}
                                            variant='outline'
                                            className='text-m8 uppercase'
                                          >
                                            {genre.title}
                                          </Badge>
                                        ))}
                                      </div>
                                    )}

                                  {(selectedType === 'posts' || selectedType === 'videos') &&
                                    Array.isArray(result.metadata?.categories) &&
                                    result.metadata.categories.length > 0 && (
                                      <div className='flex flex-row sm:flex-wrap'>
                                        {result.metadata.categories.map((category: any) => (
                                          <Badge
                                            key={category.id}
                                            variant='outline'
                                            className='text-m8 uppercase'
                                          >
                                            {category.title}
                                          </Badge>
                                        ))}
                                      </div>
                                    )}

                                  {selectedType === 'takeovers' &&
                                    Array.isArray(result.metadata?.hosts) &&
                                    result.metadata.hosts.length > 0 && (
                                      <div className='flex flex-row sm:flex-wrap'>
                                        {result.metadata.hosts.map((host: any) => (
                                          <Badge
                                            key={host.id}
                                            variant='outline'
                                            className='text-m8 uppercase'
                                          >
                                            {host.title}
                                          </Badge>
                                        ))}
                                      </div>
                                    )}
                                </div>
                              </div>
                            </div>
                            {idx < results.length - 1 && (
                              <div className='border-b border-default w-full' />
                            )}
                          </Link>
                        );
                      })}
                      {/* Sentinel for Intersection Observer infinite scroll */}
                      <div
                        ref={observerTarget}
                        className='h-8 w-full flex items-center justify-center py-4'
                      >
                        {isLoadingMore && <Loader className='h-4 w-4 animate-spin' />}
                      </div>
                    </>
                  ) : (
                    <div className='flex flex-col items-center justify-center uppercase py-12 text-center'>
                      {isLoading ? (
                        <>
                          <Loader className='h-6 w-6 animate-spin mb-4' />
                          <p className='text-muted-foregroun font-mono text-m8'>Searching...</p>
                        </>
                      ) : debouncedSearchTerm ? (
                        <>
                          <AlertCircle className='h-6 w-6 mb-4 text-muted-foreground' />
                          <p className='text-muted-foreground font-mono text-m8'>
                            No results found
                          </p>
                        </>
                      ) : (
                        <>
                          <FileQuestion className='h-6 w-6 mb-4 text-muted-foreground' />
                          <p className='text-muted-foreground font-mono text-m8'>
                            Start typing to search
                          </p>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

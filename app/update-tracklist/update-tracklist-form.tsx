'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { getEpisodeImageUrl, type EpisodeObject } from '@/lib/cosmic-types';
import type { GenreObject } from '@/lib/cosmic-config';
import { fetchGenres } from '@/lib/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dropzone } from '@/components/ui/dropzone';
import {
  Command,
  CommandInput,
  CommandList,
  CommandItem,
  CommandEmpty,
} from '@/components/ui/command';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { compressImage } from '@/lib/image-compression';
import { buildShowImageFilename } from '@/lib/upload-filename-utils';

interface ImageUploadResponse {
  success?: boolean;
  media?: {
    name?: string;
  };
  error?: string;
}

function htmlTracklistToPlainText(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function UpdateTracklistForm() {
  const [broadcastDate, setBroadcastDate] = useState('');
  const [episodes, setEpisodes] = useState<EpisodeObject[]>([]);
  const [selectedEpisode, setSelectedEpisode] = useState<EpisodeObject | null>(null);
  const [episodeInput, setEpisodeInput] = useState('');
  const [isEpisodesOpen, setIsEpisodesOpen] = useState(false);
  const [isLoadingEpisodes, setIsLoadingEpisodes] = useState(false);
  const [tracklist, setTracklist] = useState('');
  const [genres, setGenres] = useState<GenreObject[]>([]);
  const [selectedGenreIds, setSelectedGenreIds] = useState<string[]>([]);
  const [genreInput, setGenreInput] = useState('');
  const [isGenresOpen, setIsGenresOpen] = useState(false);
  const [isLoadingGenres, setIsLoadingGenres] = useState(true);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchEpisodesByDate = useCallback(async (date: string) => {
    if (!date) {
      setEpisodes([]);
      setSelectedEpisode(null);
      setEpisodeInput('');
      setTracklist('');
      setSelectedGenreIds([]);
      setGenreInput('');
      setImageFile(null);
      return;
    }
    setIsLoadingEpisodes(true);
    try {
      const res = await fetch(`/api/episodes/by-date?date=${date}&includeDrafts=true`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch');
      setEpisodes(data.episodes || []);
      setSelectedEpisode(null);
      setEpisodeInput('');
      setTracklist('');
      setSelectedGenreIds([]);
      setGenreInput('');
      setImageFile(null);
    } catch (err) {
      console.error('Failed to fetch episodes:', err);
      toast.error('Failed to load episodes for this date');
      setEpisodes([]);
      setSelectedEpisode(null);
      setTracklist('');
      setSelectedGenreIds([]);
      setGenreInput('');
      setImageFile(null);
    } finally {
      setIsLoadingEpisodes(false);
    }
  }, []);

  useEffect(() => {
    if (broadcastDate) {
      fetchEpisodesByDate(broadcastDate);
    } else {
      setEpisodes([]);
      setSelectedEpisode(null);
      setTracklist('');
      setSelectedGenreIds([]);
      setGenreInput('');
      setImageFile(null);
    }
  }, [broadcastDate, fetchEpisodesByDate]);

  useEffect(() => {
    const loadGenres = async () => {
      try {
        const result = await fetchGenres();
        if (!result.success) {
          throw new Error('Genre request failed');
        }
        setGenres(result.genres as GenreObject[]);
      } catch (error) {
        console.error('Failed to load genres:', error);
        toast.error('Failed to load genres');
      } finally {
        setIsLoadingGenres(false);
      }
    };

    loadGenres();
  }, []);

  const matchingEpisodes = useMemo(
    () =>
      episodes.filter(
        ep => !episodeInput || ep.title?.toLowerCase().includes(episodeInput.toLowerCase())
      ),
    [episodeInput, episodes]
  );

  const matchingGenres = useMemo(() => {
    const normalizedInput = genreInput.trim().toLowerCase();
    return genres
      .filter(
        genre =>
          !selectedGenreIds.includes(genre.id) &&
          (!normalizedInput || genre.title.toLowerCase().includes(normalizedInput))
      )
      .slice(0, 50);
  }, [genreInput, genres, selectedGenreIds]);

  const handleEpisodeSelect = (ep: EpisodeObject) => {
    setSelectedEpisode(ep);
    setEpisodeInput(ep.title);
    setIsEpisodesOpen(false);
    setTracklist(htmlTracklistToPlainText(ep.metadata?.tracklist || ''));
    setSelectedGenreIds(ep.metadata?.genres?.map(genre => genre.id) || []);
    setGenreInput('');
    setImageFile(null);
  };

  const handleGenreSelect = (genreId: string) => {
    setSelectedGenreIds(currentIds =>
      currentIds.includes(genreId) ? currentIds : [...currentIds, genreId]
    );
    setGenreInput('');
    setIsGenresOpen(false);
  };

  const handleSubmit = async () => {
    if (!selectedEpisode) {
      toast.error('Please select a show first');
      return;
    }

    if (!tracklist.trim()) {
      toast.error('Please enter a tracklist');
      return;
    }

    setIsSubmitting(true);
    try {
      let imageName: string | undefined;

      if (imageFile) {
        const fileToUpload =
          imageFile.size > 2 * 1024 * 1024 ? await compressImage(imageFile, 2, 2000) : imageFile;
        const imageFormData = new FormData();
        imageFormData.append('image', fileToUpload);
        imageFormData.append(
          'fileName',
          buildShowImageFilename(broadcastDate, selectedEpisode.title, fileToUpload.name)
        );

        const imageResponse = await fetch('/api/upload-image', {
          method: 'POST',
          body: imageFormData,
        });
        const imageData = (await imageResponse.json()) as ImageUploadResponse;

        if (!imageResponse.ok || !imageData.success || !imageData.media?.name) {
          throw new Error(imageData.error || 'Failed to upload image');
        }

        imageName = imageData.media.name;
      }

      const res = await fetch(`/api/episodes/${selectedEpisode.id}/tracklist`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tracklist,
          slug: selectedEpisode.slug,
          genreIds: selectedGenreIds,
          imageName,
        }),
      });

      const text = await res.text();
      const data = (() => {
        try {
          return JSON.parse(text) as { success?: boolean; error?: string };
        } catch {
          return { error: text || 'Failed to update show' };
        }
      })();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update show');
      }

      toast.success('Show updates saved');
      setSelectedEpisode(null);
      setEpisodeInput('');
      setTracklist('');
      setSelectedGenreIds([]);
      setGenreInput('');
      setImageFile(null);
    } catch (err) {
      console.error('Show update failed:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to update show');
    } finally {
      setIsSubmitting(false);
    }
  };

  const showPageUrl = selectedEpisode
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/episode/${selectedEpisode.slug}`
    : '';

  return (
    <div className='space-y-6'>
      <div className='space-y-2'>
        <Label htmlFor='broadcast-date'>Broadcast date</Label>
        <Input
          id='broadcast-date'
          type='date'
          value={broadcastDate}
          onChange={e => setBroadcastDate(e.target.value)}
          disabled={isSubmitting}
        />
      </div>

      {broadcastDate && (
        <div className='space-y-2'>
          <Label>Select show</Label>
          <Command
            className='w-full border border-input rounded-none relative'
            shouldFilter={false}
          >
            <CommandInput
              placeholder={isLoadingEpisodes ? 'Loading...' : 'Search shows on this date'}
              value={episodeInput}
              onValueChange={v => {
                setEpisodeInput(v);
                setIsEpisodesOpen(true);
              }}
              onFocus={() => setIsEpisodesOpen(true)}
              disabled={isLoadingEpisodes || isSubmitting}
            />
            {isEpisodesOpen && (
              <CommandList onClickOutside={() => setIsEpisodesOpen(false)}>
                {matchingEpisodes.length === 0 ? (
                  <CommandEmpty>No shows found</CommandEmpty>
                ) : (
                  matchingEpisodes.map(ep => (
                    <CommandItem
                      key={ep.id}
                      value={ep.id}
                      onSelect={() => handleEpisodeSelect(ep)}
                      className='cursor-pointer'
                    >
                      {ep.title}
                      {ep.metadata?.broadcast_time && (
                        <span className='ml-2 text-muted-foreground'>
                          {ep.metadata.broadcast_time}
                        </span>
                      )}
                      {ep.status === 'draft' && (
                        <span className='ml-2 text-muted-foreground'>(draft)</span>
                      )}
                    </CommandItem>
                  ))
                )}
              </CommandList>
            )}
          </Command>
        </div>
      )}

      {selectedEpisode && (
        <div className='space-y-4 border border-input p-4'>
          <h3 className='text-h7 font-display uppercase'>Show preview</h3>
          <div className='flex gap-4'>
            <img
              src={getEpisodeImageUrl(selectedEpisode)}
              alt=''
              className='size-24 object-cover'
            />
            <div className='flex-1 min-w-0'>
              <p className='font-medium'>{selectedEpisode.title}</p>
              <p className='text-sm text-muted-foreground'>
                {selectedEpisode.metadata?.broadcast_date}{' '}
                {selectedEpisode.metadata?.broadcast_time}
                {selectedEpisode.status === 'draft' ? ' · draft' : ''}
              </p>
              <p className='text-sm text-muted-foreground truncate' title={showPageUrl}>
                {showPageUrl}
              </p>
            </div>
          </div>
        </div>
      )}

      {selectedEpisode && (
        <div className='space-y-2'>
          <Label htmlFor='music-genres'>Music genres</Label>
          <Command
            className='w-full border border-input rounded-none relative'
            shouldFilter={false}
          >
            <CommandInput
              id='music-genres'
              placeholder={isLoadingGenres ? 'Loading genres...' : 'Search genres'}
              value={genreInput}
              onValueChange={value => {
                setGenreInput(value);
                setIsGenresOpen(true);
              }}
              onFocus={() => setIsGenresOpen(true)}
              disabled={isLoadingGenres || isSubmitting}
            />
            {isGenresOpen && (
              <CommandList onClickOutside={() => setIsGenresOpen(false)}>
                {matchingGenres.length === 0 ? (
                  <CommandEmpty>No genres found</CommandEmpty>
                ) : (
                  matchingGenres.map(genre => (
                    <CommandItem
                      key={genre.id}
                      value={genre.id}
                      onSelect={() => handleGenreSelect(genre.id)}
                      className='cursor-pointer'
                    >
                      {genre.title}
                    </CommandItem>
                  ))
                )}
              </CommandList>
            )}
          </Command>
          {selectedGenreIds.length > 0 && (
            <div className='flex flex-wrap gap-2'>
              {selectedGenreIds.map(genreId => {
                const genre = genres.find(item => item.id === genreId);
                return (
                  <Badge key={genreId} variant='secondary' className='flex items-center gap-1'>
                    {genre?.title || genreId}
                    <button
                      type='button'
                      onClick={() =>
                        setSelectedGenreIds(currentIds =>
                          currentIds.filter(currentId => currentId !== genreId)
                        )
                      }
                      disabled={isSubmitting}
                      aria-label={`Remove ${genre?.title || 'genre'}`}
                    >
                      <X className='size-3' />
                    </button>
                  </Badge>
                );
              })}
            </div>
          )}
          <p className='text-sm text-muted-foreground'>
            Add or remove the genres that best describe this show.
          </p>
        </div>
      )}

      {selectedEpisode && (
        <div className='space-y-2'>
          <Label htmlFor='show-image'>Replace show image</Label>
          <Dropzone
            id='show-image'
            accept='image/jpeg,image/jpg,image/png,image/webp'
            disabled={isSubmitting}
            onFileSelect={setImageFile}
            selectedFile={imageFile}
            maxSize={5 * 1024 * 1024}
            placeholder='Drag and drop a new show image here'
            showImagePreview
          />
          <p className='text-sm text-muted-foreground'>
            Optional. Upload a square JPG, PNG, or WebP up to 5MB. The current image remains unless
            you choose a new one.
          </p>
        </div>
      )}

      {selectedEpisode && (
        <div className='space-y-2'>
          <Label htmlFor='tracklist'>Tracklist</Label>
          <Textarea
            id='tracklist'
            placeholder={'Artist - Track [Label]\nArtist - Track [Label]'}
            rows={12}
            value={tracklist}
            onChange={e => setTracklist(e.target.value)}
            disabled={isSubmitting}
            className='font-mono text-sm'
          />
          <p className='text-sm text-muted-foreground'>
            One track per line. If a tracklist is already saved, it will be prefilled so you can
            edit it.
          </p>
        </div>
      )}

      <div className='flex justify-end'>
        <Button
          onClick={handleSubmit}
          disabled={!selectedEpisode || !tracklist.trim() || isSubmitting}
        >
          {isSubmitting ? 'Saving...' : 'Save show updates'}
        </Button>
      </div>
    </div>
  );
}

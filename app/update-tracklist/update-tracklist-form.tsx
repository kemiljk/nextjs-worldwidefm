'use client';

import { useState, useEffect, useCallback } from 'react';
import { EpisodeObject, getEpisodeImageUrl } from '@/lib/cosmic-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Command,
  CommandInput,
  CommandList,
  CommandItem,
  CommandEmpty,
} from '@/components/ui/command';
import { toast } from 'sonner';

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
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchEpisodesByDate = useCallback(async (date: string) => {
    if (!date) {
      setEpisodes([]);
      setSelectedEpisode(null);
      setEpisodeInput('');
      setTracklist('');
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
    } catch (err) {
      console.error('Failed to fetch episodes:', err);
      toast.error('Failed to load episodes for this date');
      setEpisodes([]);
      setSelectedEpisode(null);
      setTracklist('');
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
    }
  }, [broadcastDate, fetchEpisodesByDate]);

  const matchingEpisodes = episodes.filter(
    ep => !episodeInput || ep.title?.toLowerCase().includes(episodeInput.toLowerCase())
  );

  const handleEpisodeSelect = (ep: EpisodeObject) => {
    setSelectedEpisode(ep);
    setEpisodeInput(ep.title);
    setIsEpisodesOpen(false);
    setTracklist(htmlTracklistToPlainText(ep.metadata?.tracklist || ''));
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
      const res = await fetch(`/api/episodes/${selectedEpisode.id}/tracklist`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tracklist,
          slug: selectedEpisode.slug,
        }),
      });

      const text = await res.text();
      const data = (() => {
        try {
          return JSON.parse(text) as { success?: boolean; error?: string };
        } catch {
          return { error: text || 'Failed to update tracklist' };
        }
      })();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update tracklist');
      }

      toast.success('Tracklist saved');
      setSelectedEpisode(null);
      setEpisodeInput('');
      setTracklist('');
    } catch (err) {
      console.error('Tracklist update failed:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to update tracklist');
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
          {isSubmitting ? 'Saving...' : 'Save tracklist'}
        </Button>
      </div>
    </div>
  );
}

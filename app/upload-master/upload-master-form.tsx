'use client';

import { useState, useEffect, useCallback } from 'react';
import { EpisodeObject, getEpisodeImageUrl } from '@/lib/cosmic-types';
import { buildRawMediaFilename } from '@/lib/upload-filename-utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dropzone } from '@/components/ui/dropzone';
import {
  Command,
  CommandInput,
  CommandList,
  CommandItem,
  CommandEmpty,
} from '@/components/ui/command';
import { toast } from 'sonner';
import { upload } from '@vercel/blob/client';

const MAX_MEDIA_MB = Number(process.env.NEXT_PUBLIC_MAX_MEDIA_UPLOAD_MB || 700);

type SubmissionPhase =
  | 'idle'
  | 'uploadingRadioCult'
  | 'uploadingMixcloud'
  | 'updatingEpisode'
  | 'success'
  | 'error';

export function UploadMasterForm() {
  const [broadcastDate, setBroadcastDate] = useState('');
  const [episodes, setEpisodes] = useState<EpisodeObject[]>([]);
  const [selectedEpisode, setSelectedEpisode] = useState<EpisodeObject | null>(null);
  const [episodeInput, setEpisodeInput] = useState('');
  const [isEpisodesOpen, setIsEpisodesOpen] = useState(false);
  const [isLoadingEpisodes, setIsLoadingEpisodes] = useState(false);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<SubmissionPhase>('idle');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchEpisodesByDate = useCallback(async (date: string) => {
    if (!date) {
      setEpisodes([]);
      setSelectedEpisode(null);
      setEpisodeInput('');
      return;
    }
    setIsLoadingEpisodes(true);
    try {
      const res = await fetch(`/api/episodes/by-date?date=${date}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch');
      setEpisodes(data.episodes || []);
      setSelectedEpisode(null);
      setEpisodeInput('');
    } catch (err) {
      console.error('Failed to fetch episodes:', err);
      toast.error('Failed to load episodes for this date');
      setEpisodes([]);
      setSelectedEpisode(null);
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
    }
  }, [broadcastDate, fetchEpisodesByDate]);

  const matchingEpisodes = episodes.filter(
    ep => !episodeInput || ep.title?.toLowerCase().includes(episodeInput.toLowerCase())
  );

  const showPageUrl = selectedEpisode
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/episode/${selectedEpisode.slug}`
    : '';

  const handleSubmit = async () => {
    if (!selectedEpisode || !mediaFile) {
      toast.error('Please select a show and add mastered audio');
      return;
    }

    const { broadcast_date, broadcast_time, duration } = selectedEpisode.metadata || {};
    const dateStr = broadcast_date || broadcastDate;

    if (!dateStr) {
      toast.error('Show has no broadcast date');
      return;
    }

    setIsSubmitting(true);
    setPhase('uploadingRadioCult');

    let radiocultMediaId: string | undefined;
    let mixcloudUrl: string | undefined;

    try {
      const mediaFileName = buildRawMediaFilename(dateStr, selectedEpisode.title, mediaFile.name);

      const blob = await upload(mediaFileName, mediaFile, {
        access: 'public',
        handleUploadUrl: '/api/upload-media/token',
      });

      const mediaFormData = new FormData();
      mediaFormData.append('mediaUrl', blob.url);
      mediaFormData.append('fileName', mediaFileName);
      mediaFormData.append(
        'metadata',
        JSON.stringify({
          title: selectedEpisode.title,
          artist: selectedEpisode.metadata?.regular_hosts?.[0]?.title || undefined,
        })
      );

      const uploadRes = await fetch('/api/upload-media', {
        method: 'POST',
        body: mediaFormData,
      });
      const uploadResult = await uploadRes.json();

      if (!uploadRes.ok || !uploadResult.success) {
        throw new Error(uploadResult.error || 'RadioCult upload failed');
      }
      radiocultMediaId = uploadResult.radiocultMediaId;

      toast.success('RadioCult upload complete');

      setPhase('uploadingMixcloud');
      const mixcloudRes = await fetch('/api/upload-mixcloud', {
        method: 'POST',
        body: (() => {
          const fd = new FormData();
          fd.append('audio', mediaFile);
          fd.append('episodeId', selectedEpisode.id);
          fd.append('title', `${selectedEpisode.title} // ${formatDateForMixcloud(dateStr)}`);
          fd.append(
            'description',
            [selectedEpisode.metadata?.description || '', '', '', `Tracklist: ${showPageUrl}`].join(
              '\n'
            )
          );
          const img =
            selectedEpisode.metadata?.external_image_url ||
            selectedEpisode.metadata?.image?.imgix_url;
          if (img) fd.append('imageUrl', img);
          fd.append('broadcastDate', dateStr);
          fd.append('broadcastTime', broadcast_time || '');
          fd.append('duration', duration || '');
          return fd;
        })(),
      });

      const mixcloudData = await mixcloudRes.json();
      if (mixcloudRes.ok && mixcloudData.url) {
        mixcloudUrl = mixcloudData.url;
        toast.success('Mixcloud upload complete');
      } else {
        toast.warning('Mixcloud upload skipped or failed', {
          description: mixcloudData.error || 'Check Mixcloud API configuration',
        });
      }

      setPhase('updatingEpisode');
      const updateRes = await fetch(`/api/episodes/${selectedEpisode.id}/archive`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          radiocult_media_id: radiocultMediaId,
          player: mixcloudUrl || undefined,
          page_link: mixcloudUrl || undefined,
        }),
      });

      if (!updateRes.ok) {
        const err = await updateRes.json();
        throw new Error(err.error || 'Failed to update episode');
      }

      setPhase('success');
      toast.success('Mastered audio uploaded and episode updated');
      setSelectedEpisode(null);
      setMediaFile(null);
      setEpisodeInput('');
    } catch (err) {
      setPhase('error');
      console.error('Upload failed:', err);
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsSubmitting(false);
    }
  };

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
                      onSelect={() => {
                        setSelectedEpisode(ep);
                        setEpisodeInput(ep.title);
                        setIsEpisodesOpen(false);
                      }}
                      className='cursor-pointer'
                    >
                      {ep.title}
                      {ep.metadata?.broadcast_time && (
                        <span className='ml-2 text-muted-foreground'>
                          {ep.metadata.broadcast_time}
                        </span>
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
        <div className='space-y-4 rounded border border-input p-4'>
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
              </p>
              <p className='text-sm text-muted-foreground truncate' title={showPageUrl}>
                {showPageUrl}
              </p>
              {selectedEpisode.metadata?.description && (
                <p className='text-sm mt-2 line-clamp-2'>{selectedEpisode.metadata.description}</p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className='space-y-2'>
        <Label>Mastered audio</Label>
        <Dropzone
          accept='audio/mpeg,audio/mp3,audio/wav,audio/m4a,audio/aac,audio/flac,audio/ogg'
          onFileSelect={setMediaFile}
          selectedFile={mediaFile}
          maxSize={MAX_MEDIA_MB * 1024 * 1024}
          placeholder='Drag and drop mastered MP3 here'
          disabled={isSubmitting}
        />
      </div>

      <div className='flex justify-end'>
        <Button onClick={handleSubmit} disabled={!selectedEpisode || !mediaFile || isSubmitting}>
          {isSubmitting
            ? phase === 'uploadingRadioCult'
              ? 'Uploading to RadioCult...'
              : phase === 'uploadingMixcloud'
                ? 'Uploading to Mixcloud...'
                : phase === 'updatingEpisode'
                  ? 'Updating episode...'
                  : 'Processing...'
            : 'Upload mastered audio'}
        </Button>
      </div>
    </div>
  );
}

function formatDateForMixcloud(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  if (!d || !m || !y) return dateStr;
  return `${d.padStart(2, '0')}-${m.padStart(2, '0')}-${y.slice(-2)}`;
}

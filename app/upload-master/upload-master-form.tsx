'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { EpisodeObject, getEpisodeImageUrl } from '@/lib/cosmic-types';
import { CosmicHost, getCosmicHosts } from '@/lib/cosmic-host-service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dropzone } from '@/components/ui/dropzone';
import {
  Command,
  CommandInput,
  CommandList,
  CommandItem,
  CommandEmpty,
} from '@/components/ui/command';
import { Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { upload } from '@vercel/blob/client';
import { buildMediaMetadataTitle, buildTemporaryMediaBlobPath } from '@/lib/upload-filename-utils';

const MAX_MEDIA_MB = Number(process.env.NEXT_PUBLIC_MAX_MEDIA_UPLOAD_MB || 2048);

type SubmissionPhase =
  | 'idle'
  | 'uploadingBlob'
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
  const [hosts, setHosts] = useState<CosmicHost[]>([]);
  const [selectedCoHostIds, setSelectedCoHostIds] = useState<string[]>([]);
  const [coHostInput, setCoHostInput] = useState('');
  const [isCoHostListOpen, setIsCoHostListOpen] = useState(false);

  useEffect(() => {
    getCosmicHosts().then(setHosts).catch(console.error);
  }, []);

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
      setSelectedCoHostIds([]);
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

  useEffect(() => {
    if (!selectedEpisode) {
      setSelectedCoHostIds([]);
      return;
    }

    const existingHostIds =
      selectedEpisode.metadata?.regular_hosts?.map(host => host.id).filter(Boolean) ?? [];
    setSelectedCoHostIds(existingHostIds);
  }, [selectedEpisode]);

  const matchingEpisodes = episodes.filter(
    ep => !episodeInput || ep.title?.toLowerCase().includes(episodeInput.toLowerCase())
  );

  const matchingCoHosts = useMemo(() => {
    const lowerInput = coHostInput.toLowerCase();
    return hosts.filter(host => {
      if (!host.title) return false;
      if (selectedCoHostIds.includes(host.id)) return false;
      return !lowerInput || host.title.toLowerCase().includes(lowerInput);
    });
  }, [hosts, coHostInput, selectedCoHostIds]);

  const selectedCoHosts = useMemo(
    () =>
      selectedCoHostIds
        .map(id => hosts.find(host => host.id === id))
        .filter((host): host is CosmicHost => Boolean(host)),
    [hosts, selectedCoHostIds]
  );

  const showPageUrl = selectedEpisode
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/episode/${selectedEpisode.slug}`
    : '';

  const handleCoHostSelect = (host: CosmicHost) => {
    setSelectedCoHostIds(prev => (prev.includes(host.id) ? prev : [...prev, host.id]));
    setCoHostInput('');
    setIsCoHostListOpen(false);
  };

  const handleCoHostRemove = (hostId: string) => {
    setSelectedCoHostIds(prev => prev.filter(id => id !== hostId));
  };

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

    if (mediaFile.size > MAX_MEDIA_MB * 1024 * 1024) {
      toast.error(
        `Selected audio file is ${(mediaFile.size / 1024 / 1024).toFixed(1)}MB which exceeds the ${MAX_MEDIA_MB}MB limit.`
      );
      return;
    }

    setIsSubmitting(true);
    setPhase('uploadingBlob');

    let radiocultMediaId: string | undefined;
    let mixcloudUrl: string | undefined;

    const mixcloudHostUsernames = selectedCoHosts
      .map(host => host.metadata?.mixcloud_username?.trim().replace(/^@/, '') || '')
      .filter(Boolean);

    const combinedHostIds = Array.from(new Set(selectedCoHostIds));

    try {
      const blob = await upload(buildTemporaryMediaBlobPath(mediaFile.name), mediaFile, {
        access: 'public',
        handleUploadUrl: '/api/upload-media/token',
      });

      setPhase('uploadingMixcloud');
      const mixcloudRes = await fetch('/api/upload-mixcloud', {
        method: 'POST',
        body: (() => {
          const fd = new FormData();
          fd.append('mediaUrl', blob.url);
          fd.append('fileName', mediaFile.name);
          fd.append('cleanup', 'false');
          fd.append('episodeId', selectedEpisode.id);
          fd.append('title', `${selectedEpisode.title} // ${formatDateForMixcloud(dateStr)}`);
          fd.append('tags', JSON.stringify(buildMixcloudTags(selectedEpisode)));
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
          if (mixcloudHostUsernames.length > 0) {
            fd.append('hosts', JSON.stringify(mixcloudHostUsernames));
          }
          fd.append('broadcastDate', dateStr);
          fd.append('broadcastTime', broadcast_time || '');
          fd.append('duration', duration || '');
          return fd;
        })(),
      });

      const mixcloudText = await mixcloudRes.text();
      const mixcloudData = (() => {
        try {
          return JSON.parse(mixcloudText) as { url?: string; error?: string; details?: unknown };
        } catch {
          return { error: mixcloudText || 'Mixcloud upload failed' };
        }
      })();

      if (!mixcloudRes.ok || !mixcloudData.url) {
        const detailText = mixcloudData.details ? ` ${JSON.stringify(mixcloudData.details)}` : '';
        throw new Error(`${mixcloudData.error || 'Mixcloud upload failed'}${detailText}`);
      }

      mixcloudUrl = mixcloudData.url;
      toast.success('Mixcloud upload complete');

      setPhase('uploadingRadioCult');
      const mediaFormData = new FormData();
      mediaFormData.append('mediaUrl', blob.url);
      mediaFormData.append('fileName', mediaFile.name);
      mediaFormData.append('cleanup', 'true');
      mediaFormData.append(
        'metadata',
        JSON.stringify({
          title: buildMediaMetadataTitle(mediaFile.name),
          artist:
            selectedCoHosts[0]?.title ||
            selectedEpisode.metadata?.regular_hosts?.[0]?.title ||
            undefined,
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

      setPhase('updatingEpisode');
      const updateRes = await fetch(`/api/episodes/${selectedEpisode.id}/archive`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          radiocult_media_id: radiocultMediaId,
          player: mixcloudUrl || undefined,
          page_link: mixcloudUrl || undefined,
          regular_hosts: combinedHostIds,
        }),
      });

      if (!updateRes.ok) {
        const updateText = await updateRes.text();
        const updateError = (() => {
          try {
            return JSON.parse(updateText) as { error?: string };
          } catch {
            return { error: updateText };
          }
        })();
        throw new Error(updateError.error || 'Failed to update episode');
      }

      setPhase('success');
      toast.success('Mastered audio uploaded and episode updated');
      setSelectedEpisode(null);
      setMediaFile(null);
      setEpisodeInput('');
      setSelectedCoHostIds([]);
      setCoHostInput('');
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

      {selectedEpisode && (
        <div className='space-y-2'>
          <Label>Co-hosts</Label>
          <Command
            className='w-full border border-input rounded-none relative'
            shouldFilter={false}
          >
            <CommandInput
              placeholder='Search hosts to add as co-hosts'
              value={coHostInput}
              onValueChange={value => {
                setCoHostInput(value);
                setIsCoHostListOpen(true);
              }}
              onFocus={() => setIsCoHostListOpen(true)}
              disabled={isSubmitting}
            />
            {coHostInput && isCoHostListOpen && (
              <CommandList onClickOutside={() => setIsCoHostListOpen(false)}>
                {matchingCoHosts.length === 0 ? (
                  <CommandEmpty>No hosts found</CommandEmpty>
                ) : (
                  matchingCoHosts.slice(0, 50).map(host => (
                    <CommandItem
                      key={host.id}
                      value={host.id}
                      onSelect={() => handleCoHostSelect(host)}
                      className='cursor-pointer'
                    >
                      {host.title}
                      {host.metadata?.mixcloud_username && (
                        <span className='ml-2 text-muted-foreground'>
                          @{host.metadata.mixcloud_username}
                        </span>
                      )}
                    </CommandItem>
                  ))
                )}
              </CommandList>
            )}
          </Command>
          {selectedCoHosts.length > 0 && (
            <div className='flex flex-wrap gap-1 mt-2'>
              {selectedCoHosts.map(host => (
                <Badge key={host.id} variant='secondary' className='flex items-center gap-1'>
                  {host.title}
                  {!isSubmitting && (
                    <X
                      className='h-3 w-3 cursor-pointer'
                      onClick={() => handleCoHostRemove(host.id)}
                    />
                  )}
                </Badge>
              ))}
            </div>
          )}
          <p className='text-sm text-muted-foreground'>
            Hosts with a Mixcloud username will be tagged on the Mixcloud upload (max 2). All
            selected hosts are saved to the episode page.
          </p>
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

      {selectedEpisode && mediaFile && <UploadProgressPanel phase={phase} />}

      <div className='flex justify-end'>
        <Button onClick={handleSubmit} disabled={!selectedEpisode || !mediaFile || isSubmitting}>
          {isSubmitting
            ? phase === 'uploadingBlob'
              ? 'Preparing upload...'
              : phase === 'uploadingRadioCult'
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

function buildMixcloudTags(episode: EpisodeObject): string[] {
  const tags = [...(episode.metadata?.genres?.map(genre => genre.title) ?? []), 'Radio'];

  return Array.from(new Set(tags.map(tag => tag.trim()).filter(Boolean))).slice(0, 5);
}

function UploadProgressPanel({ phase }: { phase: SubmissionPhase }) {
  const steps: { phase: SubmissionPhase; label: string; description: string }[] = [
    {
      phase: 'uploadingBlob',
      label: 'Preparing audio',
      description: 'Uploading the file once so the server can send it on.',
    },
    {
      phase: 'uploadingMixcloud',
      label: 'Publishing to Mixcloud',
      description: 'This is usually the slowest part for large mastered files.',
    },
    {
      phase: 'uploadingRadioCult',
      label: 'Sending to RadioCult',
      description: 'Adding the mastered file to the playout library.',
    },
    {
      phase: 'updatingEpisode',
      label: 'Updating the episode',
      description: 'Saving the Mixcloud player and RadioCult media ID.',
    },
  ];

  const currentIndex = steps.findIndex(step => step.phase === phase);

  return (
    <div className='border border-neutral-300 bg-transparent p-4'>
      <p className='text-sm font-medium'>
        {phase === 'idle'
          ? 'Ready to upload'
          : phase === 'error'
            ? 'Upload stopped'
            : 'Upload in progress'}
      </p>
      <div className='mt-3 space-y-3'>
        {steps.map((step, index) => {
          const isDone = currentIndex > index || phase === 'success';
          const isActive = currentIndex === index;

          return (
            <div key={step.phase} className='flex gap-3 text-sm'>
              <span
                className={[
                  'relative mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border font-mono text-[11px] font-medium leading-[0] tabular-nums',
                  isDone
                    ? 'border-foreground bg-foreground text-background'
                    : isActive
                      ? 'border-foreground bg-background'
                      : 'border-muted-foreground/40 text-muted-foreground',
                ].join(' ')}
              >
                {isDone ? (
                  <Check aria-hidden='true' className='size-3.5 stroke-[2.5]' />
                ) : (
                  <span className='absolute left-1/2 top-1/2 block -translate-x-1/2 -translate-y-1/2 leading-[0]'>
                    {index + 1}
                  </span>
                )}
              </span>
              <span className='min-w-0'>
                <span className='block font-medium'>{step.label}</span>
                <span className='block text-muted-foreground'>{step.description}</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

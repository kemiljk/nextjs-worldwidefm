'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useId,
  useRef,
  useState,
} from 'react';
import { EpisodeObject, getEpisodeImageUrl } from '@/lib/cosmic-types';
import type { CosmicHost } from '@/lib/cosmic-host-service';
import { fetchFormHosts } from '@/lib/actions/form-options';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Dropzone } from '@/components/ui/dropzone';
import {
  Command,
  CommandInput,
  CommandList,
  CommandItem,
  CommandEmpty,
} from '@/components/ui/command';
import { Check, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { buildMediaMetadataTitle, buildTemporaryMediaBlobPath } from '@/lib/upload-filename-utils';
import { getMaxMediaUploadMb } from '@/lib/upload-config';
import {
  runUploadMasterFlow,
  buildUploadResultSummary,
  retryMasterToDrive,
  uploadFormOutcome,
  type UploadDestinationResult,
} from '@/lib/upload-master-flow';
import {
  MAX_MIXCLOUD_HOST_TAGS,
  extractSubmittedMixcloudUsernames,
  mixcloudHostUsernames,
  normalizeMixcloudUsername,
} from '@/lib/mixcloud-username';
import {
  runUploadQueue,
  summariseUploadQueue,
  type UploadJobHandle,
  type UploadJobResult,
  type UploadJobStatus,
} from '@/lib/upload-master-queue';
import {
  buildMixcloudDescription,
  buildMixcloudTags,
  formatDateForMixcloud,
} from '@/lib/upload-master-metadata';

const MAX_MEDIA_MB = getMaxMediaUploadMb();

type SubmissionPhase =
  | 'idle'
  | 'uploadingBlob'
  | 'uploadingRadioCult'
  | 'uploadingMixcloud'
  | 'uploadingDrive'
  | 'updatingEpisode'
  | 'success'
  | 'error';

interface UploadMasterJobProps {
  /** 1-based position in the queue; the first job keeps the original element ids. */
  jobNumber: number;
  /** Show a header with status and a remove button (only when several shows are queued). */
  showHeader: boolean;
  driveEnabled: boolean;
  driveAccessKey: string;
  initialBroadcastDate: string;
  /** Only one upload may run at a time across the whole page. */
  acquireUploadLock(): boolean;
  releaseUploadLock(): void;
  /** True while a different show is uploading. */
  waitingForOtherUpload: boolean;
  onStatusChange(status: UploadJobStatus, broadcastDate: string): void;
  onRemove?(): void;
}

const STATUS_LABELS: Record<UploadJobStatus, string> = {
  empty: 'Not set up',
  ready: 'Ready',
  uploading: 'Uploading',
  done: 'Uploaded',
  warning: 'Uploaded with warnings',
  failed: 'Failed',
};

const UploadMasterJob = forwardRef<UploadJobHandle, UploadMasterJobProps>(function UploadMasterJob(
  {
    jobNumber,
    showHeader,
    driveEnabled,
    driveAccessKey,
    initialBroadcastDate,
    acquireUploadLock,
    releaseUploadLock,
    waitingForOtherUpload,
    onStatusChange,
    onRemove,
  },
  ref
) {
  const dateInputId = jobNumber === 1 ? 'broadcast-date' : `broadcast-date-${jobNumber}`;
  const [broadcastDate, setBroadcastDate] = useState(initialBroadcastDate);
  const [lastOutcome, setLastOutcome] = useState<UploadJobResult | null>(null);
  const [lastUploadedTitle, setLastUploadedTitle] = useState('');
  const [episodes, setEpisodes] = useState<EpisodeObject[]>([]);
  const [selectedEpisode, setSelectedEpisode] = useState<EpisodeObject | null>(null);
  const [episodeInput, setEpisodeInput] = useState('');
  const [isEpisodesOpen, setIsEpisodesOpen] = useState(false);
  const [isLoadingEpisodes, setIsLoadingEpisodes] = useState(false);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<SubmissionPhase>('idle');
  const [destinationResults, setDestinationResults] = useState<UploadDestinationResult[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [retainedBlobUrl, setRetainedBlobUrl] = useState<string | null>(null);
  const [pendingDrive, setPendingDrive] = useState<{
    blobUrl: string;
    fileName: string;
    broadcastDate: string;
    episodeId: string;
    canCleanup: boolean;
  } | null>(null);
  const [hosts, setHosts] = useState<CosmicHost[]>([]);
  const [selectedCoHostIds, setSelectedCoHostIds] = useState<string[]>([]);
  const [coHostInput, setCoHostInput] = useState('');
  const [isCoHostListOpen, setIsCoHostListOpen] = useState(false);
  const checkboxIdPrefix = useId();
  // Staff's ticks for usernames hosts typed into the submission form, by lowercase username.
  const [submittedTagChoices, setSubmittedTagChoices] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchFormHosts().then(setHosts).catch(console.error);
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
    setSubmittedTagChoices({});
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

  // Mixcloud only tags hosts with a username, and at most two per upload.
  const { untaggableHosts, overLimitHosts } = useMemo(() => {
    const hasUsername = (host: CosmicHost) =>
      Boolean(normalizeMixcloudUsername(host.metadata?.mixcloud_username));
    const withUsername = selectedCoHosts.filter(hasUsername);
    return {
      untaggableHosts: selectedCoHosts.filter(host => !hasUsername(host)),
      overLimitHosts: withUsername.slice(MAX_MIXCLOUD_HOST_TAGS),
    };
  }, [selectedCoHosts]);

  // Usernames from the submission form can be tagged too, so a host needs no Cosmic profile first.
  // A pasted mixcloud.com link is ticked for staff; a bare @name could be another platform, so
  // it starts unticked.
  const submittedUsernames = useMemo(
    () =>
      extractSubmittedMixcloudUsernames(selectedEpisode?.metadata?.mixcloud_submission_notes).map(
        entry => ({
          ...entry,
          checked: submittedTagChoices[entry.username.toLowerCase()] ?? entry.fromLink,
        })
      ),
    [selectedEpisode, submittedTagChoices]
  );
  const profileUsernames = useMemo(
    () => selectedCoHosts.map(host => host.metadata?.mixcloud_username),
    [selectedCoHosts]
  );
  const tagUsernames = useMemo(
    () =>
      mixcloudHostUsernames([
        ...profileUsernames,
        ...submittedUsernames.filter(entry => entry.checked).map(entry => entry.username),
      ]),
    [profileUsernames, submittedUsernames]
  );
  const droppedSubmittedUsernames = submittedUsernames.filter(
    entry =>
      entry.checked &&
      !tagUsernames.some(username => username.toLowerCase() === entry.username.toLowerCase())
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

  const resetUploadResults = () => {
    setDestinationResults([]);
    setPhase('idle');
    setLastOutcome(null);
  };

  const handleSubmit = async (): Promise<UploadJobResult> => {
    if (!selectedEpisode || !mediaFile) {
      toast.error('Please select a show and add mastered audio');
      return 'skipped';
    }
    if (driveEnabled && !driveAccessKey.trim()) {
      toast.error('Enter the staff access key for Google Drive');
      return 'skipped';
    }

    const { broadcast_date, broadcast_time, duration } = selectedEpisode.metadata || {};
    const dateStr = broadcast_date || broadcastDate;

    if (!dateStr) {
      toast.error('Show has no broadcast date');
      return 'skipped';
    }

    if (mediaFile.size > MAX_MEDIA_MB * 1024 * 1024) {
      toast.error(
        `Selected audio file is ${(mediaFile.size / 1024 / 1024).toFixed(1)}MB which exceeds the ${MAX_MEDIA_MB}MB limit.`
      );
      return 'skipped';
    }

    if (!acquireUploadLock()) {
      toast.error('Another show is uploading. Wait for it to finish, then try again.');
      return 'skipped';
    }

    setDestinationResults([]);
    setLastOutcome(null);
    setIsSubmitting(true);
    setPhase('uploadingBlob');

    const taggedUsernames = tagUsernames;

    const combinedHostIds = Array.from(new Set(selectedCoHostIds));

    try {
      if (driveEnabled) {
        const check = await fetch('/api/upload-drive', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${driveAccessKey}`,
          },
          body: JSON.stringify({ action: 'check' }),
        });
        if (!check.ok)
          throw new Error('Google Drive is unavailable or the staff access key is invalid');
      }
      const e2eBlobUrl = process.env.NEXT_PUBLIC_E2E_FAKE_BLOB_URL;
      const blobUrl =
        e2eBlobUrl ||
        (
          await (
            await import('@vercel/blob/client')
          ).upload(buildTemporaryMediaBlobPath(mediaFile.name), mediaFile, {
            access: 'public',
            handleUploadUrl: '/api/upload-media/token',
            multipart: true,
          })
        ).url;

      setPhase('uploadingMixcloud');
      const flowResult = await runUploadMasterFlow({
        blobUrl,
        mediaFileName: mediaFile.name,
        episodeId: selectedEpisode.id,
        episodeSlug: selectedEpisode.slug,
        mixcloudTitle: `${selectedEpisode.title} // ${formatDateForMixcloud(dateStr)}`,
        mixcloudTags: buildMixcloudTags(selectedEpisode),
        mixcloudDescription: buildMixcloudDescription(selectedEpisode, showPageUrl),
        mixcloudImageUrl:
          selectedEpisode.metadata?.external_image_url ||
          selectedEpisode.metadata?.image?.imgix_url,
        mixcloudHostUsernames: taggedUsernames,
        broadcastDate: dateStr,
        broadcastTime: broadcast_time || '',
        duration: duration || '',
        radiocultMetadata: {
          title: buildMediaMetadataTitle(mediaFile.name),
          artist:
            selectedCoHosts[0]?.title ||
            selectedEpisode.metadata?.regular_hosts?.[0]?.title ||
            undefined,
        },
        regularHostIds: combinedHostIds,
        driveAccessKey: driveEnabled ? driveAccessKey : undefined,
        onPhaseChange: setPhase,
        onDestinationResult: result => setDestinationResults(previous => [...previous, result]),
        clientTimeoutMs: process.env.NEXT_PUBLIC_E2E_UPLOAD_CLIENT_TIMEOUT_MS
          ? Number(process.env.NEXT_PUBLIC_E2E_UPLOAD_CLIENT_TIMEOUT_MS)
          : undefined,
      });

      const summary = buildUploadResultSummary(flowResult);
      if (flowResult.driveError) {
        setPendingDrive({
          blobUrl,
          fileName: mediaFile.name,
          broadcastDate: dateStr,
          episodeId: selectedEpisode.id,
          canCleanup: Boolean(
            flowResult.mixcloudUrl && flowResult.radiocultMediaId && flowResult.archiveUpdated
          ),
        });
      } else if (!flowResult.shouldCleanupBlob) {
        setRetainedBlobUrl(blobUrl);
      }
      const outcome = uploadFormOutcome(flowResult);
      if (outcome === 'failed') {
        throw new Error(summary);
      }
      setPhase('success');
      const uploadedTitle = selectedEpisode.title;
      const withTitle = (message: string) =>
        jobNumber > 1 || showHeader ? `${uploadedTitle}: ${message}` : message;
      if (outcome === 'complete') {
        toast.success(withTitle('Mastered audio uploaded and episode updated'));
      } else {
        toast.warning(withTitle(summary));
      }
      setLastUploadedTitle(uploadedTitle);
      setLastOutcome(outcome);
      setSelectedEpisode(null);
      setMediaFile(null);
      setEpisodeInput('');
      setSelectedCoHostIds([]);
      setCoHostInput('');
      return outcome;
    } catch (err) {
      setPhase('error');
      setLastOutcome('failed');
      console.error('Upload failed:', err);
      const message = err instanceof Error ? err.message : 'Upload failed';
      toast.error(showHeader ? `${selectedEpisode.title}: ${message}` : message);
      return 'failed';
    } finally {
      setIsSubmitting(false);
      releaseUploadLock();
    }
  };

  // The latest submit handler is exposed to the page's "upload all" queue.
  const submitRef = useRef(handleSubmit);
  submitRef.current = handleSubmit;
  useImperativeHandle(ref, () => ({ submit: () => submitRef.current() }), []);

  const status: UploadJobStatus = isSubmitting
    ? 'uploading'
    : lastOutcome === 'complete'
      ? 'done'
      : lastOutcome === 'partial'
        ? 'warning'
        : lastOutcome === 'failed'
          ? 'failed'
          : selectedEpisode && mediaFile
            ? 'ready'
            : 'empty';

  useEffect(() => {
    onStatusChange(status, broadcastDate);
    // The parent callback is stable per job; report only when these values change.
  }, [status, broadcastDate]);

  const retryDrive = async () => {
    if (!pendingDrive || !driveAccessKey.trim()) return;
    setIsSubmitting(true);
    try {
      const { cleanupFailed } = await retryMasterToDrive({
        ...pendingDrive,
        accessKey: driveAccessKey,
      });
      if (!pendingDrive.canCleanup || cleanupFailed) setRetainedBlobUrl(pendingDrive.blobUrl);
      setPendingDrive(null);
      setDestinationResults(previous =>
        previous.map(result =>
          result.destination === 'Google Drive'
            ? { destination: 'Google Drive', success: true }
            : result
        )
      );
      if (cleanupFailed) {
        toast.warning('Master archived to Google Drive; the temporary audio could not be deleted');
      } else {
        toast.success('Master archived to Google Drive');
      }
    } catch {
      toast.error('Google Drive upload could not be confirmed. Check the folder before retrying.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className={showHeader ? 'space-y-6 border border-input p-4' : 'space-y-6'}
      data-testid={`upload-job-${jobNumber}`}
    >
      {showHeader && (
        <div className='flex items-center justify-between gap-3'>
          <h2 className='text-h8 font-display uppercase'>Show {jobNumber}</h2>
          <div className='flex items-center gap-3'>
            <Badge variant={status === 'failed' ? 'destructive' : 'secondary'} role='status'>
              {STATUS_LABELS[status]}
            </Badge>
            {onRemove && !isSubmitting && (
              <button
                type='button'
                onClick={onRemove}
                className='inline-flex items-center gap-1 text-sm underline'
                aria-label={`Remove show ${jobNumber}`}
              >
                <X className='size-3.5' aria-hidden='true' /> Remove
              </button>
            )}
          </div>
        </div>
      )}
      <div className='space-y-2'>
        <Label htmlFor={dateInputId}>Broadcast date</Label>
        <Input
          id={dateInputId}
          type='date'
          value={broadcastDate}
          onChange={e => {
            resetUploadResults();
            setBroadcastDate(e.target.value);
          }}
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
                        resetUploadResults();
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
          {selectedEpisode.metadata?.mixcloud_submission_notes && (
            <div className='text-sm whitespace-pre-wrap'>
              <p className='font-medium'>Submitted Mixcloud details</p>
              <p>{selectedEpisode.metadata.mixcloud_submission_notes}</p>
              <p className='text-muted-foreground'>
                Use these details to update host profiles and select co-hosts below. Usernames
                written as @name or a Mixcloud link can be tagged straight from here.
              </p>
            </div>
          )}
          {submittedUsernames.length > 0 && (
            <fieldset className='space-y-2 text-sm' disabled={isSubmitting}>
              <legend className='font-medium'>Tag these Mixcloud usernames</legend>
              {submittedUsernames.map(entry => {
                const id = `${checkboxIdPrefix}-${entry.username}`;
                return (
                  <div key={entry.username} className='flex items-center gap-2'>
                    <Checkbox
                      id={id}
                      checked={entry.checked}
                      onCheckedChange={checked =>
                        setSubmittedTagChoices(prev => ({
                          ...prev,
                          [entry.username.toLowerCase()]: checked === true,
                        }))
                      }
                    />
                    <Label htmlFor={id} className='normal-case font-normal'>
                      @{entry.username}
                      {!entry.fromLink && (
                        <span className='text-muted-foreground'>
                          {' '}
                          (typed as @name, check it&apos;s their Mixcloud)
                        </span>
                      )}
                    </Label>
                  </div>
                );
              })}
            </fieldset>
          )}
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
                      {normalizeMixcloudUsername(host.metadata?.mixcloud_username) && (
                        <span className='ml-2 text-muted-foreground'>
                          @{normalizeMixcloudUsername(host.metadata?.mixcloud_username)}
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
            Hosts with a Mixcloud username will be tagged on the Mixcloud upload (max{' '}
            {MAX_MIXCLOUD_HOST_TAGS}). All selected hosts are saved to the episode page.
          </p>
          {(untaggableHosts.length > 0 ||
            overLimitHosts.length > 0 ||
            droppedSubmittedUsernames.length > 0) && (
            <div
              role='alert'
              className='border border-amber-500 bg-amber-50 p-3 text-sm space-y-1 dark:bg-amber-950'
            >
              {untaggableHosts.length > 0 && (
                <p>
                  Won&apos;t be tagged on Mixcloud — no valid Mixcloud username in Cosmic:{' '}
                  {untaggableHosts.map(host => host.title).join(', ')}. Add one on the host in
                  Cosmic, then reload this page.
                </p>
              )}
              {droppedSubmittedUsernames.length > 0 && (
                <p>
                  Won&apos;t be tagged — Mixcloud allows {MAX_MIXCLOUD_HOST_TAGS} hosts per upload:{' '}
                  {droppedSubmittedUsernames.map(entry => `@${entry.username}`).join(', ')}.
                </p>
              )}
              {overLimitHosts.length > 0 && (
                <p>
                  Won&apos;t be tagged — Mixcloud allows {MAX_MIXCLOUD_HOST_TAGS} hosts per upload:{' '}
                  {overLimitHosts.map(host => host.title).join(', ')}.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <div className='space-y-2'>
        <Label>Mastered audio</Label>
        <Dropzone
          accept='audio/mpeg,audio/mp3,audio/wav,audio/m4a,audio/aac,audio/flac,audio/ogg'
          onFileSelect={file => {
            resetUploadResults();
            setMediaFile(file);
          }}
          selectedFile={mediaFile}
          maxSize={MAX_MEDIA_MB * 1024 * 1024}
          placeholder='Drag and drop mastered MP3 here'
          disabled={isSubmitting}
        />
      </div>

      {pendingDrive && (
        <div className='space-y-2 text-sm' role='status'>
          <p>
            The master is still available for Google Drive. Check the Drive folder before retrying.
          </p>
          <a
            className='underline break-all'
            href={pendingDrive.blobUrl}
            target='_blank'
            rel='noopener noreferrer'
          >
            Open retained audio
          </a>
          <div>
            <Button
              type='button'
              variant='outline'
              onClick={retryDrive}
              disabled={isSubmitting || !driveAccessKey.trim()}
            >
              Retry Google Drive only
            </Button>
          </div>
        </div>
      )}

      {retainedBlobUrl && (
        <div className='space-y-2 text-sm' role='status'>
          <p>The temporary audio is still retained.</p>
          <a
            className='underline break-all'
            href={retainedBlobUrl}
            target='_blank'
            rel='noopener noreferrer'
          >
            Open retained audio
          </a>
        </div>
      )}

      {selectedEpisode && mediaFile && (
        <UploadProgressPanel
          phase={phase}
          results={destinationResults}
          driveEnabled={driveEnabled}
        />
      )}

      {lastUploadedTitle && lastOutcome && lastOutcome !== 'skipped' && !isSubmitting && (
        <p className='text-sm font-medium'>
          {lastOutcome === 'failed' ? 'Upload failed' : 'Last upload'}: {lastUploadedTitle}
        </p>
      )}

      <div role='status' aria-live='polite' className='space-y-1 text-sm'>
        {destinationResults.map(result => (
          <p key={result.destination}>
            {result.destination}:{' '}
            {result.success ? 'uploaded' : `failed (${result.error || 'Upload failed'})`}
          </p>
        ))}
      </div>

      <div className='flex justify-end'>
        <Button
          type='button'
          onClick={handleSubmit}
          disabled={
            !selectedEpisode ||
            !mediaFile ||
            isSubmitting ||
            waitingForOtherUpload ||
            Boolean(pendingDrive)
          }
        >
          {waitingForOtherUpload && !isSubmitting
            ? 'Waiting for the current upload...'
            : isSubmitting
              ? phase === 'uploadingBlob'
                ? 'Preparing upload...'
                : phase === 'uploadingRadioCult'
                  ? 'Uploading to RadioCult...'
                  : phase === 'uploadingMixcloud'
                    ? 'Uploading to Mixcloud...'
                    : phase === 'uploadingDrive'
                      ? 'Archiving to Google Drive...'
                      : phase === 'updatingEpisode'
                        ? 'Updating episode...'
                        : 'Processing...'
              : 'Upload mastered audio'}
        </Button>
      </div>
    </div>
  );
});

interface QueuedJob {
  id: string;
  number: number;
}

/**
 * Several mastered shows can be set up on one page. Each has its own status and
 * result, and uploads run strictly one at a time so none can start while another
 * is still running.
 */
export function UploadMasterForm({ driveEnabled = false }: { driveEnabled?: boolean }) {
  const nextNumber = useRef(2);
  const [jobs, setJobs] = useState<QueuedJob[]>([{ id: 'job-1', number: 1 }]);
  const [statuses, setStatuses] = useState<Record<string, UploadJobStatus>>({});
  const [dates, setDates] = useState<Record<string, string>>({});
  const [driveAccessKey, setDriveAccessKey] = useState('');
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [isRunningQueue, setIsRunningQueue] = useState(false);
  const activeJobRef = useRef<string | null>(null);
  const handles = useRef(new Map<string, UploadJobHandle>());
  const unmounted = useRef(false);

  // Reset on mount too: React Strict Mode runs the cleanup once before the real mount.
  useEffect(() => {
    unmounted.current = false;
    return () => {
      unmounted.current = true;
    };
  }, []);

  // Leaving the page mid-upload would abandon it; ask first.
  useEffect(() => {
    if (!activeJobId) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [activeJobId]);

  const acquireLock = (id: string) => {
    if (activeJobRef.current && activeJobRef.current !== id) return false;
    activeJobRef.current = id;
    setActiveJobId(id);
    return true;
  };
  const releaseLock = (id: string) => {
    if (activeJobRef.current !== id) return;
    activeJobRef.current = null;
    setActiveJobId(null);
  };

  const addJob = () => {
    const lastId = jobs[jobs.length - 1]?.id;
    const number = nextNumber.current++;
    setJobs(previous => [...previous, { id: `job-${number}`, number }]);
    // Shows usually share a broadcast date; start the new one on the same day.
    if (lastId) {
      setDates(previous => ({ ...previous, [`job-${number}`]: previous[lastId] || '' }));
    }
  };

  const removeJob = (id: string) => {
    setJobs(previous => previous.filter(job => job.id !== id));
    handles.current.delete(id);
  };

  const readyJobs = jobs.filter(job => statuses[job.id] === 'ready');
  const statusList = jobs.map(job => statuses[job.id] ?? 'empty');
  const multiple = jobs.length > 1;

  const uploadAll = async () => {
    if (isRunningQueue || activeJobRef.current) return;
    setIsRunningQueue(true);
    try {
      const results = await runUploadQueue(
        readyJobs.map(job => ({ id: job.id, getHandle: () => handles.current.get(job.id) })),
        { shouldStop: () => unmounted.current }
      );
      const values = Object.values(results);
      const failed = values.filter(result => result === 'failed').length;
      const skipped = values.filter(result => result === 'skipped').length;
      if (failed + skipped > 0) {
        toast.warning(
          `${failed} failed${skipped ? `, ${skipped} not started` : ''}. Check each show below.`
        );
      }
    } finally {
      setIsRunningQueue(false);
    }
  };

  return (
    <div className='space-y-6'>
      {driveEnabled && (
        <div className='space-y-2'>
          <Label htmlFor='drive-access-key'>Staff access key</Label>
          <Input
            id='drive-access-key'
            type='password'
            autoComplete='off'
            value={driveAccessKey}
            onChange={event => setDriveAccessKey(event.target.value)}
            disabled={Boolean(activeJobId)}
          />
        </div>
      )}

      {jobs.map(job => (
        <UploadMasterJob
          key={job.id}
          ref={handle => {
            if (handle) handles.current.set(job.id, handle);
            else handles.current.delete(job.id);
          }}
          jobNumber={job.number}
          showHeader={multiple}
          driveEnabled={driveEnabled}
          driveAccessKey={driveAccessKey}
          initialBroadcastDate={dates[job.id] ?? ''}
          acquireUploadLock={() => acquireLock(job.id)}
          releaseUploadLock={() => releaseLock(job.id)}
          waitingForOtherUpload={Boolean(activeJobId) && activeJobId !== job.id}
          onStatusChange={(status, broadcastDate) => {
            setStatuses(previous =>
              previous[job.id] === status ? previous : { ...previous, [job.id]: status }
            );
            setDates(previous =>
              previous[job.id] === broadcastDate
                ? previous
                : { ...previous, [job.id]: broadcastDate }
            );
          }}
          onRemove={multiple ? () => removeJob(job.id) : undefined}
        />
      ))}

      <div className='flex flex-wrap items-center justify-between gap-3'>
        <Button type='button' variant='outline' onClick={addJob} disabled={Boolean(activeJobId)}>
          <Plus className='size-4' aria-hidden='true' /> Add another show
        </Button>
        {multiple && (
          <Button
            type='button'
            onClick={uploadAll}
            disabled={readyJobs.length === 0 || Boolean(activeJobId) || isRunningQueue}
          >
            {isRunningQueue ? 'Uploading shows one by one...' : `Upload ${readyJobs.length} ready`}
          </Button>
        )}
      </div>

      {multiple && (
        <p role='status' aria-live='polite' className='text-sm' data-testid='upload-queue-summary'>
          {summariseUploadQueue(statusList)}
        </p>
      )}
    </div>
  );
}

function UploadProgressPanel({
  phase,
  results,
  driveEnabled,
}: {
  phase: SubmissionPhase;
  results: UploadDestinationResult[];
  driveEnabled: boolean;
}) {
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
    ...(driveEnabled
      ? [
          {
            phase: 'uploadingDrive' as const,
            label: 'Archiving to Google Drive',
            description: 'Saving the master in its broadcast-month folder.',
          },
        ]
      : []),
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
          const destination =
            step.phase === 'uploadingMixcloud'
              ? 'Mixcloud'
              : step.phase === 'uploadingRadioCult'
                ? 'RadioCult'
                : step.phase === 'uploadingDrive'
                  ? 'Google Drive'
                  : undefined;
          const result = results.find(item => item.destination === destination);
          const isDone = destination
            ? result?.success === true
            : currentIndex > index || phase === 'success';
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
                {result && !result.success ? (
                  <X aria-hidden='true' className='size-3.5' />
                ) : isDone ? (
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

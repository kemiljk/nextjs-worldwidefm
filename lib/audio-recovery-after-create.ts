import {
  notifyAudioRecovery,
  type AudioRecoveryNotificationInput,
} from '@/lib/audio-recovery-notification';

type CreatedEpisode = {
  id: string;
  slug: string;
};

type PendingAudioRecovery = Pick<AudioRecoveryNotificationInput, 'failureCode' | 'fileName'>;

type CompleteAudioRecoveryInput = {
  episode: CreatedEpisode;
  showTitle: string;
  mediaUrl?: string;
  pendingRecovery?: PendingAudioRecovery;
  storedWithSubmission: boolean;
};

type Notify = (input: AudioRecoveryNotificationInput) => Promise<{ notified: boolean }>;

export async function completeAudioRecoveryAfterCreate(
  input: CompleteAudioRecoveryInput,
  notify: Notify = notifyAudioRecovery
): Promise<{ storedWithSubmission: boolean; teamNotified: boolean } | undefined> {
  if (!input.mediaUrl || !input.pendingRecovery) return undefined;

  const notification = await notify({
    episodeId: input.episode.id,
    episodeSlug: input.episode.slug,
    showTitle: input.showTitle,
    mediaUrl: input.mediaUrl,
    fileName: input.pendingRecovery.fileName,
    failureCode: input.pendingRecovery.failureCode,
    storedWithSubmission: input.storedWithSubmission,
  });

  return {
    storedWithSubmission: input.storedWithSubmission,
    teamNotified: notification.notified,
  };
}

/// <reference types="bun-types" />
import { describe, expect, it } from 'bun:test';
import { completeAudioRecoveryAfterCreate } from '@/lib/audio-recovery-after-create';
import type { AudioRecoveryNotificationInput } from '@/lib/audio-recovery-notification';

describe('completeAudioRecoveryAfterCreate', () => {
  it('returns confirmed storage and notification state with the created episode reference', async () => {
    const notifications: AudioRecoveryNotificationInput[] = [];
    const mediaUrl =
      'https://example.public.blob.vercel-storage.com/media/raw20260902-morning-show.mp3';

    const result = await completeAudioRecoveryAfterCreate(
      {
        episode: { id: 'episode-123', slug: 'morning-show-123' },
        showTitle: 'Morning Show',
        mediaUrl,
        pendingRecovery: {
          failureCode: 'storage_full',
          fileName: 'raw20260902 Morning Show.mp3',
        },
        storedWithSubmission: true,
      },
      async input => {
        notifications.push(input);
        return { notified: true };
      }
    );

    expect(notifications).toHaveLength(1);
    expect(notifications[0]?.episodeId).toBe('episode-123');
    expect(notifications[0]?.episodeSlug).toBe('morning-show-123');
    expect(notifications[0]?.mediaUrl).toBe(mediaUrl);
    expect(result).toEqual({
      storedWithSubmission: true,
      teamNotified: true,
    });
  });

  it('does not claim recovery or notify anyone without a retained audio URL', async () => {
    let notificationAttempted = false;

    const result = await completeAudioRecoveryAfterCreate(
      {
        episode: { id: 'episode-123', slug: 'morning-show-123' },
        showTitle: 'Morning Show',
        pendingRecovery: {
          failureCode: 'unknown',
          fileName: 'morning-show.mp3',
        },
        storedWithSubmission: false,
      },
      async () => {
        notificationAttempted = true;
        return { notified: true };
      }
    );

    expect(result).toBeUndefined();
    expect(notificationAttempted).toBe(false);
  });
});

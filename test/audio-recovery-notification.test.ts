/// <reference types="bun-types" />
import { describe, expect, it } from 'bun:test';
import {
  AUDIO_RECOVERY_EMAIL,
  notifyAudioRecovery,
  type AudioRecoveryEmail,
} from '@/lib/audio-recovery-notification';

describe('audio recovery notifications', () => {
  it('always routes recovery notifications to the WWFM info mailbox', async () => {
    const sent: AudioRecoveryEmail[] = [];

    await notifyAudioRecovery(
      {
        episodeId: 'episode-123',
        episodeSlug: 'morning-show-123',
        showTitle: 'Morning Show',
        mediaUrl: 'https://example.public.blob.vercel-storage.com/media/morning-show.mp3',
        fileName: 'morning-show.mp3',
        failureCode: 'storage_full',
        storedWithSubmission: true,
      },
      {
        env: { AUDIO_RECOVERY_EMAILS: 'someone-else@example.com' },
        send: async email => {
          sent.push(email);
        },
      }
    );

    expect(sent[0]?.to).toEqual([AUDIO_RECOVERY_EMAIL]);
  });

  it('sends key people the episode reference and retained audio location', async () => {
    const sent: AudioRecoveryEmail[] = [];
    const result = await notifyAudioRecovery(
      {
        episodeId: 'episode-123',
        episodeSlug: 'morning-show-123',
        showTitle: 'Morning Show',
        mediaUrl: 'https://example.public.blob.vercel-storage.com/media/morning-show.mp3',
        fileName: 'raw20260902 Morning Show.mp3',
        failureCode: 'storage_full',
        storedWithSubmission: true,
      },
      {
        env: {
          SUPPORT_EMAIL: 'noreply@worldwidefm.net',
          NEXT_PUBLIC_APP_NAME: 'Worldwide FM',
        },
        send: async email => {
          sent.push(email);
          return { error: null };
        },
      }
    );

    expect(result.notified).toBe(true);
    expect(sent).toHaveLength(1);
    expect(sent[0]?.to).toEqual(['info@worldwidefm.net']);
    expect(sent[0]?.subject).toContain('Morning Show');
    expect(sent[0]?.text).toContain('episode-123');
    expect(sent[0]?.text).toContain('morning-show-123');
    expect(sent[0]?.text).toContain('blob.vercel-storage.com');
    expect(sent[0]?.text).toContain('RadioCult storage is full');
    expect(sent[0]?.text).toContain('Link saved on the Cosmic episode: yes');
    expect(sent[0]?.text).toContain('Complete the RadioCult upload');
    expect(sent[0]?.text).toContain('do not need to upload it again');
  });

  it('reports that notification is unconfirmed when email is not configured', async () => {
    const result = await notifyAudioRecovery(
      {
        episodeId: 'episode-123',
        episodeSlug: 'morning-show-123',
        showTitle: 'Morning Show',
        mediaUrl: 'https://example.public.blob.vercel-storage.com/media/morning-show.mp3',
        fileName: 'morning-show.mp3',
        failureCode: 'unknown',
        storedWithSubmission: true,
      },
      { env: {} }
    );

    expect(result.notified).toBe(false);
  });

  it('does not hold the show submission open when the email provider stalls', async () => {
    const result = await notifyAudioRecovery(
      {
        episodeId: 'episode-123',
        episodeSlug: 'morning-show-123',
        showTitle: 'Morning Show',
        mediaUrl: 'https://example.public.blob.vercel-storage.com/media/morning-show.mp3',
        fileName: 'morning-show.mp3',
        failureCode: 'service_unavailable',
        storedWithSubmission: true,
      },
      {
        env: {},
        timeoutMs: 5,
        send: () => new Promise(() => {}),
      }
    );

    expect(result.notified).toBe(false);
  });
});

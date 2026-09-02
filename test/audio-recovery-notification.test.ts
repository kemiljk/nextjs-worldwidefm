/// <reference types="bun-types" />
import { describe, expect, it } from 'bun:test';
import {
  notifyAudioRecovery,
  parseAudioRecoveryRecipients,
  type AudioRecoveryEmail,
} from '@/lib/audio-recovery-notification';

describe('audio recovery notifications', () => {
  it('uses configured recipients without duplicates', () => {
    expect(
      parseAudioRecoveryRecipients(
        'programming@worldwidefm.net, ops@worldwidefm.net, programming@worldwidefm.net'
      )
    ).toEqual(['programming@worldwidefm.net', 'ops@worldwidefm.net']);
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
          AUDIO_RECOVERY_EMAILS: 'programming@worldwidefm.net,ops@worldwidefm.net',
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
    expect(sent[0]?.to).toEqual(['programming@worldwidefm.net', 'ops@worldwidefm.net']);
    expect(sent[0]?.subject).toContain('Morning Show');
    expect(sent[0]?.text).toContain('episode-123');
    expect(sent[0]?.text).toContain('morning-show-123');
    expect(sent[0]?.text).toContain('blob.vercel-storage.com');
    expect(sent[0]?.text).toContain('RadioCult storage is full');
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
        env: { AUDIO_RECOVERY_EMAILS: 'ops@worldwidefm.net' },
        timeoutMs: 5,
        send: () => new Promise(() => {}),
      }
    );

    expect(result.notified).toBe(false);
  });
});

import type { RadioCultFailureCode } from '@/lib/radiocult-failure';

export type AudioRecoveryNotificationInput = {
  episodeId: string;
  episodeSlug: string;
  showTitle: string;
  mediaUrl: string;
  fileName: string;
  failureCode: RadioCultFailureCode;
  storedWithSubmission: boolean;
};

export type AudioRecoveryEmail = {
  from: string;
  to: string[];
  subject: string;
  text: string;
};

type NotificationEnvironment = Record<string, string | undefined>;

type NotificationDependencies = {
  env?: NotificationEnvironment;
  send?: (email: AudioRecoveryEmail) => Promise<{ error?: unknown } | void>;
  timeoutMs?: number;
};

const DEFAULT_NOTIFICATION_TIMEOUT_MS = 8_000;
export const AUDIO_RECOVERY_EMAIL = 'info@worldwidefm.net';

export async function notifyAudioRecovery(
  input: AudioRecoveryNotificationInput,
  dependencies: NotificationDependencies = {}
): Promise<{ notified: boolean }> {
  const env = dependencies.env || process.env;
  const supportEmail = env.SUPPORT_EMAIL || 'noreply@worldwidefm.net';
  const appName = env.NEXT_PUBLIC_APP_NAME || 'Worldwide FM';
  let send = dependencies.send;

  const subjectTitle = input.showTitle.replace(/[\r\n]+/g, ' ').trim();
  const email: AudioRecoveryEmail = {
    from: `${appName} audio recovery <${supportEmail}>`,
    to: [AUDIO_RECOVERY_EMAIL],
    subject: `Audio needs attention: ${subjectTitle}`,
    text: [
      'A show has been submitted, but its automatic RadioCult upload did not finish.',
      '',
      'Submission details',
      `Show: ${input.showTitle}`,
      `Episode ID: ${input.episodeId}`,
      `Episode slug: ${input.episodeSlug}`,
      `Audio file: ${input.fileName}`,
      `Reason: ${failureLabel(input.failureCode)}`,
      '',
      'Audio recovery',
      `Direct audio link: ${input.mediaUrl}`,
      `Link saved on the Cosmic episode: ${input.storedWithSubmission ? 'yes' : 'no'}`,
      '',
      'What to do next',
      '1. Open or download the retained audio from the direct link above.',
      '2. Complete the RadioCult upload when the account is ready.',
      '3. Add the resulting RadioCult media ID to the Cosmic episode.',
      '4. Remove the recovery link only after the audio is safely attached in RadioCult.',
      '',
      'The host has been told that WWFM has the audio and that they do not need to upload it again.',
    ].join('\n'),
  };

  try {
    if (!send) {
      if (!env.RESEND_API_KEY) {
        console.error('[audio-recovery] RESEND_API_KEY is not configured; notification not sent');
        return { notified: false };
      }

      const { Resend } = await import('resend');
      const resend = new Resend(env.RESEND_API_KEY);
      send = message => resend.emails.send(message);
    }

    const result = await sendWithTimeout(
      send,
      email,
      dependencies.timeoutMs ?? DEFAULT_NOTIFICATION_TIMEOUT_MS
    );
    if (result && 'error' in result && result.error) {
      console.error('[audio-recovery] Email provider rejected the notification');
      return { notified: false };
    }

    return { notified: true };
  } catch (error) {
    console.error(
      '[audio-recovery] Notification failed:',
      error instanceof Error ? error.message : 'Unknown error'
    );
    return { notified: false };
  }
}

async function sendWithTimeout(
  send: NonNullable<NotificationDependencies['send']>,
  email: AudioRecoveryEmail,
  timeoutMs: number
): Promise<{ error?: unknown } | void> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      send(email),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error('Notification timed out')),
          Math.max(1, timeoutMs)
        );
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function failureLabel(code: RadioCultFailureCode): string {
  if (code === 'storage_full') return 'RadioCult storage is full';
  if (code === 'service_unavailable') return 'RadioCult was unavailable';
  if (code === 'upload_rejected') return 'RadioCult rejected the upload';
  return 'The automatic RadioCult upload did not finish';
}

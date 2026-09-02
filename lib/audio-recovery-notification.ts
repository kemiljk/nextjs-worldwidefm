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

export function parseAudioRecoveryRecipients(value?: string): string[] {
  const recipients = (value || 'info@worldwidefm.net')
    .split(',')
    .map(recipient => recipient.trim())
    .filter(Boolean);

  return [...new Set(recipients)];
}

export async function notifyAudioRecovery(
  input: AudioRecoveryNotificationInput,
  dependencies: NotificationDependencies = {}
): Promise<{ notified: boolean }> {
  const env = dependencies.env || process.env;
  const recipients = parseAudioRecoveryRecipients(env.AUDIO_RECOVERY_EMAILS);
  const supportEmail = env.SUPPORT_EMAIL || 'noreply@worldwidefm.net';
  const appName = env.NEXT_PUBLIC_APP_NAME || 'Worldwide FM';
  let send = dependencies.send;

  const subjectTitle = input.showTitle.replace(/[\r\n]+/g, ' ').trim();
  const email: AudioRecoveryEmail = {
    from: `${appName} audio recovery <${supportEmail}>`,
    to: recipients,
    subject: `Audio needs attention: ${subjectTitle}`,
    text: [
      'A show was submitted with audio that needs manual attention.',
      '',
      `Show: ${input.showTitle}`,
      `Episode ID: ${input.episodeId}`,
      `Episode slug: ${input.episodeSlug}`,
      `Audio file: ${input.fileName}`,
      `Audio location: ${input.mediaUrl}`,
      `Stored on Cosmic submission: ${input.storedWithSubmission ? 'yes' : 'no'}`,
      `Reason: ${failureLabel(input.failureCode)}`,
      '',
      'The host has been told not to upload the same file again.',
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

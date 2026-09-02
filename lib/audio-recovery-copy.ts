export type AudioRecoveryState = {
  audioReceived: boolean;
  storedWithSubmission: boolean;
  teamNotified: boolean;
};

export type AudioRecoveryCopy = {
  title: string;
  summary: string;
  detail: string;
  requiresHostAction: boolean;
};

export function getAudioRecoveryCopy(state: AudioRecoveryState): AudioRecoveryCopy {
  if (!state.audioReceived) {
    return {
      title: 'Show submitted — audio still needed',
      summary: "We received your show details, but didn't receive the audio file.",
      detail: 'Please send the audio to your usual Worldwide FM contact so they can add it.',
      requiresHostAction: true,
    };
  }

  if (!state.storedWithSubmission) {
    return {
      title: 'Show submitted — audio needs attention',
      summary: "We received your audio, but couldn't attach its location to the show submission.",
      detail: state.teamNotified
        ? "We've notified the Worldwide FM team and shared the audio location with them. You don't need to upload it again."
        : 'Please let your usual Worldwide FM contact know. The audio was received, so you do not need to upload it again.',
      requiresHostAction: !state.teamNotified,
    };
  }

  return {
    title: 'Show and audio received',
    summary: 'Your show has been submitted for approval, and the audio is stored with it.',
    detail: state.teamNotified
      ? "We couldn't finish processing the audio automatically, so we've notified the Worldwide FM team. You don't need to upload it again."
      : "We couldn't finish processing the audio automatically. Please let your usual Worldwide FM contact know; they can find it with your submission, and you don't need to upload it again.",
    requiresHostAction: !state.teamNotified,
  };
}

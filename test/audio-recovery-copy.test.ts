/// <reference types="bun-types" />
import { describe, expect, it } from 'bun:test';
import { getAudioRecoveryCopy } from '@/lib/audio-recovery-copy';

describe('getAudioRecoveryCopy', () => {
  it('reassures the host only when the audio is stored and the team was notified', () => {
    const copy = getAudioRecoveryCopy({
      audioReceived: true,
      storedWithSubmission: true,
      teamNotified: true,
    });

    expect(copy.title).toBe('Show and audio received');
    expect(copy.detail).toContain("we've notified the Worldwide FM team");
    expect(copy.detail).toContain("don't need to upload it again");
    expect(copy.requiresHostAction).toBe(false);
  });

  it('asks the host to contact WWFM when notification could not be confirmed', () => {
    const copy = getAudioRecoveryCopy({
      audioReceived: true,
      storedWithSubmission: true,
      teamNotified: false,
    });

    expect(copy.title).toBe('Show and audio received');
    expect(copy.detail).toContain('usual Worldwide FM contact');
    expect(copy.detail).not.toContain("we've notified");
    expect(copy.requiresHostAction).toBe(true);
  });

  it('does not claim the audio is stored when the submission could not retain its location', () => {
    const copy = getAudioRecoveryCopy({
      audioReceived: true,
      storedWithSubmission: false,
      teamNotified: false,
    });

    expect(copy.title).toBe('Show submitted — audio needs attention');
    expect(copy.summary).not.toContain('stored with your submission');
    expect(copy.requiresHostAction).toBe(true);
  });

  it('clearly asks for the file when the audio never reached temporary storage', () => {
    const copy = getAudioRecoveryCopy({
      audioReceived: false,
      storedWithSubmission: false,
      teamNotified: false,
    });

    expect(copy.title).toBe('Show submitted — audio still needed');
    expect(copy.summary).toContain("didn't receive the audio file");
    expect(copy.detail).toContain('send the audio');
    expect(copy.requiresHostAction).toBe(true);
  });
});

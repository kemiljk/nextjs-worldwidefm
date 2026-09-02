/// <reference types="bun-types" />
import { describe, expect, it } from 'bun:test';
import { describeRadioCultFailure } from '@/lib/radiocult-failure';

describe('describeRadioCultFailure', () => {
  it('classifies storage exhaustion without exposing the vendor response to hosts', () => {
    const failure = describeRadioCultFailure({
      status: 400,
      error:
        'RadioCult upload failed: {"success":false,"error":"You have exceeded all of your plan\'s available storage"}',
      radiocultError:
        '{"success":false,"error":"You have exceeded all of your plan\'s available storage"}',
    });

    expect(failure.code).toBe('storage_full');
    expect(failure.publicMessage).toBe("We couldn't finish processing your audio automatically.");
    expect(failure.publicMessage).not.toContain('RadioCult');
    expect(failure.publicMessage).not.toContain('storage');
    expect(failure.diagnosticMessage).toContain("plan's available storage");
  });

  it('classifies upstream failures with the same calm public message', () => {
    const failure = describeRadioCultFailure({
      status: 503,
      error: 'RadioCult upload failed: temporary outage',
      radiocultError: 'temporary outage',
    });

    expect(failure.code).toBe('service_unavailable');
    expect(failure.publicMessage).toBe("We couldn't finish processing your audio automatically.");
  });
});

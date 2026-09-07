import { describe, expect, test } from 'bun:test';
import { isCurrentRadioEvent } from '../lib/radio-event-time';

describe('live programme boundaries', () => {
  const event = { startTime: '2026-09-07T12:00:00Z', endTime: '2026-09-07T13:00:00Z' };
  test('does not announce future programmes early or retain finished programmes', () => {
    expect(isCurrentRadioEvent(event, Date.parse('2026-09-07T11:59:59Z'))).toBe(false);
    expect(isCurrentRadioEvent(event, Date.parse(event.startTime))).toBe(true);
    expect(isCurrentRadioEvent(event, Date.parse(event.endTime))).toBe(false);
    expect(isCurrentRadioEvent(event, Date.parse('2026-09-08T12:00:00Z'))).toBe(false);
  });
  test('bounds incomplete schedule metadata', () => {
    expect(isCurrentRadioEvent({ startTime: event.startTime }, Date.parse(event.endTime))).toBe(
      true
    );
    expect(
      isCurrentRadioEvent({ startTime: event.startTime }, Date.parse('2026-09-08T00:00:00Z'))
    ).toBe(false);
    expect(isCurrentRadioEvent({ startTime: 'invalid' }, Date.now())).toBe(false);
  });
});

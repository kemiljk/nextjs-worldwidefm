import { describe, expect, it } from 'bun:test';
import { getRecurringTemplates, parseRecurringTemplate } from '@/lib/create-weekly-shows';
import { getRecurringEpisodeBody } from '@/lib/recurring-shows';

describe('Cosmic recurring templates', () => {
  const object = {
    title: 'A weekly show',
    metadata: {
      host: 'host-id',
      day: 'Tuesday',
      start_time: '08:00',
      duration_hours: '1.5',
      description: 'New show copy',
    },
  };

  it('uses the editor’s show copy rather than the host biography', () => {
    const template = parseRecurringTemplate(object);
    expect(template.hostId).toBe('host-id');
    expect(template.durationHours).toBe(1.5);
    expect(getRecurringEpisodeBody(template, { description: 'Host biography' })).toBe(
      '<p>New show copy</p>'
    );
  });

  it('rejects invalid schedule details rather than creating the wrong episode', () => {
    expect(() =>
      parseRecurringTemplate({ ...object, metadata: { ...object.metadata, day: 'Tues' } })
    ).toThrow();
    expect(() =>
      parseRecurringTemplate({ ...object, metadata: { ...object.metadata, start_time: '25:00' } })
    ).toThrow();
    expect(() =>
      parseRecurringTemplate({ ...object, metadata: { ...object.metadata, host: null } })
    ).toThrow();
  });
});

describe('loading Cosmic recurring templates', () => {
  function clientFor(result: unknown, schemaError?: Error) {
    const chain = {
      props: () => chain,
      depth: () => chain,
      status: () => chain,
      limit: () => chain,
      skip: () => (result instanceof Error ? Promise.reject(result) : Promise.resolve(result)),
    };
    return {
      objectTypes: {
        findOne: async () => {
          if (schemaError) throw schemaError;
          return {};
        },
      },
      objects: { find: () => chain },
    } as unknown as Parameters<typeof getRecurringTemplates>[0];
  }

  it('returns no templates when none are published, allowing all shows to be paused', async () => {
    expect(await getRecurringTemplates(clientFor({ objects: [] }))).toEqual([]);
    const noObjects = Object.assign(new Error('no objects'), { status: 404 });
    expect(await getRecurringTemplates(clientFor(noObjects))).toEqual([]);
  });

  it('surfaces missing schema and service failures instead of falling back to old shows', async () => {
    const missingSchema = Object.assign(new Error('missing schema'), { status: 404 });
    await expect(getRecurringTemplates(clientFor({}, missingSchema))).rejects.toThrow(
      'missing schema'
    );
    await expect(
      getRecurringTemplates(clientFor(new Error('service unavailable')))
    ).rejects.toThrow('service unavailable');
  });
});

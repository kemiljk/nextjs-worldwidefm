import { describe, expect, it } from 'bun:test';
import { withCleanEpisodeTitles } from '@/lib/cosmic-clean-titles';

// A tiny stand-in for the SDK's query builder: methods return the builder, and it is thenable.
function fakeClient(objects: Record<string, unknown>[]) {
  const calls: string[] = [];
  const builder = {
    props() {
      calls.push('props');
      return builder;
    },
    depth() {
      calls.push('depth');
      return builder;
    },
    then(onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) {
      return Promise.resolve({ objects, total: objects.length }).then(onFulfilled, onRejected);
    },
  };
  const client = {
    objects: {
      find: (_query: unknown) => builder,
      findOne: (_query: unknown) => ({
        ...builder,
        then: (onFulfilled: (value: unknown) => unknown) =>
          Promise.resolve({ object: objects[0] }).then(onFulfilled),
      }),
      updateOne: async (id: string, data: unknown) => ({ id, data }),
    },
    other: 'value',
  };
  return { client, calls };
}

describe('withCleanEpisodeTitles', () => {
  it('cleans episode titles on find, however the chain is built', async () => {
    const { client, calls } = fakeClient([
      { title: 'Luke Una – 06.10.2026', metadata: { broadcast_date: '2026-10-06' } },
    ]);
    const cosmic = withCleanEpisodeTitles(client);

    const response = (await cosmic.objects
      .find({ type: 'episode' })
      .props('id,title')
      .depth(1)) as unknown as { objects: { title: string }[] };

    expect(response.objects[0].title).toBe('Luke Una');
    expect(calls).toEqual(['props', 'depth']);
  });

  it('cleans findOne and leaves other object types alone', async () => {
    const episode = fakeClient([{ title: 'Luke Una – 06.10.2026' }]);
    expect(
      ((await withCleanEpisodeTitles(episode.client).objects.findOne({ type: 'episode' })) as any)
        .object.title
    ).toBe('Luke Una');

    const post = fakeClient([{ title: 'Launch – 06.10.2026' }]);
    expect(
      ((await withCleanEpisodeTitles(post.client).objects.findOne({ type: 'posts' })) as any).object
        .title
    ).toBe('Launch – 06.10.2026');
  });

  it('passes writes and other properties straight through', async () => {
    const { client } = fakeClient([]);
    const cosmic = withCleanEpisodeTitles(client);

    expect(await cosmic.objects.updateOne('abc', { title: 'Luke Una – 06.10.2026' })).toEqual({
      id: 'abc',
      data: { title: 'Luke Una – 06.10.2026' },
    });
    expect(cosmic.other).toBe('value');
  });
});

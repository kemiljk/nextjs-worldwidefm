import { stripEpisodeTitleDates } from './episode-title';

type Query = Record<string, unknown> | undefined;

/** Wraps a Cosmic query builder so that awaiting it returns cleaned episode titles. */
function cleanedQuery<B extends object>(builder: B, query: Query): B {
  const proxy: B = new Proxy(builder, {
    get(target, property) {
      if (property === 'then') {
        return (
          onFulfilled?: (value: unknown) => unknown,
          onRejected?: (reason: unknown) => unknown
        ) =>
          (target as unknown as { then: (...args: unknown[]) => unknown }).then(
            (result: unknown) => {
              const cleaned = stripEpisodeTitleDates(result, query?.type);
              return onFulfilled ? onFulfilled(cleaned) : cleaned;
            },
            onRejected
          );
      }
      const value = Reflect.get(target, property, target);
      if (typeof value !== 'function') return value;
      // Builder methods (props, depth, limit...) return the builder itself; keep it wrapped.
      return (...args: unknown[]) => {
        const out = value.apply(target, args);
        return out === target ? proxy : out;
      };
    },
  });
  return proxy;
}

/**
 * Returns the client with `objects.find` and `objects.findOne` results run through
 * `stripEpisodeTitleDates`. Everything else (inserts, updates, media) passes straight through.
 */
export function withCleanEpisodeTitles<C extends { objects: object }>(client: C): C {
  const objects = new Proxy(client.objects, {
    get(target, property) {
      const value = Reflect.get(target, property, target);
      if (typeof value !== 'function') return value;
      if (property === 'find' || property === 'findOne') {
        return (query: Query, ...rest: unknown[]) =>
          cleanedQuery(value.call(target, query, ...rest), query);
      }
      return value.bind(target);
    },
  });

  return new Proxy(client, {
    get(target, property) {
      if (property === 'objects') return objects;
      const value = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

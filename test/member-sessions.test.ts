import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { MEMBER_SESSION_COOKIE, MEMBER_SESSION_LIFETIME_SECONDS } from '@/lib/member-session';

const cookieValues = new Map<string, string>();
const sessions = new Map<string, { id: string; slug: string; metadata: { expires_at: string } }>();
const account = {
  id: 'member-123',
  title: 'A Member',
  metadata: {
    email: 'a@example.test',
    password: 'password-hash',
    email_verified: true,
    active_status: true,
  },
};
let savedCookieOptions: Record<string, unknown> = {};

mock.module('next/headers', () => ({
  cookies: async () => ({
    get: (key: string) => (cookieValues.has(key) ? { value: cookieValues.get(key) } : undefined),
    set: (key: string, value: string, options: Record<string, unknown>) => {
      cookieValues.set(key, value);
      savedCookieOptions = options;
    },
    delete: (key: string) => cookieValues.delete(key),
  }),
}));
mock.module('next/cache', () => ({ unstable_noStore: () => {}, revalidateTag: () => {} }));
mock.module('bcryptjs', () => ({ default: { compare: async (p: string) => p === 'correct' } }));
mock.module('@/lib/get-canonical-genres', () => ({ getCanonicalGenres: async () => [] }));
mock.module('@/lib/schedule-service', () => ({
  getWeeklySchedule: async () => ({ scheduleItems: [] }),
}));
mock.module('@/lib/cosmic-config', () => ({
  cosmic: {
    objects: {
      findOne(query: { type?: string; id?: string; slug?: string }) {
        const chain = {
          props: () => chain,
          depth: async () => {
            const object =
              query.type === 'member-sessions'
                ? sessions.get(query.slug || '')
                : query.id && query.id !== account.id
                  ? null
                  : account;
            return { object };
          },
        };
        return chain;
      },
      async insertOne(input: { slug: string; metadata: { expires_at: string } }) {
        const object = { id: 'session-1', slug: input.slug, metadata: input.metadata };
        sessions.set(input.slug, object);
        return { object };
      },
      async updateOne(id: string, updates: { metadata: { expires_at: string } }) {
        const session = [...sessions.values()].find(item => item.id === id);
        if (!session) throw new Error('Missing session');
        session.metadata = updates.metadata;
        return { object: session };
      },
      async deleteOne(id: string) {
        const session = [...sessions.values()].find(item => item.id === id);
        if (session) sessions.delete(session.slug);
      },
    },
  },
}));

const { login, getAuthUser, getUserData, logoutUser, refreshMemberSession } = await import(
  '@/cosmic/blocks/user-management/actions'
);

async function signIn() {
  const form = new FormData();
  form.set('email', account.metadata.email);
  form.set('password', 'correct');
  return login(form);
}

describe('member sessions', () => {
  beforeEach(() => {
    cookieValues.clear();
    sessions.clear();
    account.metadata.password = 'password-hash';
  });

  it('rejects the old forgeable user ID cookie and persists an opaque session on login', async () => {
    cookieValues.set('user_id', account.id);
    expect(await getAuthUser()).toBeNull();
    expect((await signIn()).user?.id).toBe(account.id);
    expect(cookieValues.has('user_id')).toBe(false);
    expect(savedCookieOptions.httpOnly).toBe(true);
    expect(savedCookieOptions.sameSite).toBe('lax');
    expect(savedCookieOptions.maxAge).toBe(MEMBER_SESSION_LIFETIME_SECONDS);
    expect(await getAuthUser()).toMatchObject({ id: account.id });
    const token = cookieValues.get(MEMBER_SESSION_COOKIE)!;
    expect([...sessions.keys()][0]).not.toContain(token);
  });

  it('revokes the session at logout, including replayed cookies', async () => {
    await signIn();
    const token = cookieValues.get(MEMBER_SESSION_COOKIE)!;
    await logoutUser();
    cookieValues.set(MEMBER_SESSION_COOKIE, token);
    expect(await getAuthUser()).toBeNull();
  });

  it('invalidates sessions after a password change and rejects altered user IDs', async () => {
    await signIn();
    const token = cookieValues.get(MEMBER_SESSION_COOKIE)!;
    cookieValues.set(MEMBER_SESSION_COOKIE, token.replace(account.id, 'other-member'));
    expect(await getAuthUser()).toBeNull();
    cookieValues.set(MEMBER_SESSION_COOKIE, token);
    account.metadata.password = 'new-password-hash';
    expect(await getAuthUser()).toBeNull();
  });

  it('renews sessions near expiry and keeps private account metadata out of responses', async () => {
    await signIn();
    const session = [...sessions.values()][0];
    session.metadata.expires_at = new Date(Date.now() + 60_000).toISOString();
    await refreshMemberSession();
    expect(Date.parse(session.metadata.expires_at)).toBeGreaterThan(Date.now() + 300 * 86400_000);
    const result = await getUserData(account.id);
    expect(result.data?.metadata.password).toBeUndefined();
    expect((await getUserData('other-member')).error).toBe('Unauthorized');
  });
});
